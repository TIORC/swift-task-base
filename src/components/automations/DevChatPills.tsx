import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Minus, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  type AutomationComment,
  uploadAutomationCommentImages,
  useAutomationComments,
  useCreateAutomationComment,
} from "@/hooks/useAutomationComments";
import { attachmentPublicUrl } from "@/hooks/useAutomationAttachments";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { playChatSound, primeChatSound } from "@/lib/chatSound";
import {
  type ChatPill,
  isChatPillPayload,
  markRead,
  mergeComment,
  openWindowList,
  receivePill,
  toAutomationComment,
} from "@/lib/devChatPills";
import { ChatComposer, CHAT_IMAGE_FALLBACK } from "@/components/automations/ChatComposer";

const initials = (name: string) =>
  name.split(" ").filter(Boolean).map((s) => s[0]).join("").slice(0, 2).toUpperCase() || "?";

/**
 * Pílulas flutuantes (chat heads) para o desenvolvedor: quando o solicitante
 * escreve no acompanhamento de uma automação, aparece uma pílula no canto da
 * tela. Clicar nela abre uma janela de conversa que responde pela mesma
 * conversa de `automation_comments`.
 *
 * Custo no banco: zero por mensagem recebida. A mensagem chega pelo canal
 * privado `dev-chat:<user_id>` (Realtime Broadcast, websocket) com o conteúdo
 * completo; a única consulta é a do histórico, e só quando a janela é aberta.
 */
