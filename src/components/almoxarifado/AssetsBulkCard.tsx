import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Package } from "lucide-react";
import { useImportAssets, type InventoryAsset, type InventoryCategory, type InventoryCollaborator, type InventoryItem } from "@/hooks/useInventory";
import { buildAssetImportPlan } from "@/lib/assetImport";

// Cola de ativos em massa: a prévia mostra o que entra, o que é criado e o que fica de fora (com o motivo).
export function AssetsBulkCard({ assets, items, categories, collaborators }: {
  assets: InventoryAsset[]; items: InventoryItem[]; categories: InventoryCategory[]; collaborators: InventoryCollaborator[];
}) {
  const [text, setText] = useState("");
  const importAssets = useImportAssets();
  const plan = useMemo(
    () => buildAssetImportPlan(text, { assets, items, categories, collaborators }),
    [text, assets, items, categories, collaborators],
  );

  const save = async () => {
    try {
      await importAssets.mutateAsync({
        newItems: plan.newItems,
        rows: plan.rows.map((r) => ({
          patrimony: r.patrimony,
          status: r.status,
          department: r.department,
          collaboratorId: r.collaboratorId,
          itemId: r.itemId,
          newItemKey: r.newItemKey,
        })),
      });
      setText("");
    } catch {
      /* erro já exibido pelo hook */
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Ativos em massa</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cole aqui as linhas da planilha (dá para copiar direto do Excel), com as colunas:
          <b> Ativo; Categoria; Patrimônio; Status; Descrição; Departamento; Colaborador Responsável</b>.
          Linhas sem patrimônio não são ativos e ficam de fora. Se o ativo não existir como item, ele é criado.
          O colaborador precisa estar cadastrado (nome completo ou primeiro nome, se for único).
          A coluna Observação não é gravada por aqui.
        </p>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Computador Daten\tComputador\t00042\tEm Uso\t\tPessoal\tLucas"}
        />
        {text.trim() !== "" && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <p><b>{plan.rows.length}</b> ativo(s) para cadastrar · <b>{plan.newItems.length}</b> item(ns) novo(s) a criar · <b>{plan.skippedNoPatrimony}</b> linha(s) sem patrimônio (ignoradas)</p>
            {plan.newItems.length > 0 && (
              <p className="text-muted-foreground">Novos itens: {plan.newItems.map((i) => i.name).join(", ")}</p>
            )}
            {plan.unmatchedCollaborators.length > 0 && (
              <p className="text-muted-foreground">
                Colaborador não encontrado (esses ativos entram sem responsável): {plan.unmatchedCollaborators.join(", ")}
              </p>
            )}
            {plan.errors.length > 0 && (
              <div className="text-destructive">
                <p className="font-medium">{plan.errors.length} linha(s) com erro ficam de fora:</p>
                {plan.errors.map((e) => <p key={e}>{e}</p>)}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-end">
          <Button size="sm" onClick={save} disabled={plan.rows.length === 0 || importAssets.isPending}>
            {importAssets.isPending ? "Cadastrando…" : `Cadastrar ${plan.rows.length} ativo(s)`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
