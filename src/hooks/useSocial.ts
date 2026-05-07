import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type {
  SmClient, SmCampaign, SmPost, SmTask, SmSocialNetwork, SmContentType,
} from "@/types/social";

const sb = supabase as any;

export function useSmClients() {
  const [data, setData] = useState<SmClient[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from("sm_clients").select("*").order("name");
    if (!error) setData((data as SmClient[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useSmCampaigns(clientId?: string) {
  const [data, setData] = useState<SmCampaign[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let q = sb.from("sm_campaigns").select("*").order("created_at", { ascending: false });
    if (clientId) q = q.eq("client_id", clientId);
    const { data, error } = await q;
    if (!error) setData((data as SmCampaign[]) ?? []);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

export function useSmPosts(filter?: { clientId?: string; status?: string }) {
  const [data, setData] = useState<SmPost[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let q = sb.from("sm_posts").select("*").order("created_at", { ascending: false });
    if (filter?.clientId) q = q.eq("client_id", filter.clientId);
    if (filter?.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (!error) setData((data as SmPost[]) ?? []);
    setLoading(false);
  }, [filter?.clientId, filter?.status]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    const ch = supabase
      .channel(`sm-posts-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_posts" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refresh]);

  return { data, loading, refresh };
}

export function useSmTasks() {
  const [data, setData] = useState<SmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb.from("sm_tasks").select("*").order("created_at", { ascending: false });
    if (!error) setData((data as SmTask[]) ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { data, loading, refresh };
}

export function useSmRefData() {
  const [networks, setNetworks] = useState<SmSocialNetwork[]>([]);
  const [contentTypes, setContentTypes] = useState<SmContentType[]>([]);

  useEffect(() => {
    (async () => {
      const [n, c] = await Promise.all([
        sb.from("sm_social_networks").select("*").eq("active", true).order("name"),
        sb.from("sm_content_types").select("*").eq("active", true).order("name"),
      ]);
      setNetworks((n.data as SmSocialNetwork[]) ?? []);
      setContentTypes((c.data as SmContentType[]) ?? []);
    })();
  }, []);

  return { networks, contentTypes };
}

export function useSocialMutations() {
  const { user } = useAuth();
  const uid = user?.id ?? "";

  return {
    createClient: (payload: Partial<SmClient>) =>
      sb.from("sm_clients").insert({ ...payload, created_by: uid }).select().single(),
    updateClient: (id: string, payload: Partial<SmClient>) =>
      sb.from("sm_clients").update(payload).eq("id", id),
    deleteClient: (id: string) => sb.from("sm_clients").delete().eq("id", id),

    createCampaign: (payload: Partial<SmCampaign>) =>
      sb.from("sm_campaigns").insert({ ...payload, created_by: uid }).select().single(),
    updateCampaign: (id: string, payload: Partial<SmCampaign>) =>
      sb.from("sm_campaigns").update(payload).eq("id", id),
    deleteCampaign: (id: string) => sb.from("sm_campaigns").delete().eq("id", id),

    createPost: (payload: Partial<SmPost>) =>
      sb.from("sm_posts").insert({ ...payload, created_by: uid }).select().single(),
    updatePost: (id: string, payload: Partial<SmPost>) =>
      sb.from("sm_posts").update(payload).eq("id", id),
    deletePost: (id: string) => sb.from("sm_posts").delete().eq("id", id),

    createTask: (payload: Partial<SmTask>) =>
      sb.from("sm_tasks").insert({ ...payload, created_by: uid }).select().single(),
    updateTask: (id: string, payload: Partial<SmTask>) =>
      sb.from("sm_tasks").update(payload).eq("id", id),
    deleteTask: (id: string) => sb.from("sm_tasks").delete().eq("id", id),
  };
}
