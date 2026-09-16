import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const sb = supabase as any;

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

/** Mapa userId -> setores (admin: listagem de usuários) */
export function useAllUserSectors() {
  return useQuery({
    queryKey: ["user_sectors", "all"],
    queryFn: async () => {
      const [{ data: rows }, { data: globals }] = await Promise.all([
        sb.from("user_sectors").select("user_id, sector"),
        sb.from("user_global_sector_access").select("user_id"),
      ]);
      const map: Record<string, string[]> = {};
      (rows || []).forEach((r: any) => {
        map[r.user_id] = [...(map[r.user_id] || []), r.sector];
      });
      const globalSet = new Set<string>((globals || []).map((g: any) => g.user_id));
      return { map, globalSet };
    },
  });
}

/** Permissão explícita de acesso global (todos os setores) de um usuário */
export function useUserGlobalSectorAccess(userId: string | null) {
  return useQuery({
    queryKey: ["user_global_sector_access", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await sb
        .from("user_global_sector_access")
        .select("user_id")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  });
}

/** Acesso global do usuário autenticado */
export function useMyGlobalSectorAccess() {
  const { user } = useAuth();
  const { profile } = useUserRole();
  const q = useUserGlobalSectorAccess(user?.id ?? null);
  return {
    isGlobal: profile === "admin" || !!q.data,
    isLoading: q.isLoading,
  };
}

/** Define os setores de um usuário (substitui completamente) + acesso global + histórico */
export function useSetUserSectors() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      userId,
      sectors,
      globalAccess,
      previousSectors = [],
    }: {
      userId: string;
      sectors: string[];
      globalAccess?: boolean;
      previousSectors?: string[];
    }) => {
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

      if (globalAccess !== undefined) {
        if (globalAccess) {
          const { error } = await sb
            .from("user_global_sector_access")
            .upsert({ user_id: userId, granted_by: user?.id ?? null });
          if (error) throw error;
        } else {
          const { error } = await sb
            .from("user_global_sector_access")
            .delete()
            .eq("user_id", userId);
          if (error) throw error;
        }
      }

      const changed =
        previousSectors.slice().sort().join("|") !== sectors.slice().sort().join("|");
      if (changed) {
        await sb.from("user_sector_history").insert({
          user_id: userId,
          old_sectors: previousSectors,
          new_sectors: sectors,
          changed_by: user?.id ?? null,
        });
      }
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["user_sectors"] });
      qc.invalidateQueries({ queryKey: ["user_global_sector_access"] });
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Setor atualizado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

/**
 * Visibilidade de automações por setor.
 * canSeeAll: permissão explícita de todos os setores (admin ou liberação individual).
 * hasSector: usuário possui ao menos um setor vinculado.
 */
export function useSectorVisibility() {
  const { data: mySectors = [], isLoading } = useMySectors();
  const { isGlobal, isLoading: loadingGlobal } = useMyGlobalSectorAccess();

  return {
    canSeeAll: isGlobal,
    allowedSectors: mySectors,
    hasSector: mySectors.length > 0,
    ready: !isLoading && !loadingGlobal,
  };
}
