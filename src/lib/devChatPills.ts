import type { AutomationComment } from "@/hooks/useAutomationComments";

/**
 * Estado puro da pílula de chat do desenvolvedor (sem React e sem rede).
 * O payload chega pelo canal privado `dev-chat:<user_id>` (evento `chat_pill`),
 * enviado pela edge function `solicitacoes` no comments:create.
 */

export const MAX_VISIBLE_PILLS = 5;
export const MAX_OPEN_WINDOWS = 2;

export interface ChatPillPayload {
  automation_id: string;
  automation_title: string;
  sender_name: string;
  comment: {
    id: string;
    automation_id: string;
    user_id: string;
    content: string;
    created_at: string;
    images?: string[];
  };
}

export interface ChatPill {
  automationId: string;
  title: string;
  senderName: string;
  lastContent: string;
  lastAt: string;
  /** Mensagens chegadas com a janela fechada. */
  unread: number;
}

export function isChatPillPayload(value: unknown): value is ChatPillPayload {
  const v = value as Partial<ChatPillPayload> | null | undefined;
  return (
    !!v &&
    typeof v.automation_id === "string" &&
    typeof v.comment?.id === "string" &&
    typeof v.comment?.content === "string" &&
    typeof v.comment?.created_at === "string"
  );
}

function snippet(content: string, max = 60) {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Nova mensagem: a conversa sobe para o início da bandeja; conta como não lida se a janela está fechada. */
export function receivePill(pills: ChatPill[], payload: ChatPillPayload, openIds: string[]): ChatPill[] {
  const previous = pills.find((p) => p.automationId === payload.automation_id);
  const next: ChatPill = {
    automationId: payload.automation_id,
    title: payload.automation_title || "Automação",
    senderName: payload.sender_name || "Solicitante",
    lastContent: snippet(payload.comment.content),
    lastAt: payload.comment.created_at,
    unread: openIds.includes(payload.automation_id) ? 0 : (previous?.unread ?? 0) + 1,
  };
  return [next, ...pills.filter((p) => p.automationId !== payload.automation_id)].slice(0, MAX_VISIBLE_PILLS);
}

export function markRead(pills: ChatPill[], automationId: string): ChatPill[] {
  return pills.map((p) => (p.automationId === automationId && p.unread > 0 ? { ...p, unread: 0 } : p));
}

/** Abre a janela da conversa; a mais recente fica na frente e só MAX_OPEN_WINDOWS ficam abertas. */
export function openWindowList(openIds: string[], automationId: string): string[] {
  return [automationId, ...openIds.filter((id) => id !== automationId)].slice(0, MAX_OPEN_WINDOWS);
}

/** Acrescenta a mensagem ao cache da conversa sem repetir o que já existe. */
export function mergeComment(list: AutomationComment[], comment: AutomationComment): AutomationComment[] {
  if (list.some((c) => c.id === comment.id)) return list;
  return [...list, comment].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function toAutomationComment(payload: ChatPillPayload): AutomationComment {
  return {
    id: payload.comment.id,
    automation_id: payload.comment.automation_id,
    user_id: payload.comment.user_id,
    content: payload.comment.content,
    mentions: [],
    images: payload.comment.images ?? [],
    created_at: payload.comment.created_at,
    profile: { full_name: payload.sender_name, avatar_url: null },
  };
}
