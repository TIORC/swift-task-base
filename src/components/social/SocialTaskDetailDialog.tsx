import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Trash2, Send, Clock, CheckCircle2, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { SocialTaskChecklist } from "@/components/social/SocialTaskChecklist";
import { useSmTaskComments, useSmTaskTime, formatMinutes } from "@/hooks/useSmTaskExtras";
import { SM_PRIORITY_LABEL } from "@/types/social";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const sb = supabase as any;

const STATUS_OPTIONS = [
  { v: "backlog", l: "Backlog" },
  { v: "pendente", l: "Pendente" },
  { v: "em_andamento", l: "Em andamento" },
  { v: "concluido", l: "Concluído" },
];

interface Props {
  task: any | null;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function SocialTaskDetailDialog({ task, onOpenChange, onChanged }: Props) {
  const { user } = useAuth();
  const { data: profiles } = useSocialAssignableProfiles();
  const taskId = task?.id ?? null;
  const comments = useSmTaskComments(taskId);
  const time = useSmTaskTime(taskId);

  const [form, setForm] = useState<any>({});
  const [comment, setComment] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [manualMin, setManualMin] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!task) return;
    setForm({
      title: task.title ?? "",
      description: task.description ?? "",
      status: task.status ?? "backlog",
      priority: task.priority ?? "medium",
      assigned_to: task.assigned_to ?? "",
      due_date: task.due_date ? String(task.due_date).slice(0, 10) : "",
    });
    setComment(""); setMentions([]);
  }, [task?.id]);

  // relógio do timer em execução
  useEffect(() => {
    if (!time.running) return;
    const i = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(i);
  }, [time.running]);

  const runningMinutes = useMemo(() => {
    if (!time.running) return 0;
    return Math.max(0, Math.round((Date.now() - new Date(time.running.started_at).getTime()) / 60000));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time.running, tick]);

  const nameOf = (id?: string | null) =>
    profiles?.find((p: any) => p.id === id)?.full_name || "Usuário";
  const initials = (n: string) => n.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  if (!task) return null;

  const save = async () => {
    const payload: any = {
      title: form.title,
      description: form.description || null,
      status: form.status,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date ? new Date(form.due_date + "T12:00:00").toISOString() : null,
    };
    const { error } = await sb.from("sm_tasks").update(payload).eq("id", task.id);
    if (error) return toast.error(error.message);
    if (form.assigned_to && form.assigned_to !== task.assigned_to && user) {
      await sb.from("notifications").insert({
        user_id: form.assigned_to,
        type: "assignment",
        message: `Tarefa M7 transferida para você: ${form.title}`,
        created_by: user.id,
      });
    }
    toast.success("Tarefa atualizada");
    onChanged();
  };

  const sendForApproval = async () => {
    const { error } = await sb.from("sm_tasks")
      .update({ requires_approval: true, approval_status: "pendente", status: "pendente" })
      .eq("id", task.id);
    if (error) return toast.error(error.message);
    toast.success("Enviada para aprovação do gestor");
    onChanged();
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    const res: any = await comments.add(comment.trim(), mentions);
    if (res?.error) return toast.error(res.error.message);
    setComment(""); setMentions([]);
  };

  return (
    <Dialog open={!!task} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 leading-snug">{task.title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <Badge variant="outline" className="text-[10px]">{SM_PRIORITY_LABEL[task.priority as keyof typeof SM_PRIORITY_LABEL] ?? task.priority}</Badge>
          <Badge variant="outline" className="text-[10px]">
            <Clock className="h-3 w-3 mr-1" />
            {formatMinutes(time.totalMinutes + runningMinutes)} trabalhados
          </Badge>
          {task.approval_status && task.approval_status !== "nao_requer" && (
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
              Aprovação: {task.approval_status}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="detalhes" className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="tempo">Tempo</TabsTrigger>
            <TabsTrigger value="comentarios">Comentários</TabsTrigger>
          </TabsList>

          <TabsContent value="detalhes" className="space-y-3 pt-3">
            <div><Label>Título</Label>
              <Input value={form.title ?? ""} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div><Label>Descrição</Label>
              <Textarea rows={4} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SM_PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Responsável (transferir)</Label>
                <Select value={form.assigned_to || "none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {profiles?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label>
                <Input type="date" value={form.due_date ?? ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 pt-1">
              <Button variant="outline" onClick={sendForApproval}>
                <CheckCircle2 className="h-4 w-4 mr-1" /> Enviar para aprovação
              </Button>
              <Button onClick={save}>Salvar alterações</Button>
            </div>
          </TabsContent>

          <TabsContent value="checklist" className="pt-3">
            <SocialTaskChecklist taskId={task.id} />
          </TabsContent>

          <TabsContent value="tempo" className="space-y-3 pt-3">
            <div className="flex items-center gap-2">
              {time.running ? (
                <Button variant="destructive" onClick={time.stop}>
                  <Square className="h-4 w-4 mr-1" /> Parar ({formatMinutes(runningMinutes)})
                </Button>
              ) : (
                <Button onClick={() => time.start()}>
                  <Play className="h-4 w-4 mr-1" /> Iniciar cronômetro
                </Button>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <Input className="w-24" type="number" min={1} placeholder="min" value={manualMin}
                  onChange={(e) => setManualMin(e.target.value)} />
                <Button variant="outline" size="icon" onClick={async () => {
                  const n = Number(manualMin);
                  if (!n || n < 1) return toast.error("Informe os minutos");
                  await time.addManual(n);
                  setManualMin("");
                }}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Total registrado: <span className="font-semibold text-foreground">{formatMinutes(time.totalMinutes)}</span>
            </p>
            <div className="space-y-1.5">
              {time.logs.length === 0 && <p className="text-xs text-muted-foreground">Nenhum registro de tempo.</p>}
              {time.logs.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs">
                  <span className="flex-1 truncate">
                    {nameOf(l.user_id)} · {format(new Date(l.started_at), "dd/MM HH:mm", { locale: ptBR })}
                    {l.ended_at ? ` — ${formatMinutes(l.duration_minutes ?? 0)}` : " — em andamento"}
                  </span>
                  {l.user_id === user?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={() => time.removeLog(l.id)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="comentarios" className="space-y-3 pt-3">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {comments.data.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
              {comments.data.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px]">{initials(nameOf(c.user_id))}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 rounded-lg bg-muted/40 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">
                      {nameOf(c.user_id)} · {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
                  </div>
                  {c.user_id === user?.id && (
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                      onClick={() => comments.remove(c.id)}><Trash2 className="h-3 w-3" /></Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Textarea rows={2} placeholder="Escreva um comentário..." value={comment}
                onChange={(e) => setComment(e.target.value)} />
              <div className="flex items-center gap-2">
                <Select value="" onValueChange={(v) => {
                  setMentions((m) => (m.includes(v) ? m : [...m, v]));
                  setComment((c) => `${c}${c && !c.endsWith(" ") ? " " : ""}@${nameOf(v)} `);
                }}>
                  <SelectTrigger className="w-48 h-9"><SelectValue placeholder="Mencionar pessoa" /></SelectTrigger>
                  <SelectContent>
                    {profiles?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button className="ml-auto" onClick={addComment} disabled={!comment.trim()}>
                  <Send className="h-4 w-4 mr-1" /> Comentar
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
