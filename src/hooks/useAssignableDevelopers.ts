import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

type P = { id: string; full_name: string | null };

/**
 * Quem pode ser responsável por uma automação:
 * - admin/gestor: qualquer desenvolvedor (e a si mesmo)
 * - dev: somente a si mesmo
 */
export function useAssignableDevelopers(profiles: P[]) {
  const { user } = useAuth();
  const { profile, roles } = useUserRole();
  const isManager = profile === "admin" || profile === "gestor";
  const isDev = roles.includes("dev");

  const { data: devIds = [] } = useQuery({
    queryKey: ["developer-user-ids"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_developer_user_ids");
      if (error) throw error;
      return (data ?? []) as string[];
    },
    staleTime: 5 * 60_000,
  });

  const canAssign = isManager || isDev;
  let options: P[] = [];
  if (isManager) options = profiles.filter(p => devIds.includes(p.id) || p.id === user?.id);
  else if (isDev) options = profiles.filter(p => p.id === user?.id);

  return { canAssign, options, isManager };
}
