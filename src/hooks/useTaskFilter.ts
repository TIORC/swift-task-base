import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyTaskVisibility } from "@/hooks/usePermissions";
import { Task } from "@/hooks/useTasks";

export function useTaskFilter(tasks: Task[] | undefined) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isLider, isMembro } = useUserRole();
  const { visibleUsers } = useMyTaskVisibility();
  const [selectedUserId, setSelectedUserId] = useState<string | "all" | "mine">("mine");

  const filteredTasks = useMemo(() => {
    if (!tasks || !user) return [];

    // Members see only their own tasks + tasks of users they have visibility for
    if (isMembro) {
      return tasks.filter(
        (t) =>
          t.assigned_to === user.id ||
          t.created_by === user.id ||
          (t.assigned_to && visibleUsers.includes(t.assigned_to)) ||
          (t.created_by && visibleUsers.includes(t.created_by))
      );
    }

    // Admin/Gestor/Lider with "all" filter
    if (selectedUserId === "all") {
      return tasks;
    }

    // "mine" or specific user
    const targetId = selectedUserId === "mine" ? user.id : selectedUserId;
    return tasks.filter(
      (t) => t.assigned_to === targetId || t.created_by === targetId
    );
  }, [tasks, user, isMembro, visibleUsers, selectedUserId]);

  const canFilter = isAdmin || isGestor || isLider;

  return {
    filteredTasks,
    selectedUserId,
    setSelectedUserId,
    canFilter,
  };
}
