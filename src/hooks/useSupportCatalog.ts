import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type CatalogKind = "system" | "site" | "equipment";

export interface CatalogEntry {
  id: string;
  kind: CatalogKind;
  name: string;
  active: boolean;
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

  const items = kind ? data.filter((e) => e.kind === kind) : data;

  return { items, all: data, isLoading, addEntry };
}
