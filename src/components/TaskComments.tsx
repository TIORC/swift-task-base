import { useState, useRef, useCallback } from "react";
import { useComments, useCreateComment, Comment } from "@/hooks/useComments";
import { useProfiles } from "@/hooks/useTasks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, MessageSquare, Loader2 } from "lucide-react";

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const { data: comments, isLoading } = useComments(taskId);
  const { data: profiles } = useProfiles();
  const createComment = useCreateComment();
  const [content, setContent] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const getInitials = (name: string | null) =>
    name ? name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "??";

  const handleInputChange = (value: string) => {
    setContent(value);

    // Check for @mention trigger
    const cursorPos = textareaRef.current?.selectionStart || value.length;
    const textBeforeCursor = value.slice(0, cursorPos);
    const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

    if (mentionMatch) {
      setMentionQuery(mentionMatch[1].toLowerCase());
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = useCallback(
    (profileId: string, name: string) => {
      const cursorPos = textareaRef.current?.selectionStart || content.length;
      const textBeforeCursor = content.slice(0, cursorPos);
      const textAfterCursor = content.slice(cursorPos);
      const mentionMatch = textBeforeCursor.match(/@(\w*)$/);

      if (mentionMatch) {
        const beforeMention = textBeforeCursor.slice(0, mentionMatch.index);
        const newContent = `${beforeMention}@${name} ${textAfterCursor}`;
        setContent(newContent);
      }

      setShowSuggestions(false);
      textareaRef.current?.focus();
    },
    [content]
  );

  const handleSubmit = () => {
    if (!content.trim()) return;

    // Extract mentions from content
    const mentionRegex = /@(\S+)/g;
    const mentionNames: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentionNames.push(match[1].toLowerCase());
    }

    const mentionIds = (profiles || [])
      .filter((p) =>
        mentionNames.some(
          (name) => p.full_name?.toLowerCase().split(" ").some((part) => name.includes(part.toLowerCase()))
        )
      )
      .map((p) => p.id);

    createComment.mutate(
      { taskId, content: content.trim(), mentions: mentionIds },
      { onSuccess: () => setContent("") }
    );
  };

  const filteredProfiles = (profiles || []).filter((p) =>
    mentionQuery
      ? p.full_name?.toLowerCase().includes(mentionQuery)
      : true
  );

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <MessageSquare className="h-4 w-4 text-muted-foreground" />
        Comentários
        {comments && comments.length > 0 && (
          <span className="text-xs text-muted-foreground font-normal">({comments.length})</span>
        )}
      </h4>

      {/* Comments list */}
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
                  {renderContentWithMentions(comment.content)}
                </p>
              </div>
            </div>
          ))}
          {(!comments || comments.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-2">Nenhum comentário ainda.</p>
          )}
        </div>
      )}

      {/* Input */}
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Escreva um comentário... Use @ para mencionar"
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

        {/* Mention suggestions */}
        {showSuggestions && filteredProfiles.length > 0 && (
          <div className="absolute bottom-full mb-1 left-0 w-full rounded-lg border border-border bg-popover shadow-lg z-50 max-h-32 overflow-y-auto">
            {filteredProfiles.map((p) => (
              <button
                key={p.id}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent text-left transition-colors"
                onClick={() => insertMention(p.id, p.full_name || "user")}
              >
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="bg-primary/20 text-primary text-[8px]">
                    {getInitials(p.full_name)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-foreground">{p.full_name || "Sem nome"}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function renderContentWithMentions(content: string) {
  const parts = content.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="text-primary font-medium">
        {part}
      </span>
    ) : (
      part
    )
  );
}
