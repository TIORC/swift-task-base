import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  useInventoryItems, useSaveItemsPlan, type InventoryCategory, type InventoryItem,
} from "@/hooks/useInventory";

// Cadastro de itens em massa: cola-se uma lista (ex.: copiada do Excel) e a prévia mostra o que será gravado.
// Nome repetido não vira item novo: linhas repetidas da lista se juntam num só item, e um item que já
// existe no estoque (mesmo nome) recebe a quantidade somada.

export interface BulkItemRow {
  name: string;
  category_id: string | null;
  brand: string | null;
  model: string | null;
  unit_price: number;
  quantity: number;
}

export interface BulkPlan {
  create: BulkItemRow[];
  add: { id: string; name: string; quantity: number; newQuantity: number }[];
  mergedLines: number; // linhas da lista que foram unidas a outra da mesma lista
  errors: string[];
}

const HEADER_NAME = "nome";

// Mesmo nome = mesmo item: sem acento, sem diferença de maiúsculas e com espaços normalizados.
const nameKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();

export function buildBulkPlan(text: string, categories: InventoryCategory[], existing: InventoryItem[]): BulkPlan {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trimEnd()).filter((l) => l.trim() !== "");
  const grouped = new Map<string, BulkItemRow>();
  let mergedLines = 0;

  lines.forEach((line, index) => {
    // Tab (colar do Excel) ou ponto e vírgula; a primeira coluna é o nome.
    const cells = (line.includes("\t") ? line.split("\t") : line.split(";")).map((c) => c.trim());
    if (index === 0 && cells[0].toLowerCase() === HEADER_NAME) return; // cabeçalho opcional

    const n = index + 1;
    const [name = "", categoryName = "", brand = "", model = "", priceText = "", qtyText = ""] = cells;
    if (!name) {
      errors.push(`Linha ${n}: informe o nome do item.`);
      return;
    }

    let categoryId: string | null = null;
    if (categoryName) {
      const found = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
      if (!found) {
        errors.push(`Linha ${n}: a categoria "${categoryName}" não existe. Cadastre-a antes.`);
        return;
      }
      categoryId = found.id;
    }

    // Aceita "3500", "3500,90" e "3.500,90" (formato brasileiro).
    const normalizedPrice = priceText.includes(",") ? priceText.replace(/\./g, "").replace(",", ".") : priceText;
    const unitPrice = normalizedPrice === "" ? 0 : Number(normalizedPrice);
    if (Number.isNaN(unitPrice) || unitPrice < 0) {
      errors.push(`Linha ${n}: valor unitário inválido ("${priceText}").`);
      return;
    }

    const quantity = qtyText === "" ? 0 : Math.trunc(Number(qtyText));
    if (Number.isNaN(quantity) || quantity < 0) {
      errors.push(`Linha ${n}: quantidade inválida ("${qtyText}").`);
      return;
    }

    const key = nameKey(name);
    const previous = grouped.get(key);
    if (previous) {
      // Repetido na própria lista: soma a quantidade e completa o que estiver vazio.
      mergedLines++;
      previous.quantity += quantity;
      previous.unit_price = previous.unit_price || unitPrice;
      previous.category_id = previous.category_id ?? categoryId;
      previous.brand = previous.brand ?? (brand || null);
      previous.model = previous.model ?? (model || null);
      return;
    }
    grouped.set(key, { name, category_id: categoryId, brand: brand || null, model: model || null, unit_price: unitPrice, quantity });
  });

  const create: BulkItemRow[] = [];
  const add: BulkPlan["add"] = [];
  grouped.forEach((row, key) => {
    const current = existing.find((i) => i.status === "active" && nameKey(i.name) === key);
    if (!current) {
      create.push(row);
      return;
    }
    if (row.quantity > 0) {
      add.push({ id: current.id, name: current.name, quantity: row.quantity, newQuantity: current.quantity + row.quantity });
    }
  });

  return { create, add, mergedLines, errors };
}

export function ItemsBulkCard({ categories }: { categories: InventoryCategory[] }) {
  const [text, setText] = useState("");
  const { data: items = [] } = useInventoryItems();
  const savePlan = useSaveItemsPlan();
  const plan = useMemo(() => buildBulkPlan(text, categories, items), [text, categories, items]);
  const total = plan.create.length + plan.add.length;

  const save = async () => {
    try {
      await savePlan.mutateAsync({
        create: plan.create,
        add: plan.add.map((a) => ({ id: a.id, quantity: a.newQuantity })),
      });
      setText("");
    } catch {
      /* erro já exibido pelo hook */
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Package className="h-4 w-4" /> Itens em massa</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Um item por linha. Colunas separadas por ponto e vírgula ou Tab (dá para colar direto do Excel):
          <b> Nome; Categoria; Marca; Modelo; Valor unitário; Quantidade</b>. Só o nome é obrigatório.
          A categoria precisa existir antes. Nomes repetidos não viram item novo: se o item já existe no estoque,
          a quantidade é somada a ele; se a lista repete o nome, as linhas se juntam num item só.
        </p>
        <Textarea
          rows={7}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Notebook Dell;Computador;Dell;Latitude 5420;3500;2\nMouse USB;Periférico;Logitech;M90;45,90;10"}
        />
        {plan.errors.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
            {plan.errors.map((e) => <p key={e}>{e}</p>)}
          </div>
        )}
        {plan.add.length > 0 && (
          <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground">Já existem no estoque (quantidade somada):</p>
            {plan.add.map((a) => <p key={a.id}>{a.name}: +{a.quantity} → total {a.newQuantity}</p>)}
          </div>
        )}
        {plan.mergedLines > 0 && (
          <p className="text-xs text-muted-foreground">{plan.mergedLines} linha(s) repetida(s) na lista foram unidas aos itens anteriores.</p>
        )}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">
            {plan.create.length} item(ns) novo(s)
            {plan.add.length > 0 ? ` · ${plan.add.length} somado(s) a existente(s)` : ""}
            {plan.errors.length > 0 ? ` · ${plan.errors.length} erro(s) na lista` : ""}
          </span>
          <Button size="sm" onClick={save} disabled={total === 0 || plan.errors.length > 0 || savePlan.isPending}>
            {savePlan.isPending ? "Cadastrando…" : `Cadastrar ${total} item(ns)`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
