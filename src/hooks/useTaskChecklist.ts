import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type TaskChecklistItem = Tables<"task_checklist_items">;

export function useTaskChecklist(taskId: string | null) {
  return useQuery({
    queryKey: ["task-checklist", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_checklist_items")
        .select("*")
        .eq("task_id", taskId!)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return data as TaskChecklistItem[];
    },
  });
}

function invalidateChecklist(qc: ReturnType<typeof useQueryClient>, taskId: string) {
  qc.invalidateQueries({ queryKey: ["task-checklist", taskId] });
}

export function useAddTaskChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, content, position }: { taskId: string; content: string; position: number }) => {
      const { error } = await supabase
        .from("task_checklist_items")
        .insert({ task_id: taskId, content: content.trim(), position });
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateChecklist(qc, vars.taskId),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleTaskChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; taskId: string; done: boolean }) => {
      const { error } = await supabase.from("task_checklist_items").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateChecklist(qc, vars.taskId),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateTaskChecklistItemContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, content }: { id: string; taskId: string; content: string }) => {
      const { error } = await supabase
        .from("task_checklist_items")
        .update({ content: content.trim() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateChecklist(qc, vars.taskId),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteTaskChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; taskId: string }) => {
      const { error } = await supabase.from("task_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateChecklist(qc, vars.taskId),
    onError: (e: Error) => toast.error(e.message),
  });
}
