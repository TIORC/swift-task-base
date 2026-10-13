import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEffect } from "react";

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  task_id: string | null;
  link: string | null;
  message: string;
  read: boolean;
  created_by: string | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`notif-${user.id}-${Math.random().toString(36).slice(2)}`);
    
    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

  return useQuery({
    queryKey: ["notifications"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
  });
}

export function useUnreadCount() {
  const { data: notifications } = useNotifications();
  return notifications?.filter((n) => !n.read).length || 0;
}

// Extrai o id da tarefa do link da notificação ("/tasks?task=<id>" ou "/kanban?task=<id>").
const TASK_ID_IN_LINK = /task=([0-9a-f-]{36})/i;

// Quantas menções não lidas o usuário tem em cada tarefa (tarefas e Kanban).
export function useUnreadMentionsByTask() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["notifications", "unread-mentions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("task_id, link")
        .eq("user_id", user!.id)
        .eq("type", "mention")
        .eq("read", false);
      if (error) throw error;

      const counts: Record<string, number> = {};
      for (const n of data) {
        const taskId = n.task_id ?? n.link?.match(TASK_ID_IN_LINK)?.[1];
        if (taskId) counts[taskId] = (counts[taskId] ?? 0) + 1;
      }
      return counts;
    },
  });
}

// Marca como lidas as menções de uma tarefa (ao abrir a tarefa).
export function useMarkTaskMentionsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("type", "mention")
        .eq("read", false)
        .or(`task_id.eq.${taskId},link.like.*task=${taskId}*`);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllAsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
