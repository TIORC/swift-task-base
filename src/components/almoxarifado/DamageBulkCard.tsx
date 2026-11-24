import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useImportDamage, useImportDamageHistory, type DamageHistoryRow, type InventoryAsset, type InventoryCollaborator,
  type InventoryItem, type InventoryMovement,
} from "@/hooks/useInventory";
import { buildDamageImportPlan } from "@/lib/damageImport";
import { normalizeText } from "@/lib/assetImport";

// Cola de danos em massa (aba Controle): a prévia mostra o que entra e o que fica de fora, com o motivo.
// Com patrimônio: marca o ativo como danificado e registra a movimentação (mexe no estoque de patrimônios).
// Sem patrimônio: vai só para o histórico de danos, sem mexer no estoque.
export function DamageBulkCard({ assets, items, collaborators, movements, damageHistory }: {
  assets: InventoryAsset[]; items: InventoryItem[]; collaborators: InventoryCollaborator[];
  movements: InventoryMovement[]; damageHistory: DamageHistoryRow[];
}) {
  const [text, setText] = useState("");
  const importDamage = useImportDamage();
  const importHistory = useImportDamageHistory();

  const existingDamageKeys = useMemo(() => {
    const keys = new Set<string>();
    movements
      .filter((m) => m.type === "damage" && m.asset_id)
      .forEach((m) => {
        const d = new Date(m.occurred_at);
        keys.add(`${m.asset_id}|${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      });
    return keys;
  }, [movements]);

  const historyKeys = useMemo(
    () => new Set(damageHistory.map((h) => `${normalizeText(h.item_name)}|${h.year}-${String(h.month).padStart(2, "0")}`)),
    [damageHistory],
  );

  const plan = useMemo(
    () => buildDamageImportPlan(text, { assets, items, collaborators, existingDamageKeys, historyKeys }),
    [text, assets, items, collaborators, existingDamageKeys, historyKeys],
  );

  const total = plan.rows.length + plan.historyRows.length;
  const busy = importDamage.isPending || importHistory.isPending;

  const save = async () => {
    try {
      if (plan.rows.length > 0) await importDamage.mutateAsync(plan.rows);
      if (plan.historyRows.length > 0) {
        await importHistory.mutateAsync(plan.historyRows.map((h) => ({
          item_name: h.item_name,
          item_id: h.item_id,
          quantity: h.quantity,
          year: h.year,
          month: h.month,
          reason: h.reason,
          department: h.department,
          collaborator_id: h.collaborator_id,
          notes: h.notes,
        })));
      }
      setText("");
    } catch {
      /* erro já exibido pelo hook */
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Danos em massa</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cole as linhas da planilha de controle (copie direto do Excel), com as colunas:
          <b> Equipamento; Patrimônio; Tipo de Controle; Ano; Mês; Motivo; Departamento; Colaborador Responsável; De quem; Para quem; Observação</b>.
          Só entram as linhas com Tipo de Controle "Dano". Com patrimônio, o ativo vira danificado. Sem patrimônio, a linha vai
          só para o histórico de danos, sem mexer no estoque. "De quem" e "Para quem" não são guardados.
        </p>
        <Textarea
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"SSD Kingston 480 GB\t\tDano\t2023\tOutubro\tSSD Queimou\tTI\tSETOR DE TI\t\t\tNão pode realizar troca por motivos de segurança."}
        />
        {text.trim() !== "" && (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-xs">
            <p>
              <b>{plan.rows.length}</b> com patrimônio (ativo vira danificado) · <b>{plan.historyRows.length}</b> sem patrimônio (só histórico) ·{" "}
              <b>{plan.skippedNotDamage}</b> de outro tipo · <b>{plan.skippedAlreadyRecorded}</b> já registrado(s)
            </p>
            {plan.unmatchedCollaborators.length > 0 && (
              <p className="text-muted-foreground">
                Colaborador não encontrado (entra sem responsável): {plan.unmatchedCollaborators.join(", ")}
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
          <Button size="sm" onClick={save} disabled={total === 0 || busy}>
            {busy ? "Registrando…" : `Registrar ${total} dano(s)`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
