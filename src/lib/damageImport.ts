import type { InventoryAsset, InventoryCollaborator, InventoryItem } from "@/hooks/useInventory";
import { normalizeText } from "@/lib/assetImport";

// Importação de danos em massa (colar da planilha da aba Controle).
// Colunas: Equipamento; Patrimônio; Tipo de Controle; Ano; Mês; Motivo; Departamento; Colaborador Responsável; De quem; Para quem; Observação.
// Só "Dano" entra. Linhas sem patrimônio não têm ativo para marcar e ficam de fora, assim como "De quem" / "Para quem", que o sistema não guarda.

const MONTH_NUMBER: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

// Linha colada com espaços (sem tab): o Tipo ("Dano" ou "Entradas"), o ano e o mês servem de âncora.
const SPACED_ROW = /^(.*?)\s+(\d{3,6})?\s*(Dano|Entradas)\s+(\d{4})\s+([A-Za-zÀ-ÿ]+)(?:\s+(.*))?$/i;

// Separa as colunas de uma linha. Com tab ou ponto e vírgula, separa direto.
// Sem separador, usa a âncora do Tipo e separa o resto nos espaços duplos.
function splitRow(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  const m = line.trim().match(SPACED_ROW);
  if (!m) return [line.trim()];
  const segs = (m[6] ?? "").split(/\s{2,}/).map((c) => c.trim()).filter(Boolean);
  // Com as 6 partes (Motivo ... Observação) o texto fica exato; senão, Observação é a última parte.
  const [reason = "", department = "", collaborator = "", deQuem = "", paraQuem = "", observacao = ""] =
    segs.length >= 6 ? segs : [segs[0], segs[1], segs[2], "", "", segs.length > 3 ? segs[segs.length - 1] : ""];
  return [m[1].trim(), m[2] ?? "", m[3], m[4], m[5], reason, department, collaborator, deQuem, paraQuem, observacao];
}

export interface DamageImportRow {
  line: number;
  assetId: string;
  itemId: string;
  patrimony: string;
  year: number;
  month: number; // 1..12
  reason: string | null;
  notes: string | null;
  department: string | null;
  collaboratorId: string | null;
  statusFrom: string;
}

// Dano sem patrimônio: entra só no histórico (não mexe no estoque).
export interface DamageHistoryDraft {
  line: number;
  item_name: string;
  item_id: string | null;
  quantity: number;
  year: number;
  month: number;
  reason: string | null;
  department: string | null;
  collaborator_id: string | null;
  notes: string | null;
}

export interface DamageImportPlan {
  rows: DamageImportRow[];
  historyRows: DamageHistoryDraft[];
  skippedNotDamage: number;
  skippedNoAsset: number;
  skippedAlreadyRecorded: number;
  errors: string[];
  unmatchedCollaborators: string[];
}

interface PlanData {
  assets: InventoryAsset[];
  collaborators: InventoryCollaborator[];
  // Movimentações de dano já existentes: "assetId|YYYY-MM" para não repetir a mesma data.
  existingDamageKeys: Set<string>;
  // Histórico já gravado (sem patrimônio): "nome normalizado|YYYY-MM".
  historyKeys: Set<string>;
  items: InventoryItem[];
}


function findCollaboratorId(text: string, collaborators: InventoryCollaborator[]): string | null {
  const key = normalizeText(text);
  if (!key) return null;
  const exact = collaborators.find((c) => normalizeText(c.full_name) === key);
  if (exact) return exact.id;
  const byFirst = collaborators.filter((c) => normalizeText(c.full_name).split(" ")[0] === key);
  return byFirst.length === 1 ? byFirst[0].id : null;
}

export function buildDamageImportPlan(text: string, data: PlanData): DamageImportPlan {
  const errors: string[] = [];
  const rows: DamageImportRow[] = [];
  const unmatched = new Set<string>();
  let skippedNotDamage = 0;
  let skippedNoAsset = 0;
  let skippedAlreadyRecorded = 0;
  const seen = new Set<string>();
  const historyRows: DamageHistoryDraft[] = [];
  const historySeen = new Set<string>();

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  lines.forEach((line, index) => {
    const cells = splitRow(line);
    if (index === 0 && normalizeText(cells[0] ?? "") === "equipamento") return; // cabeçalho

    const n = index + 1;
    const [equipamento = "", patrimony = "", tipo = "", yearText = "", monthText = "", reason = "", department = "", collaboratorName = "", , , notes = ""] = cells;

    if (normalizeText(tipo) !== "dano") {
      skippedNotDamage++;
      return;
    }

    const year = Number(yearText);
    const monthNumber = /^\d+$/.test(monthText) ? Number(monthText) : MONTH_NUMBER[normalizeText(monthText)];
    const dateOk = Number.isInteger(year) && year >= 2000 && year <= 2100 && !!monthNumber && monthNumber >= 1 && monthNumber <= 12;
    if (!dateOk) {
      errors.push(`Linha ${n}: ano ou mês inválido ("${yearText}" / "${monthText}").`);
      return;
    }

    // Sem patrimônio: vai para o histórico de danos, sem mexer no estoque.
    if (!patrimony) {
      if (!equipamento) {
        errors.push(`Linha ${n}: informe o equipamento.`);
        return;
      }
      const historyKey = `${normalizeText(equipamento)}|${year}-${String(monthNumber).padStart(2, "0")}`;
      if (data.historyKeys.has(historyKey) || historySeen.has(historyKey)) {
        skippedAlreadyRecorded++;
        return;
      }
      historySeen.add(historyKey);
      const item = data.items.find((i) => i.status === "active" && normalizeText(i.name) === normalizeText(equipamento));
      const collaboratorId = findCollaboratorId(collaboratorName, data.collaborators);
      if (collaboratorName && !collaboratorId) unmatched.add(collaboratorName);
      historyRows.push({
        line: n,
        item_name: equipamento,
        item_id: item?.id ?? null,
        quantity: 1,
        year,
        month: monthNumber,
        reason: reason || null,
        department: department || null,
        collaborator_id: collaboratorId,
        notes: notes || null,
      });
      return;
    }

    const asset = data.assets.find((a) => a.patrimony_number.trim() === patrimony);
    if (!asset) {
      skippedNoAsset++;
      errors.push(`Linha ${n}: patrimônio ${patrimony} não está cadastrado. Cadastre-o na aba Ativos.`);
      return;
    }

    const key = `${asset.id}|${year}-${String(monthNumber).padStart(2, "0")}`;
    if (data.existingDamageKeys.has(key) || seen.has(key)) {
      skippedAlreadyRecorded++;
      return;
    }
    seen.add(key);

    if (collaboratorName && !findCollaboratorId(collaboratorName, data.collaborators)) unmatched.add(collaboratorName);

    rows.push({
      line: n,
      assetId: asset.id,
      itemId: asset.item_id,
      patrimony,
      year,
      month: monthNumber,
      reason: reason || null,
      notes: notes || null,
      department: department || null,
      collaboratorId: findCollaboratorId(collaboratorName, data.collaborators),
      statusFrom: asset.status,
    });
  });

  return {
    rows,
    historyRows,
    skippedNotDamage,
    skippedNoAsset,
    skippedAlreadyRecorded,
    errors,
    unmatchedCollaborators: [...unmatched],
  };
}
