import { useState, useRef, useCallback } from "react";
import { useAutomationComments, useCreateAutomationComment } from "@/hooks/useAutomationComments";
import { useAllProfiles } from "@/hooks/useAutomationsData";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, Loader2 } from "lucide-react";

interface Props {
  automationId: string;
}

export function AutomationComments({ automationId }: Props) {
  const { data: comments, isLoading } = useAutomationComments(automationId);
  const { data: profiles } = useAllProfiles();
  const createComment = useCreateAutomationComment();
  const [content, setContent] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const initials = (n: string | null) =>
    n ? n.split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase() : "??";

  const handleChange = (v: string) => {
    setContent(v);
    const cur = ref.current?.selectionStart || v.length;
    const m = v.slice(0, cur).match(/@(\w*)$/);
    if (m) { setMentionQuery(m[1].toLowerCase()); setShowSuggestions(true); }
    else setShowSuggestions(false);
  };

  const insertMention = useCallback((name: string) => {
    const cur = ref.current?.selectionStart || content.length;
    const before = content.slice(0, cur);
    const after = content.slice(cur);
    const m = before.match(/@(\w*)$/);
    if (m) {
      const head = before.slice(0, m.index);
      setContent(`${head}@${name} ${after}`);
    }
    setShowSuggestions(false);
    ref.current?.focus();
  }, [content]);

  const submit = () => {
    if (!content.trim()) return;
    const names: string[] = [];
    let m: RegExpExecArray | null;
    const re = /@(\S+)/g;
    while ((m = re.exec(content)) !== null) names.push(m[1].toLowerCase());
    const ids = (profiles || [])
      .filter((p) => names.some((n) => p.full_name?.toLowerCase().split(" ").some((part) => n.includes(part.toLowerCase()))))
      .map((p) => p.id);
    createComment.mutate(
      { automationId, content: content.trim(), mentions: ids },
      { onSuccess: () => setContent("") },
    );
  };

  const filtered = (profiles || []).filter((p) =>
    mentionQuery ? p.full_name?.toLowerCase().includes(mentionQuery) : true
  );

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        Comentários e Atualizações
        {comments && comments.length > 0 && (
          <span className="text-xs text-muted-foreground font-normal">({comments.length})</span>
        )}
      </h4>
      <p className="text-[11px] text-muted-foreground -mt-2">
        Descreva o que já foi concluído, dúvidas ou bloqueios. Use <span className="text-primary">@</span> para mencionar alguém.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {comments?.map((c) => (
            <div key={c.id} className="flex gap-2">
              <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                <AvatarFallback className="bg-primary/20 text-primary text-[9px]">
                  {initials(c.profile?.full_name || null)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{c.profile?.full_name || "Sem nome"}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(c.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">
                  {renderMentions(c.content)}
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
          ref={ref}
          value={content}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="O que foi concluído? Use @ para mencionar..."
          rows={2}
          className="bg-secondary border-border pr-12 text-sm resize-none"
        />
        <Button size="icon" className="absolute bottom-2 right-2 h-7 w-7" onClick={submit} disabled={!content.trim() || createComment.isPending}>
          {createComment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        </Button>

        {showSuggestions && filtered.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-full rounded-lg border border-border bg-popover shadow-lg z-50 max-h-32 overflow-y-auto">
            {filtered.map((p) => (
              <button
                key={p.id}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                onClick={() => insertMention(p.full_name || "user")}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-primary/20 text-primary text-[8px]">
                    {initials(p.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span>{p.full_name || "Sem nome"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderMentions(text: string) {
  return text.split(/(@\S+)/g).map((part, i) =>
    part.startsWith("@")
      ? <span key={i} className="text-primary font-medium">{part}</span>
      : part
  );
}
