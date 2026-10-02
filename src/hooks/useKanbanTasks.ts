import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyTaskVisibility } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { invalidateGamification } from "@/hooks/useGamification";
import { runAutomationEngine } from "@/hooks/useAutomationRules";

export type KanbanTask = Tables<"tasks"> & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
  total_minutes?: number;
};

export type KanbanStatus = "backlog" | "pending" | "todo" | "in_progress" | "review" | "done" | "discarded";

export const KANBAN_COLUMNS: { status: KanbanStatus; title: string }[] = [
  { status: "backlog", title: "Backlog" },
  { status: "pending", title: "Pendente" },
  { status: "in_progress", title: "Em Andamento" },
  { status: "review", title: "Em Validação" },
  { status: "done", title: "Concluído" },
  { status: "discarded", title: "Descartado" },
];

export type KanbanFilterValue = "mine_or_unassigned" | "mine" | "unassigned" | "all" | string;

export function useKanbanTasks() {
  return useQuery({
    queryKey: ["kanban-tasks"],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [...new Set(tasks.map((t) => t.assigned_to).filter(Boolean))] as string[];
      let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);

        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        }
      }

      const { data: timeLogs } = await supabase
        .from("time_logs")
        .select("task_id, duration_minutes");

      const timeMap: Record<string, number> = {};
      timeLogs?.forEach((log) => {
        timeMap[log.task_id] = (timeMap[log.task_id] || 0) + log.duration_minutes;
      });

      return tasks.map((t) => ({
        ...t,
        profiles: t.assigned_to ? profilesMap[t.assigned_to] || null : null,
        total_minutes: timeMap[t.id] || 0,
      })) as KanbanTask[];
    },
  });
}

export function useKanbanUpdateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"tasks"> & { id: string }) => {
      const { data: oldTask } = await supabase
        .from("tasks")
        .select("assigned_to, title, status, priority")
        .eq("id", id)
        .single();

      const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;

      if (user && updates.status && updates.status !== oldTask?.status) {
        const statusLabels: Record<string, string> = {
          backlog: "Backlog", pending: "Pendente", todo: "A Fazer", in_progress: "Em Andamento",
          review: "Em Validação", done: "Concluído", discarded: "Descartado",
        };
        const eventType = updates.status === "done" ? "completed"
          : updates.status === "review" ? "sent_review"
          : updates.status === "in_progress" ? "started"
          : updates.status === "discarded" ? "discarded"
          : "status_changed";
        await supabase.from("task_events").insert({
          task_id: id, user_id: user.id, event_type: eventType,
          description: `Status alterado para "${statusLabels[updates.status as string] || updates.status}"`,
        });
      }

      if (user && updates.priority && updates.priority !== oldTask?.priority) {
        await supabase.from("task_events").insert({
          task_id: id, user_id: user.id, event_type: "priority_changed",
          description: `Prioridade alterada para "${updates.priority}"`,
        });
      }

      if (user && updates.assigned_to && updates.assigned_to !== oldTask?.assigned_to) {
        await supabase.from("task_events").insert({
          task_id: id, user_id: user.id, event_type: "reassigned",
          description: `Responsável alterado`,
          metadata: { from: oldTask?.assigned_to, to: updates.assigned_to },
        });
      }

      if (
        user &&
        updates.assigned_to &&
        updates.assigned_to !== oldTask?.assigned_to &&
        updates.assigned_to !== user.id
      ) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single();
        const senderName = profile?.full_name || user.email || "Alguém";

        await supabase.from("notifications").insert({
          user_id: updates.assigned_to,
          type: "assigned",
          task_id: id,
          message: `${senderName} atribuiu a tarefa "${oldTask?.title || "sem título"}" a você`,
          created_by: user.id,
        });
      }

      if (user && updates.status && updates.status !== oldTask?.status) {
        await runAutomationEngine(id, "status", updates.status as string, user.id);
      }
      if (user && updates.priority) {
        await runAutomationEngine(id, "priority", updates.priority as string, user.id);
      }
      if (user && updates.assigned_to) {
        await runAutomationEngine(id, "assigned_to", updates.assigned_to, user.id);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      invalidateGamification(queryClient);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useKanbanTaskFilter(tasks: KanbanTask[] | undefined) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isLider, isMembro } = useUserRole();
  const { visibleUsers } = useMyTaskVisibility();
  const [selectedUserId, setSelectedUserId] = useState<KanbanFilterValue>("mine_or_unassigned");

  const filteredTasks = useMemo(() => {
    if (!tasks || !user) return [];

    if (isMembro) {
      const base = tasks.filter(
        (t) =>
          t.assigned_to === user.id ||
          t.created_by === user.id ||
          (t.assigned_to && visibleUsers.includes(t.assigned_to)) ||
          (t.created_by && visibleUsers.includes(t.created_by))
      );
      if (selectedUserId === "all") return base;
      if (selectedUserId === "unassigned") return base.filter((t) => !t.assigned_to);
      if (selectedUserId === "mine") return base.filter((t) => t.assigned_to === user.id);
      return base.filter((t) => t.assigned_to === user.id || !t.assigned_to);
    }

    if (selectedUserId === "all") return tasks;
    if (selectedUserId === "unassigned") return tasks.filter((t) => !t.assigned_to);
    if (selectedUserId === "mine_or_unassigned") {
      return tasks.filter((t) => t.assigned_to === user.id || !t.assigned_to);
    }

    const targetId = selectedUserId === "mine" ? user.id : selectedUserId;
    return tasks.filter(
      (t) => t.assigned_to === targetId || t.created_by === targetId
    );
  }, [tasks, user, isMembro, visibleUsers, selectedUserId]);

  const canFilter = isAdmin || isGestor || isLider || isMembro;

  return {
    filteredTasks,
    selectedUserId,
    setSelectedUserId,
    canFilter,
  };
}
