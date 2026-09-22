import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AutomationComment {
  id: string;
  automation_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export function useAutomationComments(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_comments", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_comments")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map((c) => c.user_id))] as string[];
      let map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
        if (profs) map = Object.fromEntries(profs.map((p) => [p.id, p]));
      }
      return (data as any[]).map((c) => ({
        ...c,
        mentions: (c.mentions as string[]) || [],
        profile: map[c.user_id] || null,
      })) as AutomationComment[];
    },
  });
}

export function useCreateAutomationComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      automationId,
      content,
      mentions,
    }: { automationId: string; content: string; mentions: string[] }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await (supabase as any)
        .from("automation_comments")
        .insert({ automation_id: automationId, user_id: user.id, content, mentions })
        .select()
        .single();
      if (error) throw error;

      // Get automation title for notification
      const { data: auto } = await supabase
        .from("automations")
        .select("title, requester_id, assigned_to")
        .eq("id", automationId)
        .single();

      // Notifica a outra parte (dev ⇄ solicitante):
      // - se quem comentou é o solicitante, avisa o dev responsável;
      // - se quem comentou é o dev/equipe, avisa o solicitante.
      const isRequesterAuthor = auto?.requester_id === user.id;
      const targetUserId = isRequesterAuthor ? auto?.assigned_to : auto?.requester_id;

      if (targetUserId && targetUserId !== user.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        const senderName = profile?.full_name || user.email || "Alguém";
        await supabase.from("notifications").insert({
          user_id: targetUserId,
          type: "automation_comment",
          message: `${senderName} comentou em "${auto?.title || "uma automação"}"`,
          created_by: user.id,
        });
      }

      if (mentions.length > 0) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        const senderName = profile?.full_name || user.email || "Alguém";
        const notifs = mentions
          .filter((uid) => uid !== user.id)
          .map((uid) => ({
            user_id: uid,
            type: "mention",
            message: `${senderName} mencionou você em "${auto?.title || "uma automação"}"`,
            created_by: user.id,
          }));
        if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
      }
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["automation_comments", vars.automationId] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
