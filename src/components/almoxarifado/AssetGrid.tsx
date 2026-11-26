import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  useSaveAssetBatch, useSetItemCategories, useRecordDamage, type AssetBatchRow, type AssetStatus, type InventoryAsset, type InventoryCategory,
  type InventoryCollaborator, type InventoryItem, type InventoryLocation, type InventoryMovement,
} from "@/hooks/useInventory";

// Planilha de patrimônios: nada é gravado enquanto a pessoa digita.
// "Gravar" envia todas as linhas alteradas num único lote.
// layout "ativos" mostra as mesmas colunas da aba Ativos; as que não são editáveis aparecem só como texto.

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
  notes: string; // só leitura na planilha
  damageMonth: string; // "01".."12" ou "" (mês do dano)
  damageYear: string; // "2026" ou ""
  damageOriginal: string; // "YYYY-MM" do dano já registrado ("" se nenhum)
  original: Original | null;
}

type Column = "patrimony" | "serial" | "value" | "department";

const orNull = (s: string) => s.trim() || null;

const currentMonth = () => String(new Date().getMonth() + 1).padStart(2, "0");
const currentYear = () => String(new Date().getFullYear());
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const blankRow = (status: AssetStatus = "available"): GridRow => ({
  key: crypto.randomUUID(), assetId: null, itemId: "", patrimony: "", serial: "", value: "0",
  status, locationId: "", collaboratorId: "", department: "", notes: "", original: null,
  damageMonth: currentMonth(), damageYear: currentYear(), damageOriginal: "",
});

const existingRow = (a: InventoryAsset, lastDamage: string): GridRow => ({
  key: a.id, assetId: a.id, itemId: a.item_id, patrimony: a.patrimony_number, serial: a.serial_number ?? "",
  value: String(a.value ?? 0), status: a.status, locationId: a.location_id ?? "",
  collaboratorId: a.collaborator_id ?? "", department: a.department ?? "", notes: a.notes ?? "",
  damageMonth: lastDamage ? lastDamage.slice(5, 7) : "", damageYear: lastDamage ? lastDamage.slice(0, 4) : "", damageOriginal: lastDamage,
  original: {
    itemId: a.item_id, patrimony: a.patrimony_number, serial: a.serial_number ?? null, value: a.value ?? 0,
    status: a.status, locationId: a.location_id ?? null, collaboratorId: a.collaborator_id ?? null,
    department: a.department ?? null,
  },
});

// Uma linha existente mudou se algum campo editável for diferente do original.
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

