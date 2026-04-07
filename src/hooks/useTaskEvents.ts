import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TaskEvent {
  id: string;
  task_id: string;
  user_id: string;
  event_type: string;
  description: string | null;
  metadata: Record<string, any> | null;
  created_at: string;
  profiles?: { full_name: string | null } | null;
}

export function useTaskEvents(taskId: string | null) {
  return useQuery({
    queryKey: ["task_events", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_events")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch profiles for user names
      const userIds = [...new Set(data.map((e) => e.user_id))];
      let profilesMap: Record<string, { full_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        }
      }

      return data.map((e) => ({
        ...e,
        profiles: profilesMap[e.user_id] || null,
      })) as TaskEvent[];
    },
  });
}

export function useLogTaskEvent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      eventType,
      description,
      metadata,
    }: {
      taskId: string;
      eventType: string;
      description: string;
      metadata?: Record<string, any>;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("task_events").insert({
        task_id: taskId,
        user_id: user.id,
        event_type: eventType,
        description,
        metadata: metadata || {},
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["task_events", vars.taskId] });
    },
  });
}

// Event type labels and icons
export const EVENT_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  created: { label: "Criada", color: "text-primary" },
  started: { label: "Iniciada", color: "text-success" },
  paused: { label: "Pausada", color: "text-warning" },
  completed: { label: "Concluída", color: "text-success" },
  sent_review: { label: "Enviada para validação", color: "text-warning" },
  approved: { label: "Aprovada", color: "text-success" },
  rejected: { label: "Rejeitada", color: "text-destructive" },
  mentioned: { label: "Menção", color: "text-primary" },
  reassigned: { label: "Transferida", color: "text-muted-foreground" },
  status_changed: { label: "Status alterado", color: "text-muted-foreground" },
  priority_changed: { label: "Prioridade alterada", color: "text-warning" },
  discarded: { label: "Descartada", color: "text-destructive" },
  comment: { label: "Comentário", color: "text-primary" },
};
