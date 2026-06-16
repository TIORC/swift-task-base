import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

/** Setores do usuário atual */
export function useMySectors() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_sectors", "me", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sectors")
        .select("sector")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r: any) => r.sector as string);
    },
  });
}

/** Setores de um usuário arbitrário (admin) */
export function useUserSectors(userId: string | null) {
  return useQuery({
    queryKey: ["user_sectors", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sectors")
        .select("sector")
        .eq("user_id", userId!);
      if (error) throw error;
      return (data || []).map((r: any) => r.sector as string);
    },
  });
}

/** Define os setores de um usuário (substitui completamente) */
export function useSetUserSectors() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, sectors }: { userId: string; sectors: string[] }) => {
      const { error: delErr } = await supabase
        .from("user_sectors")
        .delete()
        .eq("user_id", userId);
      if (delErr) throw delErr;

      if (sectors.length > 0) {
        const rows = sectors.map((s) => ({ user_id: userId, sector: s }));
        const { error: insErr } = await supabase.from("user_sectors").insert(rows as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["user_sectors", v.userId] });
      qc.invalidateQueries({ queryKey: ["user_sectors", "me"] });
      toast.success("Setores atualizados!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Decide se o usuário enxerga "tudo" (admin/gestor/TI) ou apenas seus setores.
 * Retorna { canSeeAll, allowedSectors, ready }
 */
export function useSectorVisibility() {
  const { profile } = useUserRole();
  const { data: mySectors = [], isLoading } = useMySectors();
  const isPrivileged = profile === "admin" || profile === "gestor";
  const hasTI = mySectors.includes("TI");
  const canSeeAll = isPrivileged || hasTI;
  return {
    canSeeAll,
    allowedSectors: mySectors,
    ready: !isLoading,
  };
}
