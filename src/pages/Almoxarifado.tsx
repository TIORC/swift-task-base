import { Fragment, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { Package, Plus, AlertTriangle, Boxes, DollarSign, Wrench, Trash2, Search, ShoppingCart, Send, Settings, Download, History, ChevronDown, Grid3x3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useInventoryItems, useInventoryAssets, useInventoryMovements, useInventoryRequests,
  useInventoryCategories, useInventoryLocations, useCanWriteInventory, useCanManageInventory,
  useCreateCategory, useCreateLocation, useCreateRequest, useUpdateRequest,
  useInventoryDepartments, useSaveDepartment,
  useInventoryCollaborators, useInventorySettings, useUpdateInventorySettings, useRecoverDamaged,
  useDeactivateItem, useDeleteMovement, useDeleteAsset, useDeleteRequest,
  useCanZerarEstoque, useZerarEstoque,
  useUpdateCategory, useDeleteCategory, useUpdateLocation, useDeleteLocation, useDeleteDepartment,
  useSaveEntryBatch, useSaveExitBatch, useUpdateItem,
} from "@/hooks/useInventory";
import { ItemFormDialog } from "@/components/almoxarifado/ItemFormDialog";
import { ColumnFilter } from "@/components/almoxarifado/ColumnFilter";
import { type OldAsset } from "@/data/ativos-antigos";
import { ContainerPanel } from "@/components/almoxarifado/ContainerPanel";
import { PURCHASED_NOTE } from "@/components/almoxarifado/EntryDialog";
import { EditableCell } from "@/components/almoxarifado/EditableCell";
import { MobileEntryForm, PendingList } from "@/components/almoxarifado/MobileEntryPanel";
import { useProfile } from "@/hooks/useProfile";
import { useAuth } from "@/hooks/useAuth";
import { SendToExitDialog } from "@/components/almoxarifado/SendToExitDialog";
import { toast } from "sonner";
import { EntryFilters, EMPTY_ENTRY_FILTERS, filterEntries, hasActiveEntryFilters, type EntryFilterState } from "@/components/almoxarifado/EntryFilters";
import { AssetGrid } from "@/components/almoxarifado/AssetGrid";
import { DashboardCharts } from "@/components/almoxarifado/DashboardCharts";
import { ExitFilters, EMPTY_EXIT_FILTERS, filterExits, hasActiveExitFilters, type ExitFilterState } from "@/components/almoxarifado/ExitFilters";
import { ExitDialog } from "@/components/almoxarifado/ExitDialog";
import { StatusChangeDialog } from "@/components/almoxarifado/StatusChangeDialog";
import { ItemUpgradeDialog } from "@/components/almoxarifado/ItemUpgradeDialog";
import { AssetFormDialog } from "@/components/almoxarifado/AssetFormDialog";
import { CollaboratorsPanel } from "@/components/almoxarifado/CollaboratorsPanel";
import { MovementFormDialog } from "@/components/almoxarifado/MovementFormDialog";
import { RowActions } from "@/components/almoxarifado/RowActions";
import { TablePagination } from "@/components/almoxarifado/TablePagination";
import { StockBadge, StatusTag, ItemStatusTags } from "@/components/almoxarifado/StockBadge";
import { MovementTextCell } from "@/components/almoxarifado/MovementTextCell";
import { NewLedgerRow } from "@/components/almoxarifado/NewLedgerRow";
import { CategoryCell } from "@/components/almoxarifado/CategoryCell";
import type { InventoryItem, InventoryAsset, InventoryMovement, InventoryRequest, InventoryLocation, InventoryCollaborator, MovementType } from "@/hooks/useInventory";
import { SECTORS } from "@/types/sectors";
import { agruparPorTipo, resumoEstoque } from "@/lib/inventory-stock";
import { usePageTheme } from "@/hooks/usePageTheme";

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = (s: string) => new Date(s).toLocaleString("pt-BR");
// Data/hora no formato da célula editável: dd/mm/aaaa hh:mm (hora local).
const brDateTime = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
const parseBrDateTime = (s: string): string | null => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const [d, mo, y, h, mi] = m.slice(1).map(Number);
  const date = new Date(y, mo - 1, d, h, mi);
  return date.getDate() === d ? date.toISOString() : null;
};
// Separa o texto de "comprado" das observações gravadas na movimentação.
const splitEntryNotes = (notes: string | null) => {
  const raw = notes ?? "";
  if (!raw.startsWith(PURCHASED_NOTE)) return { purchased: false, obs: raw };
  return { purchased: true, obs: raw.slice(PURCHASED_NOTE.length).replace(/^ — /, "") };
};
// Texto sem acento e sem maiúsculas, para comparar nas buscas.
const normalizeSearch = (s: string) => s.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const alphaInitial =(name: string) => name.trim().charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const MOV_LABELS: Record<MovementType, string> = {
  in: "Entrada", out: "Saída", transfer: "Transferência", damage: "Dano",
  discard: "Descarte", adjust: "Ajuste", assign: "Atribuição", return: "Devolução",
  upgrade: "Atualização",
};

// Destaque de cor do tipo na tabela "Últimas movimentações" (regras em index.css).
const MOV_TYPE_CLASS: Partial<Record<MovementType, string>> = {
  in: "mov-type-in",
  out: "mov-type-out",
};

