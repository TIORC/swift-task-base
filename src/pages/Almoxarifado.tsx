import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Package, Plus, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, Boxes, DollarSign, Wrench, Trash2, Search, ShoppingCart, Send, Settings, Download } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useInventoryItems, useInventoryAssets, useInventoryMovements, useInventoryRequests,
  useInventoryCategories, useInventoryLocations, useCanWriteInventory,
  useDeleteItem, useCreateCategory, useCreateLocation, useCreateRequest, useUpdateRequest,
} from "@/hooks/useInventory";
import { ItemFormDialog } from "@/components/almoxarifado/ItemFormDialog";
import { MovementDialog } from "@/components/almoxarifado/MovementDialog";
import { AssetFormDialog } from "@/components/almoxarifado/AssetFormDialog";
import { StockBadge } from "@/components/almoxarifado/StockBadge";
import type { InventoryItem, InventoryAsset, MovementType } from "@/hooks/useInventory";
import { useAssignableProfiles } from "@/hooks/useTasks";


const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dateFmt = (s: string) => new Date(s).toLocaleString("pt-BR");

const MOV_LABELS: Record<MovementType, string> = {
  in: "Entrada", out: "Saída", transfer: "Transferência", damage: "Dano",
  discard: "Descarte", adjust: "Ajuste", assign: "Atribuição", return: "Devolução",
};

