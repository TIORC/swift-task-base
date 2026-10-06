import type { InventoryItem } from "@/hooks/useInventory";

export interface StockGroup {
  tipo: string;
  quantidade: number;
}

export interface StockGroupDetail extends StockGroup {
  itens: InventoryItem[];
}

const deaccent = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const norm = (s: string) => deaccent(s).toLowerCase();

const key = (s: string) => norm(s).trim().replace(/\s+/g, " ");

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function tipoDoItem(item: { name: string | null; brand?: string | null }): string {
  const name = (item.name ?? "").trim();
  const brand = (item.brand ?? "").trim();
  if (!name || !brand) return name;

  const normBrand = norm(brand).trim();
  if (!normBrand) return name;

  const matches = new RegExp(`(?:^|[\\s\\-_/])${escapeRegExp(normBrand)}$`).test(norm(name));
  if (!matches) return name;

  const base = name.slice(0, name.length - brand.length).replace(/[\s\-_/]+$/, "").trim();
  return base || name;
}

function temPrefixoDePalavra(nome: string, prefixo: string): boolean {
  if (prefixo.length >= nome.length) return false;
  if (!/[\s\-_/]/.test(nome.charAt(prefixo.length))) return false;
  return norm(nome).slice(0, prefixo.length) === norm(prefixo);
}

export function baseDoTipo(nome: string, nomes: string[]): string {
  let base = nome;
  for (const candidato of nomes) {
    if (candidato.length < base.length && temPrefixoDePalavra(nome, candidato)) base = candidato;
  }
  return base;
}

const primeiraPalavra = (nome: string) => (nome.trim().split(/[\s\-_/]+/)[0] || "—");

const chaveDaPalavra = (p: string) => key(p).replace(/s$/, "").replace(/e$/, "");

const capitalizar = (p: string) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();

export function resumoEstoque(items: InventoryItem[]): StockGroupDetail[] {
  const ativos = items.filter((i) => i.status === "active");
  const byType = new Map<string, StockGroupDetail>();

  ativos.forEach((item) => {
    const palavra = primeiraPalavra(item.name ?? "");
    const k = chaveDaPalavra(palavra);
    const quantidade = (item.quantity ?? 0) + (item.in_use_quantity ?? 0);
    const existing = byType.get(k);
    if (existing) {
      existing.quantidade += quantidade;
      existing.itens.push(item);
      if (palavra.length < existing.tipo.length) existing.tipo = capitalizar(palavra);
    } else {
      byType.set(k, { tipo: capitalizar(palavra), quantidade, itens: [item] });
    }
  });

  return [...byType.values()].sort((a, b) => a.tipo.localeCompare(b.tipo, "pt-BR"));
}

export function agruparPorTipo(items: InventoryItem[]): StockGroup[] {
  return resumoEstoque(items).map(({ tipo, quantidade }) => ({ tipo, quantidade }));
}