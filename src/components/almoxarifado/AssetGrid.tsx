import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  useSaveAssetBatch, type AssetBatchRow, type AssetStatus, type InventoryAsset, type InventoryCollaborator,
  type InventoryItem, type InventoryLocation,
} from "@/hooks/useInventory";

// Planilha de patrimônios: nada é gravado enquanto a pessoa digita.
// "Completar edições" envia todas as linhas alteradas num único lote.

const STATUS_LABELS: Record<AssetStatus, string> = {
  available: "Disponível", in_use: "Em uso", damaged: "Danificado", discarded: "Descartado", maintenance: "Manutenção",
};

interface Original {
  itemId: string;
  patrimony: string;
  serial: string | null;
  value: number;
  status: string;
  locationId: string | null;
  collaboratorId: string | null;
  department: string | null;
}

interface GridRow {
  key: string;
  assetId: string | null; // null = linha nova
  itemId: string;
  patrimony: string;
  serial: string;
  value: string;
  status: AssetStatus;
  locationId: string;
  collaboratorId: string;
  department: string;
  original: Original | null;
}

type Column = "patrimony" | "serial" | "value" | "department";

const orNull = (s: string) => s.trim() || null;

const blankRow = (): GridRow => ({
  key: crypto.randomUUID(), assetId: null, itemId: "", patrimony: "", serial: "", value: "0",
  status: "available", locationId: "", collaboratorId: "", department: "", original: null,
});

const existingRow = (a: InventoryAsset): GridRow => ({
  key: a.id, assetId: a.id, itemId: a.item_id, patrimony: a.patrimony_number, serial: a.serial_number ?? "",
  value: String(a.value ?? 0), status: a.status, locationId: a.location_id ?? "",
  collaboratorId: a.collaborator_id ?? "", department: a.department ?? "",
  original: {
    itemId: a.item_id, patrimony: a.patrimony_number, serial: a.serial_number ?? null, value: a.value ?? 0,
    status: a.status, locationId: a.location_id ?? null, collaboratorId: a.collaborator_id ?? null,
    department: a.department ?? null,
  },
});

// Uma linha existente mudou se algum campo for diferente do original.
function isChanged(r: GridRow): boolean {
  const o = r.original;
  if (!o) return false;
  return r.itemId !== o.itemId
    || r.patrimony.trim() !== o.patrimony
    || orNull(r.serial) !== o.serial
    || Number(r.value) !== o.value
    || r.status !== o.status
    || (r.locationId || null) !== o.locationId
    || (r.collaboratorId || null) !== o.collaboratorId
    || orNull(r.department) !== o.department;
}

const isBlankNew = (r: GridRow) => r.assetId === null && !r.itemId && !r.patrimony.trim() && !r.serial.trim();

interface Props {
  assets: InventoryAsset[];
  items: InventoryItem[];
  locations: InventoryLocation[];
  collaborators: InventoryCollaborator[];
  onExit: () => void;
}

