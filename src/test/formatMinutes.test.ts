import { describe, it, expect } from "vitest";
import { formatMinutes } from "@/lib/utils";

// Bug relatado em /reports (aba Automações): o KPI "Horas totais" mostrava
// "34h 5.110000000000355m" porque o resto `m % 60` não era arredondado antes.
describe("formatMinutes", () => {
  it("não deixa vazar artefato de ponto flutuante", () => {
    expect(formatMinutes(2045.110000000000355)).toBe("34h 5m");
    expect(formatMinutes(34 * 60 + 5.110000000000355)).toBe("34h 5m");
    expect(formatMinutes(60.000000000000014)).toBe("1h");
    expect(formatMinutes(0.30000000000000004)).toBe("0m");
  });

  it("formata horas e minutos", () => {
    expect(formatMinutes(0)).toBe("0m");
    expect(formatMinutes(45)).toBe("45m");
    expect(formatMinutes(59.6)).toBe("1h");
    expect(formatMinutes(60)).toBe("1h");
    expect(formatMinutes(61)).toBe("1h 1m");
    expect(formatMinutes(2045)).toBe("34h 5m");
  });

  it("protege contra valores inválidos ou negativos", () => {
    expect(formatMinutes(NaN)).toBe("0m");
    expect(formatMinutes(Infinity)).toBe("0m");
    expect(formatMinutes(-120)).toBe("0m");
    expect(formatMinutes(null as unknown as number)).toBe("0m");
    expect(formatMinutes(undefined as unknown as number)).toBe("0m");
  });

  it("soma os registros de duration_minutes sem errar o total", () => {
    // Cenário real: soma de várias linhas fracionárias de automation_time_logs
    const logs = [12.4, 3.7, 120.51, 1898.5, 10.0];
    const total = logs.reduce((s, n) => s + n, 0);
    expect(formatMinutes(total)).toBe("34h 5m");
  });
});