import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type KanbanChecklistItem = Tables<"kanban_task_checklist_items">;

export function useKanbanChecklist(taskId: string | null) {
  return useQuery({
    queryKey: ["kanban-checklist", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_task_checklist_items")
        .select("*")
        .eq("task_id", taskId!)
        .order("position")
        .order("created_at");
      if (error) throw error;
      return data as KanbanChecklistItem[];
    },
  });
}

function invalidateChecklist(qc: ReturnType<typeof useQueryClient>, taskId: string) {
  qc.invalidateQueries({ queryKey: ["kanban-checklist", taskId] });
  qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
}

// Adiciona um ou mais itens. startPosition mantém a ordem na lista.
export function useAddChecklistItems() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ taskId, items, startPosition = 0 }: { taskId: string; items: { content: string; done: boolean }[]; startPosition?: number }) => {
      const rows = items
        .filter((i) => i.content.trim())
        .map((i, idx) => ({ task_id: taskId, content: i.content.trim(), done: i.done, position: startPosition + idx }));
      if (rows.length === 0) return;
      const { error } = await supabase.from("kanban_task_checklist_items").insert(rows);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateChecklist(qc, vars.taskId),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; taskId: string; done: boolean }) => {
      const { error } = await supabase.from("kanban_task_checklist_items").update({ done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateChecklist(qc, vars.taskId),
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteChecklistItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; taskId: string }) => {
      const { error } = await supabase.from("kanban_task_checklist_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => invalidateChecklist(qc, vars.taskId),
    onError: (e: Error) => toast.error(e.message),
  });
}