export function AssetGrid({ assets, items, locations, collaborators, onExit }: Props) {
  const saveBatch = useSaveAssetBatch();
  const collabName = (id: string) => collaborators.find((c) => c.id === id)?.full_name ?? "";
  const [rows, setRows] = useState<GridRow[]>(() =>
    // Mesma ordem da tabela: setor, responsável, patrimônio.
    [...assets]
      .sort((a, b) =>
        (a.department ?? "").localeCompare(b.department ?? "", "pt-BR", { sensitivity: "base" })
        || collabName(a.collaborator_id ?? "").localeCompare(collabName(b.collaborator_id ?? ""), "pt-BR", { sensitivity: "base" })
        || a.patrimony_number.localeCompare(b.patrimony_number, "pt-BR", { numeric: true }))
      .map(existingRow),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const activeItems = items.filter((i) => i.status === "active").sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const sortedCollabs = [...collaborators].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  const sortedLocs = [...locations].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";

  const dirty = rows.some((r) => (r.assetId === null ? !isBlankNew(r) : isChanged(r)));

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

  const validateAndBuild = (): { payload: AssetBatchRow[]; errors: string[] } => {
    const payload: AssetBatchRow[] = [];
    const errs: string[] = [];

    rows.forEach((r, i) => {
      const n = i + 1;
      if (r.assetId === null && isBlankNew(r)) return;
      if (r.assetId !== null && !isChanged(r)) return;

      const rowErrors: string[] = [];
      if (!r.itemId) rowErrors.push(`Linha ${n}: selecione o item`);
      if (!r.patrimony.trim()) rowErrors.push(`Linha ${n}: informe o nº de patrimônio`);
      const value = Number(r.value);
      if (Number.isNaN(value) || value < 0) rowErrors.push(`Linha ${n}: valor inválido`);
      if (rowErrors.length) {
        errs.push(...rowErrors);
        return;
      }

      const base = {
        item_id: r.itemId,
        patrimony_number: r.patrimony.trim(),
        serial_number: orNull(r.serial),
        value,
        status: r.status,
        location_id: r.locationId || null,
        collaborator_id: r.collaboratorId || null,
        department: orNull(r.department),
      };

      if (r.assetId !== null) {
        const o = r.original!;
        payload.push({
          kind: "update",
          id: r.assetId,
          ...base,
          original: {
            item_id: o.itemId, patrimony_number: o.patrimony, serial_number: o.serial, value: o.value,
            status: o.status, location_id: o.locationId, collaborator_id: o.collaboratorId, department: o.department,
          },
        });
        return;
      }

      payload.push({ kind: "new", ...base });
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
        const row = rows.find((r) => r.assetId === c.id);
        return row ? `${row.patrimony || "linha"} (${c.reason})` : c.id;
      });
      const msg = `Nada foi salvo. Patrimônios alterados por outra pessoa: ${names.join(", ")}. Recarregue a tela e refaça as edições.`;
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
      case "patrimony": return r.patrimony;
      case "serial": return r.serial;
      case "value": return r.value;
      case "department": return r.department;
    }
  };

  const setValue = (col: Column, value: string): Partial<GridRow> => {
    switch (col) {
      case "patrimony": return { patrimony: value };
      case "serial": return { serial: value };
      case "value": return { value };
      case "department": return { department: value };
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
        <table className="w-full min-w-[1300px] text-sm">
          <thead className="bg-muted/50 text-left text-xs">
            <tr>
              <th className="w-10 px-2 py-2" aria-label="Adicionar linha" />
              <th className="px-2 py-2">Patrimônio</th>
              <th className="px-2 py-2">Item</th>
              <th className="px-2 py-2">Série</th>
              <th className="px-2 py-2">Valor (R$)</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Local</th>
              <th className="px-2 py-2">Responsável</th>
              <th className="px-2 py-2">Departamento</th>
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
                  <td className="px-2 py-1">{cell("patrimony", { placeholder: "nº patrimônio", className: "w-32" })}</td>
                  <td className="px-2 py-1">
                    <select aria-label="Item" className={selectClass} value={r.itemId}
                      onChange={(e) => updateRow(r.key, { itemId: e.target.value })}>
                      {r.assetId !== null && !activeItems.some((it) => it.id === r.itemId) && (
                        <option value={r.itemId}>{itemName(r.itemId)}</option>
                      )}
                      <option value="">Selecione o item</option>
                      {activeItems.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">{cell("serial", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">{cell("value", { type: "number", min: 0, className: "w-28" })}</td>
                  <td className="px-2 py-1">
                    <select aria-label="Status" className={selectClass} value={r.status}
                      onChange={(e) => updateRow(r.key, { status: e.target.value as AssetStatus })}>
                      {(Object.keys(STATUS_LABELS) as AssetStatus[]).map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select aria-label="Local" className={selectClass} value={r.locationId}
                      onChange={(e) => updateRow(r.key, { locationId: e.target.value })}>
                      <option value="">—</option>
                      {sortedLocs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">
                    <select aria-label="Responsável" className={selectClass} value={r.collaboratorId}
                      onChange={(e) => pickCollaborator(r, e.target.value)}>
                      <option value="">Sem responsável</option>
                      {sortedCollabs.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1">{cell("department", { placeholder: "opcional" })}</td>
                  <td className="px-2 py-1">
                    {r.assetId === null && (
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
