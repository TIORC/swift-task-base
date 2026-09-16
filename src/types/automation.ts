export const AUTOMATION_STATUSES = [
  "requested",
  "backlog",
  "analysis",
  "waiting_info",
  "approved",
  "development",
  "internal_testing",
  "homologation",
  "change_requested",
  "waiting_user",
  "completed",
  "blocked",
  "cancelled",
] as const;

export type AutomationStatus = (typeof AUTOMATION_STATUSES)[number];

export const STATUS_LABELS: Record<AutomationStatus, string> = {
  requested: "Solicitada",
  backlog: "Backlog",
  analysis: "Em análise",
  waiting_info: "Aguardando informações",
  approved: "Aprovada",
  development: "Em desenvolvimento",
  internal_testing: "Em testes",
  homologation: "Aguardando validação",
  change_requested: "Alteração solicitada",
  waiting_user: "Aguardando Usuário",
  completed: "Concluída",
  blocked: "Bloqueado",
  cancelled: "Cancelada",
};

// Pending reasons shown when an automation moves to "Pendente"
export const PENDING_REASONS = ["purchase", "approval", "sector", "system"] as const;
export type PendingReason = (typeof PENDING_REASONS)[number];
export const PENDING_REASON_LABELS: Record<PendingReason, string> = {
  purchase: "Compra",
  approval: "Aprovação",
  sector: "Setor",
  system: "Sistema",
};

export const STATUS_COLORS: Record<AutomationStatus, string> = {
  backlog: "bg-muted text-muted-foreground",
  analysis: "bg-blue-500/10 text-blue-500",
  requested: "bg-sky-500/10 text-sky-500",
  waiting_info: "bg-yellow-500/10 text-yellow-600",
  approved: "bg-teal-500/10 text-teal-500",
  change_requested: "bg-rose-500/10 text-rose-500",
  development: "bg-indigo-500/10 text-indigo-500",
  internal_testing: "bg-amber-500/10 text-amber-500",
  homologation: "bg-purple-500/10 text-purple-500",
  waiting_user: "bg-orange-500/10 text-orange-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  blocked: "bg-red-500/10 text-red-500",
  cancelled: "bg-muted text-muted-foreground line-through",
};

export const BOARD_COLUMNS: AutomationStatus[] = [
  "requested",
  "backlog",
  "analysis",
  "waiting_info",
  "approved",
  "development",
  "internal_testing",
  "homologation",
  "change_requested",
  "waiting_user",
  "completed",
  "blocked",
];

export const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;
export const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
export const PRIORITY_COLORS: Record<string, string> = {
  low: "text-muted-foreground",
  medium: "text-blue-500",
  high: "text-amber-500",
  urgent: "text-red-500",
};

export const RISK_LABELS: Record<string, string> = {
  low: "Baixo",
  medium: "Médio",
  high: "Alto",
  critical: "Crítico",
};

export const COMPLEXITY_OPTIONS = ["low", "medium", "high", "strategic"] as const;
export const COMPLEXITY_LABELS: Record<string, string> = {
  low: "Simples",
  medium: "Média",
  high: "Complexa",
  strategic: "Estratégica",
};

/** Chaves de configuração do bônus de XP (valores vivem em public.xp_settings). */
export const COMPLEXITY_BONUS_KEYS: Record<string, string> = {
  low: "bonus_low",
  medium: "bonus_medium",
  high: "bonus_high",
  strategic: "bonus_strategic",
};

/** Status em que a solicitação ainda está sob avaliação da TI. */
export const REQUEST_STATUSES: AutomationStatus[] = [
  "requested",
  "analysis",
  "waiting_info",
  "change_requested",
];

export const BLOCKER_TYPES = [
  "approval",
  "user_response",
  "access",
  "credential",
  "environment",
  "third_party",
  "validation",
  "other",
] as const;

export const BLOCKER_TYPE_LABELS: Record<string, string> = {
  approval: "Aprovação",
  user_response: "Retorno do Usuário",
  access: "Acesso",
  credential: "Credencial",
  environment: "Ambiente",
  third_party: "Sistema Terceiro",
  validation: "Validação Final",
  purchase: "Compra",
  sector: "Setor",
  system: "Sistema",
  other: "Outro",
};

