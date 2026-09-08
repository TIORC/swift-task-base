import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Package, Plus, AlertTriangle, Boxes, DollarSign, Wrench, Trash2, Search, ShoppingCart, Send, Settings, Download, History } from "lucide-react";
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
  useInventoryCategories, useInventoryLocations, useCanWriteInventory,
  useCreateCategory, useCreateLocation, useCreateRequest, useUpdateRequest,
  useInventoryCollaborators, useInventorySettings, useUpdateInventorySettings, useRecoverDamaged,
} from "@/hooks/useInventory";
import { ItemFormDialog } from "@/components/almoxarifado/ItemFormDialog";
import { EntryDialog } from "@/components/almoxarifado/EntryDialog";
import { ExitDialog } from "@/components/almoxarifado/ExitDialog";
import { StatusChangeDialog } from "@/components/almoxarifado/StatusChangeDialog";
import { AssetFormDialog } from "@/components/almoxarifado/AssetFormDialog";
import { CollaboratorsPanel } from "@/components/almoxarifado/CollaboratorsPanel";
import { StockBadge, StatusTag, ItemStatusTags } from "@/components/almoxarifado/StockBadge";
import type { InventoryItem, InventoryAsset, MovementType } from "@/hooks/useInventory";

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = (s: string) => new Date(s).toLocaleString("pt-BR");

const MOV_LABELS: Record<MovementType, string> = {
  in: "Entrada", out: "Saída", transfer: "Transferência", damage: "Dano",
  discard: "Descarte", adjust: "Ajuste", assign: "Atribuição", return: "Devolução",
};

