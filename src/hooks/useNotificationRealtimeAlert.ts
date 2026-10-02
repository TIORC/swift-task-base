import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { showAlert } from "@/lib/alertStore";

type JsonRow = Record<string, unknown>;

/**
 * Component wrapper para usar no layout.
 */
export function NotificationRealtimeAlert() {
  useNotificationRealtimeAlert();
  return null;
}

export function useNotificationRealtimeAlert() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    const channel = supabase
      .channel(`notif-alert-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload: { new: JsonRow }) => {
          const notif = payload.new;
          if (!notif) return;

          queryClient.invalidateQueries({ queryKey: ["notifications"] });

          const kind = mapTypeToKind(notif.type as string | null);
          const { title, description } = buildAlertMessage(notif);

          showAlert({ kind, title, description });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);
}

function mapTypeToKind(type: string | null): "request" | "message" | "mention" | "default" {
  if (!type) return "default";
  if (type === "automation" || type === "automation_update" || type === "automation_assigned" || type === "automation_comment" || type === "assignment") {
    return "request";
  }
  if (type === "mention") return "mention";
  return "message";
}

function buildAlertMessage(notif: JsonRow): { title: string; description: string } {
  const type = notif.type as string | null;
  const message = (notif.message as string) || "";

  switch (type) {
    case "automation":
    case "automation_update":
    case "automation_assigned":
    case "automation_comment":
    case "assignment":
      return {
        title: "Você recebeu uma nova solicitação de desenvolvimento!",
        description: message,
      };
    case "mention":
      return {
        title: "Você foi mencionado",
        description: message,
      };
    default:
      return {
        title: "Nova notificação",
        description: message,
      };
  }
}