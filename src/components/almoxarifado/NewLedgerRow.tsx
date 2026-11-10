import { useState, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  useSaveEntryBatch, useSaveExitBatch, useUpdateItem, useUpdateMovementText,
  type InventoryCategory, type InventoryCollaborator, type InventoryItem,
} from "@/hooks/useInventory";

type Kind = "in" | "out";

// Hora local no formato do campo datetime-local (aaaa-mm-ddThh:mm).
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

interface Props {
  items: InventoryItem[];
  collaborators: InventoryCollaborator[];
  categories: InventoryCategory[];
}

// Linha de digitação no topo da tabela Entradas e Saídas: preencha e confirme (Enter ou Adicionar).
// Entrada cria o item/patrimônio pelo lote de entradas; saída usa o lote de saídas.
export function NewLedgerRow({ items, collaborators, categories }: Props) {
  const saveEntry = useSaveEntryBatch();
  const saveExit = useSaveExitBatch();
  const updateItem = useUpdateItem();
  const [categoryId, setCategoryId] = useState("");
  const [kind, setKind] = useState<Kind>("in");
  const [itemId, setItemId] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [patrimony, setPatrimony] = useState("");
  const [when, setWhen] = useState(nowLocal);
  const [dept, setDept] = useState("");
  const [collabId, setCollabId] = useState("");
  const [obs, setObs] = useState("");
  const [esText, setEsText] = useState("");
  const updateText = useUpdateMovementText();
  const busy = saveEntry.isPending || saveExit.isPending;

  const reset = () => {
    setItemId(""); setName(""); setQty("1"); setPatrimony(""); setWhen(nowLocal());
    setDept(""); setCollabId(""); setObs(""); setCategoryId(""); setEsText("");
  };

  // O lote não recebe o E&S escrito: grava no movimento mais recente do tipo, logo após salvar.
  const saveEsText = async (type: Kind) => {
    const text = esText.trim();
    if (!text) return;
    const { data } = await supabase.from("inventory_movements")
      .select("id").eq("type", type).order("created_at", { ascending: false }).limit(1);
    const id = data?.[0]?.id;
    if (id) await updateText.mutateAsync({ id, field: "es_text", value: text });
  };

  const submit = async () => {
    if (busy) return;
    const quantity = Number(qty);
    if (!Number.isInteger(quantity) || quantity < 1) { toast.error("Quantidade deve ser um número inteiro maior que zero"); return; }
    const occurred = new Date(when);
    if (!when || Number.isNaN(occurred.getTime())) { toast.error("Informe a data e a hora"); return; }
    const pat = patrimony.trim() || null;
    const notes = obs.trim() || null;

    try {
      if (kind === "in") {
        if (!name.trim()) { toast.error("Informe o nome do equipamento"); return; }
        if (pat && quantity !== 1) { toast.error("Bem patrimoniado tem quantidade sempre 1"); return; }
        const res = await saveEntry.mutateAsync([{
          kind: "new", name: name.trim(), brand: null, model: null, patrimony_number: pat, serial_number: null,
          quantity, unit_price: 0, entry_date: when.slice(0, 10), occurred_at: occurred.toISOString(),
          notes, purchased: true,
        }]);
        if (res.ok) {
          // A função de entradas cria o item sem categoria: grava a escolhida no item recém-criado.
          if (categoryId) {
            const { data } = await supabase.from("inventory_items")
              .select("id").eq("name", name.trim()).order("created_at", { ascending: false }).limit(1);
            const newId = data?.[0]?.id;
            if (newId) await updateItem.mutateAsync({ id: newId, category_id: categoryId } as never);
          }
          await saveEsText("in");
          reset();
        }
      } else {
        if (!itemId) { toast.error("Selecione o equipamento"); return; }
        if (!collabId) { toast.error("Toda saída exige um responsável"); return; }
        const collab = collaborators.find((c) => c.id === collabId);
        const res = await saveExit.mutateAsync([{
          kind: "new", item_id: itemId, quantity, occurred_at: occurred.toISOString(), collaborator_id: collabId,
          department: dept.trim() || collab?.department || null, reason: null, patrimony_number: pat, notes,
        }]);
        if (res.ok) {
          if (categoryId && categoryId !== (selectedItem?.category_id ?? "")) {
            await updateItem.mutateAsync({ id: itemId, category_id: categoryId } as never);
          }
          await saveEsText("out");
          reset();
        }
      }
    } catch {
      // o hook já mostra o erro do banco
    }
  };

  const onEnter = (e: KeyboardEvent) => { if (e.key === "Enter") submit(); };
  const selectedItem = items.find((i) => i.id === itemId);

  return (
    <TableRow className="bg-blue-50/60 hover:bg-blue-50/60">
      <TableCell>
        <div className="flex items-center gap-1">
          {kind === "out" ? (
            <Select
              value={itemId}
              onValueChange={(v) => {
                setItemId(v);
                setCategoryId(items.find((i) => i.id === v)?.category_id ?? "");
              }}
            >
              <SelectTrigger className="h-8 min-w-[160px] text-xs"><SelectValue placeholder="Selecione o item" /></SelectTrigger>
              <SelectContent>
                {items.filter((i) => i.status === "active").map((i) => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              className="h-8 min-w-[160px] text-xs"
              placeholder="Nome do equipamento"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={onEnter}
            />
          )}
          <Input
            className="h-8 w-16 text-xs [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            type="number"
            min={1}
            aria-label="Quantidade"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onKeyDown={onEnter}
          />
        </div>
      </TableCell>
      <TableCell>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="h-8 min-w-[130px] text-xs"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input className="h-8 text-xs" placeholder="Patrimônio" value={patrimony} onChange={(e) => setPatrimony(e.target.value)} onKeyDown={onEnter} />
      </TableCell>
      <TableCell>
        <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="in">Entrada</SelectItem>
            <SelectItem value="out">Saída</SelectItem>
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Input type="datetime-local" className="h-8 text-xs" value={when} onChange={(e) => setWhen(e.target.value)} onKeyDown={onEnter} />
      </TableCell>
      <TableCell>
        <Input className="h-8 text-xs" placeholder="Departamento" value={dept} onChange={(e) => setDept(e.target.value)} onKeyDown={onEnter} />
      </TableCell>
      <TableCell className="min-w-[180px]">
        <Textarea
          rows={2}
          maxLength={1000}
          aria-label="E&S"
          placeholder={kind === "out" ? "E&S (ex.: Bárbara Geisa)" : "E&S (ex.: Estoque)"}
          value={esText}
          onChange={(e) => setEsText(e.target.value)}
          className="min-h-[48px] text-xs"
        />
        <div className="mt-1">
          {kind === "out" ? (
            <Select value={collabId} onValueChange={setCollabId}>
              <SelectTrigger className="h-8 min-w-[150px] text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                {collaborators.filter((c) => c.active).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </TableCell>
      <TableCell>
        <Input className="h-8 text-xs" placeholder="Observação" value={obs} onChange={(e) => setObs(e.target.value)} onKeyDown={onEnter} />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">Preencha depois na linha</TableCell>
      <TableCell className="text-right">
        <Button size="sm" onClick={submit} disabled={busy}>
          <Plus className="mr-1 h-3.5 w-3.5" />Adicionar
        </Button>
      </TableCell>
    </TableRow>
  );
}
