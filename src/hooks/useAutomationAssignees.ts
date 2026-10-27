import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { firstNameKey } from "@/hooks/useKanbanTasks";

// Únicas pessoas que podem ser responsáveis por automações (regra do líder).
const AUTOMATION_TEAM_FIRST_NAMES = ["welder", "gabriel"];

export interface AutomationTeamMember {
  id: string;
  full_name: string | null;
}

export interface AutomationAssignment {
  user_id: string;
  xp: number;
}

/** Welder e Gabriel, os únicos selecionáveis como responsáveis por automações. */
export function useAutomationTeam() {
  return useQuery({
    queryKey: ["automation-team"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<AutomationTeamMember[]> => {
      const { data, error } = await supabase.from("profiles").select("id, full_name");
      if (error) throw error;
      return (data ?? [])
        .filter((p) => !!p.full_name && AUTOMATION_TEAM_FIRST_NAMES.includes(firstNameKey(p.full_name)))
        .sort((a, b) => (a.full_name ?? "").localeCompare(b.full_name ?? "", "pt-BR"));
    },
  });
}

/** Responsáveis de uma automação, cada um com o XP que recebe ao concluir. */
export function useAutomationAssignments(automationId: string | undefined) {
  return useQuery({
    queryKey: ["automation-assignees", automationId],
    enabled: !!automationId,
    queryFn: async (): Promise<AutomationAssignment[]> => {
      const { data, error } = await supabase
        .from("automation_assignees")
        .select("user_id, xp, created_at")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ user_id: r.user_id, xp: r.xp }));
    },
  });
}

/** Grava a lista de responsáveis com o XP de cada um (só líder ou admin; o servidor confere). */
export function useSetAutomationAssignments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ automationId, assignments }: { automationId: string; assignments: AutomationAssignment[] }) => {
      const { error } = await (supabase as any).rpc("automation_set_assignees", {
        _automation_id: automationId,
        _user_ids: assignments.map((a) => a.user_id),
        _xp: assignments.map((a) => a.xp),
      });
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["automation-assignees", vars.automationId] });
      qc.invalidateQueries({ queryKey: ["automations"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
