import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AutomationRule {
  id: string;
  name: string;
  trigger_field: "status" | "priority" | "assigned_to";
  trigger_value: string;
  action_type: "change_status" | "notify_assigned" | "notify_creator" | "assign_to";
  action_value: string | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
}

export const TRIGGER_FIELDS = [
  { value: "status", label: "Status muda para" },
  { value: "priority", label: "Prioridade muda para" },
  { value: "assigned_to", label: "Responsável muda" },
] as const;

export const ACTION_TYPES = [
  { value: "change_status", label: "Alterar status para" },
  { value: "notify_assigned", label: "Notificar responsável" },
  { value: "notify_creator", label: "Notificar criador" },
  { value: "assign_to", label: "Atribuir para" },
] as const;

export function useAutomationRules() {
  return useQuery({
    queryKey: ["automation-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as AutomationRule[];
    },
  });
}

export function useCreateAutomationRule() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (rule: Omit<AutomationRule, "id" | "created_by" | "created_at">) => {
      const { data, error } = await supabase
        .from("automation_rules")
        .insert({ ...rule, created_by: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regra criada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("automation_rules")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAutomationRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automation-rules"] });
      toast.success("Regra excluída!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Runs automation rules against a task update.
 * Call this after a task mutation to evaluate IF→THEN rules.
 */
export async function runAutomationEngine(
  taskId: string,
  changedField: "status" | "priority" | "assigned_to",
  newValue: string,
  userId: string
) {
  // Fetch enabled rules matching the trigger
  const { data: rules } = await supabase
    .from("automation_rules")
    .select("*")
    .eq("trigger_field", changedField)
    .eq("trigger_value", newValue)
    .eq("enabled", true);

  if (!rules || rules.length === 0) return;

  // Fetch task for context
  const { data: task } = await supabase
    .from("tasks")
    .select("id, title, assigned_to, created_by, status")
    .eq("id", taskId)
    .single();

  if (!task) return;

  for (const rule of rules) {
    try {
      switch (rule.action_type) {
        case "change_status":
          if (rule.action_value && rule.action_value !== task.status) {
            await supabase
              .from("tasks")
              .update({ status: rule.action_value as any })
              .eq("id", taskId);
          }
          break;

        case "notify_assigned":
          if (task.assigned_to) {
            await supabase.from("notifications").insert({
              user_id: task.assigned_to,
              type: "automation",
              task_id: taskId,
              message: `[Auto] ${rule.name}: "${task.title}"`,
              created_by: userId,
            });
          }
          break;

        case "notify_creator":
          if (task.created_by) {
            await supabase.from("notifications").insert({
              user_id: task.created_by,
              type: "automation",
              task_id: taskId,
              message: `[Auto] ${rule.name}: "${task.title}"`,
              created_by: userId,
            });
          }
          break;

        case "assign_to":
          if (rule.action_value) {
            await supabase
              .from("tasks")
              .update({ assigned_to: rule.action_value })
              .eq("id", taskId);
          }
          break;
      }
    } catch (err) {
      console.error("Automation rule error:", rule.name, err);
    }
  }
}
