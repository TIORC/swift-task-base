import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useInventoryAssets, useInventoryLocations, useRegisterItemUpgrade,
  UPGRADE_FIELD_LABELS, type InventoryItem,
} from "@/hooks/useInventory";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: InventoryItem | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ItemUpgradeDialog({ open, onOpenChange, item }: Props) {
  const { data: assets = [] } = useInventoryAssets();
  const { data: locations = [] } = useInventoryLocations();
  const registerUpgrade = useRegisterItemUpgrade();

  const [form, setForm] = useState({
    name: "", reason: "", date: today(), notes: "", quantity: 1,
    brand: "", model: "", description: "", unit_price: 0,
    location_id: "", asset_id: "",
  });

  useEffect(() => {
    if (open && item) {
      setForm({
        name: item.name ?? "",
        reason: "", date: today(), notes: "", quantity: 1,
        brand: item.brand ?? "",
        model: item.model ?? "",
        description: item.description ?? "",
        unit_price: item.unit_price,
        location_id: item.location_id ?? "",
        asset_id: "",
      });
    }
  }, [open, item]);

  const itemAssets = useMemo(
    () => assets.filter((a) => a.item_id === item?.id && a.status !== "discarded"),
    [assets, item?.id],
  );

  // Só manda no banco o que de fato mudou, para o histórico ficar legível.
  const changed = useMemo(() => {
    if (!item) return [] as { field: keyof typeof UPGRADE_FIELD_LABELS; from: string; to: string }[];
    const rows: { field: keyof typeof UPGRADE_FIELD_LABELS; from: string; to: string }[] = [];
    for (const field of Object.keys(UPGRADE_FIELD_LABELS) as (keyof typeof UPGRADE_FIELD_LABELS)[]) {
      const from = item[field] ?? "";
      const to = field === "unit_price" ? form.unit_price : form[field];
      if (String(to) !== String(from)) {
        rows.push({
          field,
          from: from === "" ? "—" : field === "unit_price" ? Number(from).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(from),
          to: to === "" || to === null ? "—" : field === "unit_price" ? Number(to).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(to),
        });
      }
    }
    return rows;
  }, [item, form]);

  const submit = async () => {
    if (!item) return;
    await registerUpgrade.mutateAsync({
      item_id: item.id,
      quantity: form.quantity,
      reason: form.reason,
      date: form.date,
      notes: form.notes || null,
      asset_id: form.asset_id || null,
      location_id: form.location_id || null,
      changes: {
        name: form.name,
        brand: form.brand,
        model: form.model,
        description: form.description,
        unit_price: form.unit_price,
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar atualização do item</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Item *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Nome do item"
            />
            <p className="mt-1 text-xs text-muted-foreground">Renomear o item também fica registrado no histórico.</p>
          </div>

          {item && item.upgrade_count > 0 && (
            <p className="text-xs text-muted-foreground">
              Este item já passou por {item.upgrade_count} atualização(ões)
              {item.last_upgrade_at
                ? ` — última em ${new Date(item.last_upgrade_at).toLocaleDateString("pt-BR")}.`
                : "."}
            </p>
          )}

          <div>
            <Label>O que foi atualizado *</Label>
            <Input
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="Ex.: troca de memória e SSD, upgrade de firmware..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div>
              <Label>Unidades atualizadas</Label>
              <Input
                type="number" min={1}
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: Math.max(1, Math.trunc(Number(e.target.value)) || 1) })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Marca</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <Label>Modelo</Label>
              <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            </div>
          </div>

          <div>
            <Label>Descrição</Label>
            <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor unitário (R$)</Label>
              <Input
                type="number" step="0.01" min={0}
                value={form.unit_price}
                onChange={(e) => setForm({ ...form, unit_price: Math.max(0, Number(e.target.value)) || 0 })}
              />
            </div>
            <div>
              <Label>Local</Label>
              <Select
                value={form.location_id || "none"}
                onValueChange={(v) => setForm({ ...form, location_id: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {itemAssets.length > 0 && (
            <div>
              <Label>Patrimônio (se houver)</Label>
              <Select value={form.asset_id || "none"} onValueChange={(v) => setForm({ ...form, asset_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="N/A" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">N/A</SelectItem>
                  {itemAssets.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.patrimony_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

          {changed.length > 0 && (
            <div className="rounded-md border border-white/20 bg-[#050d20] p-3">
              <p className="mb-2 text-xs text-muted-foreground">O que será gravado no histórico</p>
              <div className="flex flex-col gap-1">
                {changed.map((c) => (
                  <div key={c.field} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className="shrink-0 font-normal">{UPGRADE_FIELD_LABELS[c.field]}</Badge>
                    <span className="text-muted-foreground line-through">{c.from}</span>
                    <span>→</span>
                    <span className="font-medium">{c.to}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={submit}
            disabled={!item || !form.name.trim() || !form.reason.trim() || registerUpgrade.isPending}
          >
            Registrar atualização
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
