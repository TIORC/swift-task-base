import { Fragment, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Package, Plus, AlertTriangle, Boxes, DollarSign, Wrench, Trash2, Search, ShoppingCart, Send, Settings, Download, History, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  useUpdateCategory, useDeleteCategory, useUpdateLocation, useDeleteLocation, useDeleteDepartment,
} from "@/hooks/useInventory";
import { ItemFormDialog } from "@/components/almoxarifado/ItemFormDialog";
import { EntryDialog } from "@/components/almoxarifado/EntryDialog";
import { ExitDialog } from "@/components/almoxarifado/ExitDialog";
import { StatusChangeDialog } from "@/components/almoxarifado/StatusChangeDialog";
import { ItemUpgradeDialog } from "@/components/almoxarifado/ItemUpgradeDialog";
import { AssetFormDialog } from "@/components/almoxarifado/AssetFormDialog";
import { CollaboratorsPanel } from "@/components/almoxarifado/CollaboratorsPanel";
import { MovementFormDialog } from "@/components/almoxarifado/MovementFormDialog";
import { RowActions } from "@/components/almoxarifado/RowActions";
import { TablePagination } from "@/components/almoxarifado/TablePagination";
import { StockBadge, StatusTag, ItemStatusTags } from "@/components/almoxarifado/StockBadge";
import type { InventoryItem, InventoryAsset, InventoryMovement, InventoryRequest, InventoryLocation, InventoryCollaborator, MovementType } from "@/hooks/useInventory";
import { SECTORS } from "@/types/sectors";
import { agruparPorTipo, resumoEstoque } from "@/lib/inventory-stock";
import { usePageTheme } from "@/hooks/usePageTheme";

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = (s: string) => new Date(s).toLocaleString("pt-BR");
const alphaInitial = (name: string) => name.trim().charAt(0).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

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

