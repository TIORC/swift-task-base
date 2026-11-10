import { useState } from "react";
import { Archive, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useArquivarAlmoxarifado, useInventoryContainer, useRecuperarAlmoxarifado, type InventoryContainerBatch } from "@/hooks/useInventory";
import { OLD_ASSETS } from "@/data/ativos-antigos";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Tabelas incluídas no backup completo (baixado para o computador).
const BACKUP_TABLES = [
  "inventory_categories",
  "inventory_locations",
  "inventory_departments",
  "inventory_collaborators",
  "inventory_items",
  "inventory_assets",
  "inventory_movements",
  "inventory_requests",
  "inventory_settings",
];

// Lê a tabela inteira em páginas de 1000 linhas (limite padrão do Supabase).
async function fetchAllRows(table: string) {
  const all: Record<string, unknown>[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    // Nome da tabela vem da lista fixa BACKUP_TABLES; o tipo genérico do cliente não aceita nome dinâmico.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + page - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    all.push(...(data ?? []));
    if (!data || data.length < page) break;
  }
  return all;
}

const TABLE_LABELS: Record<string, string> = {
  inventory_items: "Itens",
  inventory_assets: "Patrimônios",
  inventory_movements: "Movimentações",
  inventory_requests: "Solicitações",
  inventory_categories: "Categorias",
  inventory_locations: "Locais",
  inventory_departments: "Departamentos",
  inventory_collaborators: "Colaboradores",
};

const LEGACY_PREVIEW_LIMIT = 200;

const dateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR");

