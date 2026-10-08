import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  useSaveExitBatch, type ExitBatchRow, type InventoryCollaborator, type InventoryItem, type InventoryMovement,
} from "@/hooks/useInventory";
import { brToIso, TIME_RE } from "@/components/almoxarifado/EntryDialog";

// Planilha de saídas: nada é gravado enquanto a pessoa digita.
// "Completar edições" envia todas as linhas alteradas num único lote.

interface Original {
  name: string;
  quantity: number;
  occurredAt: string;   // ISO exatamente como veio do banco
  collaboratorId: string | null;
  department: string | null;
  reason: string | null;
  patrimony: string | null;
  rawNotes: string | null;
  date: string;
  time: string;
}

interface GridRow {
  key: string;
  movementId: string | null; // null = linha nova
  itemId: string;            // linhas novas: item escolhido
  name: string;              // linhas existentes: nome do item (editável)
  date: string;              // dd/mm/aaaa
  time: string;              // hh:mm
  quantity: string;
  collaboratorId: string;
  department: string;
  patrimony: string;
  reason: string;
  notes: string;
  original: Original | null;
}

type Column = "date" | "time" | "name" | "quantity" | "department" | "patrimony" | "reason" | "notes";

const pad = (n: number) => String(n).padStart(2, "0");
const localParts = (iso: string) => {
  const d = new Date(iso);
  return { date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

const orNull = (s: string) => s.trim() || null;

const blankRow = (): GridRow => {
  const now = localParts(new Date().toISOString());
  return {
    key: crypto.randomUUID(), movementId: null, itemId: "", name: "",
    date: now.date, time: now.time, quantity: "1", collaboratorId: "", department: "",
    patrimony: "", reason: "", notes: "", original: null,
  };
};

const existingRow = (m: InventoryMovement, item: InventoryItem | undefined): GridRow => {
  const occurredAt = m.occurred_at ?? m.created_at;
  const parts = localParts(occurredAt);
  const name = item?.name ?? "";
  return {
    key: m.id, movementId: m.id, itemId: m.item_id, name,
    date: parts.date, time: parts.time,
    quantity: String(m.quantity), collaboratorId: m.collaborator_id ?? "",
    department: m.department ?? "", patrimony: m.patrimony_number ?? "",
    reason: m.reason ?? "", notes: m.notes ?? "",
    original: {
      name, quantity: m.quantity, occurredAt, collaboratorId: m.collaborator_id ?? null,
      department: m.department ?? null, reason: m.reason ?? null, patrimony: m.patrimony_number ?? null,
      rawNotes: m.notes ?? null, date: parts.date, time: parts.time,
    },
  };
};

// Uma linha existente mudou se algum campo editável for diferente do original.
function isChanged(r: GridRow): boolean {
  const o = r.original;
  if (!o) return false;
  return r.name.trim() !== o.name
    || Number(r.quantity) !== o.quantity
    || r.date !== o.date
    || r.time !== o.time
    || (r.collaboratorId || null) !== o.collaboratorId
    || orNull(r.department) !== o.department
    || orNull(r.reason) !== o.reason
    || orNull(r.patrimony) !== o.patrimony
    || orNull(r.notes) !== (o.rawNotes ?? null);
}

const isBlankNew = (r: GridRow) =>
  r.movementId === null && !r.itemId && !r.reason.trim() && !r.patrimony.trim() && !r.notes.trim();

interface Props {
  movements: InventoryMovement[];
  items: InventoryItem[];
  collaborators: InventoryCollaborator[];
  onExit: () => void;
}

export function ExitGrid({ movements, items, collaborators, onExit }: Props) {
  const saveBatch = useSaveExitBatch();
  const [rows, setRows] = useState<GridRow[]>(() =>
    movements.map((m) => existingRow(m, items.find((i) => i.id === m.item_id))),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const activeItems = items.filter((i) => i.status === "active").sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const sortedCollabs = [...collaborators].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));

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

  // Ao escolher o responsável, o departamento acompanha o cadastro dele.
  const pickCollaborator = (r: GridRow, collaboratorId: string) => {
    const dept = collaborators.find((c) => c.id === collaboratorId)?.department ?? "";
    updateRow(r.key, { collaboratorId, department: dept });
  };

  const validateAndBuild = (): { payload: ExitBatchRow[]; errors: string[] } => {
    const payload: ExitBatchRow[] = [];
    const errs: string[] = [];

    rows.forEach((r, i) => {
      const n = i + 1;
      if (r.movementId === null && isBlankNew(r)) return;
      if (r.movementId !== null && !isChanged(r)) return;

      const qty = Number(r.quantity);
      const iso = brToIso(r.date);
      const rowErrors: string[] = [];
      if (!iso) rowErrors.push(`Linha ${n}: data inválida (use dd/mm/aaaa)`);
      if (!TIME_RE.test(r.time)) rowErrors.push(`Linha ${n}: hora inválida (use hh:mm)`);
      if (!Number.isInteger(qty) || qty < 1) rowErrors.push(`Linha ${n}: quantidade deve ser um número inteiro maior que zero`);
      if (!r.collaboratorId) rowErrors.push(`Linha ${n}: toda saída exige um responsável`);
      if (r.movementId === null && !r.itemId) rowErrors.push(`Linha ${n}: selecione o item`);
      if (r.movementId !== null && !r.name.trim()) rowErrors.push(`Linha ${n}: informe o nome do item`);
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
          occurred_at: sameMoment ? o.occurredAt : occurredAt,
          collaborator_id: r.collaboratorId,
          department: orNull(r.department),
          reason: orNull(r.reason),
          patrimony_number: orNull(r.patrimony),
          notes: orNull(r.notes),
          original: {
            name: o.name, quantity: o.quantity, occurred_at: o.occurredAt, collaborator_id: o.collaboratorId,
            department: o.department, reason: o.reason, patrimony_number: o.patrimony, notes: o.rawNotes,
          },
        });
        return;
      }

      payload.push({
        kind: "new",
        item_id: r.itemId,
        quantity: qty,
        occurred_at: occurredAt,
        collaborator_id: r.collaboratorId,
        department: orNull(r.department),
        reason: orNull(r.reason),
        patrimony_number: orNull(r.patrimony),
        notes: orNull(r.notes),
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

  const getValue = (r: GridRow, col: Column): string => {
    switch (col) {
      case "date": return r.date;
      case "time": return r.time;
      case "name": return r.name;
      case "quantity": return r.quantity;
      case "department": return r.department;
      case "patrimony": return r.patrimony;
      case "reason": return r.reason;
      case "notes": return r.notes;
    }
  };

  const setValue = (col: Column, value: string): Partial<GridRow> => {
    switch (col) {
      case "date": return { date: value };
      case "time": return { time: value };
      case "name": return { name: value };
      case "quantity": return { quantity: value };
      case "department": return { department: value };
      case "patrimony": return { patrimony: value };
      case "reason": return { reason: value };
      case "notes": return { notes: value };
    }
  };

  const selectClass = "h-8 w-full rounded-md border border-input bg-background px-2 text-sm";

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
              <th className="px-2 py-2">Qtd</th>
              <th className="px-2 py-2">Responsável</th>
              <th className="px-2 py-2">Departamento</th>
              <th className="px-2 py-2">Patrimônio</th>
              <th className="px-2 py-2">Motivo</th>
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
                  <td className="px-2 py-1">
                    {r.movementId === null ? (
                      <select
                        aria-label="Item"
                        className={selectClass}
                        value={r.itemId}
                        onChange={(e) => updateRow(r.key, { itemId: e.target.value })}
                      >
                        <option value="">Selecione o item</option>
                        {activeItems.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                      </select>
                    ) : cell("name", { placeholder: "Nome do item" })}
                  </td>
                  <td className="px-2 py-1">{cell("quantity", { type: "number", min: 1, className: "w-20" })}</td>
                  <td className="px-2 py-1">
                    <select
                      aria-label="Responsável"
                      className={selectClass}
                      value={r.collaboratorId}
                      onChange={(e) => pickCollaborator(r, e.target.value)}
                    >
                      <option value="">Selecione</option>
                      {sortedCollabs.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">{cell("department", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">{cell("patrimony", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">{cell("reason", { placeholder: "opcional" })}</td>
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
