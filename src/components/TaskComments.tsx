import { useState, useRef, useMemo } from "react";
import { useComments, useCreateComment } from "@/hooks/useComments";
import { useProfiles } from "@/hooks/useTasks";
import { findMentionedIds, normalizeName, splitMentions } from "@/lib/mentions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, Loader2 } from "lucide-react";

interface TaskCommentsProps {
  taskId: string;
  taskTitle?: string;
}

const getInitials = (name: string | null) =>
  name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "??";

export function TaskComments({ taskId, taskTitle }: TaskCommentsProps) {
  const { data: comments, isLoading } = useComments(taskId);
  const { data: profiles = [] } = useProfiles();
  const createComment = useCreateComment();
  const [content, setContent] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Pessoas que batem com o que foi digitado depois do "@".
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = normalizeName(mentionQuery);
    return profiles
      .filter((p) => p.full_name && normalizeName(p.full_name).includes(q))
      .slice(0, 6);
  }, [mentionQuery, profiles]);

  const onContentChange = (value: string) => {
    setContent(value);
    // "@" seguido de texto até o cursor, sem quebra de linha no meio.
    const cursor = textareaRef.current?.selectionStart ?? value.length;
    const match = value.slice(0, cursor).match(/@([^@\n]*)$/);
    setMentionQuery(match ? match[1] : null);
  };

  // Troca o "@texto" digitado pelo nome completo escolhido.
  const pickMention = (fullName: string) => {
    const cursor = textareaRef.current?.selectionStart ?? content.length;
    const before = content.slice(0, cursor).replace(/@([^@\n]*)$/, `@${fullName} `);
    const after = content.slice(cursor);
    setContent(before + after);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const handleSubmit = () => {
    const text = content.trim();
    if (!text) return;

    // Só vira menção quem aparece com o nome completo no texto.
    const mentionIds = findMentionedIds(text, profiles);

    createComment.mutate(
      { taskId, taskTitle, content: text, mentions: mentionIds },
      { onSuccess: () => { setContent(""); setMentionQuery(null); } }
    );
  };

  const mentionedNames = (ids: string[]) =>
    profiles.filter((p) => ids.includes(p.id) && p.full_name).map((p) => p.full_name as string);

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        Comentários
        {comments && comments.length > 0 && (
          <span className="text-xs text-muted-foreground font-normal">({comments.length})</span>
        )}
      </h4>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3 max-h-48 overflow-y-auto">
          {comments?.map((comment) => (
            <div key={comment.id} className="flex gap-2">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarFallback className="bg-primary/20 text-primary text-[9px]">
                  {getInitials(comment.profile?.full_name || null)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {comment.profile?.full_name || "Sem nome"}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(comment.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                  {splitMentions(comment.content, mentionedNames(comment.mentions)).map((part, i) =>
                    part.mention ? (
                      <span key={i} className="rounded bg-primary/10 px-1 font-medium text-primary">
                        {part.text}
                      </span>
                    ) : (
                      <span key={i}>{part.text}</span>
                    )
                  )}
                </p>
              </div>
            </div>
          ))}
          {(!comments || comments.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário ainda.</p>
          )}
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          onKeyDown={(e) => {
            // Com a lista de pessoas aberta, Enter escolhe a primeira sugestão.
            if (suggestions.length > 0 && e.key === "Enter") {
              e.preventDefault();
              pickMention(suggestions[0].full_name!);
              return;
            }
            if (e.key === "Escape") setMentionQuery(null);
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Escreva um comentário... Digite @ para marcar alguém"
          rows={2}
          className="bg-secondary border-border pr-12 text-sm resize-none"
        />
        <Button
          size="icon"
          className="absolute bottom-2 right-2 h-7 w-7"
          onClick={handleSubmit}
          disabled={!content.trim() || createComment.isPending}
        >
          {createComment.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
        </Button>

        {suggestions.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-full rounded-lg border border-border bg-popover shadow-lg z-50 max-h-40 overflow-y-auto">
            {suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pickMention(p.full_name!)}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-primary/20 text-primary text-[8px]">
                    {getInitials(p.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground">{p.full_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
