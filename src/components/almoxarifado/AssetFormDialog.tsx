import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateAsset, useUpdateAsset, useInventoryItems, useInventoryLocations,
  type InventoryAsset, type AssetStatus,
} from "@/hooks/useInventory";
import { useAssignableProfiles } from "@/hooks/useTasks";


interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: InventoryAsset | null;
  defaultItemId?: string;
}

const STATUSES: { v: AssetStatus; label: string }[] = [
  { v: "available", label: "Disponível" },
  { v: "in_use", label: "Em uso" },
  { v: "maintenance", label: "Em manutenção" },
  { v: "damaged", label: "Danificado" },
  { v: "discarded", label: "Descartado" },
];

export function AssetFormDialog({ open, onOpenChange, asset, defaultItemId }: Props) {
  const { data: items = [] } = useInventoryItems();
  const { data: locations = [] } = useInventoryLocations();
  const { data: profiles } = useAssignableProfiles();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();

  const [form, setForm] = useState({
    item_id: "", patrimony_number: "", serial_number: "", value: 0,
    status: "available" as AssetStatus, location_id: "", acquired_at: "", notes: "",
    assigned_to: "",
  });

  useEffect(() => {
    if (asset) {
      setForm({
        item_id: asset.item_id, patrimony_number: asset.patrimony_number,
        serial_number: asset.serial_number ?? "", value: asset.value,
        status: asset.status, location_id: asset.location_id ?? "",
        acquired_at: asset.acquired_at ?? "", notes: asset.notes ?? "",
        assigned_to: asset.assigned_to ?? "",
      });
    } else {
      setForm({ item_id: defaultItemId ?? "", patrimony_number: "", serial_number: "",
        value: 0, status: "available", location_id: "", acquired_at: "", notes: "", assigned_to: "" });
    }
  }, [asset, defaultItemId, open]);

  const submit = async () => {
    const payload: any = {
      ...form,
      location_id: form.location_id || null,
      acquired_at: form.acquired_at || null,
      assigned_to: form.assigned_to || null,
    };

    if (asset) await updateAsset.mutateAsync({ id: asset.id, ...payload });
    else await createAsset.mutateAsync(payload);
    onOpenChange(false);
  };

  const trackedItems = items.filter((i) => i.tracked_individually);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{asset ? "Editar patrimônio" : "Novo patrimônio"}</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Item *</Label>
            <Select value={form.item_id} onValueChange={(v) => setForm({ ...form, item_id: v })} disabled={!!asset}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{trackedItems.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Nº Patrimônio *</Label><Input value={form.patrimony_number} onChange={(e) => setForm({ ...form, patrimony_number: e.target.value })} /></div>
            <div><Label>Nº Série</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.value} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} /></div>
            <div><Label>Data aquisição</Label><Input type="date" value={form.acquired_at} onChange={(e) => setForm({ ...form, acquired_at: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: AssetStatus) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s.v} value={s.v}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Local</Label>
              <Select value={form.location_id} onValueChange={(v) => setForm({ ...form, location_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Responsável pelo equipamento</Label>
            <Select value={form.assigned_to || "none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {profiles?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>

        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!form.item_id || !form.patrimony_number}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
