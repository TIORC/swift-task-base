// Setores da empresa para vinculação de automações e usuários
export const SECTORS = [
  "DP",
  "DF",
  "DC",
  "DS",
  "Comercial",
  "Qualidade",
  "SC",
  "RH",
  "M7",
  "BPO",
  "TI",
] as const;

export type Sector = (typeof SECTORS)[number];

export const SECTOR_LABELS: Record<string, string> = {
  DP: "DP",
  DF: "DF",
  DC: "DC",
  DS: "DS",
  Comercial: "Comercial",
  Qualidade: "Qualidade",
  SC: "SC",
  RH: "RH",
  M7: "M7",
  BPO: "BPO",
  TI: "TI",
};

export const SECTOR_COLORS: Record<string, string> = {
  DP: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  DF: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  DC: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  DS: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  Comercial: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  Qualidade: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
  SC: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20",
  RH: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  M7: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
  BPO: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  TI: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
};
