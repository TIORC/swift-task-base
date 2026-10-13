import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KANBAN_COLUMNS, KanbanStatus, KanbanTask, useKanbanCreateTask, useKanbanDeleteTask, useKanbanUpdateTask } from "@/hooks/useKanbanTasks";
import { Trash2 } from "lucide-react";
import { format } from "date-fns";

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
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<KanbanStatus>(defaultStatus);
  const [priority, setPriority] = useState("medium");
  const [assignee, setAssignee] = useState("none");
  const [due, setDue] = useState("");
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(task?.title ?? "");
    setDescription(task?.description ?? "");
    setStatus((task?.status as KanbanStatus) ?? defaultStatus);
    setPriority(task?.priority ?? "medium");
    setAssignee(task?.assigned_to ?? "none");
    setDue(task?.due_date ?? "");
    setComment("");
  }, [open, task, defaultStatus]);

  const { data: people = [] } = useQuery({
    queryKey: ["kanban-people"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name").order("full_name");
      return data ?? [];
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
  const nameOf = (id: string) => people.find((p) => p.id === id)?.full_name ?? "—";

  const save = async () => {
    if (!title.trim()) return;
    const row = {
      title: title.trim(),
      description: description || null,
      status: status as any,
      priority: priority as any,
      assigned_to: assignee === "none" ? null : assignee,
      due_date: due || null,
    };
    if (task) await update.mutateAsync({ id: task.id, ...row });
    else await create.mutateAsync(row);
    onOpenChange(false);
  };

  const addComment = async () => {
    if (!comment.trim() || !task || !user) return;
    await supabase.from("kanban_task_comments").insert({ task_id: task.id, user_id: user.id, content: comment.trim() });
    setComment("");
    qc.invalidateQueries({ queryKey: ["kanban-comments", task.id] });
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{task ? "Tarefa do Kanban" : "Nova tarefa do Kanban"}</DialogTitle></DialogHeader>
        <fieldset disabled={readOnly} className="space-y-3">
          <div><Label>Título*</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Status</Label>
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
            <div><Label>Responsável</Label>
              <Select value={assignee} onValueChange={setAssignee} disabled={readOnly}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {people.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
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

        {task && (
          <div className="space-y-2 border-t border-border pt-3">
            <Label>Comentários</Label>
            {comments.map((c) => (
              <div key={c.id} className="rounded-lg bg-muted/50 p-2 text-sm">
                <p className="text-[11px] text-muted-foreground">{nameOf(c.user_id)} · {format(new Date(c.created_at), "dd/MM HH:mm")}</p>
                <p className="whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
            <div className="flex gap-2">
              <Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escreva um comentário..." onKeyDown={(e) => e.key === "Enter" && addComment()} />
              <Button variant="outline" onClick={addComment}>Enviar</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
