import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type MobileEntryKind = "in" | "out";

export interface MobileEntry {
  id: string;
  created_by: string;
  ti_name: string;
  equipamento: string;
  categoria_id: string | null;
  patrimonio: string | null;
  tipo: MobileEntryKind;
  data: string; // yyyy-mm-dd
  es_text: string | null;
  status: "pending";
  created_at: string;
}

export type MobileEntryInput = Pick<
  MobileEntry, "ti_name" | "equipamento" | "categoria_id" | "patrimonio" | "tipo" | "data" | "es_text"
>;

// A tabela é nova e ainda não está nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("inventory_mobile_entries");
const QUERY_KEY = ["inventory", "mobile_entries"];

export function useMobileEntries() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await table().select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MobileEntry[];
    },
  });
}

export function useCreateMobileEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: MobileEntryInput) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await table().insert({ ...input, created_by: user.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message || "Erro ao enviar o lançamento"),
  });
}

export function useDeleteMobileEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await table().delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
    onError: (e: Error) => toast.error(e.message || "Erro ao excluir o lançamento"),
  });
}
