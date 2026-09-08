import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useRegisterExit, useInventoryCollaborators, useInventoryAssets,
  type InventoryItem,
} from "@/hooks/useInventory";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item?: InventoryItem | null;
}

const today = () => new Date().toISOString().slice(0, 10);

export function ExitDialog({ open, onOpenChange, item }: Props) {
  const { data: collaborators = [] } = useInventoryCollaborators();
  const { data: assets = [] } = useInventoryAssets();
  const registerExit = useRegisterExit();

  const [form, setForm] = useState({
    quantity: 1, collaborator_id: "", department: "", has_patrimony: false,
    patrimony_number: "", serial_number: "", reason: "", exit_date: today(), notes: "",
  });

  useEffect(() => {
    if (open) setForm({
      quantity: 1, collaborator_id: "", department: "", has_patrimony: false,
      patrimony_number: "", serial_number: "", reason: "", exit_date: today(), notes: "",
    });
  }, [open, item?.id]);

  const activeCollabs = collaborators.filter((c) => c.active);
  const selectedCollab = useMemo(
    () => collaborators.find((c) => c.id === form.collaborator_id),
    [collaborators, form.collaborator_id],
  );
  const availableAssets = assets.filter((a) => a.item_id === item?.id && a.status === "available");

  const exceeds = !!item && form.quantity > item.quantity;
  const valid = !!item && !!form.collaborator_id && form.quantity > 0 && !exceeds;

  const submit = async () => {
    if (!item) return;
    await registerExit.mutateAsync({
      item_id: item.id,
      quantity: form.quantity,
      collaborator_id: form.collaborator_id,
      department: form.department || selectedCollab?.department || "",
      patrimony_number: form.has_patrimony ? (form.patrimony_number || null) : null,
      serial_number: form.serial_number || null,
      reason: form.reason || null,
      exit_date: form.exit_date,
      notes: form.notes || null,
      unit_price: item.unit_price,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar saída</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Item</Label>
            <Input readOnly className="bg-muted/50" value={item ? `${item.name} — disponível: ${item.quantity}` : ""} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade de saída *</Label>
              <Input type="number" min={1} value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} />
              {exceeds && <p className="mt-1 text-xs text-destructive">Maior que o disponível ({item?.quantity}).</p>}
            </div>
            <div><Label>Data da saída</Label><Input type="date" value={form.exit_date} onChange={(e) => setForm({ ...form, exit_date: e.target.value })} /></div>
          </div>

          <div>
            <Label>Responsável pelo item *</Label>
            <Select
              value={form.collaborator_id}
              onValueChange={(v) => {
                const c = collaborators.find((x) => x.id === v);
                setForm({ ...form, collaborator_id: v, department: c?.department ?? "" });
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
              <SelectContent>
                {activeCollabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.department}</SelectItem>)}
              </SelectContent>
            </Select>
            {activeCollabs.length === 0 && (
              <p className="mt-1 text-xs text-muted-foreground">Cadastre colaboradores em Configurações → Colaboradores.</p>
            )}
          </div>
          <div><Label>Departamento</Label><Input value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} /></div>

          <div className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={form.has_patrimony} onCheckedChange={(v) => setForm({ ...form, has_patrimony: v })} />
              <div>
                <p className="text-sm font-medium">Informar patrimônio</p>
                <p className="text-xs text-muted-foreground">Sem patrimônio o registro fica como “N/A”.</p>
              </div>
            </div>
            {form.has_patrimony && (
              <>
                {availableAssets.length > 0 && (
                  <div>
                    <Label>Patrimônio já cadastrado</Label>
                    <Select value={form.patrimony_number} onValueChange={(v) => setForm({ ...form, patrimony_number: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione (ou digite abaixo)" /></SelectTrigger>
                      <SelectContent>
                        {availableAssets.map((a) => <SelectItem key={a.id} value={a.patrimony_number}>{a.patrimony_number}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Nº de patrimônio</Label><Input value={form.patrimony_number} onChange={(e) => setForm({ ...form, patrimony_number: e.target.value })} /></div>
                  <div><Label>Nº de série (opcional)</Label><Input value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} /></div>
                </div>
              </>
            )}
          </div>

          <div><Label>Motivo da saída</Label><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></div>
          <div><Label>Observações</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || registerExit.isPending}>Confirmar saída</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
