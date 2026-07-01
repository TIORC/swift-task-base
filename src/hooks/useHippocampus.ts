import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type HippocampusType = "idea" | "tip" | "warning" | "reminder" | "link" | "vault" | "note";

export interface HippocampusNote {
  id: string;
  user_id: string;
  title: string | null;
  content: string;
  type: HippocampusType;
  tags: string[];
  is_pinned: boolean;
  is_archived: boolean;
  is_sensitive: boolean;
  reminder_at: string | null;
  reminder_repeat: "none" | "daily" | "weekly" | "monthly" | null;
  reminder_seen: boolean;
  created_at: string;
  updated_at: string;
}

export function useHippocampus(targetUserId?: string) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<HippocampusNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    let q = supabase.from("hippocampus_notes").select("*").order("is_pinned", { ascending: false }).order("updated_at", { ascending: false });
    if (targetUserId) q = q.eq("user_id", targetUserId);
    else q = q.eq("user_id", user.id);
    const { data, error } = await q;
    if (!error && data) setNotes(data as HippocampusNote[]);
    setLoading(false);
  }, [user?.id, targetUserId]);

  useEffect(() => { void load(); }, [load]);

  const create = async (input: Partial<HippocampusNote> & { content: string }) => {
    if (!user) return;
    const title = input.title?.trim() || input.content.split("\n")[0].slice(0, 60) || "Nota";
    const { error } = await supabase.from("hippocampus_notes").insert({
      user_id: user.id,
      title,
      content: input.content,
      type: input.type ?? "note",
      tags: input.tags ?? [],
      is_pinned: input.is_pinned ?? false,
      is_sensitive: input.is_sensitive ?? input.type === "vault",
      reminder_at: input.reminder_at ?? null,
      reminder_repeat: input.reminder_repeat ?? null,
    });
    if (error) throw error;
    await load();
  };

  const update = async (id: string, patch: Partial<HippocampusNote>) => {
    const { error } = await supabase.from("hippocampus_notes").update(patch).eq("id", id);
    if (error) throw error;
    await load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("hippocampus_notes").delete().eq("id", id);
    if (error) throw error;
    await load();
  };

  return { notes, loading, create, update, remove, reload: load };
}

export function useAllHippocampusUsers() {
  const [users, setUsers] = useState<Array<{ user_id: string; full_name: string | null; count: number }>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("hippocampus_notes").select("user_id");
      const counts = new Map<string, number>();
      (data ?? []).forEach((r: any) => counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1));
      const ids = Array.from(counts.keys());
      if (ids.length === 0) { setUsers([]); setLoading(false); return; }
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const list = ids.map((id) => ({
        user_id: id,
        full_name: profiles?.find((p: any) => p.id === id)?.full_name ?? null,
        count: counts.get(id) ?? 0,
      }));
      setUsers(list);
      setLoading(false);
    })();
  }, []);
  return { users, loading };
}
