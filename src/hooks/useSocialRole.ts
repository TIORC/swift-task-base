import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SocialRole = "admin" | "gestor" | "social_media" | "designer" | "redator" | "cliente";

const sb = supabase as any;

export function useSocialRole() {
  const { user } = useAuth();
  const [roles, setRoles] = useState<SocialRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) { setRoles([]); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data } = await sb.from("user_social_roles").select("role").eq("user_id", user.id);
      setRoles(((data ?? []) as { role: SocialRole }[]).map(r => r.role));
      setLoading(false);
    })();
  }, [user?.id]);

  const isAdmin = roles.includes("admin");
  const isLeader = isAdmin || roles.includes("gestor");
  const isClient = roles.includes("cliente");

  return { roles, isAdmin, isLeader, isClient, loading };
}