export const DEFAULT_SUBTASKS = [
  "Levantamento do processo",
  "Definição da regra",
  "Desenvolvimento",
  "Tratamento de exceções",
  "Testes",
  "Homologação",
  "Deploy",
  "Documentação",
  "Treinamento do usuário",
];

export interface Automation {
  id: string;
  title: string;
  description: string | null;
  objective: string | null;
  system_process: string | null;
  requester: string | null;
  requester_department: string | null;
  assigned_to: string | null;
  created_by: string;
  priority: string;
  status: AutomationStatus;
  complexity: string | null;
  automation_type: string | null;
  language_tool: string | null;
  environment: string | null;
  needs_credentials: boolean;
  needs_external_integration: boolean;
  process_impact: string | null;
  progress_percent: number;
  estimated_hours: number;
  spent_hours: number;
  estimated_deadline: string | null;
  final_deadline: string | null;
  started_at: string | null;
  deployed_at: string | null;
  completed_at: string | null;
  risk_level: string;
  deploy_status: string;
  documentation_done: boolean;
  sector: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationSubtask {
  id: string;
  automation_id: string;
  title: string;
  completed: boolean;
  assigned_to: string | null;
  deadline: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
}

export interface AutomationBlocker {
  id: string;
  automation_id: string;
  blocker_type: string;
  description: string | null;
  responsible_id: string | null;
  pending_since: string;
  resolved_at: string | null;
  impact_on_deadline: string | null;
  created_by: string;
  created_at: string;
}

export interface AutomationEvent {
  id: string;
  automation_id: string;
  event_type: string;
  description: string | null;
  user_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AutomationTimeLog {
  id: string;
  automation_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  description: string | null;
  created_at: string;
}

// Health score helpers
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
}

export function computeHealthScore(a: Automation): { score: number; label: string; color: string } {
  let score = 100;

  // Deadline proximity (only "late" if past END of due day)
  if (a.final_deadline) {
    const msLeft = endOfDay(new Date(a.final_deadline)) - Date.now();
    const daysLeft = msLeft / (1000 * 60 * 60 * 24);
    if (msLeft < 0) score -= 40;
    else if (daysLeft < 3) score -= 25;
    else if (daysLeft < 7) score -= 10;
  }

  if (a.risk_level === "critical") score -= 30;
  else if (a.risk_level === "high") score -= 20;
  else if (a.risk_level === "medium") score -= 10;

  if (a.status === "blocked") score -= 25;

  if (a.progress_percent < 30 && a.final_deadline) {
    const daysLeft = (endOfDay(new Date(a.final_deadline)) - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 14) score -= 15;
  }

  const daysSinceUpdate = (Date.now() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate > 5) score -= 15;

  score = Math.max(0, Math.min(100, score));

  if (score >= 70) return { score, label: "Saudável", color: "text-emerald-500" };
  if (score >= 40) return { score, label: "Atenção", color: "text-amber-500" };
  return { score, label: "Crítico", color: "text-red-500" };
}

export function computePrediction(a: Automation): { label: string; color: string } {
  if (a.status === "completed" || a.status === "cancelled") return { label: "Finalizado", color: "text-muted-foreground" };
  if (!a.final_deadline) return { label: "Sem prazo", color: "text-muted-foreground" };

  const msLeft = endOfDay(new Date(a.final_deadline)) - Date.now();
  const daysLeft = msLeft / (1000 * 60 * 60 * 24);

  if (msLeft < 0) return { label: "Atrasado", color: "text-red-500" };
  if (a.status === "blocked" || a.risk_level === "critical" || a.risk_level === "high") {
    return { label: "Em risco", color: "text-amber-500" };
  }
  if (daysLeft < 3 && a.progress_percent < 80) return { label: "Tende a atrasar", color: "text-amber-500" };
  return { label: "Dentro do prazo", color: "text-emerald-500" };
}
