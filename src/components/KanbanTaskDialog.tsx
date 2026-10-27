import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  KANBAN_COLUMNS,
  KanbanStatus,
  KanbanTask,
  PENDING_KANBAN_PEOPLE,
  canDeleteKanbanTaskName,
  isKanbanResponsible,
  toColumnStatus,
  useKanbanCreateTask,
  useKanbanDeleteTask,
  useKanbanUpdateTask,
} from "@/hooks/useKanbanTasks";
import { getKanbanFileUrl, useUploadKanbanAttachments } from "@/hooks/useKanbanAttachments";
import { storageSafeName } from "@/lib/attachment-types";
import { useAddChecklistItems } from "@/hooks/useKanbanChecklist";
import { KanbanAttachments } from "@/components/KanbanAttachments";
import { KanbanChecklist, PendingChecklistItem } from "@/components/KanbanChecklist";
import { KanbanCoverPicker } from "@/components/KanbanCoverPicker";
import { labelFor } from "@/lib/kanban-labels";
import { ImagePlus, Smile, Trash2, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

// Limite por tarefa; o banco também impede a partir do mesmo número (ver migração de comentários).
const MAX_COMMENTS = 1000;

const MAX_COMMENT_IMAGES = 5;
const MAX_COMMENT_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const COMMENT_IMAGE_FALLBACK = "📷 Imagem";

const EMOJIS = [
  "😀","😂","😊","😍","🤔","😅","😉","🙂","😎","🥳","😢","😡",
  "👍","👎","👏","🙏","💪","👀","🔥","✅","❌","⚠️","❓","❗",
  "🎉","🚀","💡","📌","📎","📅","⏰","🐛","🔧","💬","❤️","⭐",
];

const PRIORITIES = [
  { v: "low", l: "Baixa" }, { v: "medium", l: "Média" }, { v: "high", l: "Alta" }, { v: "urgent", l: "Urgente" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task?: KanbanTask | null;
  defaultStatus?: KanbanStatus;
  readOnly?: boolean;
}

export function KanbanTaskDialog({ open, onOpenChange, task, defaultStatus = "backlog", readOnly }: Props) {
  const { user } = useAuth();
  const { profile: me } = useProfile();
  const qc = useQueryClient();
  const create = useKanbanCreateTask();
  const update = useKanbanUpdateTask();
  const del = useKanbanDeleteTask();
  const upload = useUploadKanbanAttachments();
  const addChecklist = useAddChecklistItems();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<KanbanStatus>(defaultStatus);
  const [priority, setPriority] = useState("medium");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [due, setDue] = useState("");
  const [xp, setXp] = useState(1);
  const [comment, setComment] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [pendingChecklist, setPendingChecklist] = useState<PendingChecklistItem[]>([]);

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus(toColumnStatus((task?.status as KanbanStatus) ?? defaultStatus));
    setPriority(task?.priority ?? "medium");
    setAssigneeIds(task?.assignee_ids ?? []);
    setDue(task?.due_date ?? "");
    setXp(task?.xp ?? 1);
    setComment("");
    setPendingFiles([]);
    setPendingChecklist([]);
  }, [open, task, defaultStatus]);

  const { data: people = [] } = useQuery({
    queryKey: ["kanban-people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return [...(data ?? []).filter((p) => isKanbanResponsible(p.full_name)), ...PENDING_KANBAN_PEOPLE];
    },
  });

  const { data: comments = [] } = useQuery({
    queryKey: ["kanban-comments", task?.id],
    enabled: !!task?.id && open,
    queryFn: async () => {
      const { data } = await supabase.from("kanban_task_comments").select("*").eq("task_id", task!.id).order("created_at");
      return data ?? [];
    },
  });
  // Todos os perfis (quem comenta ou é mencionado não precisa ser responsável pela tarefa).
  const { data: profileList = [] } = useQuery({
    queryKey: ["kanban-profile-names"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name");
      return (data ?? []).filter((p) => p.full_name);
    },
  });
  const profileNames = useMemo(
    () => Object.fromEntries(profileList.map((p) => [p.id, p.full_name ?? "Sem nome"])) as Record<string, string>,
    [profileList]
  );
  const nameOf = (id: string) => profileNames[id] ?? "—";

  // Chat: sempre mostra o comentário mais recente e evita envio duplicado.
  const [sending, setSending] = useState(false);
  const [commentImages, setCommentImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imagePreviews = useMemo(() => commentImages.map((f) => URL.createObjectURL(f)), [commentImages]);
  useEffect(() => () => imagePreviews.forEach((u) => URL.revokeObjectURL(u)), [imagePreviews]);
  useEffect(() => { if (open) setCommentImages([]); }, [open, task?.id]);

  const addCommentImages = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (images.some((f) => f.size > MAX_COMMENT_IMAGE_SIZE)) {
      toast.error("Cada imagem pode ter no máximo 10MB.");
      return;
    }
    if (commentImages.length + images.length > MAX_COMMENT_IMAGES) {
      toast.error(`No máximo ${MAX_COMMENT_IMAGES} imagens por comentário.`);
    }
    setCommentImages((prev) => [...prev, ...images].slice(0, MAX_COMMENT_IMAGES));
  };
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [comments.length, open, task?.id]);

  // Menções: "@" abre a lista de pessoas; o texto guarda "@Nome" e a lista guarda os ids.
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const suggestions = useMemo(() => {
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return profileList.filter((p) => (p.full_name ?? "").toLowerCase().includes(q)).slice(0, 6);
  }, [mentionQuery, profileList]);

  const onCommentChange = (value: string) => {
    setComment(value);
    const match = value.match(/@([^@]*)$/);
    setMentionQuery(match && !match[1].includes("\n") ? match[1] : null);
  };

  const pickMention = (fullName: string) => {
    setComment((c) => c.replace(/@([^@]*)$/, `@${fullName} `));
    setMentionQuery(null);
  };

  // Destaca "@Nome" no texto, só para pessoas que foram mencionadas no comentário.
  const renderContent = (text: string, ids: string[]) => {
    const names = ids.map((id) => profileNames[id]).filter(Boolean).sort((a, b) => b.length - a.length);
    if (names.length === 0) return text;
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const parts = text.split(new RegExp(`(@(?:${escaped.join("|")}))`, "g"));
    return parts.map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className="rounded bg-primary/15 px-1 font-semibold text-primary">{part}</span>
      ) : (
        part
      )
    );
  };

  const save = async () => {
    if (!title.trim()) return;
    const row = {
      title: title.trim(),
      description: description || null,
      status: status as any,
      priority: priority as any,
      assignee_ids: assigneeIds,
      due_date: due || null,
      xp: Math.min(50, Math.max(1, Math.round(xp) || 1)),
    };
    if (task) {
      await update.mutateAsync({ id: task.id, ...row });
    } else {
      const created = await create.mutateAsync(row);
      if (pendingFiles.length > 0) upload.mutate({ taskId: created.id, files: pendingFiles });
      if (pendingChecklist.length > 0) addChecklist.mutate({ taskId: created.id, items: pendingChecklist });
    }
    onOpenChange(false);
  };

  const addComment = async () => {
    if (sending || (!comment.trim() && commentImages.length === 0) || !task || !user) return;
    if (comments.length >= MAX_COMMENTS) {
      toast.error(`Limite de ${MAX_COMMENTS} comentários por tarefa atingido.`);
      return;
    }
    const content = comment.trim() || COMMENT_IMAGE_FALLBACK;
    setSending(true);
    const imagePaths: string[] = [];
    try {
      for (const [i, file] of commentImages.entries()) {
        const path = `${user.id}/kanban/${task.id}/comments/${Date.now()}_${i}_${storageSafeName(file.name || "print.png")}`;
        const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, file, { upsert: false });
        if (upErr) throw upErr;
        imagePaths.push(path);
      }
    } catch (e) {
      toast.error((e as Error).message);
      setSending(false);
      return;
    }
    const mentions = profileList
      .filter((p) => p.full_name && content.includes(`@${p.full_name}`))
      .map((p) => p.id);
    const { error } = await supabase
      .from("kanban_task_comments")
      .insert({ task_id: task.id, user_id: user.id, content, mentions, images: imagePaths });
    if (error) {
      toast.error(error.message);
      setSending(false);
      return;
    }
    setComment("");
    setCommentImages([]);
    setMentionQuery(null);
    setSending(false);
    qc.invalidateQueries({ queryKey: ["kanban-comments", task.id] });
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    const author = nameOf(user.id);
    for (const uid of mentions.filter((id) => id !== user.id)) {
      await supabase.from("notifications").insert({
        user_id: uid,
        type: "mention",
        link: `/kanban?task=${task.id}`,
        message: `${author} mencionou você na tarefa do Kanban "${task.title}"`,
        created_by: user.id,
      });
    }
  };

  const busy = create.isPending || update.isPending;

  // Excluir: criador da tarefa ou corporativos da lista (também no modo somente leitura).
  const canDelete = !!task && (task.created_by === user?.id || canDeleteKanbanTaskName(me?.full_name));
  const removeTask = async () => {
    if (!task || !confirm("Excluir esta tarefa? Esta ação não pode ser desfeita.")) return;
    await del.mutateAsync(task.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`kanban-scroll ${task ? "w-[96vw] max-w-[1500px]" : "max-w-lg"} max-h-[90vh] overflow-y-auto overflow-x-hidden p-0`}>
        {task && <KanbanCoverPicker task={task} readOnly={readOnly} />}
        <div className="space-y-4 p-6">
        <DialogHeader><DialogTitle>{task ? "Tarefa do Kanban" : "Nova tarefa do Kanban"}</DialogTitle></DialogHeader>
        <div className={task ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(340px,34%,540px)]" : ""}>
        <div className="min-w-0 space-y-4">
        <fieldset disabled={readOnly} className="space-y-3">
          <div><Label>Título*</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Coluna</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as KanbanStatus)} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{KANBAN_COLUMNS.map((c) => <SelectItem key={c.status} value={c.status}>{c.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p.v} value={p.v}>{p.l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label>Responsáveis</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {people.map((p) => {
                  const on = assigneeIds.includes(p.id);
                  const style = labelFor(p.full_name ?? "");
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={readOnly}
                      onClick={() =>
                        setAssigneeIds((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))
                      }
                      className={`rounded px-2.5 py-1 text-xs font-semibold transition-opacity disabled:cursor-not-allowed ${on ? "" : "opacity-40 hover:opacity-70"}`}
                      style={{ backgroundColor: style.bg, color: style.text }}
                    >
                      {on && "✓ "}{p.full_name || "Sem nome"}
                    </button>
                  );
                })}
              </div>
              {assigneeIds.length === 0 && <p className="pt-1 text-[11px] text-muted-foreground">Sem responsável: a tarefa fica aberta para todos.</p>}
            </div>
            <div><Label>Prazo</Label><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></div>
            <div><Label>XP da tarefa (1 a 50)</Label>
              <Input type="number" min={1} max={50} value={xp} onChange={(e) => setXp(Number(e.target.value))} onBlur={() => setXp((v) => Math.min(50, Math.max(1, Math.round(v) || 1)))} />
              <p className="pt-1 text-[11px] text-muted-foreground">
                {assigneeIds.length > 1 ? `Dividido entre ${assigneeIds.length} responsáveis: ${(xp / assigneeIds.length).toFixed(1).replace(".0", "")} XP para cada.` : "Dividido igualmente entre os responsáveis."}
              </p>
            </div>
          </div>
        </fieldset>

        {(!readOnly || canDelete) && (
          <div className="flex justify-between gap-2">
            {canDelete ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={removeTask} disabled={del.isPending}>
                <Trash2 className="h-4 w-4 mr-1" />Excluir
              </Button>
            ) : <span />}
            {!readOnly && <Button onClick={save} disabled={busy || !title.trim()}>{busy ? "Salvando..." : "Salvar"}</Button>}
          </div>
        )}

        <KanbanAttachments
          taskId={task?.id ?? null}
          readOnly={readOnly}
          pendingFiles={pendingFiles}
          onPendingChange={setPendingFiles}
        />

        <KanbanChecklist
          taskId={task?.id ?? null}
          readOnly={readOnly}
          pendingItems={pendingChecklist}
          onPendingChange={setPendingChecklist}
        />

        </div>

        {task && (
          <aside className="space-y-3 border-t border-border pt-4 lg:-mr-6 lg:border-l lg:border-t-0 lg:pt-0 lg:pl-6">
            <h4 className="text-sm font-semibold">
              Comentários e atividade
              <span className="ml-1 text-xs font-normal text-muted-foreground">({comments.length}/{MAX_COMMENTS})</span>
            </h4>
            <div ref={listRef} className="max-h-[60vh] space-y-3 overflow-y-auto pr-1 lg:max-h-none lg:h-[calc(90vh-14rem)]">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
                    style={{ backgroundColor: labelFor(nameOf(c.user_id)).bg, color: labelFor(nameOf(c.user_id)).text }}
                  >
                    {nameOf(c.user_id).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-semibold">{nameOf(c.user_id)}</span>{" "}
                      <span className="text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</span>
                    </p>
                    <div className="space-y-2 rounded-lg bg-muted/50 p-2 text-sm">
                      {!((c.images ?? []).length > 0 && c.content === COMMENT_IMAGE_FALLBACK) && (
                        <p className="whitespace-pre-wrap break-words">{renderContent(c.content, c.mentions ?? [])}</p>
                      )}
                      {(c.images ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {(c.images ?? []).map((path) => (
                            <a key={path} href={getKanbanFileUrl(path)} target="_blank" rel="noreferrer">
                              <img
                                src={getKanbanFileUrl(path)}
                                alt="Print do comentário"
                                loading="lazy"
                                className="max-h-48 max-w-full rounded-md border border-border object-contain"
                              />
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
            </div>
            {commentImages.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {imagePreviews.map((url, i) => (
                  <div key={url} className="relative h-16 w-16 overflow-hidden rounded-md border border-border">
                    <img src={url} alt="Prévia do print" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setCommentImages((prev) => prev.filter((_, j) => j !== i))}
                      className="absolute right-0 top-0 rounded-bl bg-background/80 p-0.5 text-foreground hover:text-destructive"
                      aria-label="Remover imagem"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className={`relative flex items-end gap-2 ${commentImages.length > 0 ? "" : "border-t border-border pt-3"}`}>
              <Textarea
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                disabled={comments.length >= MAX_COMMENTS}
                rows={2}
                onPaste={(e) => {
                  const files = Array.from(e.clipboardData.files);
                  if (files.some((f) => f.type.startsWith("image/"))) {
                    e.preventDefault();
                    addCommentImages(files);
                  }
                }}
                className="min-h-[44px] max-h-32 resize-none"
                placeholder={comments.length >= MAX_COMMENTS ? "Limite de comentários atingido" : "Comentário... (@ marca, Shift+Enter pula linha)"}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMentionQuery(null);
                  if (e.key === "Enter" && !e.shiftKey && suggestions.length > 0 && mentionQuery !== null) {
                    e.preventDefault();
                    pickMention(suggestions[0].full_name!);
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    addComment();
                  }
                }}
              />
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addCommentImages(Array.from(e.target.files ?? [])); e.target.value = ""; }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Anexar print (ou cole com Ctrl+V)"
                disabled={comments.length >= MAX_COMMENTS || commentImages.length >= MAX_COMMENT_IMAGES}
                onClick={() => imageInputRef.current?.click()}
              >
                <ImagePlus className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="icon" title="Emojis" disabled={comments.length >= MAX_COMMENTS}>
                    <Smile className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-2">
                  <div className="grid grid-cols-6 gap-1">
                    {EMOJIS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setComment((c) => c + e)}
                        className="rounded p-1 text-xl leading-none hover:bg-muted"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button onClick={addComment} disabled={sending || (!comment.trim() && commentImages.length === 0) || comments.length >= MAX_COMMENTS}>Enviar</Button>
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-16 bottom-full z-50 mb-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                  {suggestions.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => pickMention(p.full_name!)}
                        className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        @{p.full_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
