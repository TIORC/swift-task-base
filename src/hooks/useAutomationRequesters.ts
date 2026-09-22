import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

const sb = supabase as any;

export interface AutomationRequester {
  user_id: string;
  sector: string;
}

/**
 * Indica se o usuário atual é um Solicitante de Automações cadastrado
 * (whitelist) — e, portanto, pode abrir novas solicitações. Admin sempre pode.
 */
export function useIsAutomationRequester() {
  const { user } = useAuth();
  const { profile } = useUserRole();

  const query = useQuery({
    queryKey: ["automation_requesters", "me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await sb
        .from("automation_requesters")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });

  return {
    canRequest: query.data === true || profile === "admin",
    isLoadingRequester: query.isLoading,
  };
}

/** Lista completa de Solicitantes de Automações (administração). */
export function useAutomationRequesters() {
  return useQuery({
    queryKey: ["automation_requesters", "all"],
    queryFn: async () => {
      const { data, error } = await sb.from("automation_requesters").select("user_id, sector");
      if (error) throw error;
      return (data || []) as AutomationRequester[];
    },
  });
}