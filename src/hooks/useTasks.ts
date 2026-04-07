import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { runAutomationEngine } from "@/hooks/useAutomationRules";

export type Task = Tables<"tasks"> & {
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
  total_minutes?: number;
};

export type TaskStatus = "backlog" | "pending" | "todo" | "in_progress" | "review" | "done" | "discarded";

export const COLUMNS: { status: TaskStatus; title: string }[] = [
  { status: "backlog", title: "Backlog" },
  { status: "pending", title: "Pendente" },
  { status: "in_progress", title: "Em Andamento" },
  { status: "review", title: "Em Validação" },
  { status: "done", title: "Concluído" },
  { status: "discarded", title: "Descartado" },
];

export function useTasks() {
  return useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("tasks")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for assigned users
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

      // Fetch time logs aggregated
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
      })) as Task[];
    },
  });
}

export function useProfiles() {
  return useQuery({
    queryKey: ["profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, avatar_url");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (task: Omit<TablesInsert<"tasks">, "created_by">) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({ ...task, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Log creation event
      await supabase.from("task_events").insert({
        task_id: data.id,
        user_id: user!.id,
        event_type: "created",
        description: `Tarefa "${data.title}" criada`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa criada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<"tasks"> & { id: string }) => {
      // Get old task to detect assignment changes
      const { data: oldTask } = await supabase.from("tasks").select("assigned_to, title").eq("id", id).single();

      const { data, error } = await supabase.from("tasks").update(updates).eq("id", id).select().single();
      if (error) throw error;

      // Notify on assignment change
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

      // Run automation engine for changed fields
      if (user && updates.status && updates.status !== oldTask?.assigned_to) {
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
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Tarefa excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
