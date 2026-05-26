import { useState, useMemo } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ListTodo, Trash2, Target, CheckSquare, CalendarDays, User, X } from "lucide-react";
import { SocialTaskChecklist } from "@/components/social/SocialTaskChecklist";
import { useSmTasks, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { SM_PRIORITY_LABEL } from "@/types/social";
import type { SmPriority } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const STATUS = ["backlog","pendente","em_andamento","concluido","descartado"] as const;
const STATUS_LABEL: Record<string, string> = { backlog:"Backlog", pendente:"Pendente", em_andamento:"Em andamento", concluido:"Concluído", descartado:"Descartado" };

type StatusChip = "all" | "open" | "in_progress" | "pending" | "done" | "discarded";
const STATUS_CHIPS: { key: StatusChip; label: string; statuses: string[] }[] = [
  { key: "all", label: "Todas", statuses: [] },
  { key: "open", label: "Abertas", statuses: ["backlog"] },
  { key: "in_progress", label: "Em andamento", statuses: ["em_andamento"] },
  { key: "pending", label: "Pendentes", statuses: ["pendente"] },
  { key: "done", label: "Concluídas", statuses: ["concluido"] },
  { key: "discarded", label: "Desconsideradas", statuses: ["descartado"] },
];

const PRIORITY_CHIPS = [
  { key: "all", label: "Todas" },
  { key: "urgent", label: "Urgente" },
  { key: "high", label: "Alta" },
  { key: "medium", label: "Média" },
  { key: "low", label: "Baixa" },
];

const STATUS_BADGE_CLS: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground border-border",
  pendente: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30",
  em_andamento: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  concluido: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  descartado: "bg-amber-800/20 text-amber-600 border-amber-700/30",
};
const PRIORITY_BADGE_CLS: Record<string, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-violet-500/15 text-violet-400 border-violet-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  urgent: "bg-red-500/15 text-red-400 border-red-500/30",
};

