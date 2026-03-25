import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DelayedTask {
  task_title: string;
  reason: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
}

export interface PrioritySuggestion {
  task_title: string;
  current_priority: string;
  suggested_priority: string;
  reason: string;
}

export interface GeneralInsight {
  insight: string;
  action: string;
}

export interface AIInsights {
  delayed_tasks: DelayedTask[];
  priority_suggestions: PrioritySuggestion[];
  general_insights: GeneralInsight[];
}

export function useAIInsights(enabled = true) {
  return useQuery<AIInsights>({
    queryKey: ["ai-insights"],
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-insights");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
  });
}
