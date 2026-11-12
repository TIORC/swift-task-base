import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, MessageSquare, User } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { solicitanteCall, type SolicitanteComment } from "@/lib/solicitacoesApi";
import { attachmentPublicUrl } from "@/hooks/useAutomationAttachments";
import { ChatComposer, CHAT_IMAGE_FALLBACK } from "@/components/automations/ChatComposer";

interface Props {
  automationId: string;
  counterpartName?: string | null;
  /** Cor forte do card: azul para Sistema, roxo para Automação. */
  tone?: "sistema" | "automacao";
  /** Nome de cada usuário (team-names). */
  authorNames?: Record<string, string>;
  /** Quem está logado no portal: a sua mensagem usa o próprio setor. */
  solicitante?: { id: string; sector: string } | null;
}

const TONE_CARD: Record<NonNullable<Props["tone"]>, string> = {
  sistema: "border-blue-700 bg-gradient-to-br from-blue-900 to-slate-950 text-white",
  automacao: "border-purple-800 bg-gradient-to-br from-purple-900 to-slate-950 text-white",
};

/**
 * Chat do portal do solicitante: MESMA conversa da tabela automation_comments,
 * mas lida/escrita SOMENTE via Edge Function "solicitacoes" (o visitante não
 * tem sessão e a RLS barra anon). Sem realtime (precisaria de sessão); usa
 * sondagem curta igual ao restante da rota.
 */
export function SolicitanteChat({ automationId, counterpartName, tone, authorNames, solicitante }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const commentsQuery = useQuery({
    queryKey: ["solicitante-comments", automationId],
    refetchInterval: 30000,
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
    mutationFn: async ({ text, images }: { text: string; images: string[] }) =>
      solicitanteCall("comments:create", { automation_id: automationId, content: text, images }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["solicitante-comments", automationId] });
      qc.invalidateQueries({ queryKey: ["solicitante-comments", "summaries"] });
    },
  });

  /** Envia cada print direto ao bucket por URL assinada: o visitante não tem sessão. */
  const uploadImages = async (files: File[]) => {
    const paths: string[] = [];
    for (const file of files) {
      const { path, token } = await solicitanteCall<{ path: string; token: string }>("comments:upload-url", {
        automation_id: automationId,
        file_name: file.name || "print.png",
      });
      const { error } = await supabase.storage.from("task-attachments").uploadToSignedUrl(path, token, file);
      if (error) throw error;
      paths.push(path);
    }
    return paths;
  };

  const send = async (text: string, files: File[]) => {
    setBusy(true);
    try {
      const images = files.length > 0 ? await uploadImages(files) : [];
      await createComment.mutateAsync({ text: text || CHAT_IMAGE_FALLBACK, images });
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

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

  return (
    <div className={`rounded-lg border p-3 ${tone ? TONE_CARD[tone] : "border-white/10 bg-white/[0.03]"}`}>
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
                const mine = comment.user_id === solicitante?.id;
                // Quem não é o solicitante é da equipe de TI.
                const authorLabel = mine
                  ? `${authorNames?.[comment.user_id] ?? "Você"} - ${solicitante?.sector ?? ""}`
                  : `${authorNames?.[comment.user_id] ?? "Equipe de TI"} - TI`;
                return (
                  <div key={`${comment.automation_id}-${comment.created_at}-${comment.user_id}`} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] ${mine ? "items-end" : "items-start"}`}>
                      <p className={`mb-0.5 flex items-center gap-1 px-1 text-[10px] font-semibold text-white/75 ${mine ? "justify-end" : "justify-start"}`}><User className="h-3 w-3 shrink-0" aria-hidden />{authorLabel}</p>
                      <div className="rounded-xl rounded-br-sm bg-sky-500/90 px-3 py-2 text-sm leading-snug text-white">
                        {!((comment.images ?? []).length > 0 && comment.content === "📷 Imagem") && (
                          <p className="whitespace-pre-wrap break-words">{comment.content}</p>
                        )}
                        {(comment.images ?? []).length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {(comment.images ?? []).map((path) => (
                              <a key={path} href={attachmentPublicUrl(path)} target="_blank" rel="noreferrer">
                                <img
                                  src={attachmentPublicUrl(path)}
                                  alt="Print enviado"
                                  loading="lazy"
                                  className="max-h-40 max-w-full rounded-md border border-white/20 object-contain"
                                />
                              </a>
                            ))}
                          </div>
                        )}
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

      <ChatComposer variant="dark" placeholder="Escreva sua mensagem…" busy={busy} onSend={send} />
    </div>
  );
}
