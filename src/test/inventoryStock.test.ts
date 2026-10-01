import { describe, it, expect } from "vitest";
import { agruparPorTipo, baseDoTipo, tipoDoItem } from "@/lib/inventory-stock";
import type { InventoryItem } from "@/hooks/useInventory";

let seq = 0;

function item(over: Partial<InventoryItem>): InventoryItem {
  seq += 1;
  return {
    id: `item-${seq}`,
    name: "Item",
    brand: null,
    status: "active",
    quantity: 0,
    in_use_quantity: 0,
    damaged_quantity: 0,
    discarded_quantity: 0,
    min_stock: 0,
    unit_price: 0,
    ...over,
  } as InventoryItem;
}

// Aba "Estoque" do /almoxarifado: "Monitor LG" e "Monitor Multilaser" são o
// mesmo tipo de produto e viram UMA linha com a soma das quantidades.
describe("tipoDoItem", () => {
  it("remove a marca do próprio item quando ela é sufixo do nome", () => {
    expect(tipoDoItem({ name: "Monitor LG", brand: "LG" })).toBe("Monitor");
    expect(tipoDoItem({ name: "Monitor Multilaser", brand: "Multilaser" })).toBe("Monitor");
  });

  it("aceita espaço, hífen e barra como separador da marca", () => {
    expect(tipoDoItem({ name: "Monitor-LG", brand: "LG" })).toBe("Monitor");
    expect(tipoDoItem({ name: "Monitor / Dell", brand: "Dell" })).toBe("Monitor");
  });

  it("limpa separadores sobrando antes da marca", () => {
    expect(tipoDoItem({ name: "Monitor - LG", brand: "LG" })).toBe("Monitor");
  });

  it("ignora caixa e acentos ao comparar nome com marca", () => {
    expect(tipoDoItem({ name: "Monitor SAMSUNG", brand: "samsung" })).toBe("Monitor");
    expect(tipoDoItem({ name: "Café Expresso", brand: "Café" })).toBe("Café Expresso");
  });

  it("não corta quando a marca não é sufixo do nome", () => {
    expect(tipoDoItem({ name: "Cabo HDMI", brand: "LG" })).toBe("Cabo HDMI");
    expect(tipoDoItem({ name: "Monitor Multilaser Pro", brand: "Multilaser" })).toBe("Monitor Multilaser Pro");
  });

  it("não corta quando a marca aparece no meio do nome", () => {
    expect(tipoDoItem({ name: "Monitor LG 24", brand: "LG" })).toBe("Monitor LG 24");
  });

  it("mantém o nome inteiro quando não há marca informada", () => {
    expect(tipoDoItem({ name: "Monitor LG", brand: null })).toBe("Monitor LG");
    expect(tipoDoItem({ name: "Monitor LG", brand: "   " })).toBe("Monitor LG");
  });

  it("não devolve string vazia quando o nome é só a marca", () => {
    expect(tipoDoItem({ name: "LG", brand: "LG" })).toBe("LG");
  });
});

describe("agruparPorTipo", () => {
  it("funda Monitor LG e Monitor Multilaser em uma linha com a soma", () => {
    const rows = agruparPorTipo([
      item({ name: "Monitor LG", brand: "LG", quantity: 4 }),
      item({ name: "Monitor Multilaser", brand: "Multilaser", quantity: 3 }),
    ]);

    expect(rows).toEqual([{ tipo: "Monitor", quantidade: 7 }]);
  });

  it("soma apenas disponíveis + em uso, sem contar danificados nem descartados", () => {
    const [row] = agruparPorTipo([
      item({ name: "Monitor LG", brand: "LG", quantity: 4, in_use_quantity: 3, damaged_quantity: 9, discarded_quantity: 5 }),
      item({ name: "Monitor Samsung", brand: "Samsung", quantity: 2, in_use_quantity: 0, damaged_quantity: 1 }),
    ]);

    expect(row).toEqual({ tipo: "Monitor", quantidade: 9 });
  });

  it("funde tipos que só diferem em caixa ou acento", () => {
    const rows = agruparPorTipo([
      item({ name: "Teclado Mecanico", quantity: 1 }),
      item({ name: "teclado  Mecanico", quantity: 2 }),
      item({ name: "Café", quantity: 4 }),
      item({ name: "cafe", quantity: 1 }),
    ]);

    expect(rows).toEqual([
      { tipo: "Café", quantidade: 5 },
      { tipo: "Teclado Mecanico", quantidade: 3 },
    ]);
  });

  it("mantém o tipo zerado na lista", () => {
    const rows = agruparPorTipo([
      item({ name: "Monitor LG", brand: "LG", quantity: 0 }),
      item({ name: "Teclado", quantity: 6 }),
    ]);

    expect(rows).toContainEqual({ tipo: "Monitor", quantidade: 0 });
  });

  it("ignora itens inativos", () => {
    const rows = agruparPorTipo([
      item({ name: "Monitor LG", brand: "LG", quantity: 4 }),
      item({ name: "Monitor Antigo", brand: "Antigo", quantity: 7, status: "inactive" }),
    ]);

    expect(rows).toEqual([{ tipo: "Monitor", quantidade: 4 }]);
  });

  it("ordena os tipos alfabeticamente", () => {
    const rows = agruparPorTipo([
      item({ name: "Teclado", quantity: 1 }),
      item({ name: "Adaptador", quantity: 1 }),
      item({ name: "Monitor", quantity: 1 }),
    ]);

    expect(rows.map((r) => r.tipo)).toEqual(["Adaptador", "Monitor", "Teclado"]);
  });

  it("aceita item sem nome e devolve traço", () => {
    expect(agruparPorTipo([item({ name: "", quantity: 1 })])).toEqual([{ tipo: "—", quantidade: 1 }]);
  });

  it("devolve lista vazia sem itens", () => {
    expect(agruparPorTipo([])).toEqual([]);
  });
});

