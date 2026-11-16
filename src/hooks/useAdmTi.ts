import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AdmTiRow {
  id: string;
  ativo: string;
  categoria: string;
  patrimonio: string;
  status: string;
  descricao: string;
  departamento: string;
  colaborador: string;
  historico: string;
  observacao: string;
}

const QUERY_KEY = ["inventory", "adm_ti"];

// A tabela é nova e ainda não está nos tipos gerados do Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const table = () => (supabase as any).from("inventory_adm_ti");

export function useAdmTiRows() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await table().select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AdmTiRow[];
    },
  });
}

/** Grava a planilha inteira de uma vez (inclui remoção das linhas que saíram). */
export function useSaveAdmTi() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: AdmTiRow[]) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).rpc("salvar_adm_ti", { _rows: rows });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("ADM TI gravado");
      return qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
    onError: (e: Error) => toast.error(e.message || "Não foi possível gravar a aba ADM TI"),
  });
}
