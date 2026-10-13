import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  isKanbanResponsible,
  toColumnStatus,
  useKanbanCreateTask,
  useKanbanDeleteTask,
  useKanbanUpdateTask,
} from "@/hooks/useKanbanTasks";
import { getKanbanFileUrl, useUploadKanbanAttachments } from "@/hooks/useKanbanAttachments";
import { useAddChecklistItems } from "@/hooks/useKanbanChecklist";
import { KanbanAttachments } from "@/components/KanbanAttachments";
import { KanbanChecklist, PendingChecklistItem } from "@/components/KanbanChecklist";
import { labelFor } from "@/lib/kanban-labels";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

// Limite por tarefa; o banco também impede a partir do mesmo número (ver migração de comentários).
const MAX_COMMENTS = 1000;

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
    setComment("");
    setPendingFiles([]);
    setPendingChecklist([]);
  }, [open, task, defaultStatus]);

  const { data: people = [] } = useQuery({
    queryKey: ["kanban-people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return (data ?? []).filter((p) => isKanbanResponsible(p.full_name));
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
    if (!comment.trim() || !task || !user) return;
    if (comments.length >= MAX_COMMENTS) {
      toast.error(`Limite de ${MAX_COMMENTS} comentários por tarefa atingido.`);
      return;
    }
    const content = comment.trim();
    const mentions = profileList
      .filter((p) => p.full_name && content.includes(`@${p.full_name}`))
      .map((p) => p.id);
    const { error } = await supabase
      .from("kanban_task_comments")
      .insert({ task_id: task.id, user_id: user.id, content, mentions });
    if (error) {
      toast.error(error.message);
      return;
    }
    const author = nameOf(user.id);
    for (const uid of mentions.filter((id) => id !== user.id)) {
      await supabase.from("notifications").insert({
        user_id: uid,
        type: "mention",
        message: `${author} mencionou você na tarefa do Kanban "${task.title}"`,
        created_by: user.id,
      });
    }
    setComment("");
    setMentionQuery(null);
    qc.invalidateQueries({ queryKey: ["kanban-comments", task.id] });
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${task ? "max-w-5xl" : "max-w-lg"} max-h-[90vh] overflow-y-auto overflow-x-hidden p-0`}>
        {task?.cover_path && (
          <img src={getKanbanFileUrl(task.cover_path)} alt="" className="block h-44 w-full object-cover sm:h-52" />
        )}
        <div className="space-y-4 p-6">
        <DialogHeader><DialogTitle>{task ? "Tarefa do Kanban" : "Nova tarefa do Kanban"}</DialogTitle></DialogHeader>
        <div className={task ? "grid gap-6 md:grid-cols-[1fr_300px]" : ""}>
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
          </div>
        </fieldset>

        {!readOnly && (
          <div className="flex justify-between gap-2">
            {task && task.created_by === user?.id ? (
              <Button variant="ghost" onClick={async () => { await del.mutateAsync(task.id); onOpenChange(false); }}>
                <Trash2 className="h-4 w-4 mr-1" />Excluir
              </Button>
            ) : <span />}
            <Button onClick={save} disabled={busy || !title.trim()}>{busy ? "Salvando..." : "Salvar"}</Button>
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
          <aside className="space-y-3 md:border-l md:border-border md:pl-6">
            <h4 className="text-sm font-semibold">
              Comentários e atividade
              <span className="ml-1 text-xs font-normal text-muted-foreground">({comments.length}/{MAX_COMMENTS})</span>
            </h4>
            <div className="relative flex gap-2">
              <Input
                value={comment}
                onChange={(e) => onCommentChange(e.target.value)}
                disabled={comments.length >= MAX_COMMENTS}
                placeholder={comments.length >= MAX_COMMENTS ? "Limite de comentários atingido" : "Escreva um comentário... use @ para marcar alguém"}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setMentionQuery(null);
                  if (e.key === "Enter" && suggestions.length > 0 && mentionQuery !== null) {
                    e.preventDefault();
                    pickMention(suggestions[0].full_name!);
                    return;
                  }
                  if (e.key === "Enter") addComment();
                }}
              />
              <Button variant="outline" onClick={addComment} disabled={comments.length >= MAX_COMMENTS}>Enviar</Button>
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-16 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-popover shadow-md">
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
            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {nameOf(c.user_id).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs">
                      <span className="font-semibold">{nameOf(c.user_id)}</span>{" "}
                      <span className="text-muted-foreground">{format(new Date(c.created_at), "dd/MM/yyyy HH:mm")}</span>
                    </p>
                    <p className="whitespace-pre-wrap break-words rounded-lg bg-muted/50 p-2 text-sm">{renderContent(c.content, c.mentions ?? [])}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
            </div>
          </aside>
        )}
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
