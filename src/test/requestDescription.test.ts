import { describe, it, expect } from "vitest";
import { parseRequestDescription } from "@/components/automations/RequestDescription";

describe("parseRequestDescription", () => {
  it("separa seções, perguntas (rótulos) e respostas (valores)", () => {
    const text = [
      "Alteração solicitada por Jonathas Braga:",
      "1. Identificação e objetivo",
      "Manutenção do sistema: DC - FOLHA DE ROSTO",
      "Nome da rotina: Processo de duas etapas",
      "Quem executa e valida:",
      "Problema a resolver:",
      "",
      "2. Como a rotina funciona hoje?",
      "Gatilhos: Manual",
      "Processo passo a passo: 1. Abrir o sistema",
      "2. Conferir os dados",
    ].join("\n");

    const [intro, ident, how] = parseRequestDescription(text);

    expect(intro.title).toBeNull();
    expect(intro.notes).toEqual(["Alteração solicitada por Jonathas Braga:"]);

    expect(ident.title).toBe("1. Identificação e objetivo");
    expect(ident.fields).toEqual([
      { label: "Manutenção do sistema", value: "DC - FOLHA DE ROSTO" },
      { label: "Nome da rotina", value: "Processo de duas etapas" },
      { label: "Quem executa e valida", value: "" },
      { label: "Problema a resolver", value: "" },
    ]);

    expect(how.title).toBe("2. Como a rotina funciona hoje?");
    expect(how.fields).toEqual([
      { label: "Gatilhos", value: "Manual" },
      { label: "Processo passo a passo", value: "1. Abrir o sistema\n2. Conferir os dados" },
    ]);
  });

  it("não trata itens numerados ou 'Rótulo: ...' comuns como seções ou perguntas", () => {
    const [section] = parseRequestDescription("Problema a resolver: primeiro\n3. Passo solto\nObs: nota livre");

    expect(section.fields).toEqual([{ label: "Problema a resolver", value: "primeiro\n3. Passo solto\nObs: nota livre" }]);
  });

  it("retorna vazio para texto vazio", () => {
    expect(parseRequestDescription("")).toEqual([]);
  });
});
