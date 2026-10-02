import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { useAutomationComments, useCreateAutomationComment } from "@/hooks/useAutomationComments";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

interface Props {
  automationId: string;
  /** Nome do responsável, para o cabeçalho da conversa. */
  counterpartName?: string | null;
}

/**
 * Conversa entre o solicitante e os desenvolvedores dentro da própria solicitação.
 * É a mesma tabela que o chat de /automacoes usa (`automation_comments`), então
 * é literalmente a mesma conversa dos dois lados — sem tradução, sem cópia.
 * Mensagens próprias ficam à direita, como em um aplicativo de mensagens.
 */
export function RequestChat({ automationId, counterpartName }: Props) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useAutomationComments(automationId, { live: true });
  const createComment = useCreateAutomationComment();
  const [content, setContent] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Agrupa por dia: numa conversa longa, saber "quando" importa tanto quanto "quem".
  const days = useMemo(() => {
    const groups: { label: string; items: typeof comments }[] = [];
    for (const comment of comments || []) {
      const label = format(new Date(comment.created_at), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(comment);
      else groups.push({ label, items: [comment] });
    }
    return groups;
  }, [comments]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [comments?.length]);

  const submit = () => {
    const text = content.trim();
    if (!text || createComment.isPending) return;
    createComment.mutate(
      { automationId, content: text, mentions: [] },
      { onSuccess: () => setContent("") },
    );
  };

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-white/70">
        <MessageSquare className="h-3.5 w-3.5" />
        Conversa com os Desenvolvedores
        {counterpartName && <span className="font-normal text-white/45">· {counterpartName}</span>}
      </p>

      <div className="mb-3 max-h-72 space-y-3 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
          </div>
        ) : (
          days.map((day) => (
            <div key={day.label} className="space-y-2">
              <p className="text-center text-[10px] uppercase tracking-wide text-white/35">{day.label}</p>
              {day.items.map((comment) => {
                const mine = comment.user_id === user?.id;
                return (
                  <div key={comment.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] ${mine ? "items-end" : "items-start"}`}>
                        {!mine && (
                          <p className="mb-0.5 px-1 text-[10px] font-medium text-white/60">
                            {comment.profile?.full_name || "Desenvolvedores"}
                          </p>
                        )}
                      <div
                        className={
                          mine
                            ? "rounded-xl rounded-br-sm bg-sky-500/90 px-3 py-2 text-sm leading-snug text-white"
                            : "rounded-xl rounded-bl-sm bg-white/10 px-3 py-2 text-sm leading-snug text-white/90"
                        }
                      >
                        <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                        <p className={`mt-0.5 text-right text-[9px] tabular-nums ${mine ? "text-white/70" : "text-white/40"}`}>
                          {format(new Date(comment.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
        {!isLoading && (comments?.length ?? 0) === 0 && (
          <p className="py-4 text-center text-xs text-white/45">
            Nenhuma mensagem ainda. Escreva abaixo e os desenvolvedores respondem por aqui.
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="Escreva sua mensagem…"
          className="min-h-[2.5rem] flex-1 resize-none rounded-lg border border-white/10 bg-black/25 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-sky-300/40 focus:outline-none"
        />
        <Button
          size="icon"
          onClick={submit}
          disabled={!content.trim() || createComment.isPending}
          aria-label="Enviar mensagem"
          className="h-10 w-10 shrink-0 rounded-lg bg-sky-500 hover:bg-sky-400"
        >
          {createComment.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className="mt-1 text-[10px] text-white/35">Enter envia · Shift+Enter quebra a linha</p>
    </div>
  );
}