export default function SocialTasks() {
  const { data, loading, refresh } = useSmTasks();
  const { data: clients } = useSmClients();
  const { data: assignableProfiles } = useSocialAssignableProfiles();
  const { user } = useAuth();
  const m = useSocialMutations();
  const [open, setOpen] = useState(false);
  const [checklistTaskId, setChecklistTaskId] = useState<string | null>(null);
  const [draftChecklist, setDraftChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Filters
  const [statusChip, setStatusChip] = useState<StatusChip>("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all"); // "mine" | "all" | userId

  const [form, setForm] = useState({
    title: "", description: "", client_id: "", priority: "medium" as SmPriority,
    due_date: "", status: "backlog",
    assigned_to: "",
    is_recurring_template: false,
    recurrence_type: "" as "" | "daily" | "weekly" | "monthly" | "custom",
    recurrence_interval: 1,
    recurrence_until: "",
    recurrence_weekday: "1",
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

  // Apply assignee filter first
  const assigneeFiltered = useMemo(() => {
    if (!data) return [];
    if (assigneeFilter === "all") return data;
    if (assigneeFilter === "mine") return data.filter(t => t.assigned_to === user?.id);
    return data.filter(t => t.assigned_to === assigneeFilter);
  }, [data, assigneeFilter, user?.id]);

  const advancedFiltered = useMemo(() => {
    let result = assigneeFiltered;
    if (statusChip !== "all") {
      const chip = STATUS_CHIPS.find(c => c.key === statusChip);
      if (chip) result = result.filter(t => chip.statuses.includes(t.status));
    }
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    if (dateFrom) result = result.filter(t => new Date(t.created_at) >= dateFrom);
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23,59,59,999);
      result = result.filter(t => new Date(t.created_at) <= end);
    }
    return result;
  }, [assigneeFiltered, statusChip, priorityFilter, dateFrom, dateTo]);

  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = { all: assigneeFiltered.length };
    STATUS_CHIPS.forEach(c => {
      if (c.key !== "all") counts[c.key] = assigneeFiltered.filter(t => c.statuses.includes(t.status)).length;
    });
    return counts;
  }, [assigneeFiltered]);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    let dueIso: string | null = form.due_date ? new Date(form.due_date).toISOString() : null;
    if (form.is_recurring_template && form.recurrence_type === "weekly" && !form.due_date) {
      dueIso = nextWeekdayDate(Number(form.recurrence_weekday)).toISOString();
    }
    const payload: any = {
      title: form.title, description: form.description || null,
      client_id: form.client_id || null, priority: form.priority,
      due_date: dueIso, status: form.status,
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

  const del = async (id: string) => {
    if (!confirm("Excluir tarefa?")) return;
    const { error } = await m.deleteTask(id);
    if (error) toast.error(error.message); else refresh();
  };

  const clearDateFilters = () => { setDateFrom(undefined); setDateTo(undefined); };
  const hasDateFilter = dateFrom || dateTo;

  const initialsOf = (name?: string | null) =>
    name ? name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() : null;

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title="Tarefas"
        description="Gerencie e acompanhe o tempo das tarefas."
        icon={<ListTodo className="h-5 w-5"/>}
        actions={
          <div className="flex items-center gap-2">
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-9 w-[180px]">
                <User className="h-4 w-4 mr-1 text-muted-foreground"/>
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Minhas tarefas</SelectItem>
                <SelectItem value="all">Todas da equipe</SelectItem>
                {assignableProfiles?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setOpen(true)} className="h-9"><Plus className="h-4 w-4 mr-1"/>Nova Tarefa</Button>
          </div>
        }
      />

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map(chip => (
          <button key={chip.key} onClick={() => setStatusChip(chip.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150
              ${statusChip === chip.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"}`}>
            {chip.label}
            <span className={`text-[10px] ${statusChip === chip.key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>{chipCounts[chip.key] || 0}</span>
          </button>
        ))}
        <div className="h-4 w-px bg-border mx-1"/>
        {PRIORITY_CHIPS.map(p => (
          <button key={p.key} onClick={() => setPriorityFilter(p.key)}
            className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150
              ${priorityFilter === p.key ? "bg-accent text-accent-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {p.label}
          </button>
        ))}
        <div className="h-4 w-px bg-border mx-1"/>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={hasDateFilter ? "default" : "outline"} size="sm" className="h-7 text-xs rounded-full gap-1.5">
              <CalendarDays className="h-3 w-3"/>
              {hasDateFilter
                ? `${dateFrom ? format(dateFrom, "dd/MM", { locale: ptBR }) : "..."} - ${dateTo ? format(dateTo, "dd/MM", { locale: ptBR }) : "..."}`
                : "Período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-3">
              <div><p className="text-xs text-muted-foreground mb-1">De:</p>
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} locale={ptBR} className="rounded-lg"/>
              </div>
              <div><p className="text-xs text-muted-foreground mb-1">Até:</p>
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} locale={ptBR} className="rounded-lg"/>
              </div>
              {hasDateFilter && <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearDateFilters}>Limpar período</Button>}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
       : advancedFiltered.length === 0 ? (
         <Card className="shadow-card"><CardContent className="p-0">
           <EmptyState icon={ListTodo} title="Nenhuma tarefa encontrada" description="Nenhuma tarefa para os filtros selecionados."
             actionLabel="Criar Tarefa" onAction={() => setOpen(true)}/>
         </CardContent></Card>
       ) : (
        <div className="space-y-2">
          {advancedFiltered.map(t => {
            const profile = assignableProfiles?.find(p => p.id === t.assigned_to);
            const initials = initialsOf(profile?.full_name);
            return (
              <div key={t.id}
                onClick={() => setChecklistTaskId(t.id)}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 cursor-pointer shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all duration-150">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                    {t.title}
                    {(t as any).is_recurring_template && <Badge variant="secondary" className="text-[10px]">Recorrente</Badge>}
                  </p>
                  {t.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</p>}
                </div>

                <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLS[t.status] || ""}`}>{STATUS_LABEL[t.status]}</Badge>
                <Badge variant="outline" className={`text-[10px] ${PRIORITY_BADGE_CLS[t.priority] || ""}`}>{SM_PRIORITY_LABEL[t.priority]}</Badge>

                {initials && (
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                )}

                <Button asChild variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary" title="Focar nesta tarefa" onClick={(e) => e.stopPropagation()}>
                  <Link to={`/social/foco?taskId=${t.id}`}><Target className="h-3.5 w-3.5"/></Link>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
                  onClick={(e) => { e.stopPropagation(); setChecklistTaskId(t.id); }} title="Checklist">
                  <CheckSquare className="h-3.5 w-3.5"/>
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={(e) => { e.stopPropagation(); del(t.id); }}>
                  <Trash2 className="h-3.5 w-3.5"/>
                </Button>
              </div>
            );
          })}
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
                        <SelectContent>{WEEKDAYS.map(w => <SelectItem key={w.v} value={w.v}>{w.l}</SelectItem>)}</SelectContent>
                      </Select>
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

      <Dialog open={!!checklistTaskId} onOpenChange={(o) => !o && setChecklistTaskId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Checklist da tarefa</DialogTitle></DialogHeader>
          {checklistTaskId && <SocialTaskChecklist taskId={checklistTaskId} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
