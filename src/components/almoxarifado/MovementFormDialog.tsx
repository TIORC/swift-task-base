import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useInventoryItems, useInventoryLocations, useInventoryCollaborators, useUpdateMovement, useUpdateItem,
  type InventoryMovement, type MovementType,
} from "@/hooks/useInventory";

const TYPES: { value: MovementType; label: string }[] = [
  { value: "in", label: "Entrada" },
  { value: "out", label: "Saída" },
  { value: "assign", label: "Atribuir a usuário" },
  { value: "return", label: "Devolução" },
  { value: "transfer", label: "Transferência" },
  { value: "adjust", label: "Ajuste (+)" },
  { value: "damage", label: "Marcar danificado" },
  { value: "discard", label: "Descartar" },
];

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  movement: InventoryMovement | null;
}

export function MovementFormDialog({ open, onOpenChange, movement }: Props) {
  const { data: items = [] } = useInventoryItems();
  const { data: locations = [] } = useInventoryLocations();
  const { data: collaborators = [] } = useInventoryCollaborators();
  const updateMov = useUpdateMovement();
  const updateItem = useUpdateItem();

  const [type, setType] = useState<MovementType>("in");
  const [itemNameValue, setItemNameValue] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [supplier, setSupplier] = useState("");
  const [invoice, setInvoice] = useState("");
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");
  const [collaboratorId, setCollaboratorId] = useState("");
  const [occurredAt, setOccurredAt] = useState("");

  useEffect(() => {
    if (!movement) return;
    setItemNameValue(items.find((i) => i.id === movement.item_id)?.name ?? "");
    setType(movement.type);
    setQuantity(movement.quantity);
    setUnitPrice(movement.unit_price);
    setReason(movement.reason ?? "");
    setNotes(movement.notes ?? "");
    setSupplier(movement.supplier ?? "");
    setInvoice(movement.invoice_number ?? "");
    setFromLoc(movement.from_location_id ?? "");
    setToLoc(movement.to_location_id ?? "");
    setCollaboratorId(movement.collaborator_id ?? "");
    setOccurredAt(toLocalInput(movement.occurred_at ?? movement.created_at));
  }, [movement, items]);

  const item = items.find((i) => i.id === movement?.item_id);
  const tracked = !!movement?.asset_id || !!item?.tracked_individually;

  const submit = async () => {
    if (!movement) return;
    const nextItemName = itemNameValue.trim();
    if (!nextItemName) return;
    if (item && nextItemName !== item.name) {
      await updateItem.mutateAsync({ id: item.id, name: nextItemName });
    }
    await updateMov.mutateAsync({
      id: movement.id,
      type,
      quantity: tracked ? 1 : Math.max(1, quantity),
      unit_price: unitPrice,
      reason,
      notes,
      supplier,
      invoice_number: invoice,
      from_location_id: fromLoc || null,
      to_location_id: toLoc || null,
      collaborator_id: collaboratorId || null,
      department: collaborators.find((c) => c.id === collaboratorId)?.department ?? null,
      occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar movimentação</DialogTitle>
          <DialogDescription>
            Alterar tipo ou quantidade recalcula o estoque do item automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          <div>
            <Label>Item</Label>
            <Input value={itemNameValue} onChange={(e) => setItemNameValue(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v: MovementType) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
            </div>
          </div>

          {(type === "out" || type === "assign") && (
            <div>
              <Label>Responsável</Label>
              <Select value={collaboratorId || "none"} onValueChange={(value) => setCollaboratorId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Selecione um responsável" /></SelectTrigger>
                <SelectContent className="responsible-dropdown">
                  <SelectItem className="responsible-dropdown-item" value="none">Nenhum</SelectItem>
                  {collaborators.map((collaborator) => (
                    <SelectItem className="responsible-dropdown-item" key={collaborator.id} value={collaborator.id}>{collaborator.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Quantidade</Label>
              <Input
                type="number" min={1} value={quantity} disabled={tracked}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
              {tracked && <p className="mt-1 text-xs text-muted-foreground">Bem patrimoniado: sempre 1.</p>}
            </div>
            <div>
              <Label>Valor unitário (R$)</Label>
              <Input type="number" step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(Number(e.target.value))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Origem</Label>
              <Select value={fromLoc} onValueChange={setFromLoc}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Destino</Label>
              <Select value={toLoc} onValueChange={setToLoc}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fornecedor</Label><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} /></div>
            <div><Label>Nota fiscal</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} /></div>
          </div>

          <div><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={updateMov.isPending || updateItem.isPending || !itemNameValue.trim()}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