// "YYYY-MM" do dano mais recente do patrimônio ("" se nunca foi marcado como danificado).
const lastDamageMonth = (movements: InventoryMovement[], assetId: string): string => {
  const last = movements
    .filter((m) => m.asset_id === assetId && m.type === "damage")
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];
  if (!last) return "";
  const d = new Date(last.occurred_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

// Linha danificada com mês/ano diferente do registrado: gera a movimentação de dano ao gravar.
const isDamageToRecord = (r: GridRow) =>
  r.status === "damaged"
  && /^\d{4}$/.test(r.damageYear)
  && /^(0[1-9]|1[0-2])$/.test(r.damageMonth)
  && `${r.damageYear}-${r.damageMonth}` !== r.damageOriginal
  && (r.assetId !== null || !isBlankNew(r));

interface Props {
  assets: InventoryAsset[];
  items: InventoryItem[];
  locations: InventoryLocation[];
  collaborators: InventoryCollaborator[];
  onExit: () => void;
  layout?: "patrimonios" | "ativos";
  categories?: InventoryCategory[];
  movements?: InventoryMovement[];
  // Status já marcado nas linhas novas (ex.: "damaged" na aba Controle).
  defaultStatus?: AssetStatus;
  // Quando informado, cada patrimônio existente ganha o botão de excluir na coluna Ações.
  onDeleteAsset?: (a: InventoryAsset) => void;
  // Mostra as colunas Mês e Ano do dano (data em que o patrimônio foi danificado).
  showDamageMonth?: boolean;
}

const ATIVOS_HEADERS = ["Ativos", "Categoria", "Patrimônio", "Valor (R$)", "Status", "Descrição", "Departamento", "Colaborador Responsável", "Histórico", "Observação"];
const PATRIMONIO_HEADERS = ["Patrimônio", "Item", "Série", "Valor (R$)", "Status", "Local", "Responsável", "Departamento"];

export function AssetGrid({
  assets, items, locations, collaborators, onExit, layout = "patrimonios", categories = [], movements = [],
  defaultStatus = "available", onDeleteAsset, showDamageMonth = false,
}: Props) {
  const ativos = layout === "ativos";
  const saveBatch = useSaveAssetBatch();
  const saveCategories = useSetItemCategories();
  const recordDamage = useRecordDamage();
  // Categoria é do item: a troca vale para todos os patrimônios dele. Guarda item id -> categoria escolhida.
  const [categoryChanges, setCategoryChanges] = useState<Record<string, string>>({});
  const collabName = (id: string) => collaborators.find((c) => c.id === id)?.full_name ?? "";
  const [rows, setRows] = useState<GridRow[]>(() =>
    // Mesma ordem da tabela: setor, responsável, patrimônio.
    [...assets]
      .sort((a, b) =>
        (a.department ?? "").localeCompare(b.department ?? "", "pt-BR", { sensitivity: "base" })
        || collabName(a.collaborator_id ?? "").localeCompare(collabName(b.collaborator_id ?? ""), "pt-BR", { sensitivity: "base" })
        || a.patrimony_number.localeCompare(b.patrimony_number, "pt-BR", { numeric: true }))
      .map((a) => existingRow(a, lastDamageMonth(movements, a.id))),
  );
  const [errors, setErrors] = useState<string[]>([]);

  const activeItems = items.filter((i) => i.status === "active").sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  // Um item por combinação de nome, marca e modelo: cadastros repetidos aparecem uma vez só na lista.
  const itemKey = (it: InventoryItem) =>
    [it.name, it.brand ?? "", it.model ?? ""].map((s) => s.trim().toLowerCase().replace(/\s+/g, " ")).join("|");
  const itemLabel = (it: InventoryItem) => [it.name, it.brand, it.model].filter(Boolean).join(" · ");
  const itemOptions = new Map<string, InventoryItem>();
  activeItems.forEach((it) => {
    const key = itemKey(it);
    if (!itemOptions.has(key)) itemOptions.set(key, it);
  });
  const sortedCollabs = [...collaborators].sort((a, b) => a.full_name.localeCompare(b.full_name, "pt-BR"));
  const sortedLocs = [...locations].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  const itemOf = (id: string) => items.find((i) => i.id === id);
  const itemName = (id: string) => itemOf(id)?.name ?? "—";
  const descriptionOf = (itemId: string) => itemOf(itemId)?.description || "—";
  const historyText = (assetId: string | null) => {
    if (!assetId) return "—";
    const hist = movements
      .filter((m) => m.asset_id === assetId)
      .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
    if (hist.length === 0) return "Sem movimentações";
    return `${hist.length} mov. · última ${new Date(hist[0].occurred_at).toLocaleDateString("pt-BR")}`;
  };

  const itemCategoryId = (itemId: string) => categoryChanges[itemId] ?? (itemOf(itemId)?.category_id ?? "");
  const categoryUpdates = Object.entries(categoryChanges)
    .filter(([id, cat]) => cat !== (itemOf(id)?.category_id ?? ""))
    .map(([id, cat]) => ({ id, category_id: cat || null }));
  const damages = rows.filter(isDamageToRecord);
  const dirty = rows.some((r) => (r.assetId === null ? !isBlankNew(r) : isChanged(r))) || categoryUpdates.length > 0 || damages.length > 0;

  const updateRow = (key: string, patch: Partial<GridRow>) =>
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const insertRowAfter = (index: number) => {
    const row = blankRow(defaultStatus);
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
      toast.error(`${errs.length} erro(s) na planilha. Corrija antes de gravar.`);
      return;
    }
    if (!payload.length && categoryUpdates.length === 0 && damages.length === 0) {
      toast.info("Nenhuma alteração para salvar.");
      return;
    }

    let count = 0;
    if (payload.length > 0) {
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
      count = res.count;
    }

    if (damages.length > 0) {
      try {
        await recordDamage.mutateAsync(damages.map((r) => ({
          assetId: r.assetId,
          patrimony: r.patrimony.trim(),
          itemId: r.itemId,
          occurredAt: new Date(`${r.damageYear}-${r.damageMonth}-01T12:00:00`).toISOString(),
          statusFrom: r.original?.status ?? "available",
        })));
      } catch {
        return; // erro já exibido pelo hook
      }
    }

    if (categoryUpdates.length > 0) {
      try {
        await saveCategories.mutateAsync(categoryUpdates);
      } catch {
        return; // erro já exibido pelo hook; os patrimônios já gravados continuam salvos
      }
    }

    toast.success(`${count || categoryUpdates.length} alteração(ões) salvas.`);
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
  const readOnlyClass = "block px-2 py-1 text-xs";
  const headers = ativos ? ATIVOS_HEADERS : showDamageMonth ? [...PATRIMONIO_HEADERS, "Mês", "Ano"] : PATRIMONIO_HEADERS;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Modo Excel: Enter desce para a linha de baixo. Nada é gravado até clicar em "Gravar".
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={cancel} disabled={saveBatch.isPending}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={saveBatch.isPending}>{saveBatch.isPending ? "Gravando…" : "Gravar"}</Button>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.map((e) => <p key={e}>{e}</p>)}
        </div>
      )}

      <div className="overflow-x-auto rounded-md border">
        <table className={`w-full text-sm ${ativos ? "min-w-[1100px]" : "min-w-[1300px]"}`}>
          <thead className="bg-muted/50 text-left text-xs">
            <tr>
              <th className="w-10 px-2 py-2" aria-label="Adicionar linha" />
              {headers.map((h) => <th key={h} className="px-2 py-2">{h}</th>)}
              <th className="px-2 py-2">{!ativos && onDeleteAsset ? "Ações" : ""}</th>
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
              const currentItem = r.itemId ? itemOf(r.itemId) : undefined;
              const currentKey = currentItem ? itemKey(currentItem) : "";
              const itemSelect = (
                <select aria-label="Item" className={selectClass} value={currentKey}
                  onChange={(e) => updateRow(r.key, { itemId: itemOptions.get(e.target.value)?.id ?? "" })}>
                  {currentItem && !itemOptions.has(currentKey) && (
                    <option value={currentKey}>{itemLabel(currentItem)}</option>
                  )}
                  <option value="">Selecione o item</option>
                  {[...itemOptions.entries()].map(([key, it]) => <option key={key} value={key}>{itemLabel(it)}</option>)}
                </select>
              );
              const statusSelect = (
                <select aria-label="Status" className={selectClass} value={r.status}
                  onChange={(e) => updateRow(r.key, { status: e.target.value as AssetStatus })}>
                  {(Object.keys(STATUS_LABELS) as AssetStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              );
              const collabSelect = (
                <select aria-label="Responsável" className={selectClass} value={r.collaboratorId}
                  onChange={(e) => pickCollaborator(r, e.target.value)}>
                  <option value="">Sem responsável</option>
                  {sortedCollabs.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                </select>
              );
              const locationSelect = (
                <select aria-label="Local" className={selectClass} value={r.locationId}
                  onChange={(e) => updateRow(r.key, { locationId: e.target.value })}>
                  <option value="">—</option>
                  {sortedLocs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
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
                  {ativos ? (
                    <>
                      <td className="px-2 py-1">{itemSelect}</td>
                      <td className="px-2 py-1">
                        <select aria-label="Categoria" className={selectClass} value={itemCategoryId(r.itemId)} disabled={!r.itemId}
                          onChange={(e) => setCategoryChanges((prev) => ({ ...prev, [r.itemId]: e.target.value }))}>
                          <option value="">Sem categoria</option>
                          {[...categories].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1">{cell("patrimony", { placeholder: "nº patrimônio", className: "w-32" })}</td>
                      <td className="px-2 py-1">{cell("value", { type: "number", min: 0, className: "w-28" })}</td>
                      <td className="px-2 py-1">{statusSelect}</td>
                      <td className="px-2 py-1"><span className={`${readOnlyClass} max-w-[220px]`}>{r.itemId ? descriptionOf(r.itemId) : "—"}</span></td>
                      <td className="px-2 py-1">{cell("department", { placeholder: "opcional" })}</td>
                      <td className="px-2 py-1">{collabSelect}</td>
                      <td className="px-2 py-1"><span className={readOnlyClass}>{historyText(r.assetId)}</span></td>
                      <td className="px-2 py-1"><span className={`${readOnlyClass} max-w-[220px]`}>{r.notes || "—"}</span></td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1">{cell("patrimony", { placeholder: "nº patrimônio", className: "w-32" })}</td>
                      <td className="px-2 py-1">{itemSelect}</td>
                      <td className="px-2 py-1">{cell("serial", { placeholder: "opcional" })}</td>
                      <td className="px-2 py-1">{cell("value", { type: "number", min: 0, className: "w-28" })}</td>
                      <td className="px-2 py-1">{statusSelect}</td>
                      <td className="px-2 py-1">{locationSelect}</td>
                      <td className="px-2 py-1">{collabSelect}</td>
                      <td className="px-2 py-1">{cell("department", { placeholder: "opcional" })}</td>
                      {showDamageMonth && (
                        <>
                          <td className="px-2 py-1">
                            <select aria-label="Mês do dano" className={selectClass} value={r.damageMonth} disabled={r.status !== "damaged"}
                              onChange={(e) => updateRow(r.key, { damageMonth: e.target.value })}>
                              <option value="">—</option>
                              {MONTHS.map((m, idx) => <option key={m} value={String(idx + 1).padStart(2, "0")}>{m}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <Input aria-label="Ano do dano" type="number" className="h-8 w-24 text-xs" value={r.damageYear}
                              disabled={r.status !== "damaged"} onChange={(e) => updateRow(r.key, { damageYear: e.target.value })} />
                          </td>
                        </>
                      )}
                    </>
                  )}
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
                    {r.assetId !== null && !ativos && (
                      <button
                        type="button"
                        aria-label="Excluir patrimônio"
                        title="Excluir patrimônio"
                        onClick={() => {
                          const asset = assets.find((x) => x.id === r.assetId);
                          if (!asset || !onDeleteAsset || !window.confirm(`Excluir o patrimônio ${asset.patrimony_number}? O histórico é mantido.`)) return;
                          onDeleteAsset(asset);
                          removeRow(r.key);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded text-destructive hover:bg-muted"
                      >
                        <Trash2 className="h-4 w-4" />
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
