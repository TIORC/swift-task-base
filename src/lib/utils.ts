import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata minutos como "34h 5m" (ou "45m" abaixo de 1h).
 *
 * `duration_minutes` é fracionário e a soma de vários registros acumula erro de
 * ponto flutuante (ex.: 2045.110000000000355), então o total é arredondado
 * ANTES de dividir — senão o resto (`m % 60`) vaza o artefato para a tela
 * (já aconteceu: "34h 5.110000000000355m").
 */
export function formatMinutes(minutes: number): string {
  const raw = Number(minutes);
  const total = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