// Mesmo formato CSV usado nas demais abas do almoxarifado (com BOM para o Excel).
function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function BatchCard({ batch, index, canRestore }: { batch: InventoryContainerBatch; index: number; canRestore: boolean }) {
  const [open, setOpen] = useState(index === 0);
  const recuperar = useRecuperarAlmoxarifado();
  const tables = Object.keys(TABLE_LABELS).filter((t) => (batch.snapshot?.[t] ?? []).length > 0 || batch.counts?.[t] !== undefined);
  const stamp = batch.created_at.slice(0, 10);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <button type="button" className="text-left" onClick={() => setOpen((v) => !v)}>
          <CardTitle className="text-base">Descarte de {dateTime(batch.created_at)}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Por {batch.performed_by_email ?? "—"} · {open ? "ocultar detalhes" : "ver detalhes"}
          </p>
        </button>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => downloadCsv([batch.counts as Record<string, unknown>], `container-${stamp}-resumo.csv`)}
          >
            <Download className="mr-2 h-4 w-4" /> Resumo
          </Button>
          {canRestore && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" disabled={recuperar.isPending}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Recuperar almoxarifado
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recuperar o almoxarifado com este lote?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os dados deste lote ({dateTime(batch.created_at)}) voltam para o almoxarifado. Isso só funciona se o
                    almoxarifado estiver vazio. O lote continua guardado no Container.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-green-600 text-white hover:bg-green-700" onClick={() => recuperar.mutate(batch.id)}>
                    Recuperar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {tables.map((t) => (
              <Badge key={t} variant="secondary">
                {TABLE_LABELS[t]}: {batch.counts?.[t] ?? (batch.snapshot?.[t] ?? []).length}
              </Badge>
            ))}
            {tables.length === 0 && <span className="text-sm text-muted-foreground">Lote vazio.</span>}
          </div>
          {tables.map((t) => {
            const rows = (batch.snapshot?.[t] ?? []) as Record<string, unknown>[];
            return (
              <div key={t} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{TABLE_LABELS[t]} ({rows.length})</p>
                  <Button size="sm" variant="ghost" disabled={rows.length === 0} onClick={() => downloadCsv(rows, `container-${stamp}-${TABLE_LABELS[t].toLowerCase()}.csv`)}>
                    <Download className="mr-2 h-4 w-4" /> CSV
                  </Button>
                </div>
                {rows.length > 0 && (
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(rows[0]).map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.slice(0, LEGACY_PREVIEW_LIMIT).map((r, i) => (
                          <TableRow key={(r.id as string) ?? i}>
                            {Object.keys(rows[0]).map((h) => (
                              <TableCell key={h} className="max-w-[220px] truncate text-xs">
                                {typeof r[h] === "object" && r[h] !== null ? JSON.stringify(r[h]) : String(r[h] ?? "")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {rows.length > LEGACY_PREVIEW_LIMIT && (
                  <p className="text-xs text-muted-foreground">Mostrando {LEGACY_PREVIEW_LIMIT} de {rows.length}. Baixe o CSV para ver tudo.</p>
                )}
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

function LegacyCard() {
  const [open, setOpen] = useState(false);
  const rows = OLD_ASSETS as unknown as Record<string, unknown>[];
  const shown = rows.slice(0, LEGACY_PREVIEW_LIMIT);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <button type="button" className="text-left" onClick={() => setOpen((v) => !v)}>
          <CardTitle className="text-base">Ativos antigos (planilha importada)</CardTitle>
          <p className="text-xs text-muted-foreground">{rows.length} registros · {open ? "ocultar" : "ver"}</p>
        </button>
        <Button size="sm" variant="outline" onClick={() => downloadCsv(rows, "container-ativos-antigos.csv")}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2">
          <div className="overflow-x-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ativo</TableHead><TableHead>Categoria</TableHead><TableHead>Patrimônio</TableHead>
                  <TableHead>Status</TableHead><TableHead>Departamento</TableHead><TableHead>Colaborador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((a, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-xs">{String(a.ativo ?? "")}</TableCell>
                    <TableCell className="text-xs">{String(a.categoria ?? "")}</TableCell>
                    <TableCell className="font-mono text-xs">{String(a.patrimonio ?? "")}</TableCell>
                    <TableCell className="text-xs">{String(a.status ?? "")}</TableCell>
                    <TableCell className="text-xs">{String(a.departamento ?? "")}</TableCell>
                    <TableCell className="text-xs">{String(a.colaborador ?? "")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {rows.length > LEGACY_PREVIEW_LIMIT && (
            <p className="text-xs text-muted-foreground">Mostrando {LEGACY_PREVIEW_LIMIT} de {rows.length}. Baixe o CSV para ver tudo.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export function ContainerPanel({ canArchive }: { canArchive: boolean }) {
  const { data: batches = [], isLoading, error } = useInventoryContainer();
  const arquivar = useArquivarAlmoxarifado();
  const recuperar = useRecuperarAlmoxarifado();
  const [exporting, setExporting] = useState(false);

  async function exportBackup() {
    setExporting(true);
    try {
      const backup: Record<string, unknown> = { exported_at: new Date().toISOString() };
      for (const t of BACKUP_TABLES) backup[t] = await fetchAllRows(t);
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-almoxarifado-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado");
    } catch (e) {
      toast.error((e as Error).message || "Não foi possível exportar o backup");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm text-muted-foreground">
            Dados descartados do almoxarifado. Cada limpeza vira um lote aqui, e o almoxarifado fica zerado para novas informações.
          </p>
        </div>
        {canArchive && (
          <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={exportBackup} disabled={exporting}>
            <Download className="mr-2 h-4 w-4" /> {exporting ? "Exportando…" : "Exportar backup (JSON)"}
          </Button>
          {batches.length > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-green-600 text-white hover:bg-green-700" disabled={recuperar.isPending}>
                  <RotateCcw className="mr-2 h-4 w-4" /> Recuperar almoxarifado
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Recuperar o almoxarifado com o lote mais recente?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Os dados do lote de {dateTime(batches[0].created_at)} voltam para o almoxarifado. Isso só funciona se o
                    almoxarifado estiver vazio. O lote continua guardado no Container.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-green-600 text-white hover:bg-green-700" onClick={() => recuperar.mutate(batches[0].id)}>
                    Recuperar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" className="bg-red-900 text-white hover:bg-red-950" disabled={arquivar.isPending}>
                <Archive className="mr-2 h-4 w-4" /> Limpar almoxarifado
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar o almoxarifado?</AlertDialogTitle>
                <AlertDialogDescription>
                  Todos os itens, patrimônios, movimentações, solicitações, categorias, locais, departamentos e colaboradores
                  serão guardados no Container e removidos do almoxarifado. As configurações são mantidas.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction className="bg-red-900 text-white hover:bg-red-950" onClick={() => arquivar.mutate()}>
                  Limpar e guardar no Container
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">Não foi possível carregar o Container. {(error as Error).message}</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

      <LegacyCard />

      {batches.map((b, i) => <BatchCard key={b.id} batch={b} index={i} canRestore={canArchive} />)}

      {!isLoading && !error && batches.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lote arquivado ainda.</p>
      )}
    </div>
  );
}
