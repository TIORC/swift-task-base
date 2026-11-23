import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type CatalogKind = "system" | "site" | "equipment" | "solution";

export interface CatalogEntry {
  id: string;
  kind: CatalogKind;
  name: string;
  active: boolean;
}

/** Só este usuário (TI Maracas) edita e exclui itens do catálogo de suporte. */
export const SUPPORT_CATALOG_EDITOR_EMAIL = "timaracas@orcoma.com.br";

export function canEditSupportCatalog(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === SUPPORT_CATALOG_EDITOR_EMAIL;
}

export function useSupportCatalog(kind?: CatalogKind) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data = [], isLoading } = useQuery({
    queryKey: ["support-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("support_catalog")
        .select("id, kind, name, active")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return (data ?? []) as CatalogEntry[];
    },
  });

  const addEntry = useMutation({
    mutationFn: async ({ kind, name }: { kind: CatalogKind; name: string }) => {
      const clean = name.trim();
      if (!clean) throw new Error("Informe um nome.");
      const { data, error } = await (supabase as any)
        .from("support_catalog")
        .insert({ kind, name: clean, created_by: user?.id ?? null })
        .select("id, kind, name, active")
        .single();
      if (error) throw error;
      return data as CatalogEntry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["support-catalog"] });
      toast.success(`"${entry.name}" cadastrado com sucesso.`);
    },
    onError: (e: any) =>
      toast.error(
        e?.code === "23505" ? "Esse registro já existe." : e?.message || "Falha ao cadastrar."
      ),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const clean = name.trim();
      if (!clean) throw new Error("Informe um nome.");
      const { data, error } = await (supabase as any)
        .from("support_catalog")
        .update({ name: clean })
        .eq("id", id)
        .select("id, kind, name, active");
      if (error) throw error;
      // Sem permissão, o banco não altera nenhuma linha e não retorna erro.
      if (!data?.length) throw new Error("Sem permissão para editar este item.");
      return data[0] as CatalogEntry;
    },
    onSuccess: (entry) => {
      queryClient.invalidateQueries({ queryKey: ["support-catalog"] });
      toast.success(`Atualizado para "${entry.name}".`);
    },
    onError: (e: any) =>
      toast.error(
        e?.code === "23505" ? "Esse registro já existe." : e?.message || "Falha ao editar."
      ),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any)
        .from("support_catalog")
        .delete()
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data?.length) throw new Error("Sem permissão para excluir este item.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["support-catalog"] });
      toast.success("Item excluído.");
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao excluir."),
  });

  const items = kind ? data.filter((e) => e.kind === kind) : data;

  return { items, all: data, isLoading, addEntry, updateEntry, deleteEntry };
}
