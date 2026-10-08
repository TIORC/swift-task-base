import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCreateEntry, useInventoryCategories, useInventoryLocations, useInventoryItems,
} from "@/hooks/useInventory";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (itemId: string) => void;
}

const currency = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const today = () => new Date().toISOString().slice(0, 10);
const nowTime = () => new Date().toTimeString().slice(0, 5);
export const isoToBr = (iso: string) => iso.split("-").reverse().join("/");
// Converte "dd/mm/aaaa" em "aaaa-mm-dd"; retorna null se a data não existir.
export const brToIso = (br: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(br);
  if (!m) return null;
  const [, d, mo, y] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  if (date.getDate() !== Number(d) || date.getMonth() !== Number(mo) - 1) return null;
  return `${y}-${mo}-${d}`;
};
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const PURCHASED_NOTE = "Item comprado (confirmado pela infraestrutura)";
const ALMOX_LOCATION_NAME = "almoxarifado ti";

export function EntryDialog({ open, onOpenChange, onCreated }: Props) {
  const { data: categories = [] } = useInventoryCategories();
  const { data: locations = [] } = useInventoryLocations();
  const { data: items = [] } = useInventoryItems();
  const createEntry = useCreateEntry();

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [form, setForm] = useState({
    item_id: "", name: "", category_id: "", subcategory: "", brand: "", model: "",
    description: "", location_id: "", quantity: 1, unit_price: 0, min_stock: 2,
    has_patrimony: false, patrimony_number: "", serial_number: "",
    entry_date: isoToBr(today()), entry_time: nowTime(), notes: "",
  });
  const [purchased, setPurchased] = useState(false);

  useEffect(() => {
    if (open) {
      setMode("new");
      setPurchased(false);
      setForm({
        item_id: "", name: "", category_id: "", subcategory: "", brand: "", model: "",
        description: "", location_id: "", quantity: 1, unit_price: 0, min_stock: 2,
        has_patrimony: false, patrimony_number: "", serial_number: "",
        entry_date: isoToBr(today()), entry_time: nowTime(), notes: "",
      });
    }
  }, [open]);

  const selected = useMemo(() => items.find((i) => i.id === form.item_id), [items, form.item_id]);

  useEffect(() => {
    if (selected) {
      setForm((f) => ({
        ...f,
        unit_price: f.unit_price || selected.unit_price,
        min_stock: selected.min_stock || 2,
        location_id: f.location_id || selected.location_id || "",
      }));
    }
  }, [selected?.id]);

  const almoxLocation = useMemo(
    () => locations.find((l) => l.name.trim().toLowerCase() === ALMOX_LOCATION_NAME),
    [locations],
  );
  // Itens novos sempre entram no Almoxarifado TI; itens existentes mantêm o local escolhido.
  const locationId = mode === "new" ? (almoxLocation?.id ?? "") : form.location_id;

  const entryDateIso = brToIso(form.entry_date);
  const entryTimeOk = TIME_RE.test(form.entry_time);

  const total = form.quantity * form.unit_price;
  const valid = purchased && !!entryDateIso && entryTimeOk && (mode === "new"
    ? form.name.trim().length > 0 && form.quantity > 0 && !!almoxLocation
    : !!form.item_id && form.quantity > 0);

  const submit = async () => {
    const res = await createEntry.mutateAsync({
      mode,
      item_id: form.item_id || undefined,
      name: form.name,
      category_id: form.category_id || null,
      subcategory: form.subcategory || null,
      brand: form.brand || null,
      model: form.model || null,
      description: form.description || null,
      location_id: locationId || null,
      quantity: form.quantity,
      unit_price: form.unit_price,
      min_stock: form.min_stock,
      has_patrimony: form.has_patrimony,
      patrimony_number: form.patrimony_number || null,
      serial_number: form.serial_number || null,
      supplier: null,
      invoice_number: null,
      entry_date: entryDateIso ?? "",
      entry_time: form.entry_time,
      notes: [PURCHASED_NOTE, form.notes].filter(Boolean).join(" — "),
    });
    onOpenChange(false);
    if (res?.itemId) onCreated?.(res.itemId);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova entrada</DialogTitle></DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="new">Criar novo item</TabsTrigger>
            <TabsTrigger value="existing">Selecionar item existente</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-4 py-2">
          {mode === "new" ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nome do item *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                <div>
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger className="entry-select-trigger"><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent className="entry-select-dropdown">{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Subcategoria</Label><Input value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} /></div>
                <div><Label>Marca</Label><Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
                <div><Label>Modelo</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
              </div>
              <div><Label>Descrição</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            </>
          ) : (
            <div>
              <Label>Item existente *</Label>
              <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })}>
                <SelectTrigger className="entry-select-trigger"><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                <SelectContent className="entry-select-dropdown">
                  {items.filter((i) => i.status === "active").map((i) => (
                    <SelectItem key={i.id} value={i.id}>{i.name} — disponível: {i.quantity}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div><Label>Quantidade *</Label><Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
            <div><Label>Valor unitário (R$)</Label><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} /></div>
            <div><Label>Valor total</Label><Input value={currency(total)} readOnly className="bg-muted/50" /></div>
            <div>
              <Label>Estoque mínimo *</Label>
              <Input type="number" min={0} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Local de armazenamento</Label>
              <Select
                value={locationId}
                onValueChange={(v) => setForm({ ...form, location_id: v })}
                disabled={mode === "new"}
              >
                <SelectTrigger className="entry-select-trigger"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent className="entry-select-dropdown">{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
              {mode === "new" && !almoxLocation && (
                <p className="mt-1 text-xs text-destructive">Local "Almoxarifado TI" não cadastrado. Cadastre-o antes de criar itens.</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data da chegada *</Label>
                <Input placeholder="dd/mm/aaaa" maxLength={10} value={form.entry_date}
                  onChange={(e) => setForm({ ...form, entry_date: e.target.value })} />
              </div>
              <div>
                <Label>Hora da chegada *</Label>
                <Input placeholder="hh:mm" maxLength={5} value={form.entry_time}
                  onChange={(e) => setForm({ ...form, entry_time: e.target.value })} />
              </div>
            </div>
          </div>

          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <input type="checkbox" className="mt-1" checked={purchased} onChange={(e) => setPurchased(e.target.checked)} />
            <span>Confirmo que este item é <b>comprado</b> (entrada somente para compras, confirmada pela infraestrutura). *</span>
          </label>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={form.has_patrimony} onCheckedChange={(v) => setForm({ ...form, has_patrimony: v })} />
              <div>
                <p className="text-sm font-medium">Possui patrimônio?</p>
                <p className="text-xs text-muted-foreground">Se não, o patrimônio ficará como “N/A” e pode ser informado depois, na saída.</p>
              </div>
            </div>
            {form.has_patrimony && (
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Nº de patrimônio</Label><Input value={form.patrimony_number} onChange={(e) => setForm({ ...form, patrimony_number: e.target.value })} /></div>
                <div><Label>Nº de série (opcional)</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
                <p className="col-span-2 text-xs text-muted-foreground">Se o nº de patrimônio já existir, os dados serão atualizados em vez de duplicados.</p>
              </div>
            )}
          </div>

          <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || createEntry.isPending}>Salvar entrada</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