function downloadCsv(rows: any[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export default function Almoxarifado() {
  const canWrite = useCanWriteInventory();
  const { data: items = [] } = useInventoryItems();
  const { data: assets = [] } = useInventoryAssets();
  const { data: movements = [] } = useInventoryMovements();
  const { data: categories = [] } = useInventoryCategories();
  const { data: locations = [] } = useInventoryLocations();
  const { data: collaborators = [] } = useInventoryCollaborators();
  const { data: settings } = useInventorySettings();
  const recover = useRecoverDamaged();

  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [entryOpen, setEntryOpen] = useState(false);
  const [lastCreatedItem, setLastCreatedItem] = useState<string | null>(null);
  const [exitDlg, setExitDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [statusDlg, setStatusDlg] = useState<{ open: boolean; item?: InventoryItem | null; mode: "damage" | "discard" }>({ open: false, mode: "damage" });
  const [itemDlg, setItemDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [assetDlg, setAssetDlg] = useState<{ open: boolean; asset?: InventoryAsset | null }>({ open: false });
  const [detail, setDetail] = useState<InventoryItem | null>(null);

  const includeDamaged = settings?.include_damaged_in_value ?? true;

  const filteredItems = useMemo(() => items.filter((i) => {
    if (categoryFilter !== "all" && i.category_id !== categoryFilter) return false;
    if (search && !`${i.name} ${i.sku ?? ""} ${i.brand ?? ""} ${i.model ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, search, categoryFilter]);

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const collabName = (id: string | null) => collaborators.find((c) => c.id === id)?.full_name ?? "—";
  const collabDept = (id: string | null) => collaborators.find((c) => c.id === id)?.department ?? "—";
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
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
            <Button size="sm" variant="outline" onClick={() => setTab("settings")}>
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

          <Card>
            <CardHeader><CardTitle className="text-base">Itens abaixo do estoque mínimo</CardTitle></CardHeader>
            <CardContent>
              {restock.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item abaixo do estoque mínimo.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Item</TableHead><TableHead>Disponível</TableHead><TableHead>Mínimo</TableHead><TableHead>Comprar</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {restock.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{r.item}</TableCell>
                        <TableCell>{r.disponivel}</TableCell>
                        <TableCell>{r.minimo}</TableCell>
                        <TableCell><Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-normal">{r.comprar}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Últimas movimentações</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead><TableHead>Motivo</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {movements.slice(0, 10).map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{dateFmt(m.created_at)}</TableCell>
                      <TableCell><Badge variant="outline" className="font-normal">{MOV_LABELS[m.type]}</Badge></TableCell>
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
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(filteredItems, "itens.csv")}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Itens são criados apenas pela tela de Entradas.</p>
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead>Categoria</TableHead>
                  <TableHead>Total</TableHead><TableHead>Disp.</TableHead><TableHead>Em uso</TableHead>
                  <TableHead>Danif.</TableHead><TableHead>Descart.</TableHead><TableHead>Mín.</TableHead>
                  <TableHead>Valor unit.</TableHead><TableHead>Valor total</TableHead>
                  <TableHead>Status</TableHead><TableHead>Responsável</TableHead>
                  <TableHead>Patrimônio</TableHead><TableHead>Local</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredItems.map((i) => {
                    const total = i.quantity + i.in_use_quantity + i.damaged_quantity;
                    return (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">{i.name}</TableCell>
                        <TableCell>{catName(i.category_id)}</TableCell>
                        <TableCell>{total}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell>{i.in_use_quantity}</TableCell>
                        <TableCell className={i.damaged_quantity > 0 ? "text-red-500" : ""}>{i.damaged_quantity}</TableCell>
                        <TableCell>{i.discarded_quantity}</TableCell>
                        <TableCell>{i.min_stock}</TableCell>
                        <TableCell>{currency(i.unit_price)}</TableCell>
                        <TableCell>{currency(total * i.unit_price)}</TableCell>
                        <TableCell><ItemStatusTags item={i} /></TableCell>
                        <TableCell>{collabName(i.responsible_collaborator_id)}</TableCell>
                        <TableCell className="font-mono text-xs">{itemPatrimonies(i.id)}</TableCell>
                        <TableCell>{locName(i.location_id)}</TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setDetail(i)}>Detalhes</Button>
                            {canWrite && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => setExitDlg({ open: true, item: i })}>Saída</Button>
                                <Button size="sm" variant="ghost" onClick={() => setStatusDlg({ open: true, item: i, mode: "damage" })}>Danificado</Button>
                                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatusDlg({ open: true, item: i, mode: "discard" })}>Descartar</Button>
                                <Button size="sm" variant="ghost" onClick={() => setItemDlg({ open: true, item: i })}>Editar</Button>
                              </>
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
                  </TableRow>
                ))}
                {movements.filter((m) => m.type === "in").length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhuma entrada registrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* ---------------- SAÍDAS ---------------- */}
        <TabsContent value="out" className="space-y-3">
          <p className="text-sm text-muted-foreground">Toda saída exige um responsável. Registre a saída pela tela de Itens.</p>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead>
                <TableHead>Responsável</TableHead><TableHead>Departamento</TableHead>
                <TableHead>Patrimônio</TableHead><TableHead>Motivo</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movements.filter((m) => m.type === "out" || m.type === "assign").map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{dateFmt(m.occurred_at ?? m.created_at)}</TableCell>
                    <TableCell>{itemName(m.item_id)}</TableCell>
                    <TableCell>{m.quantity}</TableCell>
                    <TableCell>{collabName(m.collaborator_id)}</TableCell>
                    <TableCell>{m.department ?? collabDept(m.collaborator_id)}</TableCell>
                    <TableCell className="font-mono text-xs">{m.patrimony_number || "N/A"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{m.reason ?? "—"}</TableCell>
                    <TableCell><StatusTag status="in_use" /></TableCell>
                  </TableRow>
                ))}
                {movements.filter((m) => m.type === "out" || m.type === "assign").length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhuma saída registrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* PATRIMÔNIOS */}
        <TabsContent value="assets" className="space-y-3">
          <div className="flex justify-end">
            {canWrite && <Button size="sm" variant="outline" onClick={() => setAssetDlg({ open: true, asset: null })}><Plus className="mr-2 h-4 w-4" /> Novo patrimônio</Button>}
          </div>
          <AssetTable assets={assets} items={items} locations={locations} collaborators={collaborators} canWrite={canWrite} onEdit={(a) => setAssetDlg({ open: true, asset: a })} />
        </TabsContent>

        {/* DANIFICADOS */}
        <TabsContent value="damaged" className="space-y-3">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>Qtd danificada</TableHead><TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>{canWrite && <TableHead className="text-right">Ações</TableHead>}
              </TableRow></TableHeader>
              <TableBody>
                {damagedItems.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{i.damaged_quantity}</TableCell>
                    <TableCell>{collabName(i.responsible_collaborator_id)}</TableCell>
                    <TableCell><StatusTag status="damaged" /></TableCell>
                    {canWrite && (
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => recover.mutate({ item: i, quantity: 1 })}>Recuperar 1</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatusDlg({ open: true, item: i, mode: "discard" })}>Descartar</Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {damagedItems.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum item danificado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
          <AssetTable assets={assets.filter((a) => a.status === "damaged")} items={items} locations={locations} collaborators={collaborators} canWrite={canWrite} onEdit={(a) => setAssetDlg({ open: true, asset: a })} />
        </TabsContent>

        {/* DESCARTADOS */}
        <TabsContent value="discarded" className="space-y-3">
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead>
                <TableHead>Patrimônio</TableHead><TableHead>Responsável</TableHead>
                <TableHead>Motivo</TableHead><TableHead>Observações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {movements.filter((m) => m.type === "discard").map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="whitespace-nowrap">{dateFmt(m.occurred_at ?? m.created_at)}</TableCell>
                    <TableCell>{itemName(m.item_id)}</TableCell>
                    <TableCell>{m.quantity}</TableCell>
                    <TableCell className="font-mono text-xs">{m.patrimony_number || "N/A"}</TableCell>
                    <TableCell>{m.collaborator_id ? collabName(m.collaborator_id) : "Sem responsável"}</TableCell>
                    <TableCell>{m.reason ?? "—"}</TableCell>
                    <TableCell className="max-w-[240px] truncate">{m.notes ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {movements.filter((m) => m.type === "discard").length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum descarte registrado.</TableCell></TableRow>
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
              </TableRow></TableHeader>
              <TableBody>
                {restock.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.item}</TableCell>
                    <TableCell>{r.categoria}</TableCell>
                    <TableCell>{r.disponivel}</TableCell>
                    <TableCell>{r.minimo}</TableCell>
                    <TableCell><Badge variant="outline" className="font-normal">{r.comprar}</Badge></TableCell>
                    <TableCell>{currency(r.valor_unitario)}</TableCell>
                    <TableCell>{currency(r.valor_estimado)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={r.status === "Crítico"
                        ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400 font-normal"
                        : "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-normal"}>{r.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {restock.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nada a comprar no momento.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="history" className="space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-sm text-muted-foreground flex items-center gap-2"><History className="h-4 w-4" /> Histórico completo</h2>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(movements, "historico.csv")}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
          </div>
          <Card><CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Data e hora</TableHead><TableHead>Ação</TableHead><TableHead>Item</TableHead>
                <TableHead>Qtd</TableHead><TableHead>Patrimônio</TableHead><TableHead>Responsável</TableHead>
                <TableHead>De</TableHead><TableHead>Para</TableHead><TableHead>Observações</TableHead>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent></Card>
        </TabsContent>

        {/* SOLICITAÇÕES */}
        <TabsContent value="requests"><RequestsPanel canWrite={canWrite} /></TabsContent>

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
          <SettingsPanel canWrite={canWrite} />
          <CollaboratorsPanel canWrite={canWrite} />
        </TabsContent>
      </Tabs>

      <EntryDialog open={entryOpen} onOpenChange={setEntryOpen} onCreated={(id) => setLastCreatedItem(id)} />
      <ExitDialog open={exitDlg.open} onOpenChange={(v) => setExitDlg({ open: v, item: v ? exitDlg.item : null })} item={exitDlg.item} />
      <StatusChangeDialog open={statusDlg.open} mode={statusDlg.mode}
        onOpenChange={(v) => setStatusDlg({ ...statusDlg, open: v })} item={statusDlg.item} />
      <ItemFormDialog open={itemDlg.open} onOpenChange={(v) => setItemDlg({ open: v, item: v ? itemDlg.item : null })} item={itemDlg.item} />
      <AssetFormDialog open={assetDlg.open} onOpenChange={(v) => setAssetDlg({ open: v, asset: v ? assetDlg.asset : null })} asset={assetDlg.asset} />

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
    <Card className={accent ? "border-destructive/40" : ""}>
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

function AssetTable({ assets, items, locations, collaborators, canWrite, onEdit }: {
  assets: InventoryAsset[]; items: InventoryItem[]; locations: any[]; collaborators: any[]; canWrite: boolean;
  onEdit: (a: InventoryAsset) => void;
}) {
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const collabName = (id: string | null) => collaborators.find((c) => c.id === id)?.full_name ?? "—";
  return (
    <Card><CardContent className="p-0 overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Patrimônio</TableHead><TableHead>Item</TableHead><TableHead>Série</TableHead>
          <TableHead>Valor</TableHead><TableHead>Status</TableHead><TableHead>Local</TableHead>
          <TableHead>Responsável</TableHead>
          <TableHead className="text-right">Ações</TableHead>
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
              <TableCell className="text-right">
                {canWrite && <Button size="sm" variant="ghost" onClick={() => onEdit(a)}>Editar</Button>}
              </TableCell>
            </TableRow>
          ))}
          {assets.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum patrimônio.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </CardContent></Card>
  );
}

function RequestsPanel({ canWrite }: { canWrite: boolean }) {
  const { data: items = [] } = useInventoryItems();
  const { data: requests = [] } = useInventoryRequests();
  const createReq = useCreateRequest();
  const updateReq = useUpdateRequest();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ item_id: "", quantity: 1, justification: "" });

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";

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
            {canWrite && <TableHead className="text-right">Ações</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {requests.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">{dateFmt(r.created_at)}</TableCell>
                <TableCell>{itemName(r.item_id)}</TableCell>
                <TableCell>{r.quantity}</TableCell>
                <TableCell className="max-w-[280px] truncate">{r.justification ?? "—"}</TableCell>
                <TableCell><Badge variant="outline" className="font-normal">{r.status}</Badge></TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    {r.status === "pending" && (
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => updateReq.mutate({ id: r.id, status: "approved" })}>Aprovar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => updateReq.mutate({ id: r.id, status: "rejected" })}>Rejeitar</Button>
                      </div>
                    )}
                    {r.status === "approved" && (
                      <Button size="sm" variant="ghost" onClick={() => updateReq.mutate({ id: r.id, status: "delivered" })}>Marcar entregue</Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
            {requests.length === 0 && <TableRow><TableCell colSpan={canWrite ? 6 : 5} className="text-center text-muted-foreground py-6">Nenhuma solicitação.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent></Card>

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

function SettingsPanel({ canWrite }: { canWrite: boolean }) {
  const { data: categories = [] } = useInventoryCategories();
  const { data: locations = [] } = useInventoryLocations();
  const { data: settings } = useInventorySettings();
  const updateSettings = useUpdateInventorySettings();
  const createCat = useCreateCategory();
  const createLoc = useCreateLocation();
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Cálculo do valor total</CardTitle></CardHeader>
        <CardContent className="flex items-center gap-3">
          <Switch
            checked={settings?.include_damaged_in_value ?? true}
            disabled={!canWrite}
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
                <Button size="sm" onClick={async () => { if (cat) { await createCat.mutateAsync({ name: cat }); setCat(""); } }}>Adicionar</Button>
              </div>
            )}
            <ul className="text-sm space-y-1">
              {categories.map((c) => <li key={c.id}><Badge variant="outline" className="font-normal">{c.name}</Badge></li>)}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Locais</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {canWrite && (
              <div className="flex gap-2">
                <Input placeholder="Novo local" value={loc} onChange={(e) => setLoc(e.target.value)} />
                <Button size="sm" onClick={async () => { if (loc) { await createLoc.mutateAsync({ name: loc }); setLoc(""); } }}>Adicionar</Button>
              </div>
            )}
            <ul className="text-sm space-y-1">
              {locations.map((l) => <li key={l.id}><Badge variant="outline" className="font-normal">{l.name}</Badge></li>)}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
