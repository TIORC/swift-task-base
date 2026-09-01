export type SmNature = "comercial" | "onboarding" | "recorrente" | "avulsa";

export const SM_NATURE_LABEL: Record<SmNature, string> = {
  comercial: "Comercial",
  onboarding: "Onboarding",
  recorrente: "Recorrente",
  avulsa: "Avulsa",
};

export const SM_NATURE_CLS: Record<SmNature, string> = {
  comercial: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  onboarding: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  recorrente: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  avulsa: "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

export const SM_NATURES: SmNature[] = ["comercial", "onboarding", "recorrente", "avulsa"];

/** Funil Comercial & Onboarding (etapas gravadas em sm_tasks.stage) */
export type SmCommercialStage =
  | "diagnostico"
  | "proposta"
  | "contrato"
  | "onboarding"
  | "onboarding_concluido";

export const SM_COMMERCIAL_STAGES: { key: SmCommercialStage; label: string; next?: SmCommercialStage; nextLabel?: string }[] = [
  { key: "diagnostico", label: "Diagnóstico", next: "proposta", nextLabel: "Proposta Enviada" },
  { key: "proposta", label: "Proposta Enviada", next: "contrato", nextLabel: "Contrato Assinado" },
  { key: "contrato", label: "Contrato Assinado", next: "onboarding", nextLabel: "Onboarding em Andamento" },
  { key: "onboarding", label: "Onboarding em Andamento", next: "onboarding_concluido", nextLabel: "Onboarding Concluído" },
  { key: "onboarding_concluido", label: "Onboarding Concluído" },
];

export const SM_COMMERCIAL_STAGE_LABEL = Object.fromEntries(
  SM_COMMERCIAL_STAGES.map((s) => [s.key, s.label])
) as Record<SmCommercialStage, string>;

/** Funis das demais naturezas (usados como colunas no Kanban de demandas) */
export const SM_RECURRING_STAGES = [
  { key: "roteiro", label: "Roteiro/Ideia" },
  { key: "producao", label: "Produção" },
  { key: "edicao", label: "Edição" },
  { key: "aprovacao", label: "Aprovação" },
  { key: "publicado", label: "Publicado" },
];

export const SM_ADHOC_STAGES = [
  { key: "solicitado", label: "Solicitado" },
  { key: "execucao", label: "Em execução" },
  { key: "aprovacao", label: "Aprovação" },
  { key: "entregue", label: "Entregue" },
];

/** Checklist padrão de onboarding (30 dias) */
export const SM_ONBOARDING_CHECKLIST = [
  "Acesso às redes sociais (login, senha e ID)",
  "Dados cadastrais e contatos do cliente",
  "Briefing inicial com o cliente",
  "Definição de temas e formatos",
  "Gravação inicial de conteúdo",
];

export const SM_DISCARD_REASONS = [
  "Cancelado pelo cliente",
  "Duplicidade",
  "Não é mais necessária",
  "Fora de escopo",
  "Outro",
];

export const SM_BILLABLE_OPTIONS = [
  { key: "cobravel", label: "Cobrável (orçamento à parte)" },
  { key: "interna", label: "Interna (sem cobrança)" },
];

export const SM_DEFAULT_SLA_HOURS: Record<string, number> = {
  urgent: 4,
  high: 24,
  medium: 72,
  low: 168,
};

export function slaDeadline(createdAt: string, priority: string, config?: Record<string, number>) {
  const hours = (config ?? SM_DEFAULT_SLA_HOURS)[priority] ?? SM_DEFAULT_SLA_HOURS.medium;
  return new Date(new Date(createdAt).getTime() + hours * 3600_000);
}

export function slaLabel(createdAt: string, priority: string, config?: Record<string, number>) {
  const target = slaDeadline(createdAt, priority, config);
  const diffMs = target.getTime() - Date.now();
  const overdue = diffMs < 0;
  const abs = Math.abs(diffMs);
  const h = Math.floor(abs / 3600_000);
  const text = h < 24 ? `${Math.max(h, 1)}h` : `${Math.floor(h / 24)}d`;
  return { overdue, text: overdue ? `SLA estourado há ${text}` : `SLA vence em ${text}` };
}
