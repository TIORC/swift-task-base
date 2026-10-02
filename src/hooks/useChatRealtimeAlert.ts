import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { showAlert } from "@/lib/alertStore";

type JsonRow = Record<string, unknown>;

/**
 * Component wrapper para usar no layout.
 */
export function ChatRealtimeAlert() {
  useChatRealtimeAlert();
  return null;
}

/**
 * Alert card quando o usuário recebe uma nova mensagem de chat.
 * Dispara no realtime do chat_messages, filtrado por conversas em que o
 usuário participa. Só avisa quando a mensagem não foi enviada por ele.
 */
export function useChatRealtimeAlert() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    const channel = supabase
      .channel(`chat-alert-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        async (payload: { new: JsonRow }) => {
          const msg = payload.new;
          if (!msg || msg.sender_id === userId) return;

          // Só alerta se o usuário participa dessa conversa
          const { data: part } = await supabase
            .from("chat_participants")
            .select("conversation_id")
            .eq("conversation_id", msg.conversation_id as string)
            .eq("user_id", userId)
            .maybeSingle();

          if (!part) return;

          const { data: sender } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", msg.sender_id as string)
            .maybeSingle();

          const senderName = (sender as { full_name: string | null } | null)?.full_name || "Alguém";
          const text = ((msg.content as string) || "").replace(/\s+/g, " ").trim().slice(0, 80);

          showAlert({
            kind: "message",
            title: `${senderName} enviou uma mensagem para você`,
            description: text,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);
}