// Sem o campo `brand` preenchido no banco, o agrupamento se apoia no nome:
// "Monitor" é prefixo de palavra de "Monitor LG" e "Monitor Multilaser",
// então os três viram uma linha só.
describe("baseDoTipo", () => {
  const nomes = ["Monitor", "Monitor LG", "Monitor Multilaser"];

  it("agrupa no nome mais curto que é prefixo de palavra", () => {
    expect(baseDoTipo("Monitor LG", nomes)).toBe("Monitor");
    expect(baseDoTipo("Monitor Multilaser", nomes)).toBe("Monitor");
    expect(baseDoTipo("Monitor", nomes)).toBe("Monitor");
  });

  it("prefere o prefixo mais curto quando há vários níveis", () => {
    const cadeias = ["Teclado", "Teclado Mecanico", "Teclado Mecanico ABNT2"];
    expect(cadeias.map((n) => baseDoTipo(n, cadeias))).toEqual([
      "Teclado",
      "Teclado",
      "Teclado",
    ]);
  });

  it("não funde quando não há separador de palavra", () => {
    expect(baseDoTipo("Mousepad", ["Mouse", "Mousepad"])).toBe("Mousepad");
    expect(baseDoTipo("Monitor", ["Monitor"])).toBe("Monitor");
  });

  it("funde ignorando caixa e acento", () => {
    expect(baseDoTipo("monitor dell", ["Monitor", "monitor dell"])).toBe("Monitor");
  });
});

describe("agruparPorTipo — unificação por prefixo", () => {
  it("junta Monitor, Monitor LG e Monitor Multilaser em uma linha", () => {
    const rows = agruparPorTipo([
      item({ name: "Monitor", quantity: 2 }),
      item({ name: "Monitor LG", quantity: 4 }),
      item({ name: "Monitor Multilaser", quantity: 3 }),
    ]);

    expect(rows).toEqual([{ tipo: "Monitor", quantidade: 9 }]);
  });

  it("mantém a soma por tipo mesmo com marca preenchida em uns e vazia em outros", () => {
    const rows = agruparPorTipo([
      item({ name: "Monitor", quantity: 2 }),
      item({ name: "Monitor LG", brand: "LG", quantity: 4 }),
      item({ name: "Monitor Multilaser", quantity: 3 }),
    ]);

    expect(rows).toEqual([{ tipo: "Monitor", quantidade: 9 }]);
  });

  it("conta em uso e ignora danificado na linha unificada", () => {
    const rows = agruparPorTipo([
      item({ name: "Monitor", quantity: 1, in_use_quantity: 2, damaged_quantity: 7 }),
      item({ name: "Monitor LG", quantity: 3, damaged_quantity: 4 }),
    ]);

    expect(rows).toEqual([{ tipo: "Monitor", quantidade: 6 }]);
  });

  it("não funde tipos sem âncora em comum", () => {
    const rows = agruparPorTipo([
      item({ name: "Cabo HDMI", quantity: 5 }),
      item({ name: "Cabo de rede", quantity: 2 }),
    ]);

    expect(rows).toEqual([
      { tipo: "Cabo de rede", quantidade: 2 },
      { tipo: "Cabo HDMI", quantidade: 5 },
    ]);
  });

  it("funde só a família do tipo âncora e mantém os outros ao lado", () => {
    const rows = agruparPorTipo([
      item({ name: "Monitor", quantity: 0 }),
      item({ name: "Monitor LG", quantity: 4 }),
      item({ name: "Monitor Multilaser", quantity: 3 }),
      item({ name: "Teclado Mecanico", quantity: 6 }),
    ]);

    expect(rows).toEqual([
      { tipo: "Monitor", quantidade: 7 },
      { tipo: "Teclado Mecanico", quantidade: 6 },
    ]);
  });
});