export function DevChatPills() {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pills, setPills] = useState<ChatPill[]>([]);
  const [openIds, setOpenIds] = useState<string[]>([]);
  // Espelho em ref: o handler do canal roda fora do render e precisa do valor atual.
  const openRef = useRef<string[]>([]);
  const applyOpen = (next: string[]) => {
    openRef.current = next;
    setOpenIds(next);
  };

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`dev-chat:${userId}`, { config: { private: true, broadcast: { self: false } } })
      .on("broadcast", { event: "chat_pill" }, ({ payload }) => {
        if (!isChatPillPayload(payload)) return;
        const comment = toAutomationComment(payload);
        // Conversa já carregada numa janela: acrescenta a mensagem sem nova consulta.
        qc.setQueryData<AutomationComment[] | undefined>(
          ["automation_comments", payload.automation_id],
          (old) => (old ? mergeComment(old, comment) : old),
        );
        setPills((prev) => receivePill(prev, payload, openRef.current));
        playChatSound();
      })
      .subscribe();

    // O navegador só libera o som após um gesto do usuário: o primeiro clique na página prepara o áudio.
    document.addEventListener("pointerdown", primeChatSound, { once: true });

    return () => {
      document.removeEventListener("pointerdown", primeChatSound);
      supabase.removeChannel(channel);
    };
  }, [userId, qc]);

  const openChat = (automationId: string) => {
    setPills((prev) => markRead(prev, automationId));
    applyOpen(openWindowList(openRef.current, automationId));
  };
  const minimize = (automationId: string) => applyOpen(openRef.current.filter((id) => id !== automationId));
  const dismiss = (automationId: string) => {
    setPills((prev) => prev.filter((p) => p.automationId !== automationId));
    applyOpen(openRef.current.filter((id) => id !== automationId));
  };

  if (!userId) return null;

  const openPills = openIds
    .map((id) => pills.find((p) => p.automationId === id))
    .filter((p): p is ChatPill => !!p);

  return (
    <>
      {/* Bandeja de pílulas: a mais recente fica mais perto do botão de chat. */}
      <div className="pointer-events-none fixed bottom-5 right-24 z-[9998] flex flex-row-reverse items-end gap-2">
        {pills.map((pill) => (
          <div key={pill.automationId} className="group pointer-events-auto relative">
            <button
              type="button"
              onClick={() => openChat(pill.automationId)}
              title={pill.title}
              className="flex max-w-[300px] items-center gap-3 rounded-full border border-border bg-card py-1.5 pl-1.5 pr-5 text-left shadow-lg transition-colors hover:bg-muted/60 animate-in fade-in slide-in-from-bottom-2"
            >
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className="bg-primary/15 text-sm font-semibold text-primary">
                  {initials(pill.senderName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold leading-tight">{pill.senderName}</p>
                <p className="truncate text-xs leading-tight text-muted-foreground">{pill.title}</p>
              </div>
              {pill.unread > 0 && (
                <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-bold text-destructive-foreground">
                  {pill.unread > 99 ? "99+" : pill.unread}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => dismiss(pill.automationId)}
              aria-label="Ocultar pílula"
              className="absolute -left-1.5 -top-1.5 hidden h-4 w-4 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground hover:text-foreground group-hover:flex"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Janelas de conversa, ao lado da bandeja e acima dela. */}
      {openPills.length > 0 && (
        <div className="pointer-events-none fixed bottom-24 right-24 z-[9998] flex max-w-[calc(100vw-7rem)] items-end gap-3">
          {[...openPills].reverse().map((pill) => (
            <DevChatWindow
              key={pill.automationId}
              pill={pill}
              onMinimize={() => minimize(pill.automationId)}
              onDismiss={() => dismiss(pill.automationId)}
              onOpenAutomation={() => navigate(`/automacoes?automation=${pill.automationId}`)}
            />
          ))}
        </div>
      )}
    </>
  );
}

interface WindowProps {
  pill: ChatPill;
  onMinimize: () => void;
  onDismiss: () => void;
  onOpenAutomation: () => void;
}

function DevChatWindow({ pill, onMinimize, onDismiss, onOpenAutomation }: WindowProps) {
  const { user } = useAuth();
  // Sem `live`: nenhuma assinatura de banco aberta por janela; novas mensagens entram pelo broadcast.
  const { data: comments, isLoading } = useAutomationComments(pill.automationId);
  const createComment = useCreateAutomationComment();
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const list = comments ?? [];

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [list.length]);

  /** Sobe os prints (sessão do dev) e grava o comentário. Devolve true quando enviou. */
  const send = async (text: string, files: File[]) => {
    if (!user) return false;
    setBusy(true);
    try {
      let images: string[] = [];
      try {
        images = files.length > 0 ? await uploadAutomationCommentImages(pill.automationId, user.id, files) : [];
      } catch (e) {
        toast.error(`Não foi possível enviar a imagem: ${(e as Error).message}`);
        return false;
      }
      await createComment.mutateAsync({
        automationId: pill.automationId,
        content: text || CHAT_IMAGE_FALLBACK,
        mentions: [],
        images,
      });
      return true;
    } catch {
      // O erro do envio já aparece em toast pelo hook.
      return false;
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pointer-events-auto flex h-[460px] max-h-[70vh] w-[340px] max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
      <div className="flex items-start gap-2 border-b border-border bg-muted/30 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{pill.senderName}</p>
          <p className="truncate text-[11px] text-muted-foreground">{pill.title}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenAutomation} title="Abrir automação">
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMinimize} title="Minimizar (mantém a pílula)">
          <Minus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDismiss} title="Fechar e ocultar pílula">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto bg-muted/10 p-3">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          list.map((comment) => {
            const mine = comment.user_id === user?.id;
            const images = comment.images ?? [];
            const onlyImage = images.length > 0 && comment.content === CHAT_IMAGE_FALLBACK;
            return (
              <div key={comment.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
                    mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm border border-border bg-card",
                  )}
                >
                  {!mine && (
                    <p className="mb-0.5 text-[10px] font-semibold text-muted-foreground">
                      {comment.profile?.full_name || pill.senderName}
                    </p>
                  )}
                  {!onlyImage && (
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{comment.content}</p>
                  )}
                  {images.length > 0 && (
                    <div className={cn("flex flex-wrap gap-1.5", !onlyImage && "mt-2")}>
                      {images.map((path) => (
                        <a key={path} href={attachmentPublicUrl(path)} target="_blank" rel="noreferrer">
                          <img
                            src={attachmentPublicUrl(path)}
                            alt="Print enviado"
                            loading="lazy"
                            className="max-h-40 max-w-full rounded-md border border-border object-contain"
                          />
                        </a>
                      ))}
                    </div>
                  )}
                  <p className={cn("mt-1 text-[9px] tabular-nums", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                    {format(new Date(comment.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border bg-card p-2">
        <ChatComposer placeholder="Responder ao solicitante…" busy={busy} onSend={send} />
      </div>
    </div>
  );
}
