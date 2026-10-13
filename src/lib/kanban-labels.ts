import { firstNameKey } from "@/hooks/useKanbanTasks";

// Etiquetas fixas por pessoa (casam pelo primeiro nome, sem acento e sem maiúscula).
const PERSON_LABELS: Record<string, { bg: string; text: string }> = {
  gabriel: { bg: "#0747a6", text: "#ffffff" },
  welder: { bg: "#61bd4f", text: "#000000" },
  angel: { bg: "#ffab4a", text: "#000000" },
  sofia: { bg: "#ff8ed4", text: "#000000" },
};
const DEFAULT_LABEL = { bg: "#6b7280", text: "#ffffff" };

export const labelFor = (fullName: string) => PERSON_LABELS[firstNameKey(fullName)] ?? DEFAULT_LABEL;
