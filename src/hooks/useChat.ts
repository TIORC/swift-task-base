import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const sb = supabase as any;

export interface ChatConversation {
  id: string;
  is_group: boolean;
  name: string | null;
  created_by: string;
  last_message_at: string;
  created_at: string;
  participants: { user_id: string; last_read_at: string; profile?: { full_name: string | null; avatar_url: string | null } | null }[];
  last_message?: { content: string; sender_id: string; created_at: string } | null;
  unread_count?: number;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  mentioned_task_ids: string[];
  mentioned_sm_task_ids: string[];
  sender_profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export function useConversations() {
  const { user } = useAuth();
  const [data, setData] = useState<ChatConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    // Fetch my participations
    const { data: parts } = await sb
      .from("chat_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", user.id);
    const convIds: string[] = (parts ?? []).map((p: any) => p.conversation_id);
    if (convIds.length === 0) { setData([]); setLoading(false); return; }

    const [{ data: convs }, { data: allParts }, { data: lastMsgs }] = await Promise.all([
      sb.from("chat_conversations").select("*").in("id", convIds).order("last_message_at", { ascending: false }),
      sb.from("chat_participants").select("*").in("conversation_id", convIds),
      sb.from("chat_messages").select("id, conversation_id, content, sender_id, created_at").in("conversation_id", convIds).order("created_at", { ascending: false }),
    ]);

    const userIds = [...new Set((allParts ?? []).map((p: any) => p.user_id))];
    const { data: profiles } = await sb.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
    const profMap: Record<string, any> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));

    const myReadMap: Record<string, string> = Object.fromEntries((parts ?? []).map((p: any) => [p.conversation_id, p.last_read_at]));
    const lastByConv: Record<string, any> = {};
    const unreadByConv: Record<string, number> = {};
    for (const m of (lastMsgs ?? [])) {
      if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
      const lr = myReadMap[m.conversation_id];
      if (m.sender_id !== user.id && (!lr || new Date(m.created_at) > new Date(lr))) {
        unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id] || 0) + 1;
      }
    }

    const list: ChatConversation[] = (convs ?? []).map((c: any) => ({
      ...c,
      participants: (allParts ?? []).filter((p: any) => p.conversation_id === c.id).map((p: any) => ({ ...p, profile: profMap[p.user_id] || null })),
      last_message: lastByConv[c.id] || null,
      unread_count: unreadByConv[c.id] || 0,
    }));
    setData(list);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`chat-conv-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, refresh]);

  return { data, loading, refresh };
}

export function useMessages(conversationId: string | null) {
  const [data, setData] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!conversationId) { setData([]); return; }
    setLoading(true);
    const { data: msgs } = await sb.from("chat_messages").select("*").eq("conversation_id", conversationId).order("created_at", { ascending: true });
    const uids = [...new Set((msgs ?? []).map((m: any) => m.sender_id))];
    const { data: profiles } = uids.length ? await sb.from("profiles").select("id, full_name, avatar_url").in("id", uids) : { data: [] };
    const pm: Record<string, any> = Object.fromEntries((profiles ?? []).map((p: any) => [p.id, p]));
    setData((msgs ?? []).map((m: any) => ({ ...m, sender_profile: pm[m.sender_id] || null })));
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (!conversationId) return;
    const ch = supabase
      .channel(`chat-msg-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [conversationId, refresh]);

  return { data, loading, refresh };
}

export async function openDirectChat(otherUserId: string): Promise<string> {
  const { data, error } = await sb.rpc("get_or_create_direct_chat", { _other: otherUserId });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function sendChatMessage(params: {
  conversationId: string;
  senderId: string;
  content: string;
  mentionedSmTaskIds?: string[];
  mentionedTaskIds?: string[];
}) {
  const { error } = await sb.from("chat_messages").insert({
    conversation_id: params.conversationId,
    sender_id: params.senderId,
    content: params.content,
    mentioned_sm_task_ids: params.mentionedSmTaskIds ?? [],
    mentioned_task_ids: params.mentionedTaskIds ?? [],
  });
  if (error) throw new Error(error.message);
}

export async function markConversationRead(conversationId: string, userId: string) {
  await sb.from("chat_participants").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", userId);
}
