import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ResponsibilityEntry {
  id: string;
  task_id: string;
  from_user_id: string | null;
  to_user_id: string | null;
  changed_by: string;
  created_at: string;
  from_name?: string | null;
  to_name?: string | null;
  changed_by_name?: string | null;
}

export function useResponsibilityHistory(taskId: string | null) {
  return useQuery({
    queryKey: ["responsibility-history", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("responsibility_history")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const userIds = [
        ...new Set(
          data.flatMap((r) => [r.from_user_id, r.to_user_id, r.changed_by].filter(Boolean))
        ),
      ] as string[];

      let profilesMap: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
        }
      }

      return data.map((r) => ({
        ...r,
        from_name: r.from_user_id ? profilesMap[r.from_user_id] || null : null,
        to_name: r.to_user_id ? profilesMap[r.to_user_id] || null : null,
        changed_by_name: profilesMap[r.changed_by] || null,
      })) as ResponsibilityEntry[];
    },
  });
}

export function useLogResponsibilityChange() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      fromUserId,
      toUserId,
    }: {
      taskId: string;
      fromUserId: string | null;
      toUserId: string | null;
    }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("responsibility_history").insert({
        task_id: taskId,
        from_user_id: fromUserId,
        to_user_id: toUserId,
        changed_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["responsibility-history", vars.taskId] });
    },
  });
}
