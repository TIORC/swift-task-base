import { supabase } from "@/integrations/supabase/client";

/**
 * Cliente da Edge Function "solicitacoes".
 *
 * TODAS as leituras e gravações da rota /k7f3q9x2/solicitacoes passam por
 * aqui. O front NUNCA toca as tabelas diretamente nesse fluxo — quem tem
 * service_role é só a função, no servidor.
 */

/** Chave do sessionStorage onde o token curto do solicitante é guardado. */
export const SOLICITANTE_TOKEN_KEY = "orcoma:solicitante-token";

export interface SolicitanteIdentity {
  id: string;
  email: string;
  sector: string;
}

export interface SolicitanteRequest {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  sector: string;
  created_at: string;
  updated_at: string | null;
  progress_percent: number | null;
  assigned_to: string | null;
  request_kind: string | null;
}

export interface SolicitanteComment {
  automation_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface SolicitanteCommentSummary {
  total: number;
  lastAuthor: string | null;
  lastAuthorName: string | null;
  lastContent: string | null;
}

function readToken(): string | null {
  try {
    return sessionStorage.getItem(SOLICITANTE_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** Chamada tipada à função; converte erro da função em Error legível. */
export async function solicitacoesCall<T>(payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("solicitacoes", { body: payload });
  if (error) {
    const message =
      (data as { error?: string } | null)?.error ||
      (error as { message?: string }).message ||
      "Falha ao falar com o servidor.";
    throw new Error(message);
  }
  if (data && typeof data === "object" && "error" in (data as Record<string, unknown>)) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data as T;
}

/** Atalho para ações autenticadas pelo token do solicitante. */
export function solicitanteCall<T>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
  const token = readToken();
  if (!token) return Promise.reject(new Error("Identificação inválida ou expirada. Identifique-se novamente."));
  return solicitacoesCall<T>({ action, token, ...extra });
}

/** Payload aceito pela ação "create" da função. */
export interface SolicitanteCreatePayload {
  title: string;
  description?: string | null;
  objective?: string | null;
  process_impact?: string | null;
  system_process?: string | null;
  sector: string;
  request_kind?: "Sistema" | "Automação" | null;
  priority?: "low" | "medium" | "high" | "urgent";
  sender_name?: string;
}
