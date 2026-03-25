import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  created_by: string;
  created_at: string;
}

export function useTaskDependencies(taskId: string | null) {
  return useQuery({
    queryKey: ["task_dependencies", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_dependencies")
        .select("*")
        .or(`task_id.eq.${taskId},depends_on_task_id.eq.${taskId}`);
      if (error) throw error;
      return data as TaskDependency[];
    },
  });
}

export function useAllDependencies() {
  return useQuery({
    queryKey: ["all_dependencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("task_dependencies").select("*");
      if (error) throw error;
      return data as TaskDependency[];
    },
  });
}

export function useAddDependency() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, dependsOnTaskId }: { taskId: string; dependsOnTaskId: string }) => {
      const { error } = await supabase.from("task_dependencies").insert({
        task_id: taskId,
        depends_on_task_id: dependsOnTaskId,
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task_dependencies"] });
      queryClient.invalidateQueries({ queryKey: ["all_dependencies"] });
      toast.success("Dependência adicionada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveDependency() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("task_dependencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task_dependencies"] });
      queryClient.invalidateQueries({ queryKey: ["all_dependencies"] });
      toast.success("Dependência removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