export default function Almoxarifado() {
  usePageTheme("almoxarifado");
  const canWrite = useCanWriteInventory();
  const canManage = useCanManageInventory();
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
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [collabFilter, setCollabFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [outCollabFilter, setOutCollabFilter] = useState("all");
  const [outPage, setOutPage] = useState(1);
  const [outPageSize, setOutPageSize] = useState(100);

  const [entryOpen, setEntryOpen] = useState(false);
  const [lastCreatedItem, setLastCreatedItem] = useState<string | null>(null);
  const [exitDlg, setExitDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [statusDlg, setStatusDlg] = useState<{ open: boolean; item?: InventoryItem | null; mode: "damage" | "discard" }>({ open: false, mode: "damage" });
  const [upgradeDlg, setUpgradeDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [itemDlg, setItemDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [assetDlg, setAssetDlg] = useState<{ open: boolean; asset?: InventoryAsset | null }>({ open: false });
  const [movDlg, setMovDlg] = useState<{ open: boolean; movement?: InventoryMovement | null }>({ open: false });
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
  const outMovements = useMemo(() => movements
    .filter((m) => m.type === "out" || m.type === "assign")
    .slice()
    .sort((a, b) => {
      const byCollaborator = collabName(a.collaborator_id).localeCompare(collabName(b.collaborator_id), "pt-BR", { sensitivity: "base" });
      return byCollaborator || itemName(a.item_id).localeCompare(itemName(b.item_id), "pt-BR", { sensitivity: "base" });
    }), [movements, collaborators, items]);
  const outLetters = Array.from(new Set(outMovements
    .map((m) => alphaInitial(collabName(m.collaborator_id)))
    .filter((letter) => /^[A-Z]$/.test(letter))));
  const filteredOutMovements = useMemo(
    () => outCollabFilter === "all"
      ? outMovements
      : outMovements.filter((m) => m.collaborator_id === outCollabFilter),
    [outMovements, outCollabFilter],
  );
  const outTotalPages = Math.max(1, Math.ceil(filteredOutMovements.length / outPageSize));
  const outSafePage = Math.min(outPage, outTotalPages);
  const pagedOutMovements = useMemo(
    () => filteredOutMovements.slice((outSafePage - 1) * outPageSize, outSafePage * outPageSize),
    [filteredOutMovements, outSafePage, outPageSize],
  );
  // O índice A-Z rola a página: com a lista paginada o destino pode estar em outra
  // página, então o índice procurado define a página antes do scrollIntoView.
  const jumpToOutLetter = (letter: string) => {
    const index = filteredOutMovements.findIndex((m) => alphaInitial(collabName(m.collaborator_id)) === letter);
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
    <div className="space-y-6">
      <PageHeader
        title="Almoxarifado TI"
        description="Entrada, saída e controle de equipamentos, peças e materiais"
        icon={<Package className="h-6 w-6" />}
        actions={
          <>
            <Button size="sm" variant="outline" className="border-white bg-[#050d20] text-white hover:bg-[#0c1d3d] hover:text-white" onClick={() => setTab("settings")}>
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </Button>
          </>

        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items">Itens</TabsTrigger>
          <TabsTrigger value="in">Entradas</TabsTrigger>
          <TabsTrigger value="out">Saídas</TabsTrigger>
          <TabsTrigger value="assets">Patrimônios</TabsTrigger>
          <TabsTrigger value="damaged">Danificados</TabsTrigger>
          <TabsTrigger value="discarded">Descartados</TabsTrigger>
          <TabsTrigger value="restock">Reposição</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
        </TabsList>

        {/* ---------------- DASHBOARD ---------------- */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi icon={<Boxes />} label="Itens cadastrados" value={activeItems.length} />
            <Kpi icon={<DollarSign />} label="Valor total" value={currency(totalValue)} />
            <Kpi icon={<Wrench />} label="Em uso" value={inUse} />
            <Kpi icon={<AlertTriangle />} label="Danificados" value={damaged} />
            <Kpi icon={<Trash2 />} label="Descartados" value={discarded} />
            <Kpi icon={<ShoppingCart />} label="Alertas de estoque" value={lowStock.length} accent={lowStock.length > 0} />
          </div>

          <Card className="low-stock-card">
            <CardHeader><CardTitle className="text-base">Itens abaixo do estoque mínimo</CardTitle></CardHeader>
            <CardContent className="max-h-[22rem] overflow-y-auto">
              {restock.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item abaixo do estoque mínimo.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Item</TableHead><TableHead>Disponível</TableHead><TableHead>Mínimo</TableHead><TableHead>Comprar</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow></TableHeader>
                  <TableBody>
                    {restock.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.item}</TableCell>
                        <TableCell className={r.disponivel === 0 ? "low-stock-zero" : undefined}>{r.disponivel}</TableCell>
                        <TableCell>{r.minimo}</TableCell>
                        <TableCell><Badge variant="outline" className="border-amber-300/50 bg-amber-400/20 text-black font-normal">{r.comprar}</Badge></TableCell>
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
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Últimas movimentações</CardTitle></CardHeader>
            <CardContent className="max-h-[13rem] overflow-y-auto">
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
          <Card>
            <CardContent className="p-0">
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
          </Card>
        </TabsContent>

        {/* ---------------- ENTRADAS ---------------- */}
        <TabsContent value="in" className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm text-muted-foreground">Histórico de entradas</h2>
            {canWrite && (
              <Button size="sm" onClick={() => setEntryOpen(true)}><Plus className="mr-2 h-4 w-4" /> Nova entrada</Button>
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
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead>
                <TableHead>Valor unit.</TableHead><TableHead>Valor total</TableHead>
<TableHead>Patrimônio</TableHead><TableHead>Fornecedor</TableHead>
                    <TableHead>Nota fiscal</TableHead><TableHead>Local</TableHead>
                    {canManage && <TableHead className="text-right">Ações</TableHead>}
                  </TableRow></TableHeader>
                  <TableBody>
                    {movements.filter((m) => m.type === "in").map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="whitespace-nowrap">{dateFmt(m.occurred_at ?? m.created_at)}</TableCell>
                        <TableCell>{itemName(m.item_id)}</TableCell>
                        <TableCell>{m.quantity}</TableCell>
                        <TableCell>{currency(m.unit_price ?? 0)}</TableCell>
                        <TableCell>{currency((m.unit_price ?? 0) * m.quantity)}</TableCell>
                        <TableCell className="font-mono text-xs">{m.patrimony_number || "N/A"}</TableCell>
                        <TableCell>{m.supplier ?? "—"}</TableCell>
                        <TableCell>{m.invoice_number ?? "—"}</TableCell>
                        <TableCell>{locName(m.to_location_id)}</TableCell>
                        {canManage && (
                          <TableCell>
                            <RowActions
                              editTitle="Editar entrada"
                              onEdit={() => setMovDlg({ open: true, movement: m })}
                              deleteTitle="Excluir entrada"
                              deleteDescription="A quantidade desta entrada volta para o estoque do item."
                              deleteLabel="Excluir"
                              pending={delMovement.isPending}
                              onDelete={() => delMovement.mutateAsync(m.id)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {movements.filter((m) => m.type === "in").length === 0 && (
                      <TableRow><TableCell colSpan={canManage ? 10 : 9} className="text-center text-muted-foreground py-6">Nenhuma entrada registrada.</TableCell></TableRow>
                    )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ---------------- SAÍDAS ---------------- */}
        <TabsContent value="out" className="space-y-3">
          <p className="text-sm text-muted-foreground">Toda saída exige um responsável. Registre a saída pela tela de Itens.</p>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Select
              value={outCollabFilter}
              onValueChange={(v) => { setOutCollabFilter(v); setOutPage(1); }}
            >
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os responsáveis</SelectItem>
                {collaborators.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
            {outCollabFilter !== "all" && (
              <Button variant="outline" size="sm" onClick={() => { setOutCollabFilter("all"); setOutPage(1); }}>Limpar</Button>
            )}
          </div>

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
          
          <Card className="min-w-0 flex-1"><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead>
                <TableHead>Responsável</TableHead><TableHead>Departamento</TableHead>
<TableHead>Patrimônio</TableHead><TableHead>Motivo</TableHead><TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {pagedOutMovements.map((m, index) => {
                  const responsibleLetter = alphaInitial(collabName(m.collaborator_id));
                  const previousLetter = index > 0 ? alphaInitial(collabName(pagedOutMovements[index - 1].collaborator_id)) : "";
                  const firstOfLetter = /^[A-Z]$/.test(responsibleLetter) && responsibleLetter !== previousLetter;
                  return <TableRow key={m.id} id={firstOfLetter ? `out-letter-${responsibleLetter}` : undefined}>
                    <TableCell className="whitespace-nowrap">{dateFmt(m.created_at)}</TableCell>
                    <TableCell>{itemName(m.item_id)}</TableCell>
                    <TableCell>{m.quantity}</TableCell>
                    <TableCell>{collabName(m.collaborator_id)}</TableCell>
                    <TableCell>{m.department ?? collabDept(m.collaborator_id)}</TableCell>
                    <TableCell className="font-mono text-xs">{m.patrimony_number || "N/A"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{m.reason ?? "—"}</TableCell>
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
                {filteredOutMovements.length === 0 && (
                  <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center text-muted-foreground py-6">
                    {outCollabFilter === "all"
                      ? "Nenhuma saída registrada."
                      : `Nenhuma saída registrada para ${collabName(outCollabFilter)}.`}
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
          </div>

          <TablePagination
            page={outSafePage}
            pageSize={outPageSize}
            total={filteredOutMovements.length}
            noun="saídas"
            onPageChange={setOutPage}
            onPageSizeChange={(n) => { setOutPageSize(n); setOutPage(1); }}
          />
        </TabsContent>

        {/* PATRIMÔNIOS */}
        <TabsContent value="assets" className="space-y-3">
          <div className="flex justify-end">
            {canWrite && <Button size="sm" onClick={() => setAssetDlg({ open: true, asset: null })}><Plus className="mr-2 h-4 w-4" /> Novo patrimônio</Button>}
          </div>
          <AssetTable assets={assets} items={items} locations={locations} collaborators={collaborators} canWrite={canWrite} canManage={canManage} onEdit={(a) => setAssetDlg({ open: true, asset: a })} onDelete={(a) => delAsset.mutate(a.id)} />
        </TabsContent>

        {/* DANIFICADOS */}
        <TabsContent value="damaged" className="space-y-3">
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
                <TableCell className="font-medium">{i.name}</TableCell>
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
      </Tabs>

      <EntryDialog open={entryOpen} onOpenChange={setEntryOpen} onCreated={(id) => setLastCreatedItem(id)} />
      <ExitDialog open={exitDlg.open} onOpenChange={(v) => setExitDlg({ open: v, item: v ? exitDlg.item : null })} item={exitDlg.item} />
      <StatusChangeDialog open={statusDlg.open} mode={statusDlg.mode}
        onOpenChange={(v) => setStatusDlg({ ...statusDlg, open: v })} item={statusDlg.item} />
      <ItemUpgradeDialog open={upgradeDlg.open}
        onOpenChange={(v) => setUpgradeDlg({ open: v, item: v ? upgradeDlg.item : null })} item={upgradeDlg.item} />
      <ItemFormDialog open={itemDlg.open} onOpenChange={(v) => setItemDlg({ open: v, item: v ? itemDlg.item : null })} item={itemDlg.item} />
      <AssetFormDialog open={assetDlg.open} onOpenChange={(v) => setAssetDlg({ open: v, asset: v ? assetDlg.asset : null })} asset={assetDlg.asset} />
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
    </div>
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
  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Patrimônio</TableHead><TableHead>Item</TableHead><TableHead>Série</TableHead>
          <TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Local</TableHead>
          <TableHead>Responsável</TableHead>
          {showActions && <TableHead className="text-right">Ações</TableHead>}
        </TableRow></TableHeader>
        <TableBody>
          {assets.map((a) => (
            <TableRow key={a.id}>
              <TableCell className="font-mono font-medium">{a.patrimony_number}</TableCell>
              <TableCell>{itemName(a.item_id)}</TableCell>
              <TableCell className="font-mono text-xs">{a.serial_number ?? "—"}</TableCell>
              <TableCell>{currency(a.value)}</TableCell>
              <TableCell><StatusTag status={a.status} /></TableCell>
              <TableCell>{locName(a.location_id)}</TableCell>
              <TableCell>{collabName(a.collaborator_id)}</TableCell>
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
          {assets.length === 0 && <TableRow><TableCell colSpan={showActions ? 8 : 7} className="text-center text-muted-foreground py-6">Nenhum patrimônio.</TableCell></TableRow>}
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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Mesmo produto com marcas diferentes vira uma linha só. Total geral: <b>{total}</b>
        </p>
        <Button variant="outline" size="sm" className="border-white bg-[#050d20] text-white hover:bg-[#0c1d3d] hover:text-white" onClick={() => downloadCsv(rows.map(({ tipo, quantidade }) => ({ tipo, quantidade })), "estoque.csv")}>
          <Download className="mr-2 h-4 w-4" /> CSV
        </Button>
      </div>
      <Card><CardContent className="p-0 overflow-x-auto">
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
                  <TableRow>
                    <TableCell className="font-medium">{r.tipo}</TableCell>
                    <TableCell className="text-right">
                      {r.quantidade === 0 ? (
                        <Badge variant="outline" className="border-red-300/50 bg-red-400/20 text-red-100 font-normal">Sem estoque</Badge>
                      ) : (
                        <span className="font-semibold">{r.quantidade}</span>
                      )}
                    </TableCell>
                    {canManage && (
                      <TableCell>
                        <Button
                          size="sm" variant="ghost" className="h-7 w-7"
                          title={abertoRow ? "Fechar" : "Ver itens deste tipo"}
                          onClick={() => setAberto({ ...aberto, [r.tipo]: !abertoRow })}
                        >
                          <ChevronDown className={`h-4 w-4 transition-transform ${abertoRow ? "rotate-180" : ""}`} />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>

                  {canManage && abertoRow && r.itens.map((item) => (
                    <TableRow key={item.id} className="bg-muted/30">
                      <TableCell className="pl-8">
                        <span className="text-sm">{item.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          disp. {item.quantity} · em uso {item.in_use_quantity}
                          {item.min_stock > item.quantity && ` · mín. ${item.min_stock}`}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {item.quantity + item.in_use_quantity}
                      </TableCell>
                      <TableCell>
                        <RowActions
                          editTitle="Editar item"
                          onEdit={() => onEditItem(item)}
                          deleteTitle="Desativar item"
                          deleteDescription={`"${item.name}" deixa de aparecer no estoque e nas listas. O histórico é mantido.`}
                          deleteLabel="Desativar"
                          pending={pending}
                          onDelete={() => onToggleItem(item)}
                        />
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
      </CardContent></Card>
    </div>
  );
}
