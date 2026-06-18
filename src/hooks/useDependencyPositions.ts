import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type NodeType = "task" | "automation";

export interface DependencyNodePosition {
  id: string;
  node_type: NodeType;
  node_id: string;
  position_x: number;
  position_y: number;
  updated_by: string | null;
  updated_at: string;
}

export function useDependencyPositions(nodeType: NodeType) {
  return useQuery({
    queryKey: ["dependency_map_positions", nodeType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dependency_map_positions" as any)
        .select("*")
        .eq("node_type", nodeType);
      if (error) throw error;
      return (data ?? []) as unknown as DependencyNodePosition[];
    },
  });
}

export function useSavePosition() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      nodeType,
      nodeId,
      x,
      y,
    }: {
      nodeType: NodeType;
      nodeId: string;
      x: number;
      y: number;
    }) => {
      const { error } = await supabase
        .from("dependency_map_positions" as any)
        .upsert(
          {
            node_type: nodeType,
            node_id: nodeId,
            position_x: x,
            position_y: y,
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "node_type,node_id" }
        );
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["dependency_map_positions", vars.nodeType] });
    },
  });
}
