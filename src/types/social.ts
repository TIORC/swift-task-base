export type SmPostStatus =
  | "ideia"
  | "roteiro"
  | "design"
  | "revisao_interna"
  | "aprovacao_cliente"
  | "agendado"
  | "publicado"
  | "reprovado";

export type SmPriority = "low" | "medium" | "high" | "urgent";

export const SM_POST_STATUS_LABEL: Record<SmPostStatus, string> = {
  ideia: "Ideia",
  roteiro: "Roteiro",
  design: "Design",
  revisao_interna: "Revisão Interna",
  aprovacao_cliente: "Aprovação Cliente",
  agendado: "Agendado",
  publicado: "Publicado",
  reprovado: "Reprovado",
};

export const SM_POST_STATUS_ORDER: SmPostStatus[] = [
  "ideia",
  "roteiro",
  "design",
  "revisao_interna",
  "aprovacao_cliente",
  "agendado",
  "publicado",
  "reprovado",
];

export const SM_PRIORITY_LABEL: Record<SmPriority, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

export interface SmClient {
  id: string;
  name: string;
  brand_identity: string | null;
  general_briefing: string | null;
  logo_url: string | null;
  primary_color: string | null;
  active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SmCampaign {
  id: string;
  client_id: string;
  name: string;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  budget: number | null;
  created_by: string;
  created_at: string;
}

export interface SmSocialNetwork {
  id: string;
  name: string;
  icon: string | null;
  active: boolean;
}

export interface SmContentType {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
}

export interface SmPost {
  id: string;
  client_id: string;
  campaign_id: string | null;
  network_id: string | null;
  content_type_id: string | null;
  title: string;
  caption: string | null;
  hashtags: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: SmPostStatus;
  priority: SmPriority;
  assigned_to: string | null;
  created_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SmTask {
  id: string;
  client_id: string | null;
  campaign_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: SmPriority;
  assigned_to: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
}
