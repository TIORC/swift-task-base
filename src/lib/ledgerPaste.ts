import type {
  EntryBatchRow, ExitBatchRow, InventoryCategory, InventoryCollaborator, InventoryItem,
} from "@/hooks/useInventory";

// Lê linhas copiadas do Excel (TSV) e transforma em lançamentos de Entrada ou Saída.
// Se a primeira linha for cabeçalho (ex.: "Equipamento", "Categoria"), as colunas são
// reconhecidas pelo nome; senão, usa a ordem padrão abaixo.

export type Field = "equip" | "cat" | "pat" | "tipo" | "data" | "qtd" | "dept" | "resp" | "es" | "obs";

const HEADER_ALIASES: Record<Field, string[]> = {
  equip: ["equipamento", "ativo", "item"],
  cat: ["categoria"],
  pat: ["patrimonio"],
  tipo: ["tipodecontrole", "tipo"],
  data: ["data"],
  qtd: ["quantidade", "qtd"],
  dept: ["departamento", "setor"],
  resp: ["responsavel", "colaborador"],
  es: ["es"],
  obs: ["observacao", "obs"],
};

const DEFAULT_ORDER: Field[] = ["equip", "cat", "pat", "tipo", "data", "dept", "resp", "es", "obs"];

export interface ParsedLedgerRow {
  line: number;
  kind: "in" | "out";
  name: string;
  categoryName: string;
  categoryId: string | null;
  patrimony: string | null;
  when: string; // yyyy-mm-dd
  responsible: string;
  es: string | null;
  entryRow?: Extract<EntryBatchRow, { kind: "new" }>;
  exitRow?: Extract<ExitBatchRow, { kind: "new" }>;
  errors: string[];
  warnings: string[];
}

interface Context {
  categories: InventoryCategory[];
  items: InventoryItem[];
  collaborators: InventoryCollaborator[];
}

// Normaliza para comparar cabeçalhos: sem acento, sem espaços e sem pontuação.
const headerKey = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Normaliza nomes para comparar: sem acento, minúsculo e com espaços simples.
const nameKey = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(y: number, m: number, d: number): string | null {
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

// Aceita dd/mm/aaaa, aaaa-mm-dd e o número de série do Excel (ex.: 45591).
function parseDate(raw: string): string | null {
  const t = raw.trim();
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return isoDate(Number(m[3]), Number(m[2]), Number(m[1]));
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return isoDate(Number(m[1]), Number(m[2]), Number(m[3]));
  if (/^\d{5}$/.test(t)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(t) * 86400000);
    return isoDate(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
  }
  return null;
}

const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function parseLedgerPaste(text: string, ctx: Context, forcedField?: Field): ParsedLedgerRow[] {
  // Uma coluna só: cada linha vai para o campo escolhido; os demais campos ficam no padrão.
  if (forcedField) {
    return text.replace(/\r/g, "").split("\n")
      .filter((l) => l.trim() !== "")
      .map((l, i) => buildRow([l.trim()], { [forcedField]: 0 }, ctx, i + 1));
  }

  const table = text.replace(/\r/g, "").split("\n")
    .map((l) => l.split("\t"))
    .filter((cells) => cells.some((c) => c.trim() !== ""));
  if (table.length === 0) return [];

  // Cabeçalho reconhecido pelo nome das colunas, ou ordem padrão.
  const colOf: Partial<Record<Field, number>> = {};
  let start = 0;
  const hasHeader = table[0].some((c) => HEADER_ALIASES.equip.includes(headerKey(c)));
  if (hasHeader) {
    start = 1;
    table[0].forEach((cell, j) => {
      const key = headerKey(cell);
      (Object.keys(HEADER_ALIASES) as Field[]).forEach((f) => {
        if (colOf[f] === undefined && HEADER_ALIASES[f].includes(key)) colOf[f] = j;
      });
    });
  } else {
    DEFAULT_ORDER.forEach((f, j) => { colOf[f] = j; });
  }

  return table.slice(start).map((cells, i) => buildRow(cells, colOf, ctx, start + i + 1));
}

function buildRow(cells: string[], colOf: Partial<Record<Field, number>>, ctx: Context, line: number): ParsedLedgerRow {
  const get = (f: Field) => {
    const j = colOf[f];
    return j === undefined ? "" : (cells[j] ?? "").trim();
  };

  const errors: string[] = [];
  const warnings: string[] = [];

  const name = get("equip");
  if (!name) errors.push("Sem equipamento");

  const tipoRaw = nameKey(get("tipo"));
  let kind: "in" | "out" = "in";
  if (tipoRaw.startsWith("sai")) kind = "out";
  else if (tipoRaw && !tipoRaw.startsWith("ent")) errors.push(`Tipo de controle inválido: "${get("tipo")}"`);

  const qRaw = get("qtd") || "1";
  const qty = Number(qRaw);
  if (!Number.isInteger(qty) || qty < 1) errors.push("Quantidade inválida");

  const patrimony = get("pat") || null;
  if (kind === "in" && patrimony && qty !== 1) errors.push("Bem patrimoniado tem quantidade 1");

  let when = todayIso();
  const dataRaw = get("data");
  if (dataRaw) {
    const parsed = parseDate(dataRaw);
    if (parsed) when = parsed;
    else errors.push(`Data inválida: "${dataRaw}"`);
  }

  const catText = get("cat");
  const category = catText ? ctx.categories.find((c) => nameKey(c.name) === nameKey(catText)) : undefined;
  if (catText && !category) warnings.push(`Categoria "${catText}" não cadastrada (será ignorada)`);

  const es = get("es") || null;
  const obs = get("obs") || null;
  const occurredIso = new Date(Number(when.slice(0, 4)), Number(when.slice(5, 7)) - 1, Number(when.slice(8, 10)), 12, 0).toISOString();

  const base = {
    line, kind, name, categoryName: catText, categoryId: category?.id ?? null,
    patrimony, when, responsible: get("resp"), es, errors, warnings,
  };

  if (kind === "in") {
    const entryRow: Extract<EntryBatchRow, { kind: "new" }> = {
      kind: "new", name, brand: null, model: null, patrimony_number: patrimony, serial_number: null,
      quantity: qty, unit_price: 0, entry_date: when, occurred_at: occurredIso, notes: obs, purchased: true,
    };
    return { ...base, entryRow };
  }

  // Saída: o equipamento precisa existir no estoque e o responsável precisa estar cadastrado.
  const item = ctx.items.find((i) => i.status === "active" && nameKey(i.name) === nameKey(name));
  if (name && !item) errors.push(`"${name}" não está cadastrado no estoque (saída precisa de item)`);

  const respText = get("resp");
  const collab = respText
    ? ctx.collaborators.find((c) => c.active && nameKey(c.full_name) === nameKey(respText))
    : undefined;
  if (!respText) errors.push("Saída exige responsável");
  else if (!collab) errors.push(`Responsável "${respText}" não encontrado`);

  if (errors.length > 0 || !item || !collab) return base;

  const exitRow: Extract<ExitBatchRow, { kind: "new" }> = {
    kind: "new", item_id: item.id, quantity: qty, occurred_at: occurredIso, collaborator_id: collab.id,
    department: get("dept") || collab.department || null, reason: null, patrimony_number: patrimony, notes: obs,
  };
  return { ...base, exitRow };
}
