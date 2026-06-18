import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyTaskVisibility } from "@/hooks/usePermissions";
import { Task } from "@/hooks/useTasks";

export type TaskFilterValue = "mine_or_unassigned" | "mine" | "unassigned" | "all" | string;

export function useTaskFilter(tasks: Task[] | undefined) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isLider, isMembro } = useUserRole();
  const { visibleUsers } = useMyTaskVisibility();
  // Default: focus on what's mine + unassigned
  const [selectedUserId, setSelectedUserId] = useState<TaskFilterValue>("mine_or_unassigned");

  const filteredTasks = useMemo(() => {
    if (!tasks || !user) return [];

    // Members see only their own tasks + tasks of users they have visibility for
    if (isMembro) {
      const base = tasks.filter(
        (t) =>
          t.assigned_to === user.id ||
          t.created_by === user.id ||
          (t.assigned_to && visibleUsers.includes(t.assigned_to)) ||
          (t.created_by && visibleUsers.includes(t.created_by))
      );
      if (selectedUserId === "all") return base;
      if (selectedUserId === "unassigned") return base.filter((t) => !t.assigned_to);
      if (selectedUserId === "mine") return base.filter((t) => t.assigned_to === user.id);
      // default mine_or_unassigned
      return base.filter((t) => t.assigned_to === user.id || !t.assigned_to);
    }

    if (selectedUserId === "all") return tasks;
    if (selectedUserId === "unassigned") return tasks.filter((t) => !t.assigned_to);
    if (selectedUserId === "mine_or_unassigned") {
      return tasks.filter((t) => t.assigned_to === user.id || !t.assigned_to);
    }

    const targetId = selectedUserId === "mine" ? user.id : selectedUserId;
    return tasks.filter(
      (t) => t.assigned_to === targetId || t.created_by === targetId
    );
  }, [tasks, user, isMembro, visibleUsers, selectedUserId]);

  const canFilter = isAdmin || isGestor || isLider || isMembro;

  return {
    filteredTasks,
    selectedUserId,
    setSelectedUserId,
    canFilter,
  };
}
