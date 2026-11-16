import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useSaveEntryBatch, useSaveExitBatch, useUpdateItem, useUpdateMovementText,
  type InventoryCategory, type InventoryCollaborator, type InventoryItem,
} from "@/hooks/useInventory";
import { parseLedgerPaste, type Field, type ParsedLedgerRow } from "@/lib/ledgerPaste";

const brDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

// Campos que podem receber uma coluna colada sozinha.
const FIELD_OPTIONS: { value: Field; label: string }[] = [
  { value: "equip", label: "Equipamento" },
  { value: "cat", label: "Categoria" },
  { value: "pat", label: "Patrimônio" },
  { value: "tipo", label: "Tipo de controle" },
  { value: "data", label: "Data" },
  { value: "qtd", label: "Quantidade" },
  { value: "dept", label: "Departamento" },
  { value: "resp", label: "Responsável" },
  { value: "es", label: "E&S" },
  { value: "obs", label: "Observação" },
];

// Cola de planilha na aba Entradas e Saídas: ao colar várias linhas (Ctrl+V), mostra uma prévia
// e lança as linhas válidas. Colar uma célula só continua funcionando como antes.
export function LedgerPasteImport({ items, categories, collaborators }: {
  items: InventoryItem[]; categories: InventoryCategory[]; collaborators: InventoryCollaborator[];
}) {
  const saveEntry = useSaveEntryBatch();
  const saveExit = useSaveExitBatch();
  const updateItem = useUpdateItem();
  const updateText = useUpdateMovementText();
  // Texto colado e, se foi uma coluna só, o campo ao qual ela pertence.
  const [paste, setPaste] = useState<{ text: string; field: Field | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const stopRef = useRef(false);

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.tagName === "TEXTAREA") return;
      const text = e.clipboardData?.getData("text/plain") ?? "";
      const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
      if (!text.includes("\t") && lines.length < 2) return; // uma célula: comportamento normal
      e.preventDefault();
      // Sem tabulação = uma coluna só: por padrão vai para Equipamento, e o usuário troca na prévia.
      setPaste({ text, field: text.includes("\t") ? null : "equip" });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  const rows = useMemo<ParsedLedgerRow[] | null>(
    () => (paste ? parseLedgerPaste(paste.text, { categories, items, collaborators }, paste.field ?? undefined) : null),
    [paste, categories, items, collaborators],
  );

  const valid = rows?.filter((r) => r.errors.length === 0) ?? [];
  const invalidCount = (rows?.length ?? 0) - valid.length;

  // Lança uma linha por vez (cada uma com a mesma gravação da linha de digitação).
  // "Parar" pede a interrupção: a linha em andamento termina e as demais não são lançadas.
  const importAll = async () => {
    setBusy(true);
    stopRef.current = false;
    setProgress({ done: 0, total: valid.length });
    let ok = 0;
    let fail = 0;
    let stopped = false;
    for (const r of valid) {
      if (stopRef.current) { stopped = true; break; }
      try {
        if (r.kind === "in" && r.entryRow) {
          const res = await saveEntry.mutateAsync([r.entryRow]);
          if (!res.ok) { fail++; continue; }
          if (r.categoryId) {
            const { data } = await supabase.from("inventory_items")
              .select("id").eq("name", r.entryRow.name).order("created_at", { ascending: false }).limit(1);
            const newId = data?.[0]?.id;
            if (newId) await updateItem.mutateAsync({ id: newId, category_id: r.categoryId } as never);
          }
        } else if (r.exitRow) {
          const res = await saveExit.mutateAsync([r.exitRow]);
          if (!res.ok) { fail++; continue; }
          const item = items.find((i) => i.id === r.exitRow?.item_id);
          if (r.categoryId && item && item.category_id !== r.categoryId) {
            await updateItem.mutateAsync({ id: item.id, category_id: r.categoryId } as never);
          }
        }
        if (r.es) {
          const { data } = await supabase.from("inventory_movements")
            .select("id").eq("type", r.kind).order("created_at", { ascending: false }).limit(1);
          const id = data?.[0]?.id;
          if (id) await updateText.mutateAsync({ id, field: "es_text", value: r.es });
        }
        ok++;
      } catch {
        fail++;
      }
      setProgress({ done: ok + fail, total: valid.length });
    }
    const naoLancadas = valid.length - ok - fail;
    setBusy(false);
    setProgress(null);
    setPaste(null);
    if (stopped) {
      toast.warning(`Lançamento interrompido: ${ok} lançado(s), ${naoLancadas} não lançado(s). As já lançadas continuam no histórico.`);
    } else if (fail === 0) {
      toast.success(`${ok} lançamento(s) importado(s)`);
    } else {
      toast.error(`${ok} importado(s), ${fail} com erro. Confira o histórico antes de colar de novo.`);
    }
  };

  const requestStop = () => { stopRef.current = true; };

  return (
    <>
      <p className="text-xs text-muted-foreground">
        Dica: copie linhas do Excel e cole nesta aba (Ctrl+V) para lançar várias de uma vez.
      </p>

      <Dialog open={paste !== null} onOpenChange={(o) => { if (!o) { if (busy) requestStop(); else setPaste(null); } }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Conferir linhas coladas</DialogTitle>
            <DialogDescription>
              {valid.length} linha(s) pronta(s) para lançar
              {invalidCount > 0 && `, ${invalidCount} com erro (não serão lançadas)`}.
            </DialogDescription>
          </DialogHeader>

          {paste?.field && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span>Coluna colada vai para:</span>
              <Select value={paste.field} onValueChange={(v) => setPaste({ ...paste, field: v as Field })}>
                <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FIELD_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                Os demais campos ficam no padrão (Entrada e data de hoje).
              </span>
            </div>
          )}

          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Equipamento</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Patrimônio</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((r) => (
                  <TableRow key={r.line} className={r.errors.length ? "bg-red-50" : undefined}>
                    <TableCell className="text-xs">{r.line}</TableCell>
                    <TableCell className="text-xs">{r.kind === "in" ? "Entrada" : "Saída"}</TableCell>
                    <TableCell className="text-xs">{r.name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.categoryName || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.patrimony ?? "—"}</TableCell>
                    <TableCell className="text-xs">{brDate(r.when)}</TableCell>
                    <TableCell className="text-xs">{r.responsible || "—"}</TableCell>
                    <TableCell className="text-xs">
                      {r.errors.map((e) => <div key={e} className="text-destructive">{e}</div>)}
                      {r.warnings.map((w) => <div key={w} className="text-amber-600">{w}</div>)}
                      {r.errors.length === 0 && r.warnings.length === 0 && <span className="text-green-700">OK</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2">
            {busy ? (
              <>
                <span className="mr-auto text-sm text-muted-foreground">
                  Lançando {progress?.done ?? 0} de {progress?.total ?? valid.length}…
                </span>
                <Button variant="destructive" onClick={requestStop} disabled={stopRef.current}>
                  {stopRef.current ? "Parando…" : "Parar"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setPaste(null)}>Cancelar</Button>
                <Button onClick={importAll} disabled={valid.length === 0}>
                  {`Lançar ${valid.length} linha(s)`}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
