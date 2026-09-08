import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateItem, useUpdateItem, useInventoryCategories, useInventoryLocations,
  type InventoryItem,
} from "@/hooks/useInventory";
import { useAssignableProfiles } from "@/hooks/useTasks";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: InventoryItem | null;
}

export function ItemFormDialog({ open, onOpenChange, item }: Props) {
  const { data: categories = [] } = useInventoryCategories();
  const { data: locations = [] } = useInventoryLocations();
  const { data: profiles } = useAssignableProfiles();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  const [form, setForm] = useState({
    name: "", sku: "", category_id: "", subcategory: "", brand: "", model: "",
    description: "", location_id: "",
    tracked_individually: false, unit_price: 0, min_stock: 2,
    ideal_stock: 0, quantity: 0, status: "active" as "active" | "inactive", notes: "",
    responsible_id: "",
  });

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name, sku: item.sku ?? "",
        category_id: item.category_id ?? "",
        subcategory: item.subcategory ?? "", brand: item.brand ?? "", model: item.model ?? "",
        description: item.description ?? "",
        location_id: item.location_id ?? "",
        tracked_individually: item.tracked_individually,
        unit_price: item.unit_price, min_stock: item.min_stock,
        ideal_stock: item.ideal_stock, quantity: item.quantity,
        status: item.status, notes: item.notes ?? "",
        responsible_id: item.responsible_id ?? "",
      });
    } else {
      setForm({ name: "", sku: "", category_id: "", subcategory: "", brand: "", model: "",
        description: "", location_id: "",
        tracked_individually: false, unit_price: 0, min_stock: 2,
        ideal_stock: 0, quantity: 0, status: "active", notes: "", responsible_id: "" });
    }
  }, [item, open]);



  const submit = async () => {
    const payload: any = {
      ...form,
      category_id: form.category_id || null,
      location_id: form.location_id || null,
      responsible_id: form.responsible_id || null,
    };

    if (item) await updateItem.mutateAsync({ id: item.id, ...payload });
    else await createItem.mutateAsync(payload);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>SKU / Código</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local padrão</Label>
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg border p-3">
            <Switch checked={form.tracked_individually} onCheckedChange={(v) => setForm({ ...form, tracked_individually: v })} />
            <div>
              <p className="text-sm font-medium">Controlar por patrimônio</p>
              <p className="text-xs text-muted-foreground">Cada unidade terá número de patrimônio, série e valor próprios.</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><Label>Preço unit. (R$)</Label><Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: Number(e.target.value) })} /></div>
            <div><Label>Estoque mín.</Label><Input type="number" value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: Number(e.target.value) })} /></div>
            <div><Label>Estoque ideal</Label><Input type="number" value={form.ideal_stock} onChange={(e) => setForm({ ...form, ideal_stock: Number(e.target.value) })} /></div>
            <div>
              <Label>{form.tracked_individually ? "Qtd inicial" : "Qtd disponível"}</Label>
              <Input type="number" value={form.quantity} disabled={form.tracked_individually}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Responsável pelo equipamento</Label>
              <Select value={form.responsible_id || "none"} onValueChange={(v) => setForm({ ...form, responsible_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {profiles?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.name || createItem.isPending || updateItem.isPending}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
