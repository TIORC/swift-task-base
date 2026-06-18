import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AutomationDependency {
  id: string;
  automation_id: string;
  depends_on_automation_id: string;
  relation_type: string;
  created_by: string;
  created_at: string;
  line_color?: string | null;
}

export function useAllAutomationDependencies() {
  return useQuery({
    queryKey: ["automation_dependencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("automation_dependencies").select("*");
      if (error) throw error;
      return (data ?? []) as AutomationDependency[];
    },
  });
}

export function useAddAutomationDependency() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      automationId,
      dependsOnAutomationId,
      relationType = "depends_on",
      lineColor,
    }: {
      automationId: string;
      dependsOnAutomationId: string;
      relationType?: string;
      lineColor?: string;
    }) => {
      const { error } = await supabase.from("automation_dependencies").insert({
        automation_id: automationId,
        depends_on_automation_id: dependsOnAutomationId,
        relation_type: relationType,
        created_by: user!.id,
        ...(lineColor ? { line_color: lineColor } : {}),
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_dependencies"] });
      toast.success("Vínculo criado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAutomationDependencyColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, lineColor }: { id: string; lineColor: string }) => {
      const { error } = await supabase
        .from("automation_dependencies")
        .update({ line_color: lineColor } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_dependencies"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useRemoveAutomationDependency() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_dependencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_dependencies"] });
      toast.success("Vínculo removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
