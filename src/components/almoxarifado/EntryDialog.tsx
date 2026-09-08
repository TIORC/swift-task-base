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
    supplier: "", invoice_number: "", entry_date: today(), notes: "",
  });

  useEffect(() => {
    if (open) {
      setMode("new");
      setForm({
        item_id: "", name: "", category_id: "", subcategory: "", brand: "", model: "",
        description: "", location_id: "", quantity: 1, unit_price: 0, min_stock: 2,
        has_patrimony: false, patrimony_number: "", serial_number: "",
        supplier: "", invoice_number: "", entry_date: today(), notes: "",
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

  const total = form.quantity * form.unit_price;
  const valid = mode === "new" ? form.name.trim().length > 0 && form.quantity > 0 : !!form.item_id && form.quantity > 0;

  const submit = async () => {
    const id = await createEntry.mutateAsync({
      mode,
      item_id: form.item_id || undefined,
      name: form.name,
      category_id: form.category_id || null,
      subcategory: form.subcategory || null,
      brand: form.brand || null,
      model: form.model || null,
      description: form.description || null,
      location_id: form.location_id || null,
      quantity: form.quantity,
      unit_price: form.unit_price,
      min_stock: form.min_stock,
      has_patrimony: form.has_patrimony,
      patrimony_number: form.patrimony_number || null,
      serial_number: form.serial_number || null,
      supplier: form.supplier || null,
      invoice_number: form.invoice_number || null,
      entry_date: form.entry_date,
      notes: form.notes || null,
    });
    onOpenChange(false);
    if (id) onCreated?.(id);
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
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
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
                <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
                <SelectContent>
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
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data da entrada</Label><Input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></div>
          </div>

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
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fornecedor (opcional)</Label><Input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></div>
            <div><Label>Nota fiscal (opcional)</Label><Input value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} /></div>
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
