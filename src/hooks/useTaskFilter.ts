import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Task } from "@/hooks/useTasks";

export function useTaskFilter(tasks: Task[] | undefined) {
  const { user } = useAuth();
  const { isAdmin, isGestor, isMembro } = useUserRole();
  const [selectedUserId, setSelectedUserId] = useState<string | "all" | "mine">("mine");

  const filteredTasks = useMemo(() => {
    if (!tasks || !user) return [];

    // Members always see only their own tasks
    if (isMembro) {
      return tasks.filter(
        (t) => t.assigned_to === user.id || t.created_by === user.id
      );
    }

    // Admin/Gestor with "all" filter
    if (selectedUserId === "all") {
      return tasks;
    }

    // "mine" or specific user
    const targetId = selectedUserId === "mine" ? user.id : selectedUserId;
    return tasks.filter(
      (t) => t.assigned_to === targetId || t.created_by === targetId
    );
  }, [tasks, user, isMembro, selectedUserId]);

  const canFilter = isAdmin || isGestor;

  return {
    filteredTasks,
    selectedUserId,
    setSelectedUserId,
    canFilter,
  };
}
