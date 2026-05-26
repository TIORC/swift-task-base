import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ListTodo, Trash2, Target, CheckSquare } from "lucide-react";
import { SocialTaskChecklist } from "@/components/social/SocialTaskChecklist";
import { useSmTasks, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { SM_PRIORITY_LABEL } from "@/types/social";
import type { SmPriority } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

const STATUS = ["backlog","pendente","em_andamento","concluido","descartado"] as const;
const STATUS_LABEL: Record<string, string> = { backlog:"Backlog", pendente:"Pendente", em_andamento:"Em andamento", concluido:"Concluído", descartado:"Descartado" };

export default function SocialTasks() {
  const { data, loading, refresh } = useSmTasks();
  const { data: clients } = useSmClients();
  const { data: assignableProfiles } = useSocialAssignableProfiles();
  const m = useSocialMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", client_id: "", priority: "medium" as SmPriority,
    due_date: "", status: "backlog",
    assigned_to: "",
    is_recurring_template: false,
    recurrence_type: "" as "" | "daily" | "weekly" | "monthly" | "custom",
    recurrence_interval: 1,
    recurrence_until: "",
    recurrence_weekday: "1", // 0=Dom .. 6=Sáb
  });

  const WEEKDAYS = [
    { v: "0", l: "Domingo" }, { v: "1", l: "Segunda" }, { v: "2", l: "Terça" },
    { v: "3", l: "Quarta" }, { v: "4", l: "Quinta" }, { v: "5", l: "Sexta" }, { v: "6", l: "Sábado" },
  ];

  const nextWeekdayDate = (weekday: number): Date => {
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    const diff = (weekday - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + diff);
    return d;
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    let dueIso: string | null = form.due_date ? new Date(form.due_date).toISOString() : null;
    if (form.is_recurring_template && form.recurrence_type === "weekly" && !form.due_date) {
      dueIso = nextWeekdayDate(Number(form.recurrence_weekday)).toISOString();
    }
    const payload: any = {
      title: form.title, description: form.description || null,
      client_id: form.client_id || null, priority: form.priority,
      due_date: dueIso,
      status: form.status,
      assigned_to: form.assigned_to || null,
      is_recurring_template: form.is_recurring_template,
      recurrence_type: form.is_recurring_template && form.recurrence_type ? form.recurrence_type : null,
      recurrence_interval: form.is_recurring_template ? form.recurrence_interval || 1 : null,
      recurrence_until: form.is_recurring_template && form.recurrence_until ? new Date(form.recurrence_until).toISOString() : null,
    };
    const { error } = await m.createTask(payload);
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setOpen(false);
    setForm({ title: "", description: "", client_id: "", priority: "medium", due_date: "", status: "backlog", assigned_to: "", is_recurring_template: false, recurrence_type: "", recurrence_interval: 1, recurrence_until: "", recurrence_weekday: "1" });
    refresh();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await m.updateTask(id, { status });
    if (error) toast.error(error.message); else refresh();
  };
  const transfer = async (id: string, userId: string) => {
    const { error } = await m.updateTask(id, { assigned_to: userId === "none" ? null : userId });
    if (error) toast.error(error.message); else { toast.success("Tarefa transferida"); refresh(); }
  };
  const del = async (id: string) => {
    if (!confirm("Excluir tarefa?")) return;
    const { error } = await m.deleteTask(id);
    if (error) toast.error(error.message); else refresh();
  };

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas" description="Tarefas operacionais da equipe Social Media" icon={<ListTodo className="h-5 w-5"/>}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1"/>Nova tarefa</Button>}
      />
      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
       : data.length === 0 ? <EmptyState icon={ListTodo} title="Nenhuma tarefa" description="Crie uma tarefa operacional para começar."/>
       : (
        <div className="space-y-2">
          {data.map(t => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate flex items-center gap-2">
                    {t.title}
                    {(t as any).is_recurring_template && <Badge variant="secondary" className="text-[10px]">Recorrente</Badge>}
                    {(t as any).parent_recurring_task_id && <Badge variant="outline" className="text-[10px]">↻</Badge>}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{SM_PRIORITY_LABEL[t.priority]}</Badge>
                    <span>{clientName(t.client_id)}</span>
                    {t.due_date && <span>• {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
                <Select value={t.assigned_to || "none"} onValueChange={(v) => transfer(t.id, v)}>
                  <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue placeholder="Responsável"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem responsável</SelectItem>
                    {assignableProfiles?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
                  <SelectTrigger className="w-[160px] h-8"><SelectValue/></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
                <Button asChild variant="outline" size="sm" title="Focar nesta tarefa">
                  <Link to={`/social/foco?taskId=${t.id}`}><Target className="h-4 w-4 mr-1"/>Focar</Link>
                </Button>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(t.id)}><Trash2 className="h-4 w-4"/></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})}/></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id || "_none"} onValueChange={v => setForm({...form, client_id: v === "_none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Sem cliente"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v as SmPriority})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{(["low","medium","high","urgent"] as SmPriority[]).map(p => <SelectItem key={p} value={p}>{SM_PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}/></div>
            </div>

            <div>
              <Label>Responsável</Label>
              <Select value={form.assigned_to || "none"} onValueChange={v => setForm({...form, assigned_to: v === "none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Sem responsável"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {assignableProfiles?.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={form.is_recurring_template} onChange={(e) => setForm({ ...form, is_recurring_template: e.target.checked })} />
                Tarefa recorrente
              </label>
              {form.is_recurring_template && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Frequência</Label>
                    <Select value={form.recurrence_type || "daily"} onValueChange={(v) => setForm({ ...form, recurrence_type: v as any })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diária</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="custom">A cada N dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.recurrence_type === "weekly" && (
                    <div>
                      <Label className="text-xs">Dia da semana</Label>
                      <Select value={form.recurrence_weekday} onValueChange={(v) => setForm({ ...form, recurrence_weekday: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map(w => <SelectItem key={w.v} value={w.v}>{w.l}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {form.recurrence_type === "custom" && (
                    <div>
                      <Label className="text-xs">A cada (dias)</Label>
                      <Input type="number" min={1} value={form.recurrence_interval} onChange={(e) => setForm({ ...form, recurrence_interval: Number(e.target.value) || 1 })} />
                    </div>
                  )}
                  <div className="col-span-2">
                    <Label className="text-xs">Repetir até (opcional)</Label>
                    <Input type="date" value={form.recurrence_until} onChange={(e) => setForm({ ...form, recurrence_until: e.target.value })} />
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
