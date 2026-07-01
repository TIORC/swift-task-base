import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateMovement, useInventoryItems, useInventoryAssets, useInventoryLocations,
  type MovementType,
} from "@/hooks/useInventory";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultType?: MovementType;
  defaultItemId?: string;
  defaultAssetId?: string;
}

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

export function MovementDialog({ open, onOpenChange, defaultType = "in", defaultItemId, defaultAssetId }: Props) {
  const { data: items = [] } = useInventoryItems();
  const { data: assets = [] } = useInventoryAssets();
  const { data: locations = [] } = useInventoryLocations();
  const createMov = useCreateMovement();

  const [type, setType] = useState<MovementType>(defaultType);
  const [itemId, setItemId] = useState(defaultItemId ?? "");
  const [assetId, setAssetId] = useState(defaultAssetId ?? "");
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [fromLoc, setFromLoc] = useState("");
  const [toLoc, setToLoc] = useState("");

  const item = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const assetsOfItem = useMemo(() => assets.filter((a) => a.item_id === itemId), [assets, itemId]);
  const isOutFlow = ["out", "discard", "damage"].includes(type);
  const exceeds = isOutFlow && item && !item.tracked_individually && quantity > item.quantity;

  const submit = async () => {
    if (!itemId) return;
    await createMov.mutateAsync({
      type, item_id: itemId,
      asset_id: item?.tracked_individually ? assetId || null : null,
      quantity: item?.tracked_individually ? 1 : quantity,
      reason, notes,
      from_location_id: fromLoc || null,
      to_location_id: toLoc || null,
    });
    onOpenChange(false);
    setReason(""); setNotes(""); setQuantity(1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nova movimentação</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div>
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v: MovementType) => setType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Item</Label>
            <Select value={itemId} onValueChange={setItemId}>
              <SelectTrigger><SelectValue placeholder="Selecione o item" /></SelectTrigger>
              <SelectContent>
                {items.filter((i) => i.status === "active").map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}{i.tracked_individually ? " (patrimoniado)" : ` (${i.quantity})`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {item?.tracked_individually && (
            <div>
              <Label>Patrimônio</Label>
              <Select value={assetId} onValueChange={setAssetId}>
                <SelectTrigger><SelectValue placeholder="Selecione o patrimônio" /></SelectTrigger>
                <SelectContent>
                  {assetsOfItem.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.patrimony_number} — {a.status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {!item?.tracked_individually && (
            <div>
              <Label>Quantidade</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
              {exceeds && <p className="mt-1 text-xs text-destructive">Excede o disponível ({item?.quantity}).</p>}
            </div>
          )}
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
          <div><Label>Motivo</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <div><Label>Observações</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={!itemId || exceeds || createMov.isPending || (item?.tracked_individually && !assetId)}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