const ASSET_STATUS_LABELS: Record<string, string> = {
  available: "Disponível", in_use: "Em uso", damaged: "Danificado",
  discarded: "Descartado", maintenance: "Manutenção",
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
  const { data: requests = [] } = useInventoryRequests();
  const { data: categories = [] } = useInventoryCategories();
  const { data: locations = [] } = useInventoryLocations();
  const { data: profiles } = useAssignableProfiles();


  const [tab, setTab] = useState("dashboard");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const [itemDlg, setItemDlg] = useState<{ open: boolean; item?: InventoryItem | null }>({ open: false });
  const [assetDlg, setAssetDlg] = useState<{ open: boolean; asset?: InventoryAsset | null }>({ open: false });
  const [movDlg, setMovDlg] = useState<{ open: boolean; type?: MovementType }>({ open: false });

  const deleteItem = useDeleteItem();

  const filteredItems = useMemo(() => items.filter((i) => {
    if (categoryFilter !== "all" && i.category_id !== categoryFilter) return false;
    if (search && !`${i.name} ${i.sku ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, search, categoryFilter]);

  // KPIs
  const totalItems = items.length;
  const totalValue =
    items.reduce((acc, i) => acc + (i.tracked_individually ? 0 : i.unit_price * i.quantity), 0) +
    assets.reduce((acc, a) => acc + a.value, 0);
  const inUse = assets.filter((a) => a.status === "in_use").length;
  const damaged = assets.filter((a) => a.status === "damaged").length;
  const discarded = assets.filter((a) => a.status === "discarded").length;
  const lowStock = items.filter((i) => !i.tracked_individually && i.status === "active" && i.quantity <= i.min_stock);

  const restock = items.filter((i) => !i.tracked_individually && i.status === "active" && i.quantity <= i.min_stock)
    .map((i) => ({
      id: i.id, name: i.name, sku: i.sku ?? "", disponivel: i.quantity,
      minimo: i.min_stock, ideal: i.ideal_stock,
      comprar: Math.max(0, (i.ideal_stock || i.min_stock) - i.quantity),
      valor_estimado: Math.max(0, (i.ideal_stock || i.min_stock) - i.quantity) * i.unit_price,
    }));

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "—";
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const personName = (id: string | null) => profiles?.find((p) => p.id === id)?.full_name ?? "—";
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";


  return (
    <div className="space-y-6">
      <PageHeader
        title="Almoxarifado TI"
        description="Controle de equipamentos, peças, periféricos e materiais"
        icon={<Package className="h-6 w-6" />}
        actions={
          <>
            <Button size="sm" variant="outline" onClick={() => setTab("settings")}>
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </Button>
            {canWrite && (
              <>
                <Button size="sm" variant="outline" onClick={() => setMovDlg({ open: true, type: "in" })}>
                  <ArrowDownToLine className="mr-2 h-4 w-4" /> Entrada
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMovDlg({ open: true, type: "out" })}>
                  <ArrowUpFromLine className="mr-2 h-4 w-4" /> Saída
                </Button>
                <Button size="sm" onClick={() => setItemDlg({ open: true, item: null })}>
                  <Plus className="mr-2 h-4 w-4" /> Novo item
                </Button>
              </>
            )}
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
          <TabsTrigger value="requests">Solicitações</TabsTrigger>
          <TabsTrigger value="reports">Relatórios</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* ---------------- DASHBOARD ---------------- */}
        <TabsContent value="dashboard" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Kpi icon={<Boxes />} label="Itens cadastrados" value={totalItems} />
            <Kpi icon={<DollarSign />} label="Valor total" value={currency(totalValue)} />
            <Kpi icon={<Wrench />} label="Em uso" value={inUse} />
            <Kpi icon={<AlertTriangle />} label="Danificados" value={damaged} />
            <Kpi icon={<Trash2 />} label="Descartados" value={discarded} />
            <Kpi icon={<ShoppingCart />} label="Alertas de estoque" value={lowStock.length} accent={lowStock.length > 0} />
          </div>

          <Card>
            <CardHeader><CardTitle className="text-base">Alertas de estoque baixo</CardTitle></CardHeader>
            <CardContent>
              {lowStock.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum item abaixo do estoque mínimo.</p> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Item</TableHead><TableHead>Disponível</TableHead><TableHead>Mínimo</TableHead><TableHead>Sugestão de compra</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {lowStock.map((i) => (
                      <TableRow key={i.id}>
                        <TableCell>{i.name}</TableCell>
                        <TableCell>{i.quantity}</TableCell>
                        <TableCell>{i.min_stock}</TableCell>
                        <TableCell><Badge variant="destructive">{Math.max(0, (i.ideal_stock || i.min_stock) - i.quantity)}</Badge></TableCell>
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
                      <TableCell><Badge variant="outline">{MOV_LABELS[m.type]}</Badge></TableCell>
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
              <Input className="pl-8" placeholder="Buscar item ou SKU..." value={search} onChange={(e) => setSearch(e.target.value)} />
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
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Item</TableHead><TableHead>SKU</TableHead><TableHead>Categoria</TableHead>
                  <TableHead>Local</TableHead><TableHead>Responsável</TableHead><TableHead>Preço</TableHead><TableHead>Estoque</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredItems.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-muted-foreground">{i.sku ?? "—"}</TableCell>
                      <TableCell>{catName(i.category_id)}</TableCell>
                      <TableCell>{locName(i.location_id)}</TableCell>
                      <TableCell>{personName(i.responsible_id)}</TableCell>
                      <TableCell>{currency(i.unit_price)}</TableCell>
                      <TableCell><StockBadge item={i} /></TableCell>

                      <TableCell className="text-right">
                        {canWrite && (
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setItemDlg({ open: true, item: i })}>Editar</Button>
                            <Button size="sm" variant="ghost" className="text-destructive"
                              onClick={() => confirm(`Excluir "${i.name}"?`) && deleteItem.mutate(i.id)}>Excluir</Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ENTRADAS / SAÍDAS */}
        {(["in", "out"] as const).map((flow) => (
          <TabsContent key={flow} value={flow} className="space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="text-sm text-muted-foreground">Histórico de {flow === "in" ? "entradas" : "saídas"}</h2>
              {canWrite && (
                <Button size="sm" onClick={() => setMovDlg({ open: true, type: flow })}>
                  <Plus className="mr-2 h-4 w-4" /> Nova {flow === "in" ? "entrada" : "saída"}
                </Button>
              )}
            </div>
            <Card><CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Data</TableHead><TableHead>Item</TableHead><TableHead>Qtd</TableHead>
                  <TableHead>Origem</TableHead><TableHead>Destino</TableHead><TableHead>Motivo</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {movements.filter((m) => flow === "in" ? m.type === "in" || m.type === "adjust" : m.type === "out").map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap">{dateFmt(m.created_at)}</TableCell>
                      <TableCell>{itemName(m.item_id)}</TableCell>
                      <TableCell>{m.quantity}</TableCell>
                      <TableCell>{locName(m.from_location_id)}</TableCell>
                      <TableCell>{locName(m.to_location_id)}</TableCell>
                      <TableCell className="max-w-[300px] truncate">{m.reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent></Card>
          </TabsContent>
        ))}

        {/* PATRIMÔNIOS */}
        <TabsContent value="assets" className="space-y-3">
          <div className="flex justify-end">
            {canWrite && <Button size="sm" onClick={() => setAssetDlg({ open: true, asset: null })}><Plus className="mr-2 h-4 w-4" /> Novo patrimônio</Button>}
          </div>
          <AssetTable assets={assets} items={items} locations={locations} canWrite={canWrite} onEdit={(a) => setAssetDlg({ open: true, asset: a })} />
        </TabsContent>

        <TabsContent value="damaged">
          <AssetTable assets={assets.filter((a) => a.status === "damaged")} items={items} locations={locations} canWrite={canWrite} onEdit={(a) => setAssetDlg({ open: true, asset: a })} />
        </TabsContent>
        <TabsContent value="discarded">
          <AssetTable assets={assets.filter((a) => a.status === "discarded")} items={items} locations={locations} canWrite={canWrite} onEdit={(a) => setAssetDlg({ open: true, asset: a })} />
        </TabsContent>

        {/* REPOSIÇÃO */}
        <TabsContent value="restock" className="space-y-3">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">Sugestão de compra: <b>ideal − disponível</b></p>
            <Button variant="outline" size="sm" onClick={() => downloadCsv(restock, "reposicao.csv")}>
              <Download className="mr-2 h-4 w-4" /> Lista de compras
            </Button>
          </div>
          <Card><CardContent className="p-0">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Item</TableHead><TableHead>SKU</TableHead><TableHead>Disponível</TableHead>
                <TableHead>Mínimo</TableHead><TableHead>Ideal</TableHead>
                <TableHead>Comprar</TableHead><TableHead>Valor estimado</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {restock.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.sku}</TableCell>
                    <TableCell>{r.disponivel}</TableCell>
                    <TableCell>{r.minimo}</TableCell>
                    <TableCell>{r.ideal}</TableCell>
                    <TableCell><Badge>{r.comprar}</Badge></TableCell>
                    <TableCell>{currency(r.valor_estimado)}</TableCell>
                  </TableRow>
                ))}
                {restock.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nada a comprar no momento.</TableCell></TableRow>}
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
            <Kpi label="Categorias" value={categories.length} icon={<Boxes />} />
          </div>
        </TabsContent>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="settings"><SettingsPanel canWrite={canWrite} /></TabsContent>
      </Tabs>

      <ItemFormDialog open={itemDlg.open} onOpenChange={(v) => setItemDlg({ open: v, item: v ? itemDlg.item : null })} item={itemDlg.item} />
      <AssetFormDialog open={assetDlg.open} onOpenChange={(v) => setAssetDlg({ open: v, asset: v ? assetDlg.asset : null })} asset={assetDlg.asset} />
      <MovementDialog open={movDlg.open} onOpenChange={(v) => setMovDlg({ open: v, type: movDlg.type })} defaultType={movDlg.type} />
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon?: React.ReactNode; label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={accent ? "border-destructive/50" : ""}>
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

function AssetTable({ assets, items, locations, canWrite, onEdit }: {
  assets: InventoryAsset[]; items: InventoryItem[]; locations: any[]; canWrite: boolean;
  onEdit: (a: InventoryAsset) => void;
}) {
  const { data: profiles } = useAssignableProfiles();
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  const locName = (id: string | null) => locations.find((l) => l.id === id)?.name ?? "—";
  const personName = (id: string | null) => profiles?.find((p) => p.id === id)?.full_name ?? "—";
  return (
    <Card><CardContent className="p-0">
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
              <TableCell><Badge variant="outline">{ASSET_STATUS_LABELS[a.status]}</Badge></TableCell>
              <TableCell>{locName(a.location_id)}</TableCell>
              <TableCell>{personName(a.assigned_to)}</TableCell>

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
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
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
  const createCat = useCreateCategory();
  const createLoc = useCreateLocation();
  const [cat, setCat] = useState("");
  const [loc, setLoc] = useState("");

  return (
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
            {categories.map((c) => <li key={c.id} className="flex items-center gap-2"><Badge variant="outline">{c.name}</Badge></li>)}
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
            {locations.map((l) => <li key={l.id} className="flex items-center gap-2"><Badge variant="outline">{l.name}</Badge></li>)}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
