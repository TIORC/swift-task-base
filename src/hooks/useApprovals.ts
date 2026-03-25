import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { checkAndAwardMedals } from "@/hooks/useGamification";

export interface Approval {
  id: string;
  task_id: string;
  approver_id: string;
  level: "lider" | "gestor";
  status: "pending" | "approved" | "rejected";
  comments: string | null;
  created_at: string;
  approver_name?: string;
}

export function useTaskApprovals(taskId: string | null) {
  return useQuery({
    queryKey: ["approvals", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      // Fetch approver names
      const approverIds = [...new Set(data.map((a: any) => a.approver_id))];
      let namesMap: Record<string, string> = {};
      if (approverIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", approverIds);
        if (profiles) {
          namesMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name || "Sem nome"]));
        }
      }

      return data.map((a: any) => ({
        ...a,
        approver_name: namesMap[a.approver_id] || "Sem nome",
      })) as Approval[];
    },
  });
}

export function useUserRole() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-role", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      const roles = data.map((r: any) => r.role as string);
      return roles;
    },
  });
}

const XP_VALUES = {
  executed: 10,
  approved_lider: 3,
  approved_gestor: 2,
};

export function useSubmitApproval() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({
      taskId,
      level,
      status,
      comments,
    }: {
      taskId: string;
      level: "lider" | "gestor";
      status: "approved" | "rejected";
      comments?: string;
    }) => {
      // Check if already approved at this level
      const { data: existing } = await supabase
        .from("approvals")
        .select("id")
        .eq("task_id", taskId)
        .eq("level", level)
        .eq("status", "approved");

      if (existing && existing.length > 0) {
        throw new Error(`Já aprovado pelo nível ${level}`);
      }

      const { data, error } = await supabase
        .from("approvals")
        .insert({
          task_id: taskId,
          approver_id: user!.id,
          level,
          status,
          comments: comments || null,
        })
        .select()
        .single();
      if (error) throw error;

      // Grant XP to approver
      if (status === "approved") {
        const action = level === "lider" ? "approved_lider" : "approved_gestor";
        await supabase.from("xp_logs").insert({
          user_id: user!.id,
          task_id: taskId,
          action,
          xp_earned: XP_VALUES[action],
        });

        // If gestor approved, grant executor XP to assigned user
        if (level === "gestor") {
          const { data: task } = await supabase
            .from("tasks")
            .select("assigned_to")
            .eq("id", taskId)
            .single();

          if (task?.assigned_to) {
            await supabase.from("xp_logs").insert({
              user_id: task.assigned_to,
              task_id: taskId,
              action: "executed",
              xp_earned: XP_VALUES.executed,
            });
          }

          // Move task to done
          await supabase.from("tasks").update({ status: "done" }).eq("id", taskId);
        }
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approvals"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["user-xp"] });
      toast.success("Aprovação registrada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUserXP(userId?: string) {
  return useQuery({
    queryKey: ["user-xp", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("xp_logs")
        .select("xp_earned")
        .eq("user_id", userId!);
      if (error) throw error;
      return data.reduce((sum: number, r: any) => sum + r.xp_earned, 0);
    },
  });
}
