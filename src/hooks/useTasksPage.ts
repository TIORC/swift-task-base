import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Task } from "@/hooks/useTasks";

interface TaskPageResult {
  tasks: Task[];
  total: number;
  counts: Record<string, number>;
}

interface PageFilters {
  page: number;
  selectedUserId: string;
  statuses?: string[];
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  recurring: boolean;
  weekday?: string;
}

export function useTasksPage(filters: PageFilters, ready: boolean) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", "page", user?.id, filters],
    enabled: !!user && ready,
    queryFn: async (): Promise<TaskPageResult> => {
      const { data, error } = await supabase.rpc("tasks_page", {
        _page: filters.page,
        _selected_user: filters.selectedUserId,
        _statuses: filters.statuses,
        _priority: filters.priority,
        _date_from: filters.dateFrom,
        _date_to: filters.dateTo,
        _recurring: filters.recurring,
        _weekday: filters.weekday,
      });
      if (error) throw error;
      return data as unknown as TaskPageResult;
    },
  });
}

export function useLinkedTask(id: string | null) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tasks", "linked", user?.id, id],
    enabled: !!user && !!id,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase.from("tasks").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as Task | null;
    },
  });
}