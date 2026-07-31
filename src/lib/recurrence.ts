export const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export const MONTH_FULL = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

/** Frequências que dependem de dia do mês / meses do ano. */
export const MONTH_BASED = ["monthly", "bimonthly", "quarterly", "semiannual", "annual"];

export function isMonthBased(type: string | null | undefined) {
  return !!type && MONTH_BASED.includes(type);
}

/** Combinações fixas de meses por frequência. */
export const MONTH_PRESETS: Record<string, { label: string; months: number[] }[]> = {
  bimonthly: [
    { label: "Jan, Mar, Mai, Jul, Set, Nov", months: [1, 3, 5, 7, 9, 11] },
    { label: "Fev, Abr, Jun, Ago, Out, Dez", months: [2, 4, 6, 8, 10, 12] },
  ],
  quarterly: [
    { label: "Jan, Abr, Jul, Out", months: [1, 4, 7, 10] },
    { label: "Fev, Mai, Ago, Nov", months: [2, 5, 8, 11] },
    { label: "Mar, Jun, Set, Dez", months: [3, 6, 9, 12] },
  ],
  semiannual: [
    { label: "Jan, Jul", months: [1, 7] },
    { label: "Fev, Ago", months: [2, 8] },
    { label: "Mar, Set", months: [3, 9] },
    { label: "Abr, Out", months: [4, 10] },
    { label: "Mai, Nov", months: [5, 11] },
    { label: "Jun, Dez", months: [6, 12] },
  ],
};

export function monthsLabel(months: number[] | null | undefined): string {
  if (!months || months.length === 0) return "Todos os meses";
  return months.slice().sort((a, b) => a - b).map((m) => MONTH_LABELS[m - 1]).join(", ");
}

/**
 * Ajusta um dia do mês para dia útil, sem sair do mês.
 * direction 'next' empurra para frente; 'previous' puxa para trás.
 * Se o ajuste sair do mês, inverte o sentido.
 */
export function adjustToBusinessDayInMonth(
  year: number,
  month1: number,
  day: number,
  direction: "next" | "previous",
): number {
  const lastDay = new Date(year, month1, 0).getDate();
  let d = Math.min(Math.max(1, day), lastDay);
  const isWeekend = (dd: number) => {
    const w = new Date(year, month1 - 1, dd).getDay();
    return w === 0 || w === 6;
  };
  const step = direction === "next" ? 1 : -1;
  let cur = d;
  while (isWeekend(cur)) {
    cur += step;
    if (cur < 1 || cur > lastDay) {
      // inverte sem passar do mês
      cur = d;
      const back = -step;
      while (isWeekend(cur)) cur += back;
      break;
    }
  }
  return cur;
}
