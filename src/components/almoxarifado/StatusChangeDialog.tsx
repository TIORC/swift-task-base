import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useMarkDamaged, useDiscardItem, useInventoryCollaborators, useInventoryAssets,
  type InventoryItem,
} from "@/hooks/useInventory";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: InventoryItem | null;
  mode: "damage" | "discard";
}

const today = () => new Date().toISOString().slice(0, 10);

export function StatusChangeDialog({ open, onOpenChange, item, mode }: Props) {
  const { data: collaborators = [] } = useInventoryCollaborators();
  const { data: assets = [] } = useInventoryAssets();
  const markDamaged = useMarkDamaged();
  const discard = useDiscardItem();
  const mutation = mode === "damage" ? markDamaged : discard;

  const [form, setForm] = useState({
    quantity: 1, patrimony_number: "", reason: "", date: today(), notes: "", from_damaged: false,
  });

  useEffect(() => {
    if (open) setForm({ quantity: 1, patrimony_number: "", reason: "", date: today(), notes: "", from_damaged: mode === "discard" });
  }, [open, item?.id, mode]);

  const itemAssets = assets.filter((a) => a.item_id === item?.id && !["discarded"].includes(a.status));
  const responsible = collaborators.find((c) => c.id === item?.responsible_collaborator_id);

  const submit = async () => {
    if (!item) return;
    await mutation.mutateAsync({
      item_id: item.id,
      quantity: form.quantity,
      patrimony_number: form.patrimony_number || null,
      reason: form.reason || null,
      date: form.date,
      notes: form.notes || null,
      collaborator_id: item.responsible_collaborator_id,
      from_damaged: form.from_damaged,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{mode === "damage" ? "Marcar como danificado" : "Descartar item"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <div><Label>Item</Label><Input readOnly className="bg-muted/50" value={item?.name ?? ""} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              <p className="mt-1 text-xs text-muted-foreground">
                Disponível: {item?.quantity ?? 0} · Danificado: {item?.damaged_quantity ?? 0}
              </p>
            </div>
            <div><Label>Data</Label><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
          </div>
          {mode === "discard" && (
            <div>
              <Label>Origem</Label>
              <Select value={form.from_damaged ? "damaged" : "available"} onValueChange={(v) => setForm({ ...form, from_damaged: v === "damaged" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="damaged">Danificado</SelectItem>
                  <SelectItem value="available">Disponível</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {itemAssets.length > 0 && (
            <div>
              <Label>Patrimônio (se houver)</Label>
              <Select value={form.patrimony_number} onValueChange={(v) => setForm({ ...form, patrimony_number: v })}>
                <SelectTrigger><SelectValue placeholder="N/A" /></SelectTrigger>
                <SelectContent>
                  {itemAssets.map((a) => <SelectItem key={a.id} value={a.patrimony_number}>{a.patrimony_number}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Responsável atual</Label>
            <Input readOnly className="bg-muted/50" value={responsible ? `${responsible.full_name} — ${responsible.department}` : "Sem responsável"} />
          </div>
          <div><Label>{mode === "damage" ? "Motivo do dano" : "Motivo do descarte"}</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={mutation.isPending || form.quantity < 1}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
