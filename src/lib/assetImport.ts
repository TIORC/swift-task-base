import type {
  AssetStatus, InventoryAsset, InventoryCategory, InventoryCollaborator, InventoryItem,
} from "@/hooks/useInventory";

// Importação de ativos em massa (colar da planilha da aba Ativos).
// Colunas: Ativo; Categoria; Patrimônio; Status; Descrição; Departamento; Colaborador Responsável; Histórico; Observação.
// Histórico e Observação não entram: o histórico vem das movimentações e a observação não é gravada pelo lote.

export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const STATUS_BY_TEXT: Record<string, AssetStatus> = {
  "em uso": "in_use",
  "disponivel": "available",
  "danificado": "damaged",
  "descartado": "discarded",
  "manutencao": "maintenance",
};

export interface ImportAssetRow {
  line: number;
  patrimony: string;
  status: AssetStatus;
  department: string | null;
  collaboratorId: string | null;
  itemId: string | null; // item já cadastrado
  newItemKey: string | null; // item que será criado (chave normalizada do nome)
}

export interface NewItemToCreate {
  key: string;
  name: string;
  category_id: string | null;
  description: string | null;
}

export interface AssetImportPlan {
  rows: ImportAssetRow[];
  newItems: NewItemToCreate[];
  skippedNoPatrimony: number;
  errors: string[];
  // Nomes de colaborador que não foram encontrados: o ativo entra sem responsável.
  unmatchedCollaborators: string[];
}

interface PlanData {
  items: InventoryItem[];
  categories: InventoryCategory[];
  collaborators: InventoryCollaborator[];
  assets: InventoryAsset[];
}

function findCollaboratorId(text: string, collaborators: InventoryCollaborator[]): { id: string | null; notFound?: boolean } {
  const key = normalizeText(text);
  if (!key) return { id: null };
  const exact = collaborators.find((c) => normalizeText(c.full_name) === key);
  if (exact) return { id: exact.id };
  // Só o primeiro nome (ex.: "Lucas"), quando for único.
  const byFirstName = collaborators.filter((c) => normalizeText(c.full_name).split(" ")[0] === key);
  if (byFirstName.length === 1) return { id: byFirstName[0].id };
  return { id: null, notFound: true };
}

export function buildAssetImportPlan(text: string, data: PlanData): AssetImportPlan {
  const errors: string[] = [];
  const rows: ImportAssetRow[] = [];
  const newItems = new Map<string, NewItemToCreate>();
  const usedPatrimony = new Set(data.assets.map((a) => a.patrimony_number.trim()));
  let skippedNoPatrimony = 0;
  const unmatchedCollaborators = new Set<string>();

  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  lines.forEach((line, index) => {
    const cells = (line.includes("\t") ? line.split("\t") : line.split(";")).map((c) => c.trim());
    if (index === 0 && normalizeText(cells[0] ?? "") === "ativo") return; // cabeçalho

    const n = index + 1;
    const [name = "", categoryName = "", patrimony = "", statusText = "", description = "", department = "", collaboratorName = ""] = cells;
    if (!name) {
      errors.push(`Linha ${n}: informe o nome do ativo.`);
      return;
    }
    // Sem número de patrimônio não é ativo (ex.: periféricos sem etiqueta): fica de fora sem erro.
    if (!patrimony) {
      skippedNoPatrimony++;
      return;
    }
    if (usedPatrimony.has(patrimony)) {
      errors.push(`Linha ${n}: o patrimônio ${patrimony} já está cadastrado ou repetido na lista.`);
      return;
    }

    const status: AssetStatus | undefined = statusText.trim() === "" ? "available" : STATUS_BY_TEXT[normalizeText(statusText)];
    if (!status) {
      errors.push(`Linha ${n}: status "${statusText}" não reconhecido (use Em Uso, Disponível, Danificado, Descartado ou Manutenção).`);
      return;
    }

    const collaborator = findCollaboratorId(collaboratorName, data.collaborators);
    if (collaborator.notFound) unmatchedCollaborators.add(collaboratorName.trim());

    const key = normalizeText(name);
    const existingItem = data.items.find((i) => i.status === "active" && normalizeText(i.name) === key);
    let itemId: string | null = null;
    let newItemKey: string | null = null;
    if (existingItem) {
      itemId = existingItem.id;
    } else {
      let categoryId: string | null = null;
      if (categoryName) {
        const category = data.categories.find((c) => normalizeText(c.name) === normalizeText(categoryName));
        if (!category) {
          errors.push(`Linha ${n}: categoria "${categoryName}" não existe. Cadastre-a antes.`);
          return;
        }
        categoryId = category.id;
      }
      if (!newItems.has(key)) {
        newItems.set(key, { key, name, category_id: categoryId, description: description || null });
      }
      newItemKey = key;
    }

    usedPatrimony.add(patrimony);
    rows.push({
      line: n,
      patrimony,
      status,
      department: department || null,
      collaboratorId: collaborator.id,
      itemId,
      newItemKey,
    });
  });

  return {
    rows,
    newItems: [...newItems.values()],
    skippedNoPatrimony,
    errors,
    unmatchedCollaborators: [...unmatchedCollaborators],
  };
}
