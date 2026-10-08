import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  useSaveEntryBatch, type EntryBatchRow, type InventoryItem, type InventoryMovement,
} from "@/hooks/useInventory";
import { brToIso, TIME_RE, PURCHASED_NOTE } from "@/components/almoxarifado/EntryDialog";

// Planilha de entradas: nada é gravado enquanto a pessoa digita.
// "Completar edições" envia todas as linhas alteradas num único lote.

interface Original {
  name: string;
  quantity: number;
  unitPrice: number;
  occurredAt: string;   // ISO exatamente como veio do banco
  rawNotes: string | null;
  date: string;
  time: string;
  obs: string;
  purchased: boolean;
  brand: string | null;
  model: string | null;
  patrimony: string | null;
}

interface GridRow {
  key: string;
  movementId: string | null; // null = linha nova
  name: string;
  brand: string;
  model: string;
  patrimony: string;
  date: string;              // dd/mm/aaaa
  time: string;              // hh:mm
  quantity: string;
  unitPrice: string;
  notes: string;             // observações (sem o texto de "comprado")
  purchased: boolean;
  original: Original | null;
}

type Column = "date" | "time" | "name" | "brand" | "model" | "patrimony" | "quantity" | "unitPrice" | "notes";

const pad = (n: number) => String(n).padStart(2, "0");
const localParts = (iso: string) => {
  const d = new Date(iso);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

// Separa o texto de "comprado" das observações gravadas na movimentação.
const splitNotes = (notes: string | null) => {
  const raw = notes ?? "";
  if (!raw.startsWith(PURCHASED_NOTE)) return { purchased: false, obs: raw };
  return { purchased: true, obs: raw.slice(PURCHASED_NOTE.length).replace(/^ — /, "") };
};

const blankRow = (): GridRow => {
  const now = localParts(new Date().toISOString());
  return {
    key: crypto.randomUUID(), movementId: null,
    name: "", brand: "", model: "", patrimony: "",
    date: now.date, time: now.time, quantity: "1", unitPrice: "0", notes: "",
    purchased: false, original: null,
  };
};

const existingRow = (m: InventoryMovement, item: InventoryItem | undefined): GridRow => {
  const occurredAt = m.occurred_at ?? m.created_at;
  const parts = localParts(occurredAt);
  const { purchased, obs } = splitNotes(m.notes);
  const brand = item?.brand ?? null;
  const model = item?.model ?? null;
  const patrimony = m.patrimony_number ?? null;
  return {
    key: m.id, movementId: m.id,
    name: item?.name ?? "", brand: brand ?? "", model: model ?? "", patrimony: patrimony ?? "",
    date: parts.date, time: parts.time,
    quantity: String(m.quantity), unitPrice: String(m.unit_price ?? 0), notes: obs,
    purchased,
    original: {
      name: item?.name ?? "", quantity: m.quantity, unitPrice: m.unit_price ?? 0, occurredAt, rawNotes: m.notes ?? null,
      date: parts.date, time: parts.time, obs, purchased, brand, model, patrimony,
    },
  };
};

const orNull = (s: string) => s.trim() || null;

// Uma linha existente mudou se algum campo editável for diferente do original.
function isChanged(r: GridRow): boolean {
  const o = r.original;
  if (!o) return false;
  return r.name.trim() !== o.name
    || Number(r.quantity) !== o.quantity
    || Number(r.unitPrice) !== o.unitPrice
    || r.date !== o.date
    || r.time !== o.time
    || orNull(r.notes) !== orNull(o.obs)
    || r.purchased !== o.purchased
    || orNull(r.brand) !== o.brand
    || orNull(r.model) !== o.model
    || orNull(r.patrimony) !== o.patrimony;
}

const isBlankNew = (r: GridRow) =>
  r.movementId === null && !r.name.trim() && !r.brand.trim() && !r.model.trim() && !r.patrimony.trim() && !r.notes.trim();

interface Props {
  movements: InventoryMovement[];
  items: InventoryItem[];
  onExit: () => void;
}

export function EntryGrid({ movements, items, onExit }: Props) {
  const saveBatch = useSaveEntryBatch();
  const [rows, setRows] = useState<GridRow[]>(() =>
    movements.map((m) => existingRow(m, items.find((i) => i.id === m.item_id))),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const dirty = rows.some((r) => (r.movementId === null ? !isBlankNew(r) : isChanged(r)));

  const updateRow = (key: string, patch: Partial<GridRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const insertRowAfter = (index: number) => {
    const row = blankRow();
    setRows((prev) => [...prev.slice(0, index + 1), row, ...prev.slice(index + 1)]);
    return row.key;
  };

  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  const focusCell = (index: number, col: Column) =>
    setTimeout(() => document.querySelector<HTMLInputElement>(`[data-cell="${index}-${col}"]`)?.focus(), 0);

  // Enter desce para a mesma coluna da linha de baixo (cria uma linha se for a última).
  const onEnter = (e: React.KeyboardEvent, index: number, col: Column) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index + 1 >= rows.length) insertRowAfter(index);
    focusCell(index + 1, col);
  };

  const validateAndBuild = (): { payload: EntryBatchRow[]; errors: string[] } => {
    const payload: EntryBatchRow[] = [];
    const errs: string[] = [];

    rows.forEach((r, i) => {
      const n = i + 1;
      if (r.movementId === null && isBlankNew(r)) return;
      if (r.movementId !== null && !isChanged(r)) return;

      const qty = Number(r.quantity);
      const price = Number(r.unitPrice);
      const iso = brToIso(r.date);
      const rowErrors: string[] = [];
      if (!iso) rowErrors.push(`Linha ${n}: data inválida (use dd/mm/aaaa)`);
      if (!TIME_RE.test(r.time)) rowErrors.push(`Linha ${n}: hora inválida (use hh:mm)`);
      if (!Number.isInteger(qty) || qty < 1) rowErrors.push(`Linha ${n}: quantidade deve ser um número inteiro maior que zero`);
      if (Number.isNaN(price) || price < 0) rowErrors.push(`Linha ${n}: valor unitário inválido`);

      if (!r.name.trim()) rowErrors.push(`Linha ${n}: informe o nome do item`);
      if (r.movementId === null && !r.purchased) rowErrors.push(`Linha ${n}: marque como comprado`);
      if (rowErrors.length) {
        errs.push(...rowErrors);
        return;
      }

      const occurredAt = new Date(`${iso}T${r.time}:00`).toISOString();

      if (r.movementId !== null) {
        const o = r.original!;
        const sameMoment = r.date === o.date && r.time === o.time;
        payload.push({
          kind: "update",
          id: r.movementId,
          name: r.name.trim(),
          quantity: qty,
          unit_price: price,
          occurred_at: sameMoment ? o.occurredAt : occurredAt,
          notes: orNull(r.notes),
          brand: orNull(r.brand),
          model: orNull(r.model),
          patrimony_number: orNull(r.patrimony),
          purchased: r.purchased,
          original: {
            name: o.name, quantity: o.quantity, unit_price: o.unitPrice, occurred_at: o.occurredAt, notes: o.rawNotes,
            brand: o.brand, model: o.model, patrimony_number: o.patrimony,
          },
        });
        return;
      }

      payload.push({
        kind: "new",
        name: r.name.trim(),
        brand: orNull(r.brand),
        model: orNull(r.model),
        patrimony_number: orNull(r.patrimony),
        serial_number: null,
        quantity: qty,
        unit_price: price,
        entry_date: iso,
        occurred_at: occurredAt,
        notes: orNull(r.notes),
        purchased: true,
      });
    });

    return { payload, errors: errs };
  };

  const save = async () => {
    const { payload, errors: errs } = validateAndBuild();
    setErrors(errs);
    if (errs.length) {
      toast.error(`${errs.length} erro(s) na planilha. Corrija antes de completar.`);
      return;
    }
    if (!payload.length) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    let res;
    try {
      res = await saveBatch.mutateAsync(payload); // erro de banco já aparece como toast pelo hook
    } catch {
      return;
    }
    if (!res.ok) {
      const names = (res.conflicts ?? []).map((c) => {
        const row = rows.find((r) => r.movementId === c.id);
        return row ? `${row.name || "linha"} (${c.reason})` : c.id;
      });
      const msg = `Nada foi salvo. Linhas alteradas por outra pessoa: ${names.join(", ")}. Recarregue a tela e refaça as edições.`;
      setErrors([msg]);
      toast.error(msg);
      return;
    }

    toast.success(`${res.count} linha(s) salvas.`);
    onExit();
  };

  const cancel = () => {
    if (dirty && !window.confirm("Descartar as edições não salvas?")) return;
    onExit();
  };

  // Leitura/escrita de cada coluna editável.
  const getValue = (r: GridRow, col: Column): string => {
    switch (col) {
      case "date": return r.date;
      case "time": return r.time;
      case "name": return r.name;
      case "brand": return r.brand;
      case "model": return r.model;
      case "patrimony": return r.patrimony;
      case "quantity": return r.quantity;
      case "unitPrice": return r.unitPrice;
      case "notes": return r.notes;
    }
  };

  const setValue = (col: Column, value: string): Partial<GridRow> => {
    switch (col) {
      case "date": return { date: value };
      case "time": return { time: value };
      case "name": return { name: value };
      case "brand": return { brand: value };
      case "model": return { model: value };
      case "patrimony": return { patrimony: value };
      case "quantity": return { quantity: value };
      case "unitPrice": return { unitPrice: value };
      case "notes": return { notes: value };
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Enter desce para a linha de baixo. Nada é gravado até clicar em "Completar edições".
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={cancel} disabled={saveBatch.isPending}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saveBatch.isPending}>Completar edições</Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[1200px] text-sm">
          <thead className="bg-muted/50 text-left text-xs">
            <tr>
              <th className="w-10 px-2 py-2" aria-label="Adicionar linha" />
              <th className="px-2 py-2">Data</th>
              <th className="px-2 py-2">Hora</th>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2">Marca</th>
              <th className="px-2 py-2">Modelo</th>
              <th className="px-2 py-2">Patrimônio</th>
              <th className="px-2 py-2">Qtd</th>
              <th className="px-2 py-2">Valor unit. (R$)</th>
              <th className="px-2 py-2">Comprado</th>
              <th className="px-2 py-2">Observações</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const cell = (col: Column, props: { placeholder?: string; className?: string; type?: string; min?: number }) => (
                <Input
                  data-cell={`${i}-${col}`}
                  className={`h-8 px-2 text-sm ${props.className ?? ""}`}
                  placeholder={props.placeholder}
                  type={props.type}
                  min={props.min}
                  value={getValue(r, col)}
                  onChange={(e) => updateRow(r.key, setValue(col, e.target.value))}
                  onKeyDown={(e) => onEnter(e, i, col)}
                />
              );
              return (
                <tr key={r.key} className="border-t">
                  <td className="px-2 py-1">
                    <button
                      type="button"
                      aria-label="Adicionar linha abaixo"
                      title="Adicionar linha abaixo"
                      onClick={() => insertRowAfter(i)}
                      className="flex h-7 w-7 items-center justify-center rounded bg-green-600 text-white hover:bg-green-700"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </td>
                  <td className="px-2 py-1">{cell("date", { placeholder: "dd/mm/aaaa", className: "w-28" })}</td>
                  <td className="px-2 py-1">{cell("time", { placeholder: "hh:mm", className: "w-20" })}</td>
                  <td className="px-2 py-1">{cell("name", { placeholder: "Nome do item" })}</td>
                  <td className="px-2 py-1">{cell("brand", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">{cell("model", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">{cell("patrimony", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">{cell("quantity", { type: "number", min: 1, className: "w-20" })}</td>
                  <td className="px-2 py-1">{cell("unitPrice", { type: "number", min: 0, className: "w-28" })}</td>
                  <td className="px-2 py-1 text-center">
                    <input
                      type="checkbox"
                      aria-label="Item comprado"
                      checked={r.purchased}
                      onChange={(e) => updateRow(r.key, { purchased: e.target.checked })}
                    />
                  </td>
                  <td className="px-2 py-1">{cell("notes", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">
                    {r.movementId === null && (
                      <button
                        type="button"
                        aria-label="Remover linha"
                        title="Remover linha"
                        onClick={() => removeRow(r.key)}
                        className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground hover:bg-muted"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Button variant="outline" size="sm" onClick={() => insertRowAfter(rows.length - 1)}>
        <Plus className="mr-2 h-4 w-4" /> Adicionar linha
      </Button>
    </div>
  );
}
