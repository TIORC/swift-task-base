import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useRegisterExit, useInventoryCollaborators,
  type InventoryItem, type InventoryMovement,
} from "@/hooks/useInventory";

// Manda uma entrada para Saídas. A entrada continua no histórico e no estoque;
// a saída criada aponta para ela, e por isso ela deixa de aparecer em Entradas.

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: InventoryMovement | null;
  item: InventoryItem | undefined;
}

const today = () => new Date().toISOString().slice(0, 10);

export function SendToExitDialog({ open, onOpenChange, entry, item }: Props) {
  const { data: collaborators = [] } = useInventoryCollaborators();
  const registerExit = useRegisterExit();

  const [collaboratorId, setCollaboratorId] = useState("");
  const [department, setDepartment] = useState("");
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!open || !entry) return;
    setCollaboratorId("");
    setDepartment("");
    setQuantity(entry.quantity);
  }, [open, entry?.id]);

  const activeCollabs = collaborators.filter((c) => c.active);
  const available = item?.quantity ?? 0;
  const exceeds = quantity > available;
  const valid = !!entry && !!collaboratorId && !!department.trim() && quantity >= 1 && !exceeds;

  const pickCollaborator = (id: string) => {
    const c = collaborators.find((x) => x.id === id);
    setCollaboratorId(id);
    setDepartment(c?.department ?? "");
  };

  const submit = async () => {
    if (!entry || !item) return;
    await registerExit.mutateAsync({
      item_id: entry.item_id,
      quantity,
      collaborator_id: collaboratorId,
      department: department.trim(),
      location_id: null,
      // O patrimônio da entrada segue junto só quando a saída é de uma peça só.
      patrimony_number: quantity === 1 ? entry.patrimony_number ?? null : null,
      serial_number: null,
      reason: null,
      exit_date: today(),
      notes: null,
      unit_price: entry.unit_price ?? 0,
      source_movement_id: entry.id,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Mandar para saídas</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Item</Label>
            <Input readOnly className="bg-muted/50" value={item ? `${item.name} — disponível: ${item.quantity}` : ""} />
          </div>
          <div>
            <Label>Responsável *</Label>
            <Select value={collaboratorId} onValueChange={pickCollaborator}>
              <SelectTrigger><SelectValue placeholder="Selecione o colaborador" /></SelectTrigger>
              <SelectContent>
                {activeCollabs.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name} — {c.department}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Setor *</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} />
            </div>
            <div>
              <Label>Quantidade *</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              {exceeds && <p className="mt-1 text-xs text-destructive">Maior que o disponível ({available}).</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!valid || registerExit.isPending}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
