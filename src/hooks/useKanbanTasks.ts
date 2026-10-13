import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyTaskVisibility } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { invalidateGamification } from "@/hooks/useGamification";

// Tarefas do Kanban são independentes de /tarefas (tabela própria).
export type KanbanTask = Tables<"kanban_tasks"> & {
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
        .from("kanban_tasks")
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
        if (profiles) profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      }

      return tasks.map((t) => ({
        ...t,
        profiles: t.assigned_to ? profilesMap[t.assigned_to] || null : null,
        total_minutes: 0,
      })) as KanbanTask[];
    },
  });
}

function useAfterChange() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    invalidateGamification(qc);
  };
}

export function useKanbanCreateTask() {
  const after = useAfterChange();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (row: Omit<TablesInsert<"kanban_tasks">, "created_by">) => {
      const { error } = await supabase.from("kanban_tasks").insert({ ...row, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: after,
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useKanbanUpdateTask() {
  const after = useAfterChange();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"kanban_tasks"> & { id: string }) => {
      const { data: old } = await supabase.from("kanban_tasks").select("assigned_to, title").eq("id", id).maybeSingle();
      const { error } = await supabase.from("kanban_tasks").update(updates).eq("id", id);
      if (error) throw error;
      if (user && updates.assigned_to && updates.assigned_to !== old?.assigned_to && updates.assigned_to !== user.id) {
        await supabase.from("notifications").insert({
          user_id: updates.assigned_to,
          type: "assigned",
          message: `Você recebeu a tarefa do Kanban "${old?.title || "sem título"}"`,
          created_by: user.id,
        });
      }
    },
    onSuccess: after,
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useKanbanDeleteTask() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kanban_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: after,
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
          !t.assigned_to ||
          t.assigned_to === user.id ||
          t.created_by === user.id ||
          (t.assigned_to && visibleUsers.includes(t.assigned_to)) ||
          visibleUsers.includes(t.created_by)
      );
      if (selectedUserId === "all") return base;
      if (selectedUserId === "unassigned") return base.filter((t) => !t.assigned_to);
      if (selectedUserId === "mine") return base.filter((t) => t.assigned_to === user.id);
      return base.filter((t) => t.assigned_to === user.id || !t.assigned_to);
    }
    if (selectedUserId === "all") return tasks;
    if (selectedUserId === "unassigned") return tasks.filter((t) => !t.assigned_to);
    if (selectedUserId === "mine_or_unassigned") return tasks.filter((t) => t.assigned_to === user.id || !t.assigned_to);
    const targetId = selectedUserId === "mine" ? user.id : selectedUserId;
    return tasks.filter((t) => t.assigned_to === targetId || t.created_by === targetId);
  }, [tasks, user, isMembro, visibleUsers, selectedUserId]);

  return { filteredTasks, selectedUserId, setSelectedUserId, canFilter: isAdmin || isGestor || isLider || isMembro };
}