function downloadCsv<T extends object>(rows: T[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify((r as Record<string, unknown>)[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function RowActionButton({
  icon: Icon, label, title, destructive, onClick,
}: {
  icon: LucideIcon; label: string; title: string; destructive?: boolean; onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="outline"
      aria-label={title}
      title={title}
      onClick={onClick}
      className={[
        "h-7 w-7 shrink-0 justify-center rounded-md border-blue-300 bg-blue-200 px-0 text-black shadow-sm hover:bg-blue-300 hover:text-black",
        "gap-1.5 px-2.5 text-xs 2xl:w-auto 2xl:justify-start",
        destructive ? "border-blue-300 text-black hover:bg-blue-300 hover:text-black" : "",
      ].join(" ")}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="hidden 2xl:inline">{label}</span>
    </Button>
  );
}

// Botão com rótulo visível, usado nos cartões do celular (onde não há coluna para o texto).
function MobileAction({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={onClick}
      className="h-8 gap-1.5 px-2.5 text-xs border-blue-300 bg-blue-200 text-black shadow-sm hover:bg-blue-300 hover:text-black"
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {label}
    </Button>
  );
}

const ENTRY_PAGE_SIZE = 30;
// Uma linha da aba Saídas: ou uma saída do sistema (mov) ou um ativo antigo (old).
type OutRow = { key: string; responsible: string; mov?: InventoryMovement; old?: OldAsset };

type OutColumn = "item" | "qtd" | "responsavel" | "departamento" | "patrimonio" | "motivo";
const OUT_COLUMNS: OutColumn[] = ["item", "qtd", "responsavel", "departamento", "patrimonio", "motivo"];
type EntryColumn = "item" | "qtd" | "valorUnit" | "valorTotal" | "patrimonio" | "local";
const ENTRY_COLUMNS: EntryColumn[] = ["item", "qtd", "valorUnit", "valorTotal", "patrimonio", "local"];
const ENTRY_COLUMN_LABELS: Record<EntryColumn, string> = {
  item: "Item", qtd: "Qtd", valorUnit: "Valor unit.", valorTotal: "Valor total", patrimonio: "Patrimônio", local: "Local",
};
type LedgerColumn = "item" | "categoria" | "patrimonio" | "tipo" | "data" | "departamento" | "es" | "observacao";
const LEDGER_COLUMNS: LedgerColumn[] = ["item", "categoria", "patrimonio", "tipo", "data", "departamento", "es", "observacao"];
const LEDGER_COLUMN_LABELS: Record<LedgerColumn, string> = {
  item: "Equipamento", categoria: "Categoria", patrimonio: "Patrimônio", tipo: "Tipo de controle",
  data: "Data", departamento: "Departamento/Saídas", es: "E&S", observacao: "Observação",
};
const OUT_COLUMN_LABELS: Record<OutColumn, string> = {
  item: "Item", qtd: "Qtd", responsavel: "Responsável", departamento: "Departamento", patrimonio: "Patrimônio", motivo: "Motivo",
};

type ViewMode = "desktop" | "mobile";

// Alterna a prévia do layout: Desktop (largura total) ou Mobile (largura de celular).
function ViewModeToggle({ value, onChange }: { value: ViewMode; onChange: (v: ViewMode) => void }) {
  const modes: { key: ViewMode; label: string }[] = [
    { key: "desktop", label: "Desktop" },
    { key: "mobile", label: "Mobile" },
  ];
  return (
    <div className="relative inline-flex rounded-full border bg-white p-1 shadow-sm">
      {modes.map((m) => {
        const active = value === m.key;
        return (
          <button
            key={m.key}
            type="button"
            onClick={() => onChange(m.key)}
            className={`relative isolate rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active ? "text-white" : "text-slate-700 hover:text-slate-900"}`}
          >
            {active && (
              <motion.span
                layoutId="almox-view-mode"
                className="absolute inset-0 -z-10 rounded-full bg-blue-600"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Almoxarifado() {
  usePageTheme("almoxarifado");
  const canWrite = useCanWriteInventory();
  const canManage = useCanManageInventory();
  // Nome do TI para o lançamento pelo celular: vem da conta logada.
  const { profile } = useProfile();
  const { user } = useAuth();
  const mobileTiName = profile?.full_name || user?.email || "";
  const { data: items = [] } = useInventoryItems();
  const { data: assets = [] } = useInventoryAssets();
  const { data: movements = [] } = useInventoryMovements();
  const { data: categories = [] } = useInventoryCategories();
  const { data: locations = [] } = useInventoryLocations();
  const { data: collaborators = [] } = useInventoryCollaborators();
  const { data: settings } = useInventorySettings();
  const recover = useRecoverDamaged();
  const deactivate = useDeactivateItem();
  const delMovement = useDeleteMovement();
  const delAsset = useDeleteAsset();

  const [tab, setTab] = useState("dashboard");
  const [viewMode, setViewMode] = useState<ViewMode>("desktop");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [collabFilter, setCollabFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [outColFilters, setOutColFilters] = useState<Partial<Record<OutColumn, string[]>>>({});
  const [outPage, setOutPage] = useState(1);
  const [outPageSize, setOutPageSize] = useState(100);

  const saveEntryBatch = useSaveEntryBatch();
  const saveExitBatch = useSaveExitBatch();
  const updateItem = useUpdateItem();
  const [assetGridOpen, setAssetGridOpen] = useState(false);
  // Saídas: rascunho digitado e filtro pesquisado (mesmo padrão das entradas).
  const [exitDraft, setExitDraft] = useState<ExitFilterState>(EMPTY_EXIT_FILTERS);
  const [exitFilters, setExitFilters] = useState<ExitFilterState>(EMPTY_EXIT_FILTERS);
  // entryDraft: o que está sendo digitado; entryFilters: o que foi pesquisado (aplicado à tabela).
  const [entryDraft, setEntryDraft] = useState<EntryFilterState>(EMPTY_ENTRY_FILTERS);
  const [entryFilters, setEntryFilters] = useState<EntryFilterState>(EMPTY_ENTRY_FILTERS);
  const [entryColFilters, setEntryColFilters] = useState<Partial<Record<EntryColumn, string[]>>>({});
  const [outSearch, setOutSearch] = useState("");
  const outTerm = normalizeSearch(outSearch);
  // Os ativos antigos vêm do arquivo fixo; as edições ficam nesta lista até recarregar a página.
  // Os ativos antigos foram para o Container: a lista de saídas começa vazia.
  const [oldData, setOldData] = useState<OldAsset[]>([]);
  const canZerar = useCanZerarEstoque();
  const [lastCreatedItem, setLastCreatedItem] = useState<string | null>(null);
  const [exitDlg, setExitDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [statusDlg, setStatusDlg] = useState<{ open: boolean; item?: InventoryItem | null; mode: "damage" | "discard" }>({ open: false, mode: "damage" });
  const [upgradeDlg, setUpgradeDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [itemDlg, setItemDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [assetDlg, setAssetDlg] = useState<{ open: boolean; asset?: InventoryAsset | null }>({ open: false });
  const [movDlg, setMovDlg] = useState<{ open: boolean; movement?: InventoryMovement | null }>({ open: false });
  const [sendEntry, setSendEntry] = useState<InventoryMovement | null>(null);
  const [detail, setDetail] = useState<InventoryItem | null>(null);

  const includeDamaged = settings?.include_damaged_in_value ?? true;

  const filteredItems = useMemo(() => items.filter((i) => {
    if (categoryFilter !== "all" && i.category_id !== categoryFilter) return false;
    if (collabFilter !== "all" && i.responsible_collaborator_id !== (collabFilter === "none" ? null : collabFilter)) return false;
    if (deptFilter !== "all") {
      const dept = collaborators.find((c) => c.id === i.responsible_collaborator_id)?.department ?? null;
      if (dept !== deptFilter) return false;
    }
    if (search && !`${i.name} ${i.sku ?? ""} ${i.brand ?? ""} ${i.model ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, search, categoryFilter, collabFilter, deptFilter, collaborators]);


  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const collabName = (id: string | null) => collaborators.find((c) => c.id === id)?.full_name ?? "—";
  const collabDept = (id: string | null) => collaborators.find((c) => c.id === id)?.department ?? "—";
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  // Entradas que já foram mandadas para saída somem da lista (continuam no histórico e no estoque).
  const sentEntryIds = useMemo(
    () => new Set(movements.map((m) => m.source_movement_id).filter((id): id is string => !!id)),
    [movements],
  );
  const entryMovements = useMemo(
    () => movements.filter((m) => m.type === "in" && !sentEntryIds.has(m.id)),
    [movements, sentEntryIds],
  );
  const entryColumnValue = (col: EntryColumn, m: InventoryMovement): string => {
    switch (col) {
      case "item": return itemName(m.item_id);
      case "qtd": return String(m.quantity);
      case "valorUnit": return currency(m.unit_price ?? 0);
      case "valorTotal": return currency((m.unit_price ?? 0) * m.quantity);
      case "patrimonio": return m.patrimony_number || "N/A";
      case "local": return locName(m.to_location_id);
    }
  };
  const entryColumnOptions = (col: EntryColumn) =>
    Array.from(new Set(entryMovements.map((m) => entryColumnValue(col, m))))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  // Ordem alfabética pelo colaborador responsável; sem responsável vai para o fim.
  const oldFiltered = useMemo(() => {
    return oldData
      .filter((a) => !outTerm || [...Object.values(a), "01/01/2020"].some((v) => normalizeSearch(v).includes(outTerm)))
      .sort((a, b) => {
        if (!a.colaborador !== !b.colaborador) return a.colaborador ? -1 : 1;
        return a.colaborador.localeCompare(b.colaborador, "pt-BR", { sensitivity: "base" })
          || a.ativo.localeCompare(b.ativo, "pt-BR", { sensitivity: "base" });
      });
  }, [oldData, outTerm]);
  // Nome do item danificado: grava o nome do próprio item.
  const saveDamagedName = (i: InventoryItem, raw: string) => {
    const name = raw.trim();
    if (!name) { toast.error("Informe o nome do item"); return; }
    updateItem.mutate({ id: i.id, name });
  };
  const saveOldCell = (a: OldAsset, col: keyof OldAsset, value: string) =>
    setOldData((prev) => prev.map((x) => (x === a ? { ...x, [col]: value.trim() } : x)));
  const setEntryColFilter = (col: EntryColumn, next: string[]) => {
    setEntryColFilters((prev) => ({ ...prev, [col]: next }));
    setEntryPage(1);
  };
  const filteredEntries = useMemo(
    () => filterEntries(entryMovements, entryFilters, itemName)
      .filter((m) => ENTRY_COLUMNS.every((col) => !entryColFilters[col]?.length || entryColFilters[col].includes(entryColumnValue(col, m))))
      .sort((a, b) => new Date(b.occurred_at ?? b.created_at).getTime() - new Date(a.occurred_at ?? a.created_at).getTime()),
    [entryMovements, entryFilters, entryColFilters, items, locations],
  );
  const [entryPage, setEntryPage] = useState(1);
  const entryPageCount = Math.max(1, Math.ceil(filteredEntries.length / ENTRY_PAGE_SIZE));
  const currentEntryPage = Math.min(entryPage, entryPageCount);
  const pageEntries = filteredEntries.slice((currentEntryPage - 1) * ENTRY_PAGE_SIZE, currentEntryPage * ENTRY_PAGE_SIZE);
  // Aba Entradas e Saídas (tabela): entradas e saídas juntas, mais recentes primeiro.
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerPageSize, setLedgerPageSize] = useState(25);
  const [ledgerColFilters, setLedgerColFilters] = useState<Partial<Record<LedgerColumn, string[]>>>({});
  const showLedgerActions = canWrite || canManage;
  const ledgerObs = (m: InventoryMovement) => (m.type === "in" ? splitEntryNotes(m.notes).obs : (m.notes ?? m.reason ?? ""));
  const ledgerValue = (col: LedgerColumn, m: InventoryMovement): string => {
    const isIn = m.type === "in";
    switch (col) {
      case "item": return itemName(m.item_id);
      case "categoria": return catName(items.find((i) => i.id === m.item_id)?.category_id ?? null);
      case "patrimonio": return m.patrimony_number || "N/A";
      case "tipo": return isIn ? "Entradas" : "Saídas";
      case "data": return dateFmt(m.occurred_at ?? m.created_at);
      case "departamento": return m.department ?? collabDept(m.collaborator_id);
      case "es": return m.es_text || (isIn ? "Estoque" : collabName(m.collaborator_id));
      case "observacao": return ledgerObs(m);
    }
  };
  const ledgerAll = useMemo(() => movements
    .filter((m) => m.type === "in" || m.type === "out" || m.type === "assign")
    .slice()
    .sort((a, b) => new Date(b.occurred_at ?? b.created_at).getTime() - new Date(a.occurred_at ?? a.created_at).getTime()),
    [movements]);
  const ledgerColumnOptions = (col: LedgerColumn) =>
    Array.from(new Set(ledgerAll.map((m) => ledgerValue(col, m))))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  const setLedgerColFilter = (col: LedgerColumn, next: string[]) => {
    setLedgerColFilters((prev) => ({ ...prev, [col]: next }));
    setLedgerPage(1);
  };
  // Filtro estilo Excel: cada coluna marcada restringe as linhas aos valores escolhidos.
  const ledgerRows = useMemo(() => ledgerAll.filter((m) =>
    LEDGER_COLUMNS.every((col) => !ledgerColFilters[col]?.length || ledgerColFilters[col].includes(ledgerValue(col, m)))),
    [ledgerAll, ledgerColFilters, items, categories, collaborators]);
  const ledgerPageCount = Math.max(1, Math.ceil(ledgerRows.length / ledgerPageSize));
  const currentLedgerPage = Math.min(ledgerPage, ledgerPageCount);
  const pageLedgerRows = ledgerRows.slice((currentLedgerPage - 1) * ledgerPageSize, currentLedgerPage * ledgerPageSize);
  // Grava uma célula da entrada: só essa linha vai para o banco, com a mesma checagem de conflito da planilha.
  const saveEntryCell = async (m: InventoryMovement, field: "date" | "name" | "quantity" | "unit_price" | "patrimony" | "obs", raw: string) => {
    const item = items.find((i) => i.id === m.item_id);
    const value = raw.trim();
    const { purchased, obs } = splitEntryNotes(m.notes);
    const next = {
      name: item?.name ?? "", quantity: m.quantity, unitPrice: m.unit_price ?? 0,
      occurredAt: m.occurred_at ?? m.created_at, patrimony: m.patrimony_number ?? null, notes: obs,
    };
    if (field === "date") {
      const iso = parseBrDateTime(value);
      if (!iso) { toast.error("Data inválida. Use dd/mm/aaaa hh:mm"); return; }
      next.occurredAt = iso;
    }
    if (field === "name") {
      if (!value) { toast.error("Informe o nome do item"); return; }
      next.name = value;
    }
    if (field === "quantity") {
      const qty = Number(value);
      if (!Number.isInteger(qty) || qty < 1) { toast.error("Quantidade deve ser um número inteiro maior que zero"); return; }
      next.quantity = qty;
    }
    if (field === "unit_price") {
      const price = Number(value.replace(",", "."));
      if (!value || Number.isNaN(price) || price < 0) { toast.error("Valor unitário inválido"); return; }
      next.unitPrice = price;
    }
    if (field === "patrimony") next.patrimony = value || null;
    if (field === "obs") next.notes = value;

    let res;
    try {
      res = await saveEntryBatch.mutateAsync([{
        kind: "update", id: m.id, name: next.name, quantity: next.quantity, unit_price: next.unitPrice,
        occurred_at: next.occurredAt, notes: next.notes.trim() || null, brand: item?.brand ?? null, model: item?.model ?? null,
        patrimony_number: next.patrimony, purchased,
        original: {
          name: item?.name ?? "", quantity: m.quantity, unit_price: m.unit_price ?? 0, occurred_at: m.occurred_at ?? m.created_at,
          notes: m.notes ?? null, brand: item?.brand ?? null, model: item?.model ?? null, patrimony_number: m.patrimony_number ?? null,
        },
      }]);
    } catch {
      return; // o hook já mostra o erro do banco
    }
    if (!res.ok) toast.error("Esta entrada foi alterada por outra pessoa. Recarregue a tela e tente de novo.");
  };

  // Grava uma célula da saída: só essa linha vai para o banco.
  const saveExitCell = async (m: InventoryMovement, field: "date" | "name" | "quantity" | "department" | "patrimony" | "reason" | "notes", raw: string) => {
    const item = items.find((i) => i.id === m.item_id);
    const value = raw.trim();
    const occurredOrig = m.occurred_at ?? m.created_at;
    if (!m.collaborator_id) { toast.error("Esta saída não tem responsável. Edite pelo ícone de lápis."); return; }
    const next = {
      name: item?.name ?? "", quantity: m.quantity, occurredAt: occurredOrig,
      department: m.department ?? null, patrimony: m.patrimony_number ?? null, reason: m.reason ?? null, notes: m.notes ?? null,
    };
    if (field === "date") {
      const iso = parseBrDateTime(value);
      if (!iso) { toast.error("Data inválida. Use dd/mm/aaaa hh:mm"); return; }
      next.occurredAt = iso;
    }
    if (field === "name") {
      if (!value) { toast.error("Informe o nome do item"); return; }
      next.name = value;
    }
    if (field === "quantity") {
      const qty = Number(value);
      if (!Number.isInteger(qty) || qty < 1) { toast.error("Quantidade deve ser um número inteiro maior que zero"); return; }
      next.quantity = qty;
    }
    if (field === "department") next.department = value || null;
    if (field === "patrimony") next.patrimony = value || null;
    if (field === "reason") next.reason = value || null;
    if (field === "notes") next.notes = value || null;

    let res;
    try {
      res = await saveExitBatch.mutateAsync([{
        kind: "update", id: m.id, name: next.name, quantity: next.quantity, occurred_at: next.occurredAt,
        collaborator_id: m.collaborator_id, department: next.department, reason: next.reason,
        patrimony_number: next.patrimony, notes: next.notes,
        original: {
          name: item?.name ?? "", quantity: m.quantity, occurred_at: occurredOrig, collaborator_id: m.collaborator_id,
          department: m.department ?? null, reason: m.reason ?? null, patrimony_number: m.patrimony_number ?? null, notes: m.notes ?? null,
        },
      }]);
    } catch {
      return; // o hook já mostra o erro do banco
    }
    if (!res.ok) toast.error("Esta saída foi alterada por outra pessoa. Recarregue a tela e tente de novo.");
  };
  const outMovements = useMemo(() => movements
    .filter((m) => m.type === "out" || m.type === "assign")
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [movements, collaborators, items]);
  const outColumnValue = (col: OutColumn, m: InventoryMovement): string => {
    switch (col) {
      case "item": return itemName(m.item_id);
      case "qtd": return String(m.quantity);
      case "responsavel": return collabName(m.collaborator_id);
      case "departamento": return m.department ?? collabDept(m.collaborator_id);
      case "patrimonio": return m.patrimony_number || "N/A";
      case "motivo": return m.reason ?? "—";
    }
  };
  const outColumnOptions = (col: OutColumn) =>
    Array.from(new Set(outMovements.map((m) => outColumnValue(col, m))))
      .sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  const setOutColFilter = (col: OutColumn, next: string[]) => {
    setOutColFilters((prev) => ({ ...prev, [col]: next }));
    setOutPage(1);
  };
  const filteredOutMovements = useMemo(
    () => filterExits(outMovements, exitFilters, itemName, collabName)
      .filter((m) => OUT_COLUMNS.every((col) => !outColFilters[col]?.length || outColFilters[col].includes(outColumnValue(col, m))))
      .filter((m) => !outTerm || [
        itemName(m.item_id), String(m.quantity), collabName(m.collaborator_id),
        m.department ?? collabDept(m.collaborator_id), m.patrimony_number ?? "", m.reason ?? "",
        dateFmt(m.occurred_at ?? m.created_at),
      ].some((v) => normalizeSearch(v).includes(outTerm))),
    [outMovements, exitFilters, outColFilters, outTerm, items, collaborators],
  );
  // Ativos antigos entram no fim da lista (data 01/01/2020), depois das saídas do sistema.
  const outRows = useMemo<OutRow[]>(() => [
    ...filteredOutMovements.map((m) => ({ key: m.id, responsible: collabName(m.collaborator_id), mov: m })),
    ...oldFiltered.map((a, i) => ({ key: `old-${i}`, responsible: a.colaborador, old: a })),
  ], [filteredOutMovements, oldFiltered, collaborators]);
  const outLetters = Array.from(new Set(outRows
    .map((r) => alphaInitial(r.responsible))
    .filter((letter) => /^[A-Z]$/.test(letter))));
  const outTotalPages = Math.max(1, Math.ceil(outRows.length / outPageSize));
  const outSafePage = Math.min(outPage, outTotalPages);
  const pagedOutRows = useMemo(
    () => outRows.slice((outSafePage - 1) * outPageSize, outSafePage * outPageSize),
    [outRows, outSafePage, outPageSize],
  );
  // O índice A-Z rola a página: com a lista paginada o destino pode estar em outra
  // página, então o índice procurado define a página antes do scrollIntoView.
  // Cada letra tem uma única linha marcada: a primeira que aparece na lista.
  const outLetterFirstIds = useMemo(() => {
    const seen = new Set<string>();
    const ids = new Set<string>();
    for (const r of outRows) {
      const letter = alphaInitial(r.responsible);
      if (/^[A-Z]$/.test(letter) && !seen.has(letter)) {
        seen.add(letter);
        ids.add(r.key);
      }
    }
    return ids;
  }, [outRows]);
  const jumpToOutLetter = (letter: string) => {
    const index = outRows.findIndex((r) => alphaInitial(r.responsible) === letter);
    if (index < 0) return;
    setOutPage(Math.floor(index / outPageSize) + 1);
    setTimeout(() => document.getElementById(`out-letter-${letter}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  };
  const itemPatrimonies = (id: string) => {
    const list = assets.filter((a) => a.item_id === id).map((a) => a.patrimony_number);
    return list.length ? list.join(", ") : "N/A";
  };

  // ---- KPIs (valores reais) ----
  const activeItems = items.filter((i) => i.status === "active");
  const itemsValue = activeItems.reduce((acc, i) => {
    const qty = i.quantity + i.in_use_quantity + (includeDamaged ? i.damaged_quantity : 0);
    return acc + qty * i.unit_price;
  }, 0);
  const assetsValue = assets
    .filter((a) => a.status !== "discarded" && (includeDamaged || a.status !== "damaged"))
    .reduce((acc, a) => acc + a.value, 0);
  const totalValue = itemsValue + assetsValue;

  const inUse = activeItems.reduce((a, i) => a + i.in_use_quantity, 0) + assets.filter((a) => a.status === "in_use").length;
  const damaged = activeItems.reduce((a, i) => a + i.damaged_quantity, 0) + assets.filter((a) => a.status === "damaged").length;
  const discarded = items.reduce((a, i) => a + i.discarded_quantity, 0) + assets.filter((a) => a.status === "discarded").length;

  const lowStock = activeItems.filter((i) => i.quantity <= i.min_stock);
  const restock = lowStock.map((i) => {
    const comprar = Math.max(1, i.min_stock - i.quantity + 1);
    return {
      id: i.id, item: i.name, categoria: catName(i.category_id), disponivel: i.quantity,
      minimo: i.min_stock, comprar, valor_unitario: i.unit_price,
      valor_estimado: comprar * i.unit_price, status: i.quantity === 0 ? "Crítico" : "Estoque baixo",
    };
  });

  const damagedItems = activeItems.filter((i) => i.damaged_quantity > 0);
  const discardedItems = items.filter((i) => i.discarded_quantity > 0);

  return (
    <motion.div
      animate={{ maxWidth: viewMode === "mobile" ? 390 : 2400 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="mx-auto w-full space-y-6 [&_thead_th]:bg-[#002366] [&_thead_th]:!text-white [&_thead_th_*]:!text-white"
    >
      <div className={viewMode === "mobile" ? "hidden" : undefined}>
      <PageHeader
        title="Almoxarifado TI"
        description="Entrada, saída e controle de equipamentos, peças e materiais"
        icon={<Package className="h-6 w-6" />}
      />
      </div>

      <div className="flex justify-center">
        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Botão Mobile do topo: formulário no tamanho de celular. */}
      {viewMode === "mobile" && (
        <div className="mb-4">
          <MobileEntryForm categories={categories} tiName={mobileTiName} />
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className={viewMode === "mobile" ? "hidden" : undefined}>
        {/* No celular as abas rolam na horizontal: alinhadas à esquerda para a primeira não ficar cortada. */}
        <TabsList className="flex h-auto w-full max-w-full justify-start overflow-x-auto scrollbar-thin md:flex-wrap md:justify-center">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items" className="hidden">Itens</TabsTrigger>
          <TabsTrigger value="in">Entradas e Saídas</TabsTrigger>
          <TabsTrigger value="out" className="hidden">Saídas</TabsTrigger>
          <TabsTrigger value="assets" className="hidden">Patrimônios</TabsTrigger>
          <TabsTrigger value="damaged">Danificados</TabsTrigger>
          <TabsTrigger value="discarded" className="hidden">Descartados</TabsTrigger>
          <TabsTrigger value="restock" className="hidden">Reposição</TabsTrigger>
          <TabsTrigger value="history" className="hidden">Histórico</TabsTrigger>
          <TabsTrigger value="requests" className="hidden">Solicitações</TabsTrigger>
          <TabsTrigger value="reports" className="hidden">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="container">Container</TabsTrigger>
          <TabsTrigger value="mobile">Mobile</TabsTrigger>
        </TabsList>

        {/* ---------------- DASHBOARD ---------------- */}
        <TabsContent value="dashboard" className="space-y-4">
          <DashboardCharts assets={assets} items={items} />
          <Card>
            <CardHeader><CardTitle className="text-base">Últimas movimentações</CardTitle></CardHeader>
            <CardContent className="max-h-[13rem] overflow-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead><TableHead>Motivo</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {movements.slice(0, 10).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{dateFmt(m.created_at)}</TableCell>
                      <TableCell><Badge variant="outline" className={`font-normal ${MOV_TYPE_CLASS[m.type] ?? ""}`}>{MOV_LABELS[m.type]}</Badge></TableCell>
                      <TableCell>{itemName(m.item_id)}</TableCell>
                      <TableCell>{m.quantity}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{m.reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------------- ITENS ---------------- */}
        <TabsContent value="items" className="space-y-3">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar item, marca ou modelo..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={collabFilter} onValueChange={setCollabFilter}>
              <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos colaboradores</SelectItem>
                <SelectItem value="none">Sem responsável</SelectItem>
                {collaborators.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos setores</SelectItem>
                {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="border-white bg-[#050d20] text-white hover:bg-[#0c1d3d] hover:text-white" onClick={() => downloadCsv(filteredItems, "itens.csv")}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">Itens são criados apenas pela tela de Entradas. Use “Atualizar” para registrar uma mudança no item — a atualização fica gravada no histórico.</p>
          <div className="hidden md:block"><Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table className="min-w-[880px]">
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead>Categoria</TableHead>
                  <TableHead>Total</TableHead><TableHead>Disp.</TableHead><TableHead>Em uso</TableHead>
                  <TableHead>Danif.</TableHead><TableHead>Descart.</TableHead><TableHead>Mín.</TableHead>
                  <TableHead>Valor unit.</TableHead><TableHead>Valor total</TableHead>
                  <TableHead>Status</TableHead><TableHead>Responsável</TableHead>
                  <TableHead>Patrimônio</TableHead><TableHead>Local</TableHead>
                  <TableHead className="sticky right-0 z-20 w-1 min-w-0 border-l bg-card text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredItems.map((i) => {
                    const total = i.quantity + i.in_use_quantity + i.damaged_quantity;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-1.5">
                            {i.name}
                            {i.upgrade_count > 0 && (
                              <Badge
                                variant="outline"
                                className="shrink-0 font-normal"
                                title={`${i.upgrade_count} atualização(ões) registrada(s)`}
                              >
                                <Wrench className="mr-1 h-3 w-3" />{i.upgrade_count}
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>{catName(i.category_id)}</TableCell>
                        <TableCell>{total}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell>{i.in_use_quantity}</TableCell>
                        <TableCell className={i.damaged_quantity > 0 ? "text-red-200" : ""}>{i.damaged_quantity}</TableCell>
                        <TableCell>{i.discarded_quantity}</TableCell>
                        <TableCell>{i.min_stock}</TableCell>
                        <TableCell>{currency(i.unit_price)}</TableCell>
                        <TableCell>{currency(total * i.unit_price)}</TableCell>
                        <TableCell><ItemStatusTags item={i} /></TableCell>
                        <TableCell>{collabName(i.responsible_collaborator_id)}</TableCell>
                        <TableCell className="font-mono text-xs">{itemPatrimonies(i.id)}</TableCell>
                        <TableCell>{locName(i.location_id)}</TableCell>
                        <TableCell className="sticky right-0 z-10 w-1 min-w-0 border-l bg-card">
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <RowActionButton
                              icon={Package} label="Detalhes" title="Ver detalhes do item"
                              onClick={() => setDetail(i)}
                            />
                            {canWrite && (
                              <>
                                <RowActionButton
                                  icon={Wrench} label="Atualizar" title="Registrar atualização (upgrade) do item"
                                  onClick={() => setUpgradeDlg({ open: true, item: i })}
                                />
                                <RowActionButton
                                  icon={Send} label="Saída" title="Registrar saída"
                                  onClick={() => setExitDlg({ open: true, item: i })}
                                />
                                <RowActionButton
                                  icon={AlertTriangle} label="Danificado" title="Marcar como danificado"
                                  onClick={() => setStatusDlg({ open: true, item: i, mode: "damage" })}
                                />
                                <RowActionButton
                                  icon={Trash2} label="Descartar" title="Descartar item" destructive
                                  onClick={() => setStatusDlg({ open: true, item: i, mode: "discard" })}
                                />
                              </>
                            )}
                            {canManage && (
                              <RowActions
                                editTitle="Editar item"
                                onEdit={() => setItemDlg({ open: true, item: i })}
                                deleteTitle={i.status === "active" ? "Desativar item" : "Reativar item"}
                                deleteDescription={i.status === "active"
                                  ? `"${i.name}" deixa de aparecer no estoque e nas listas. O histórico é mantido.`
                                  : `"${i.name}" volta a aparecer no estoque e nas listas.`}
                                deleteLabel={i.status === "active" ? "Desativar" : "Reativar"}
                                pending={deactivate.isPending}
                                onDelete={() => deactivate.mutateAsync({ id: i.id, reactivate: i.status !== "active" })}
                              />
                            )}
                          </div>
                        </TableCell>

                      </TableRow>
                    );
                  })}
                  {filteredItems.length === 0 && (
                    <TableRow><TableCell colSpan={15} className="text-center text-muted-foreground py-6">Nenhum item. Registre uma entrada para começar.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card></div>

          <div className="space-y-2 md:hidden">
            {filteredItems.map((i) => {
              const total = i.quantity + i.in_use_quantity + i.damaged_quantity;
              return (
                <Card key={i.id}>
                  <CardContent className="space-y-2 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 font-medium">
                        <span className="flex items-center gap-1.5 break-words">
                          {i.name}
                          {i.upgrade_count > 0 && (
                            <Badge variant="outline" className="shrink-0 font-normal">
                              <Wrench className="mr-1 h-3 w-3" />{i.upgrade_count}
                            </Badge>
                          )}
                        </span>
                        <p className="text-xs text-muted-foreground">{catName(i.category_id)}</p>
                      </div>
                      <div className="shrink-0"><ItemStatusTags item={i} /></div>
                    </div>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                      <div><p className="text-muted-foreground">Total</p><p className="text-sm">{total}</p></div>
                      <div><p className="text-muted-foreground">Disp.</p><p className="text-sm">{i.quantity}</p></div>
                      <div><p className="text-muted-foreground">Em uso</p><p className="text-sm">{i.in_use_quantity}</p></div>
                      <div><p className="text-muted-foreground">Danif.</p><p className={`text-sm ${i.damaged_quantity > 0 ? "text-red-600" : ""}`}>{i.damaged_quantity}</p></div>
                      <div><p className="text-muted-foreground">Descart.</p><p className="text-sm">{i.discarded_quantity}</p></div>
                      <div><p className="text-muted-foreground">Mín.</p><p className="text-sm">{i.min_stock}</p></div>
                      <div><p className="text-muted-foreground">Valor unit.</p><p className="text-sm">{currency(i.unit_price)}</p></div>
                      <div className="col-span-2"><p className="text-muted-foreground">Valor total</p><p className="text-sm">{currency(total * i.unit_price)}</p></div>
                      <div className="col-span-3"><p className="text-muted-foreground">Responsável · Local</p><p className="text-sm">{collabName(i.responsible_collaborator_id)} · {locName(i.location_id)}</p></div>
                      <div className="col-span-3"><p className="text-muted-foreground">Patrimônio</p><p className="font-mono text-xs">{itemPatrimonies(i.id)}</p></div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-1.5 border-t pt-2">
                      <MobileAction icon={Package} label="Detalhes" onClick={() => setDetail(i)} />
                      {canWrite && (
                        <>
                          <MobileAction icon={Wrench} label="Atualizar" onClick={() => setUpgradeDlg({ open: true, item: i })} />
                          <MobileAction icon={Send} label="Saída" onClick={() => setExitDlg({ open: true, item: i })} />
                          <MobileAction icon={AlertTriangle} label="Danificado" onClick={() => setStatusDlg({ open: true, item: i, mode: "damage" })} />
                          <MobileAction icon={Trash2} label="Descartar" onClick={() => setStatusDlg({ open: true, item: i, mode: "discard" })} />
                        </>
                      )}
                      {canManage && (
                        <RowActions
                          editTitle="Editar item"
                          onEdit={() => setItemDlg({ open: true, item: i })}
                          deleteTitle={i.status === "active" ? "Desativar item" : "Reativar item"}
                          deleteDescription={i.status === "active"
                            ? `"${i.name}" deixa de aparecer no estoque e nas listas. O histórico é mantido.`
                            : `"${i.name}" volta a aparecer no estoque e nas listas.`}
                          deleteLabel={i.status === "active" ? "Desativar" : "Reativar"}
                          pending={deactivate.isPending}
                          onDelete={() => deactivate.mutateAsync({ id: i.id, reactivate: i.status !== "active" })}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {filteredItems.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item. Registre uma entrada para começar.</p>
            )}
          </div>
        </TabsContent>

        {/* ---------------- ENTRADAS ---------------- */}
        <TabsContent value="in" className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm text-muted-foreground">Histórico de entradas</h2>
              <p className="text-xs text-muted-foreground">Entradas são somente para itens comprados. A data da chegada fica registrada e o item entra em estoque.</p>
            </div>
            {canWrite && (
              <div className="flex gap-2">
                <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">!</span>
                  Clique na célula para modificar
                </div>
              </div>
            )}
          </div>


          {lastCreatedItem && canWrite && (
            <Card className="border-primary/40">
              <CardContent className="p-3 flex items-center justify-between gap-3">
                <p className="text-sm">Entrada registrada para <b>{itemName(lastCreatedItem)}</b>. Deseja já entregar a alguém?</p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setExitDlg({ open: true, item: items.find((i) => i.id === lastCreatedItem) })}>
                    Registrar saída deste item
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setLastCreatedItem(null)}>Fechar</Button>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2 md:hidden">
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">Filtrar:</span>
              {ENTRY_COLUMNS.map((col) => (
                <ColumnFilter
                  key={col}
                  inline
                  label={ENTRY_COLUMN_LABELS[col]}
                  options={entryColumnOptions(col)}
                  selected={entryColFilters[col] ?? []}
                  onChange={(next) => setEntryColFilter(col, next)}
                />
              ))}
            </div>
            {pageEntries.map((m) => (
              <Card key={m.id}>
                <CardContent className="space-y-2 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 font-medium">
                      <EditableCell disabled={!canWrite} value={itemName(m.item_id)} display={itemName(m.item_id)} onSave={(v) => saveEntryCell(m, "name", v)} />
                    </div>
                    <div className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                      <EditableCell disabled={!canWrite} value={brDateTime(m.occurred_at ?? m.created_at)} display={dateFmt(m.occurred_at ?? m.created_at)} onSave={(v) => saveEntryCell(m, "date", v)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div><p className="text-muted-foreground">Qtd</p>
                      <EditableCell disabled={!canWrite} value={String(m.quantity)} display={m.quantity} onSave={(v) => saveEntryCell(m, "quantity", v)} />
                    </div>
                    <div><p className="text-muted-foreground">Valor unit.</p>
                      <EditableCell disabled={!canWrite} value={String(m.unit_price ?? 0)} display={currency(m.unit_price ?? 0)} onSave={(v) => saveEntryCell(m, "unit_price", v)} />
                    </div>
                    <div><p className="text-muted-foreground">Valor total</p><p>{currency((m.unit_price ?? 0) * m.quantity)}</p></div>
                    <div><p className="text-muted-foreground">Local</p><p>{locName(m.to_location_id)}</p></div>
                    <div className="col-span-2"><p className="text-muted-foreground">Patrimônio</p>
                      <EditableCell disabled={!canWrite} className="font-mono text-xs" value={m.patrimony_number ?? ""} display={m.patrimony_number || "N/A"} onSave={(v) => saveEntryCell(m, "patrimony", v)} />
                    </div>
                  </div>
                  {canManage && (
                    <div className="flex flex-wrap justify-end gap-1.5 border-t pt-2">
                      <MobileAction icon={Send} label="Mandar para saídas" onClick={() => setSendEntry(m)} />
                      <RowActions
                        editTitle="Editar entrada"
                        onEdit={() => setMovDlg({ open: true, movement: m })}
                        deleteTitle="Excluir entrada"
                        deleteDescription="A quantidade desta entrada volta para o estoque do item."
                        deleteLabel="Excluir"
                        pending={delMovement.isPending}
                        onDelete={() => delMovement.mutateAsync(m.id)}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {filteredEntries.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {entryMovements.length === 0 ? "Nenhuma entrada registrada." : "Nenhuma entrada encontrada com esses filtros."}
              </p>
            )}
          </div>

          <div className="hidden md:block"><Card><CardContent className="p-0 overflow-x-auto">
            {/* Grade de planilha: bordas em todas as células, como no Excel. */}
            <Table className="[&_td]:border [&_td]:border-slate-300 [&_th]:border [&_th]:border-slate-500">
              <TableHeader><TableRow>
                {LEDGER_COLUMNS.map((col) => (
                  <ColumnFilter
                    key={col}
                    label={LEDGER_COLUMN_LABELS[col]}
                    options={ledgerColumnOptions(col)}
                    selected={ledgerColFilters[col] ?? []}
                    onChange={(next) => setLedgerColFilter(col, next)}
                  />
                ))}
                <TableHead className="min-w-[260px]">Entrega</TableHead>
                {showLedgerActions && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {canWrite && (
                  <NewLedgerRow items={items} collaborators={collaborators} categories={categories} />
                )}
                {pageLedgerRows.map((m) => {
                  const isIn = m.type === "in";
                  const item = items.find((i) => i.id === m.item_id);
                  const obs = ledgerObs(m);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">
                        <EditableCell disabled={!canWrite} value={itemName(m.item_id)} display={itemName(m.item_id)}
                          onSave={(v) => (isIn ? saveEntryCell(m, "name", v) : saveExitCell(m, "name", v))} />
                      </TableCell>
                      <TableCell>
                        <CategoryCell itemId={m.item_id} categoryId={item?.category_id ?? null} categories={categories} disabled={!canWrite} />
                      </TableCell>
                      <TableCell>
                        <EditableCell disabled={!canWrite} className="font-mono text-xs" value={m.patrimony_number ?? ""} display={m.patrimony_number || "N/A"}
                          onSave={(v) => (isIn ? saveEntryCell(m, "patrimony", v) : saveExitCell(m, "patrimony", v))} />
                      </TableCell>
                      <TableCell className={`text-center font-semibold text-white ${isIn ? "bg-green-600" : "bg-red-600"}`}>
                        {isIn ? "Entradas" : "Saídas"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EditableCell disabled={!canWrite} value={brDateTime(m.occurred_at ?? m.created_at)} display={dateFmt(m.occurred_at ?? m.created_at)}
                          onSave={(v) => (isIn ? saveEntryCell(m, "date", v) : saveExitCell(m, "date", v))} />
                      </TableCell>
                      <TableCell>
                        {/* Entrada não tem departamento próprio: só a saída é editável aqui. */}
                        <EditableCell disabled={!canWrite || isIn} value={m.department ?? ""} display={m.department ?? collabDept(m.collaborator_id)}
                          onSave={(v) => saveExitCell(m, "department", v)} />
                      </TableCell>
                      <TableCell>
                        <MovementTextCell
                          movementId={m.id}
                          field="es_text"
                          value={m.es_text ?? ""}
                          placeholder={isIn ? "Estoque" : collabName(m.collaborator_id)}
                          disabled={!canWrite}
                          className="min-w-[160px]"
                        />
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <EditableCell disabled={!canWrite} value={obs} display={obs || "—"}
                          onSave={(v) => (isIn ? saveEntryCell(m, "obs", v) : saveExitCell(m, "notes", v))} />
                      </TableCell>
                      <TableCell>
                        <MovementTextCell movementId={m.id} field="delivery_text" value={m.delivery_text ?? ""} disabled={!canWrite} />
                      </TableCell>
                      {showLedgerActions && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {canManage && isIn && (
                              <button
                                type="button"
                                aria-label="Mandar para saídas"
                                title="Mandar para saídas"
                                onClick={() => setSendEntry(m)}
                                className="flex h-7 w-7 items-center justify-center rounded text-blue-600 hover:bg-blue-50"
                              >
                                <Send className="h-4 w-4" />
                              </button>
                            )}
                            {canManage && <RowActions
                              editTitle={isIn ? "Editar entrada" : "Editar saída"}
                              onEdit={() => setMovDlg({ open: true, movement: m })}
                              deleteTitle={isIn ? "Excluir entrada" : "Excluir saída"}
                              deleteDescription={isIn
                                ? "A quantidade desta entrada volta para o estoque do item."
                                : "A quantidade desta saída volta para o estoque do item."}
                              deleteLabel="Excluir"
                              pending={delMovement.isPending}
                              onDelete={() => delMovement.mutateAsync(m.id)}
                            />}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                {ledgerRows.length === 0 && (
                  <TableRow><TableCell colSpan={showLedgerActions ? 10 : 9} className="text-center text-muted-foreground py-6">
                    {ledgerAll.length === 0 ? "Nenhuma movimentação registrada." : "Nenhuma movimentação encontrada com esses filtros."}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card></div>
          <div className="hidden md:block">
            <TablePagination
              page={currentLedgerPage}
              pageSize={ledgerPageSize}
              total={ledgerRows.length}
              noun="movimentações"
              onPageChange={setLedgerPage}
              onPageSizeChange={(n) => { setLedgerPageSize(n); setLedgerPage(1); }}
            />
          </div>
          {entryPageCount > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <Button variant="outline" size="sm" disabled={currentEntryPage <= 1} onClick={() => setEntryPage(currentEntryPage - 1)}>Anterior</Button>
              <span className="text-muted-foreground">Página {currentEntryPage} de {entryPageCount}</span>
              <Button variant="outline" size="sm" disabled={currentEntryPage >= entryPageCount} onClick={() => setEntryPage(currentEntryPage + 1)}>Próxima</Button>
            </div>
          )}
        </TabsContent>

        {/* ---------------- SAÍDAS ---------------- */}
        <TabsContent value="out" className="space-y-3">
          <p className="hidden text-sm text-muted-foreground">Toda saída exige um responsável. Registre a saída pela tela de Itens.</p>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <div className="relative min-w-[220px] max-w-md flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-8" placeholder="Buscar saídas e ativos: patrimônio, colaborador, departamento, equipamento..." value={outSearch} onChange={(e) => setOutSearch(e.target.value)} />
            </div>
            {canWrite && (
              <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">!</span>
                Clique na célula para modificar
              </div>
            )}
          </div>

          <>
          <div className="flex min-w-0 flex-col gap-2 md:flex-row md:gap-3">
          <nav aria-label="Índice alfabético de responsáveis" className="scrollbar-thin flex shrink-0 gap-1 overflow-x-auto pb-1 md:sticky md:top-4 md:max-h-[70vh] md:flex-col md:overflow-y-auto md:overflow-x-hidden md:pb-0">
            {"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((letter) => {
              const available = outLetters.includes(letter);
              return <button key={letter} type="button" disabled={!available} aria-label={`Ir para responsáveis com ${letter}`}
                onClick={() => jumpToOutLetter(letter)}
                className="h-8 min-w-8 rounded border border-black bg-white px-2 text-sm font-medium text-black enabled:hover:bg-gray-100 disabled:border-gray-400 disabled:bg-white disabled:text-black disabled:opacity-100 md:w-9 md:px-0">
                {letter}
              </button>;
            })}
          </nav>
          
          <div className="hidden min-w-0 flex-1 md:block"><Card className="min-w-0 flex-1"><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead>
                {(["item", "qtd", "responsavel", "departamento", "patrimonio"] as const).map((col) => (
                  <ColumnFilter
                    key={col}
                    label={OUT_COLUMN_LABELS[col]}
                    options={outColumnOptions(col)}
                    selected={outColFilters[col] ?? []}
                    onChange={(next) => setOutColFilter(col, next)}
                  />
                ))}
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {pagedOutRows.map((r) => {
                  const rowId = outLetterFirstIds.has(r.key) ? `out-letter-${alphaInitial(r.responsible)}` : undefined;
                  if (r.old) {
                    const a = r.old;
                    return <TableRow key={r.key} id={rowId}>
                      <TableCell className="whitespace-nowrap font-medium text-red-600">01/01/2020</TableCell>
                      <TableCell>
                        <EditableCell disabled={!canWrite} value={a.ativo} display={a.ativo} onSave={(v) => saveOldCell(a, "ativo", v)} />
                      </TableCell>
                      <TableCell>1</TableCell>
                      <TableCell>
                        <EditableCell disabled={!canWrite} value={a.colaborador} display={a.colaborador} onSave={(v) => saveOldCell(a, "colaborador", v)} />
                      </TableCell>
                      <TableCell>
                        <EditableCell disabled={!canWrite} value={a.departamento} display={a.departamento} onSave={(v) => saveOldCell(a, "departamento", v)} />
                      </TableCell>
                      <TableCell>
                        <EditableCell disabled={!canWrite} className="font-mono text-xs" value={a.patrimonio} display={a.patrimonio || "N/A"} onSave={(v) => saveOldCell(a, "patrimonio", v)} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <EditableCell disabled={!canWrite} value={a.status} display={<Badge className="border-blue-600 bg-blue-600 font-normal text-white hover:bg-blue-600">{a.status}</Badge>} onSave={(v) => saveOldCell(a, "status", v)} />
                      </TableCell>
                      {canManage && <TableCell />}
                    </TableRow>;
                  }
                  const m = r.mov!;
                  return <TableRow key={r.key} id={rowId}>
                    <TableCell className="whitespace-nowrap">
                      <EditableCell disabled={!canWrite} value={brDateTime(m.occurred_at ?? m.created_at)} display={dateFmt(m.occurred_at ?? m.created_at)} onSave={(v) => saveExitCell(m, "date", v)} />
                    </TableCell>
                    <TableCell>
                      <EditableCell disabled={!canWrite} value={itemName(m.item_id)} display={itemName(m.item_id)} onSave={(v) => saveExitCell(m, "name", v)} />
                    </TableCell>
                    <TableCell>
                      <EditableCell disabled={!canWrite} value={String(m.quantity)} display={m.quantity} onSave={(v) => saveExitCell(m, "quantity", v)} />
                    </TableCell>
                    <TableCell>{collabName(m.collaborator_id)}</TableCell>
                    <TableCell>
                      <EditableCell disabled={!canWrite} value={m.department ?? collabDept(m.collaborator_id)} display={m.department ?? collabDept(m.collaborator_id)} onSave={(v) => saveExitCell(m, "department", v)} />
                    </TableCell>
                    <TableCell>
                      <EditableCell disabled={!canWrite} className="font-mono text-xs" value={m.patrimony_number ?? ""} display={m.patrimony_number || "N/A"} onSave={(v) => saveExitCell(m, "patrimony", v)} />
                    </TableCell>
                    <TableCell><StatusTag status="in_use" /></TableCell>
                    {canManage && (
                      <TableCell>
                        <RowActions
                          editTitle="Editar saída"
                          onEdit={() => setMovDlg({ open: true, movement: m })}
                          deleteTitle="Excluir saída"
                          deleteDescription="A quantidade sai de em uso e volta para o disponível do item."
                          deleteLabel="Excluir"
                          pending={delMovement.isPending}
                          onDelete={() => delMovement.mutateAsync(m.id)}
                        />
                      </TableCell>
                    )}
                  </TableRow>;
                })}
                {outRows.length === 0 && (
                  <TableRow><TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground py-6">
                    {outMovements.length === 0 && oldData.length === 0 ? "Nenhuma saída registrada." : "Nenhuma saída encontrada com esses filtros."}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
          </div>
          </div>

          <div className="space-y-2 md:hidden">
            <div className="flex flex-wrap gap-2">
              <span className="self-center text-xs text-muted-foreground">Filtrar:</span>
              {(["item", "qtd", "responsavel", "departamento", "patrimonio"] as const).map((col) => (
                <ColumnFilter
                  key={col}
                  inline
                  label={OUT_COLUMN_LABELS[col]}
                  options={outColumnOptions(col)}
                  selected={outColFilters[col] ?? []}
                  onChange={(next) => setOutColFilter(col, next)}
                />
              ))}
            </div>
            {pagedOutRows.map((r) => {
              const rowId = outLetterFirstIds.has(r.key) ? `out-letter-${alphaInitial(r.responsible)}` : undefined;
              if (r.old) {
                const a = r.old;
                return (
                  <Card key={r.key} id={rowId}>
                    <CardContent className="space-y-2 p-3 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 font-medium">
                          <EditableCell disabled={!canWrite} value={a.ativo} display={a.ativo} onSave={(v) => saveOldCell(a, "ativo", v)} />
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-xs font-medium text-red-600">01/01/2020</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                        <div><p className="text-muted-foreground">Responsável</p>
                          <EditableCell disabled={!canWrite} value={a.colaborador} display={a.colaborador} onSave={(v) => saveOldCell(a, "colaborador", v)} />
                        </div>
                        <div><p className="text-muted-foreground">Departamento</p>
                          <EditableCell disabled={!canWrite} value={a.departamento} display={a.departamento} onSave={(v) => saveOldCell(a, "departamento", v)} />
                        </div>
                        <div><p className="text-muted-foreground">Patrimônio</p>
                          <EditableCell disabled={!canWrite} className="font-mono text-xs" value={a.patrimonio} display={a.patrimonio || "N/A"} onSave={(v) => saveOldCell(a, "patrimonio", v)} />
                        </div>
                        <div><p className="text-muted-foreground">Status</p>
                          <EditableCell disabled={!canWrite} value={a.status} display={<Badge className="border-blue-600 bg-blue-600 font-normal text-white hover:bg-blue-600">{a.status}</Badge>} onSave={(v) => saveOldCell(a, "status", v)} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
              const m = r.mov!;
              return (
                <Card key={r.key} id={rowId}>
                  <CardContent className="space-y-2 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 font-medium">
                        <EditableCell disabled={!canWrite} value={itemName(m.item_id)} display={itemName(m.item_id)} onSave={(v) => saveExitCell(m, "name", v)} />
                      </div>
                      <div className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
                        <EditableCell disabled={!canWrite} value={brDateTime(m.occurred_at ?? m.created_at)} display={dateFmt(m.occurred_at ?? m.created_at)} onSave={(v) => saveExitCell(m, "date", v)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                      <div><p className="text-muted-foreground">Qtd</p>
                        <EditableCell disabled={!canWrite} value={String(m.quantity)} display={m.quantity} onSave={(v) => saveExitCell(m, "quantity", v)} />
                      </div>
                      <div><p className="text-muted-foreground">Responsável</p><p>{collabName(m.collaborator_id)}</p></div>
                      <div><p className="text-muted-foreground">Departamento</p>
                        <EditableCell disabled={!canWrite} value={m.department ?? collabDept(m.collaborator_id)} display={m.department ?? collabDept(m.collaborator_id)} onSave={(v) => saveExitCell(m, "department", v)} />
                      </div>
                      <div><p className="text-muted-foreground">Patrimônio</p>
                        <EditableCell disabled={!canWrite} className="font-mono text-xs" value={m.patrimony_number ?? ""} display={m.patrimony_number || "N/A"} onSave={(v) => saveExitCell(m, "patrimony", v)} />
                      </div>
                      <div className="col-span-2"><p className="text-muted-foreground">Motivo</p>
                        <EditableCell disabled={!canWrite} value={m.reason ?? ""} display={m.reason ?? "—"} onSave={(v) => saveExitCell(m, "reason", v)} />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t pt-2">
                      <StatusTag status="in_use" />
                      {canManage && (
                        <RowActions
                          editTitle="Editar saída"
                          onEdit={() => setMovDlg({ open: true, movement: m })}
                          deleteTitle="Excluir saída"
                          deleteDescription="A quantidade sai de em uso e volta para o disponível do item."
                          deleteLabel="Excluir"
                          pending={delMovement.isPending}
                          onDelete={() => delMovement.mutateAsync(m.id)}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {outRows.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {outMovements.length === 0 && oldData.length === 0 ? "Nenhuma saída registrada." : "Nenhuma saída encontrada com esses filtros."}
              </p>
            )}
          </div>

          <TablePagination
            page={outSafePage}
            pageSize={outPageSize}
            total={outRows.length}
            noun="saídas"
            onPageChange={setOutPage}
            onPageSizeChange={(n) => { setOutPageSize(n); setOutPage(1); }}
          />
          </>
        </TabsContent>

        {/* PATRIMÔNIOS */}
        <TabsContent value="assets" className="space-y-3">
          <div className="flex justify-end">
            {canWrite && (
              <div className="flex gap-2">
                {!assetGridOpen && (
                  <Button size="sm" variant="outline" onClick={() => setAssetGridOpen(true)}>
                    <Grid3x3 className="mr-2 h-4 w-4" /> Edição Estilo Excel
                  </Button>
                )}
                <Button size="sm" onClick={() => setAssetDlg({ open: true, asset: null })}><Plus className="mr-2 h-4 w-4" /> Novo patrimônio</Button>
              </div>
            )}
          </div>
          {assetGridOpen && canWrite ? (
            <AssetGrid
              assets={assets}
              items={items}
              locations={locations}
              collaborators={collaborators}
              onExit={() => setAssetGridOpen(false)}
            />
          ) : (
            <AssetTable assets={assets} items={items} locations={locations} collaborators={collaborators} canWrite={canWrite} canManage={canManage} onEdit={(a) => setAssetDlg({ open: true, asset: a })} onDelete={(a) => delAsset.mutate(a.id)} />
          )}
        </TabsContent>

        {/* DANIFICADOS */}
        <TabsContent value="damaged" className="space-y-3">
          {canWrite && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2 rounded-md border border-blue-300 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">!</span>
                Clique na célula para modificar
              </div>
            </div>
          )}
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
<TableHead>Item</TableHead><TableHead>Qtd danificada</TableHead><TableHead>Responsável</TableHead>
            <TableHead>Status</TableHead>
            {(canWrite || canManage) && <TableHead className="text-right">Ações</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {damagedItems.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="font-medium">
                  <EditableCell disabled={!canWrite} value={i.name} display={i.name} onSave={(v) => saveDamagedName(i, v)} />
                </TableCell>
                <TableCell>{i.damaged_quantity}</TableCell>
                <TableCell>{collabName(i.responsible_collaborator_id)}</TableCell>
                <TableCell><StatusTag status="damaged" /></TableCell>
                {(canWrite || canManage) && (
                  <TableCell>
                    <div className="flex justify-end gap-1.5">
                      {canWrite && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => recover.mutate({ item: i, quantity: 1 })}>Recuperar 1</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatusDlg({ open: true, item: i, mode: "discard" })}>Descartar</Button>
                        </>
                      )}
                      {canManage && (
                        <RowActions
                          editTitle="Editar item"
                          onEdit={() => setItemDlg({ open: true, item: i })}
                          deleteTitle="Desativar item"
                          deleteDescription={`"${i.name}" deixa de aparecer no estoque e nas listas. O histórico é mantido.`}
                          deleteLabel="Desativar"
                          pending={deactivate.isPending}
                          onDelete={() => deactivate.mutateAsync({ id: i.id })}
                        />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {damagedItems.length === 0 && <TableRow><TableCell colSpan={(canWrite || canManage) ? 5 : 4} className="text-center text-muted-foreground py-6">Nenhum item danificado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
          <AssetTable assets={assets.filter((a) => a.status === "damaged")} items={items} locations={locations} collaborators={collaborators} canWrite={canWrite} canManage={canManage} onEdit={(a) => setAssetDlg({ open: true, asset: a })} onDelete={(a) => delAsset.mutate(a.id)} />
        </TabsContent>

        {/* DESCARTADOS */}
        <TabsContent value="discarded" className="space-y-3">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead>
<TableHead>Patrimônio</TableHead><TableHead>Responsável</TableHead>
                <TableHead>Motivo</TableHead><TableHead>Observações</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {movements.filter((m) => m.type === "discard").map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{dateFmt(m.created_at)}</TableCell>
                    <TableCell>{itemName(m.item_id)}</TableCell>
                    <TableCell>{m.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{m.patrimony_number || "N/A"}</TableCell>
                    <TableCell>{m.collaborator_id ? collabName(m.collaborator_id) : "Sem responsável"}</TableCell>
                    <TableCell>{m.reason ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{m.notes ?? "—"}</TableCell>
                    {canManage && (
                      <TableCell>
                        <RowActions
                          editTitle="Editar descarte"
                          onEdit={() => setMovDlg({ open: true, movement: m })}
                          deleteTitle="Excluir descarte"
                          deleteDescription="O item volta para o estoque, conforme a quantidade registrada."
                          deleteLabel="Excluir"
                          pending={delMovement.isPending}
                          onDelete={() => delMovement.mutateAsync(m.id)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {movements.filter((m) => m.type === "discard").length === 0 && (
                  <TableRow><TableCell colSpan={canManage ? 8 : 7} className="text-center text-muted-foreground py-6">Nenhum descarte registrado.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
          {discardedItems.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Itens com unidades descartadas: {discardedItems.map((i) => `${i.name} (${i.discarded_quantity})`).join(" · ")}
            </p>
          )}
        </TabsContent>

        {/* REPOSIÇÃO */}
        <TabsContent value="restock" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Sugestão de compra: <b>estoque mínimo − disponível + 1</b></p>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(restock, "reposicao.csv")}>
              <Download className="mr-2 h-4 w-4" /> Lista de compras
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Categoria</TableHead><TableHead>Disponível</TableHead>
                <TableHead>Mínimo</TableHead><TableHead>Comprar</TableHead>
<TableHead>Valor unitário</TableHead><TableHead>Valor estimado</TableHead><TableHead>Status</TableHead>
            {canManage && <TableHead className="text-right">Ações</TableHead>}
            </TableRow></TableHeader>
            <TableBody>
              {restock.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.item}</TableCell>
                  <TableCell>{r.categoria}</TableCell>
                  <TableCell>{r.disponivel}</TableCell>
                  <TableCell>{r.minimo}</TableCell>
                  <TableCell><Badge variant="outline" className="font-normal text-black">{r.comprar}</Badge></TableCell>
                  <TableCell>{currency(r.valor_unitario)}</TableCell>
                  <TableCell>{currency(r.valor_estimado)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={r.status === "Crítico"
                      ? "border-red-300/50 bg-red-400/20 text-black font-normal"
                      : "border-amber-300/50 bg-amber-400/20 text-black font-normal"}>{r.status}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell>
                      <RowActions
                        editTitle="Editar item"
                        onEdit={() => setItemDlg({ open: true, item: items.find((i) => i.id === r.id) })}
                        deleteTitle="Desativar item"
                        deleteDescription={`"${r.item}" deixa de aparecer no estoque e nas listas. O histórico é mantido.`}
                        deleteLabel="Desativar"
                        pending={deactivate.isPending}
                        onDelete={() => deactivate.mutateAsync({ id: r.id })}
                      />
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {restock.length === 0 && <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center text-muted-foreground py-6">Nada a comprar no momento.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="history" className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm text-muted-foreground flex items-center gap-2"><History className="h-4 w-4" /> Histórico completo</h2>
            <Button variant="outline" size="sm" className="border-white bg-[#050d20] text-white hover:bg-[#0c1d3d] hover:text-white" onClick={() => downloadCsv(movements, "historico.csv")}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data e hora</TableHead><TableHead>Ação</TableHead><TableHead>Item</TableHead>
                <TableHead>Qtd</TableHead><TableHead>Patrimônio</TableHead><TableHead>Responsável</TableHead>
                <TableHead>De</TableHead><TableHead>Para</TableHead><TableHead>Observações</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {movements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{dateFmt(m.created_at)}</TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{MOV_LABELS[m.type]}</Badge></TableCell>
                    <TableCell>{itemName(m.item_id)}</TableCell>
                    <TableCell>{m.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{m.patrimony_number || "N/A"}</TableCell>
                    <TableCell>{m.collaborator_id ? collabName(m.collaborator_id) : "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.status_from ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{m.status_to ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{m.notes ?? m.reason ?? "—"}</TableCell>
                    {canManage && (
                      <TableCell>
                        <RowActions
                          editTitle="Editar movimentação"
                          onEdit={() => setMovDlg({ open: true, movement: m })}
                          deleteTitle="Excluir movimentação"
                          deleteDescription="O estoque é recalculado para desfazer o efeito desta linha."
                          deleteLabel="Excluir"
                          pending={delMovement.isPending}
                          onDelete={() => delMovement.mutateAsync(m.id)}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* SOLICITAÇÕES */}
        <TabsContent value="requests"><RequestsPanel canWrite={canWrite} canManage={canManage} /></TabsContent>

        {/* RELATÓRIOS */}
        <TabsContent value="reports" className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCsv(items, "itens.csv")}><Download className="mr-2 h-4 w-4" /> Itens</Button>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(assets, "patrimonios.csv")}><Download className="mr-2 h-4 w-4" /> Patrimônios</Button>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(movements, "movimentacoes.csv")}><Download className="mr-2 h-4 w-4" /> Movimentações</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>Imprimir</Button>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <Kpi label="Total de movimentações" value={movements.length} icon={<Boxes />} />
            <Kpi label="Valor imobilizado" value={currency(totalValue)} icon={<DollarSign />} />
            <Kpi label="Patrimônios cadastrados" value={assets.length} icon={<Package />} />
            <Kpi label="Colaboradores ativos" value={collaborators.filter((c) => c.active).length} icon={<Boxes />} />
          </div>
        </TabsContent>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="settings" className="space-y-4">
          <SettingsPanel canWrite={canWrite} canManage={canManage} />
          <CollaboratorsPanel canWrite={canWrite} canManage={canManage} />
        </TabsContent>

        {/* ESTOQUE */}
        <TabsContent value="estoque" className="space-y-3">
          <EstoquePanel
            canManage={canManage}
            pending={deactivate.isPending}
            onEditItem={(item) => setItemDlg({ open: true, item })}
            onToggleItem={(item) => deactivate.mutate({ id: item.id })}
          />
        </TabsContent>

        {/* CONTAINER (dados descartados) */}
        <TabsContent value="container" className="space-y-3">
          <ContainerPanel canArchive={canZerar} />
        </TabsContent>
        <TabsContent value="mobile" className="space-y-3">
          <PendingList items={items} collaborators={collaborators} canWrite={canWrite} />
        </TabsContent>
      </Tabs>

      <ExitDialog open={exitDlg.open} onOpenChange={(v) => setExitDlg({ open: v, item: v ? exitDlg.item : null })} item={exitDlg.item} />
      <StatusChangeDialog open={statusDlg.open} mode={statusDlg.mode}
        onOpenChange={(v) => setStatusDlg({ ...statusDlg, open: v })} item={statusDlg.item} />
      <ItemUpgradeDialog open={upgradeDlg.open}
        onOpenChange={(v) => setUpgradeDlg({ open: v, item: v ? upgradeDlg.item : null })} item={upgradeDlg.item} />
      <ItemFormDialog open={itemDlg.open} onOpenChange={(v) => setItemDlg({ open: v, item: v ? itemDlg.item : null })} item={itemDlg.item} />
      <AssetFormDialog open={assetDlg.open} onOpenChange={(v) => setAssetDlg({ open: v, asset: v ? assetDlg.asset : null })} asset={assetDlg.asset} />
      <SendToExitDialog
        open={!!sendEntry}
        onOpenChange={(v) => { if (!v) setSendEntry(null); }}
        entry={sendEntry}
        item={items.find((i) => i.id === sendEntry?.item_id)}
      />
      <MovementFormDialog open={movDlg.open} onOpenChange={(v) => setMovDlg({ open: v, movement: v ? movDlg.movement : null })} movement={movDlg.movement} />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{detail?.name}</DialogTitle></DialogHeader>
          {detail && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Field label="Categoria" value={catName(detail.category_id)} />
              <Field label="Subcategoria" value={detail.subcategory ?? "—"} />
              <Field label="Marca" value={detail.brand ?? "—"} />
              <Field label="Modelo" value={detail.model ?? "—"} />
              <Field label="Local" value={locName(detail.location_id)} />
              <Field label="Estoque mínimo" value={String(detail.min_stock)} />
              <Field label="Disponível" value={String(detail.quantity)} />
              <Field label="Em uso" value={String(detail.in_use_quantity)} />
              <Field label="Danificado" value={String(detail.damaged_quantity)} />
              <Field label="Descartado" value={String(detail.discarded_quantity)} />
              <Field label="Valor unitário" value={currency(detail.unit_price)} />
              <Field label="Responsável" value={collabName(detail.responsible_collaborator_id)} />
              <Field label="Patrimônio" value={itemPatrimonies(detail.id)} />
              <Field
                label="Atualizações"
                value={detail.upgrade_count > 0
                  ? `${detail.upgrade_count}${detail.last_upgrade_at
                    ? ` — última em ${new Date(detail.last_upgrade_at).toLocaleDateString("pt-BR")}`
                    : ""}`
                  : "Nenhuma"}
              />
              <div className="col-span-2"><Field label="Descrição" value={detail.description ?? "—"} /></div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p>{value}</p>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={`almox-kpi-card ${accent ? "border-destructive/40" : ""}`}>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`shrink-0 rounded-lg p-2 ${accent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-semibold truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AssetTable({ assets, items, locations, collaborators, canWrite, canManage, onEdit, onDelete }: {
  assets: InventoryAsset[]; items: InventoryItem[]; locations: InventoryLocation[]; collaborators: InventoryCollaborator[];
  canWrite: boolean; canManage: boolean;
  onEdit: (a: InventoryAsset) => void; onDelete: (a: InventoryAsset) => void;
}) {
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const collabName = (id: string | null) => collaborators.find((c) => c.id === id)?.full_name ?? "—";
  const showActions = canWrite || canManage;
  // Setores ficam juntos (A-Z); dentro de cada setor, responsáveis em ordem alfabética; depois patrimônio.
  const sortedAssets = [...assets].sort((a, b) =>
    (a.department ?? "").localeCompare(b.department ?? "", "pt-BR", { sensitivity: "base" })
    || collabName(a.collaborator_id).localeCompare(collabName(b.collaborator_id), "pt-BR", { sensitivity: "base" })
    || a.patrimony_number.localeCompare(b.patrimony_number, "pt-BR", { numeric: true }),
  );
  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Patrimônio</TableHead><TableHead>Item</TableHead><TableHead>Série</TableHead>
          <TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Local</TableHead>
          <TableHead>Responsável</TableHead><TableHead>Departamento</TableHead>
          {showActions && <TableHead className="text-right">Ações</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {sortedAssets.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-mono font-medium">{a.patrimony_number}</TableCell>
              <TableCell>{itemName(a.item_id)}</TableCell>
              <TableCell className="font-mono text-xs">{a.serial_number ?? "—"}</TableCell>
              <TableCell>{currency(a.value)}</TableCell>
              <TableCell><StatusTag status={a.status} /></TableCell>
              <TableCell>{locName(a.location_id)}</TableCell>
              <TableCell>{collabName(a.collaborator_id)}</TableCell>
              <TableCell>{a.department ?? "—"}</TableCell>
              {showActions && (
                <TableCell>
                  <div className="flex justify-end">
                    <RowActions
                      onEdit={canWrite ? () => onEdit(a) : undefined}
                      editTitle="Editar patrimônio"
                      deleteTitle="Excluir patrimônio"
                      deleteDescription={`O patrimônio ${a.patrimony_number} será removido. As movimentações dele no histórico são mantidas.`}
                      deleteLabel="Excluir"
                      onDelete={canManage ? () => onDelete(a) : undefined}
                    />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
          {assets.length === 0 && <TableRow><TableCell colSpan={showActions ? 9 : 8} className="text-center text-muted-foreground py-6">Nenhum patrimônio.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function RequestsPanel({ canWrite, canManage }: { canWrite: boolean; canManage: boolean }) {
  const { data: items = [] } = useInventoryItems();
  const { data: requests = [] } = useInventoryRequests();
  const createReq = useCreateRequest();
  const updateReq = useUpdateRequest();
  const delReq = useDeleteRequest();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", quantity: 1, justification: "" });
  const [editing, setEditing] = useState<InventoryRequest | null>(null);
  const [editForm, setEditForm] = useState({ status: "pending" as InventoryRequest["status"], justification: "" });

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  const showActions = canWrite || canManage;

  const openEdit = (r: InventoryRequest) => {
    setEditing(r);
    setEditForm({ status: r.status, justification: r.justification ?? "" });
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setOpen(true)}><Send className="mr-2 h-4 w-4" /> Nova solicitação</Button>
      </div>
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead>
            <TableHead>Justificativa</TableHead><TableHead>Status</TableHead>
            {showActions && <TableHead className="text-right">Ações</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{dateFmt(r.created_at)}</TableCell>
                <TableCell>{itemName(r.item_id)}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell className="max-w-[280px] truncate">{r.justification ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="font-normal">{r.status}</Badge></TableCell>
                {showActions && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {canWrite && r.status === "pending" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => updateReq.mutate({ id: r.id, status: "approved" })}>Aprovar</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateReq.mutate({ id: r.id, status: "rejected" })}>Rejeitar</Button>
                        </>
                      )}
                      {canWrite && r.status === "approved" && (
                        <Button size="sm" variant="ghost" onClick={() => updateReq.mutate({ id: r.id, status: "delivered" })}>Marcar entregue</Button>
                      )}
                      {canManage && (
                        <RowActions
                          editTitle="Editar solicitação"
                          onEdit={() => openEdit(r)}
                          deleteTitle="Excluir solicitação"
                          deleteDescription="A solicitação será removida. Isso não movimenta o estoque."
                          deleteLabel="Excluir"
                          pending={delReq.isPending}
                          onDelete={() => delReq.mutateAsync(r.id)}
                        />
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {requests.length === 0 && <TableRow><TableCell colSpan={showActions ? 6 : 5} className="text-center text-muted-foreground py-6">Nenhuma solicitação.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar solicitação</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Item</Label>
              <Input value={editing ? itemName(editing.item_id) : ""} readOnly className="bg-muted/50" />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={editForm.status} onValueChange={(v: InventoryRequest["status"]) => setEditForm({ ...editForm, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="approved">Aprovada</SelectItem>
                  <SelectItem value="rejected">Rejeitada</SelectItem>
                  <SelectItem value="delivered">Entregue</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Justificativa</Label><Textarea value={editForm.justification} onChange={(e) => setEditForm({ ...editForm, justification: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button disabled={updateReq.isPending} onClick={async () => {
              if (!editing) return;
              const { status } = editForm;
              await updateReq.mutateAsync({ id: editing.id, status, review_notes: editForm.justification });
              setEditing(null);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova solicitação</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div>
              <Label>Item</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{items.filter((i) => i.status === "active").map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Quantidade</Label><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div><Label>Justificativa</Label><Textarea value={form.justification} onChange={(e) => setForm({ ...form, justification: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.item_id} onClick={async () => { await createReq.mutateAsync(form); setOpen(false); setForm({ item_id: "", quantity: 1, justification: "" }); }}>Enviar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsPanel({ canWrite, canManage }: { canWrite: boolean; canManage: boolean }) {
  const { data: categories = [] } = useInventoryCategories();
  const { data: locations = [] } = useInventoryLocations();
  const { data: settings } = useInventorySettings();
  const updateSettings = useUpdateInventorySettings();
  const createCat = useCreateCategory();
  const updateCat = useUpdateCategory();
  const delCat = useDeleteCategory();
  const createLoc = useCreateLocation();
  const updateLoc = useUpdateLocation();
  const delLoc = useDeleteLocation();
  const { data: departments = [] } = useInventoryDepartments();
  const saveDept = useSaveDepartment();
  const delDept = useDeleteDepartment();
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");
  const [dept, setDept] = useState("");
  const [editDept, setEditDept] = useState<{ id: string; name: string } | null>(null);
  const [rename, setRename] = useState<{ kind: "category" | "location"; id: string; name: string } | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Cálculo do valor total</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            checked={settings?.include_damaged_in_value ?? true}
            disabled={!canManage}
            onCheckedChange={(v) => updateSettings.mutate({ include_damaged_in_value: v })}
          />
          <div>
            <p className="text-sm font-medium">Incluir itens danificados no valor total?</p>
            <p className="text-xs text-muted-foreground">Itens descartados e inativos nunca entram no cálculo.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Categorias</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canWrite && (
              <div className="flex gap-2">
                <Input placeholder="Nova categoria" value={cat} onChange={(e) => setCat(e.target.value)} />
                <Button size="sm" onClick={async () => { if (cat.trim()) { await createCat.mutateAsync({ name: cat.trim() }); setCat(""); } }}>Adicionar</Button>
              </div>
            )}
            <ul className="space-y-1.5">
              {categories.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="flex-1 justify-start font-normal">{c.name}</Badge>
                  {canManage && (
                    <RowActions
                      editTitle="Renomear categoria"
                      onEdit={() => setRename({ kind: "category", id: c.id, name: c.name })}
                      deleteTitle="Excluir categoria"
                      deleteDescription={`"${c.name}" será removida. Os itens vinculados ficam sem categoria.`}
                      deleteLabel="Excluir"
                      pending={delCat.isPending}
                      onDelete={() => delCat.mutateAsync(c.id)}
                    />
                  )}
                </li>
              ))}
              {categories.length === 0 && <li className="text-muted-foreground text-sm">Nenhuma categoria.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Locais</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canWrite && (
              <div className="flex gap-2">
                <Input placeholder="Novo local" value={loc} onChange={(e) => setLoc(e.target.value)} />
                <Button size="sm" onClick={async () => { if (loc.trim()) { await createLoc.mutateAsync({ name: loc.trim() }); setLoc(""); } }}>Adicionar</Button>
              </div>
            )}
            <ul className="space-y-1.5">
              {locations.map((l) => (
                <li key={l.id} className="flex items-center gap-2">
                  <Badge variant="outline" className="flex-1 justify-start font-normal">{l.name}</Badge>
                  {canManage && (
                    <RowActions
                      editTitle="Renomear local"
                      onEdit={() => setRename({ kind: "location", id: l.id, name: l.name })}
                      deleteTitle="Excluir local"
                      deleteDescription={`"${l.name}" será removido. Os itens vinculados ficam sem local.`}
                      deleteLabel="Excluir"
                      pending={delLoc.isPending}
                      onDelete={() => delLoc.mutateAsync(l.id)}
                    />
                  )}
                </li>
              ))}
              {locations.length === 0 && <li className="text-muted-foreground text-sm">Nenhum local.</li>}
            </ul>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Setores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canWrite && (
              <div className="flex gap-2">
                <Input placeholder="Novo setor" value={dept} onChange={(e) => setDept(e.target.value)} />
                <Button size="sm" onClick={async () => { if (dept.trim()) { await saveDept.mutateAsync({ name: dept }); setDept(""); } }}>Adicionar</Button>
              </div>
            )}
            <ul className="grid sm:grid-cols-2 gap-2 text-sm">
              {departments.map((d) => (
                <li key={d.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                  {editDept?.id === d.id ? (
                    <>
                      <Input value={editDept.name} onChange={(e) => setEditDept({ id: d.id, name: e.target.value })} className="h-8" />
                      <Button size="sm" variant="ghost" onClick={async () => { await saveDept.mutateAsync({ id: d.id, name: editDept.name, active: d.active }); setEditDept(null); }}>Salvar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditDept(null)}>Cancelar</Button>
                    </>
                  ) : (
                    <>
                      <span className={d.active ? "flex-1" : "flex-1 text-muted-foreground line-through"}>{d.name}</span>
                      {canWrite && (
                        <Button size="sm" variant="outline" onClick={() => setEditDept({ id: d.id, name: d.name })}>Renomear</Button>
                      )}
                      {canWrite && (
                        <Button size="sm" variant="outline" onClick={() => saveDept.mutate({ id: d.id, name: d.name, active: !d.active })}>
                          {d.active ? "Desativar" : "Ativar"}
                        </Button>
                      )}
                      {canManage && (
                        <RowActions
                          editTitle="Renomear setor"
                          onEdit={() => setEditDept({ id: d.id, name: d.name })}
                          deleteTitle="Excluir setor"
                          deleteDescription={`"${d.name}" será removido. Os colaboradores vinculados ficam sem setor.`}
                          deleteLabel="Excluir"
                          pending={delDept.isPending}
                          onDelete={() => delDept.mutateAsync(d.id)}
                        />
                      )}
                    </>
                  )}
                </li>
              ))}
              {departments.length === 0 && <li className="text-muted-foreground">Nenhum setor cadastrado.</li>}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!rename} onOpenChange={(v) => !v && setRename(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{rename?.kind === "category" ? "Renomear categoria" : "Renomear local"}</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Nome</Label>
            <Input value={rename?.name ?? ""} onChange={(e) => setRename(rename && { ...rename, name: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRename(null)}>Cancelar</Button>
            <Button disabled={!rename?.name.trim()} onClick={async () => {
              if (!rename) return;
              if (rename.kind === "category") await updateCat.mutateAsync({ id: rename.id, name: rename.name.trim() });
              else await updateLoc.mutateAsync({ id: rename.id, name: rename.name.trim() });
              setRename(null);
            }}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Itens com o mesmo nome aparecem como uma linha só, com as quantidades somadas.
function agruparPorNome(itens: InventoryItem[]) {
  const grupos = new Map<string, { key: string; name: string; disponivel: number; emUso: number; itens: InventoryItem[] }>();
  itens.forEach((item) => {
    const key = (item.name ?? "").trim().toLowerCase();
    const g = grupos.get(key);
    if (g) {
      g.disponivel += item.quantity;
      g.emUso += item.in_use_quantity;
      g.itens.push(item);
    } else {
      grupos.set(key, { key, name: item.name, disponivel: item.quantity, emUso: item.in_use_quantity, itens: [item] });
    }
  });
  return [...grupos.values()];
}

function EstoquePanel({ canManage, onEditItem, onToggleItem, pending }: {
  canManage: boolean;
  onEditItem: (item: InventoryItem) => void;
  onToggleItem: (item: InventoryItem) => void;
  pending: boolean;
}) {
  const { data: items = [] } = useInventoryItems();

  const rows = useMemo(() => resumoEstoque(items), [items]);
  const [aberto, setAberto] = useState<Record<string, boolean>>({});
  const total = rows.reduce((acc, r) => acc + r.quantidade, 0);
  const canZerar = useCanZerarEstoque();
  const zerar = useZerarEstoque();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mesmo produto com marcas diferentes vira uma linha só. Total geral: <b>{total}</b>
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="border-white bg-[#050d20] text-white hover:bg-[#0c1d3d] hover:text-white" onClick={() => downloadCsv(rows.map(({ tipo, quantidade }) => ({ tipo, quantidade })), "estoque.csv")}>
            <Download className="mr-2 h-4 w-4" /> CSV
          </Button>
          {canZerar && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" className="bg-red-900 text-white hover:bg-red-950" disabled={zerar.isPending}>Zerar Estoque</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Zerar o estoque?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A quantidade disponível de todos os itens volta para 0. Cadastros, histórico e patrimônios são mantidos,
                    e as quantidades anteriores ficam guardadas. Novas entradas começam a contar a partir de zero.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction className="bg-red-900 text-white hover:bg-red-950" onClick={() => zerar.mutate()}>
                    Zerar estoque
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
      <div className="space-y-2 md:hidden">
        {rows.map((r) => {
          const abertoRow = !!aberto[r.tipo];
          return (
            <Card key={r.tipo}>
              <CardContent className="p-0">
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={canManage ? () => setAberto({ ...aberto, [r.tipo]: !abertoRow }) : undefined}
                  className="flex w-full items-center justify-between gap-3 p-3 text-left disabled:cursor-default"
                >
                  <span className="min-w-0 break-words font-medium">{r.tipo}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {r.quantidade === 0 ? (
                      <Badge variant="outline" className="border-red-500/50 bg-red-400 text-black font-normal">Sem estoque</Badge>
                    ) : (
                      <span className="font-semibold">{r.quantidade}</span>
                    )}
                    {canManage && <ChevronDown className={`h-4 w-4 transition-transform ${abertoRow ? "rotate-180" : ""}`} />}
                  </span>
                </button>
                {canManage && abertoRow && (
                  <div className="space-y-2 border-t p-3">
                    {agruparPorNome(r.itens).map((g) => (
                      <div key={g.key} className="flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <p className="break-words">{g.name}</p>
                          <p className="text-xs text-muted-foreground">disp. {g.disponivel} · em uso {g.emUso}</p>
                        </div>
                        {g.itens.length === 1 && (
                          <RowActions
                            editTitle="Editar item"
                            onEdit={() => onEditItem(g.itens[0])}
                            deleteTitle="Desativar item"
                            deleteDescription={`"${g.name}" deixa de aparecer no estoque e nas listas. O histórico é mantido.`}
                            deleteLabel="Desativar"
                            pending={pending}
                            onDelete={() => onToggleItem(g.itens[0])}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum item cadastrado. Registre uma entrada para começar.</p>
        )}
      </div>

      <div className="hidden md:block"><Card><CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead className="text-right">Estoque Atual</TableHead>
            {canManage && <TableHead className="w-10" />}
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((r) => {
              const abertoRow = !!aberto[r.tipo];
              return (
                <Fragment key={r.tipo}>
                  <TableRow
                    className={canManage ? "cursor-pointer hover:bg-muted/50" : undefined}
                    onClick={canManage ? () => setAberto({ ...aberto, [r.tipo]: !abertoRow }) : undefined}
                  >
                    <TableCell className="font-medium">{r.tipo}</TableCell>
                    <TableCell className="text-right">
                      {r.quantidade === 0 ? (
                        <Badge variant="outline" className="border-red-500/50 bg-red-400 text-black font-normal">Sem estoque</Badge>
                      ) : (
                        <span className="font-semibold">{r.quantidade}</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7"
                          title={abertoRow ? "Fechar" : "Ver itens deste tipo"}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${abertoRow ? "rotate-180" : ""}`} />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>

                  {canManage && abertoRow && agruparPorNome(r.itens).map((g) => (
                    <TableRow key={g.key} className="bg-muted/30">
                      <TableCell className="pl-8">
                        <span className="text-sm">{g.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          disp. {g.disponivel} · em uso {g.emUso}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {g.disponivel}
                      </TableCell>
                      <TableCell>
                        {g.itens.length === 1 && (
                          <RowActions
                            editTitle="Editar item"
                            onEdit={() => onEditItem(g.itens[0])}
                            deleteTitle="Desativar item"
                            deleteDescription={`"${g.name}" deixa de aparecer no estoque e nas listas. O histórico é mantido.`}
                            deleteLabel="Desativar"
                            pending={pending}
                            onDelete={() => onToggleItem(g.itens[0])}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <TableRow><TableCell colSpan={canManage ? 3 : 2} className="text-center text-muted-foreground py-6">Nenhum item cadastrado. Registre uma entrada para começar.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card></div>
    </div>
  );
}
