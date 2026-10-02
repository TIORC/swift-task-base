import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { solicitanteCall, type SolicitanteComment } from "@/lib/solicitacoesApi";

interface Props {
  automationId: string;
  counterpartName?: string | null;
}

/**
 * Chat do portal do solicitante: MESMA conversa da tabela automation_comments,
 * mas lida/escrita SOMENTE via Edge Function "solicitacoes" (o visitante não
 * tem sessão e a RLS barra anon). Sem realtime (precisaria de sessão); usa
 * sondagem curta igual ao restante da rota.
 */
export function SolicitanteChat({ automationId, counterpartName }: Props) {
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const commentsQuery = useQuery({
    queryKey: ["solicitante-comments", automationId],
    refetchInterval: 15000,
    queryFn: async () => {
      const { comments } = await solicitanteCall<{ comments: SolicitanteComment[] }>("comments:list", {
        automation_id: automationId,
      });
      return comments;
    },
  });
  const comments = commentsQuery.data ?? [];
  const isLoading = commentsQuery.isLoading;

  const createComment = useMutation({
    mutationFn: async (text: string) =>
      solicitanteCall("comments:create", { automation_id: automationId, content: text }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitante-comments", automationId] });
      qc.invalidateQueries({ queryKey: ["solicitante-comments", "summaries"] });
      setContent("");
    },
  });

  // Agrupa por dia: numa conversa longa, saber "quando" importa tanto quanto "quem".
  const days = useMemo(() => {
    const groups: { label: string; items: SolicitanteComment[] }[] = [];
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
    createComment.mutate(text);
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
                const mine = true; // portal do solicitante: a conversa exibida é só a dele
                return (
                  <div key={`${comment.automation_id}-${comment.created_at}-${comment.user_id}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] ${mine ? "items-end" : "items-start"}`}>
                      <div className="rounded-xl rounded-br-sm bg-sky-500/90 px-3 py-2 text-sm leading-snug text-white">
                        <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                        <p className="mt-0.5 text-right text-[9px] tabular-nums text-white/70">
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
