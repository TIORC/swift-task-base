import { describe, it, expect } from "vitest";
import {
  clampPercent,
  computeExecutionPercent,
  progressBand,
  MANUAL_PROGRESS_STEPS,
} from "@/types/automation";

// Regra da barra de "Execução" em /automacoes: a porcentagem é SEMPRE a
// informada pela equipe (manual, 0/25/50/75/100), mesmo quando a automação
// já tem tarefas técnicas — as tarefas ficam só como contador de referência.
describe("computeExecutionPercent", () => {
  it("usa sempre a porcentagem manual informada pela equipe", () => {
    expect(computeExecutionPercent({ progress_percent: 0 })).toBe(0);
    expect(computeExecutionPercent({ progress_percent: 25 })).toBe(25);
    expect(computeExecutionPercent({ progress_percent: 50 })).toBe(50);
    expect(computeExecutionPercent({ progress_percent: 75 })).toBe(75);
    expect(computeExecutionPercent({ progress_percent: 100 })).toBe(100);
  });

  it("zera valores ausentes ou inválidos", () => {
    expect(computeExecutionPercent({ progress_percent: null as unknown as number })).toBe(0);
    expect(computeExecutionPercent({ progress_percent: NaN })).toBe(0);
    expect(computeExecutionPercent({} as { progress_percent: number })).toBe(0);
  });

  it("limita a porcentagem entre 0 e 100", () => {
    expect(clampPercent(150)).toBe(100);
    expect(clampPercent(-20)).toBe(0);
    expect(clampPercent(undefined)).toBe(0);
    expect(clampPercent(NaN)).toBe(0);
    expect(clampPercent(77.6)).toBe(78);
  });
});

// Cores combinadas: 0%/25% vermelho, 50% amarelo, 75%/100% verde forte.
describe("progressBand", () => {
  it("usa vermelho até 25%, amarelo em 50% e verde a partir de 75%", () => {
    expect(progressBand(0)).toBe("low");
    expect(progressBand(25)).toBe("low");
    expect(progressBand(50)).toBe("medium");
    expect(progressBand(75)).toBe("high");
    expect(progressBand(100)).toBe("high");
  });

  it("encaixa valores intermediários na faixa correspondente", () => {
    expect(progressBand(33)).toBe("low");
    expect(progressBand(49)).toBe("low");
    expect(progressBand(66)).toBe("medium");
    expect(progressBand(74)).toBe("medium");
    expect(progressBand(80)).toBe("high");
  });

  it("trata valores ausentes ou inválidos como 0% (vermelho)", () => {
    expect(progressBand(null)).toBe("low");
    expect(progressBand(undefined)).toBe("low");
    expect(progressBand(NaN)).toBe("low");
  });
});

describe("MANUAL_PROGRESS_STEPS", () => {
  it("oferece exatamente 0, 25, 50, 75 e 100 para o desenvolvedor", () => {
    expect([...MANUAL_PROGRESS_STEPS]).toEqual([0, 25, 50, 75, 100]);
  });
});
