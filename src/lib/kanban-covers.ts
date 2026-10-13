import type { CSSProperties } from "react";

// Capas de cor/gradiente das tarefas do Kanban (a chave é gravada em kanban_tasks.cover_preset).
export const KANBAN_COVER_PRESETS: { key: string; label: string; background: string }[] = [
  { key: "blue", label: "Azul", background: "linear-gradient(135deg, #1e3a8a, #3b82f6)" },
  { key: "green", label: "Verde", background: "linear-gradient(135deg, #14532d, #22c55e)" },
  { key: "purple", label: "Roxo", background: "linear-gradient(135deg, #4c1d95, #a855f7)" },
  { key: "orange", label: "Laranja", background: "linear-gradient(135deg, #9a3412, #f97316)" },
  { key: "pink", label: "Rosa", background: "linear-gradient(135deg, #9d174d, #ec4899)" },
  { key: "teal", label: "Verde-azulado", background: "linear-gradient(135deg, #134e4a, #14b8a6)" },
  { key: "red", label: "Vermelho", background: "linear-gradient(135deg, #7f1d1d, #ef4444)" },
  { key: "slate", label: "Grafite", background: "linear-gradient(135deg, #1e293b, #64748b)" },
];

export function coverPresetStyle(key: string | null | undefined): CSSProperties | null {
  const preset = KANBAN_COVER_PRESETS.find((p) => p.key === key);
  return preset ? { background: preset.background } : null;
}
