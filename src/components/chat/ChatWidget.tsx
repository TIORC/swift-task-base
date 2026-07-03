import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, X, ArrowLeft, Send, Search, Plus, AtSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useConversations, useMessages, openDirectChat, sendChatMessage, markConversationRead } from "@/hooks/useChat";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const sb = supabase as any;

interface Props { context: "ti" | "social"; }

interface Profile { id: string; full_name: string | null; avatar_url: string | null }
interface TaskLite { id: string; title: string; kind: "ti" | "sm" }

const MENTION_TOKEN_RE = /\[\[(ti|sm):([0-9a-f-]{36}):([^\]]+)\]\]/g;

function renderContent(content: string, onOpen: (kind: "ti" | "sm", id: string) => void) {
  const nodes: (string | { kind: "ti" | "sm"; id: string; title: string })[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(MENTION_TOKEN_RE.source, "g");
  while ((m = re.exec(content))) {
    if (m.index > last) nodes.push(content.slice(last, m.index));
    nodes.push({ kind: m[1] as "ti" | "sm", id: m[2], title: m[3] });
    last = m.index + m[0].length;
  }
  if (last < content.length) nodes.push(content.slice(last));

  return nodes.map((n, i) =>
    typeof n === "string" ? <span key={i}>{n}</span> : (
      <button key={i} onClick={(e) => { e.stopPropagation(); onOpen(n.kind, n.id); }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-md bg-primary/15 text-primary hover:bg-primary/25 text-[11px] font-medium">
        <AtSign className="h-3 w-3"/>{n.title}
      </button>
    )
  );
}

export function ChatWidget({ context }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"list" | "chat" | "new">("list");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [mentions, setMentions] = useState<TaskLite[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<TaskLite[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversations } = useConversations();
  const { data: messages } = useMessages(activeId);

  const totalUnread = useMemo(() => conversations.reduce((s, c) => s + (c.unread_count || 0), 0), [conversations]);

  const activeConv = conversations.find(c => c.id === activeId);
  const otherOf = (conv: typeof conversations[number]) => conv.participants.find(p => p.user_id !== user?.id);

  // Load users for "new chat" — só membros do sistema atual
  useEffect(() => {
    if (view !== "new") return;
    (async () => {
      const systemKey = context === "social" ? "social" : "ti";
      const { data: sys } = await sb.from("user_systems").select("user_id").eq("system", systemKey).eq("enabled", true);
      const ids = (sys ?? []).map((s: any) => s.user_id).filter((id: string) => id !== user?.id);
      if (ids.length === 0) { setUsers([]); return; }
      const { data } = await sb.from("profiles").select("id, full_name, avatar_url").in("id", ids).order("full_name");
      setUsers((data ?? []) as Profile[]);
    })();
  }, [view, user?.id, context]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, activeId]);

  // Mark as read
  useEffect(() => {
    if (activeId && user && open) markConversationRead(activeId, user.id);
  }, [activeId, messages.length, user, open]);

  // Task mention search
  useEffect(() => {
    if (mentionQuery === null) { setMentionResults([]); return; }
    const q = mentionQuery.trim();
    (async () => {
      const table = context === "social" ? "sm_tasks" : "tasks";
      let query = sb.from(table).select("id, title").order("created_at", { ascending: false }).limit(8);
      if (q) query = query.ilike("title", `%${q}%`);
      const { data } = await query;
      setMentionResults((data ?? []).map((t: any) => ({ id: t.id, title: t.title, kind: context === "social" ? "sm" : "ti" })));
    })();
  }, [mentionQuery, context]);

  const handleInput = (v: string) => {
    setInput(v);
    // Detect @ at end
    const m = v.match(/@([^\s@]{0,40})$/);
    if (m) setMentionQuery(m[1]);
    else setMentionQuery(null);
  };

  const insertMention = (t: TaskLite) => {
    const newVal = input.replace(/@([^\s@]{0,40})$/, `[[${t.kind}:${t.id}:${t.title.replace(/[\[\]]/g, "")}]] `);
    setInput(newVal);
    setMentions(prev => prev.some(p => p.id === t.id) ? prev : [...prev, t]);
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const send = async () => {
    if (!input.trim() || !activeId || !user) return;
    try {
      const smIds = mentions.filter(m => m.kind === "sm").map(m => m.id);
      const tiIds = mentions.filter(m => m.kind === "ti").map(m => m.id);
      await sendChatMessage({ conversationId: activeId, senderId: user.id, content: input.trim(), mentionedSmTaskIds: smIds, mentionedTaskIds: tiIds });
      setInput(""); setMentions([]); setMentionQuery(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const openMention = (kind: "ti" | "sm", id: string) => {
    if (kind === "sm") navigate(`/social/tarefas?taskId=${id}`);
    else navigate(`/tasks?taskId=${id}`);
    setOpen(false);
  };

  const startNew = async (uid: string) => {
    try {
      const convId = await openDirectChat(uid);
      setActiveId(convId);
      setView("chat");
    } catch (e: any) { toast.error(e.message); }
  };

  const initials = (n?: string | null) => n ? n.split(" ").map(s => s[0]).join("").slice(0,2).toUpperCase() : "?";

  return (
    <>
      {/* Floating button */}
      <button onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-50 h-14 w-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:scale-105 transition-transform flex items-center justify-center"
        aria-label="Chat">
        <MessageSquare className="h-6 w-6"/>
        {totalUnread > 0 && (
          <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[380px] h-[560px] max-h-[85vh] rounded-2xl bg-card border border-border shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-muted/30">
            {(view === "chat" || view === "new") && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setView("list"); setActiveId(null); }}>
                <ArrowLeft className="h-4 w-4"/>
              </Button>
            )}
            <div className="flex-1 min-w-0">
              {view === "list" && <p className="text-sm font-semibold">Conversas</p>}
              {view === "new" && <p className="text-sm font-semibold">Nova conversa</p>}
              {view === "chat" && activeConv && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-7 w-7">
                    {otherOf(activeConv)?.profile?.avatar_url && <AvatarImage src={otherOf(activeConv)!.profile!.avatar_url!}/>}
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{initials(otherOf(activeConv)?.profile?.full_name)}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm font-medium truncate">{otherOf(activeConv)?.profile?.full_name || "Usuário"}</p>
                </div>
              )}
            </div>
            {view === "list" && (
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setView("new")} title="Nova conversa">
                <Plus className="h-4 w-4"/>
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4"/>
            </Button>
          </div>

          {/* Body */}
          {view === "list" && (
            <ScrollArea className="flex-1">
              {conversations.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40"/>
                  Nenhuma conversa ainda.<br/>
                  <Button variant="link" size="sm" onClick={() => setView("new")}>Iniciar conversa</Button>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {conversations.map(c => {
                    const other = otherOf(c);
                    return (
                      <li key={c.id}>
                        <button onClick={() => { setActiveId(c.id); setView("chat"); }}
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left">
                          <Avatar className="h-9 w-9">
                            {other?.profile?.avatar_url && <AvatarImage src={other.profile.avatar_url}/>}
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(other?.profile?.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-medium truncate">{other?.profile?.full_name || "Usuário"}</p>
                              {c.last_message && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {formatDistanceToNow(new Date(c.last_message.created_at), { locale: ptBR, addSuffix: false })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs text-muted-foreground truncate">
                                {c.last_message?.content?.replace(MENTION_TOKEN_RE, "@$3") || "Sem mensagens"}
                              </p>
                              {(c.unread_count || 0) > 0 && (
                                <Badge className="h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px]">{c.unread_count}</Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </ScrollArea>
          )}

          {view === "new" && (
            <>
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"/>
                  <Input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Buscar usuário..." className="pl-8 h-9"/>
                </div>
              </div>
              <ScrollArea className="flex-1">
                <ul className="divide-y divide-border">
                  {users.filter(u => (u.full_name || "").toLowerCase().includes(userSearch.toLowerCase())).map(u => (
                    <li key={u.id}>
                      <button onClick={() => startNew(u.id)} className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 text-left">
                        <Avatar className="h-8 w-8">
                          {u.avatar_url && <AvatarImage src={u.avatar_url}/>}
                          <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials(u.full_name)}</AvatarFallback>
                        </Avatar>
                        <p className="text-sm">{u.full_name || "Sem nome"}</p>
                      </button>
                    </li>
                  ))}
                </ul>
              </ScrollArea>
            </>
          )}

          {view === "chat" && activeId && (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/10">
                {messages.map(m => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"}`}>
                        <div className="whitespace-pre-wrap break-words leading-relaxed">
                          {renderContent(m.content, openMention)}
                        </div>
                        <p className={`text-[9px] mt-1 ${mine ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Mention dropdown */}
              {mentionQuery !== null && mentionResults.length > 0 && (
                <div className="border-t border-border bg-popover max-h-40 overflow-y-auto">
                  {mentionResults.map(t => (
                    <button key={t.id} onClick={() => insertMention(t)}
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted flex items-center gap-2">
                      <AtSign className="h-3 w-3 text-primary"/>{t.title}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={e => { e.preventDefault(); send(); }} className="p-2 border-t border-border flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={e => handleInput(e.target.value)}
                  placeholder="Digite mensagem. Use @ para mencionar tarefa"
                  className="h-9"
                  autoFocus
                />
                <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={!input.trim()}>
                  <Send className="h-4 w-4"/>
                </Button>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
