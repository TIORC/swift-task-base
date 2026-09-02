import { useState, useMemo, useEffect } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, ListTodo, Trash2, Target, CheckSquare, CalendarDays, User, X, Briefcase, Bookmark, FileStack, Clock, Timer, Ban } from "lucide-react";
import { isOverdue } from "@/lib/dates";
import { SocialTaskChecklist } from "@/components/social/SocialTaskChecklist";
import { SocialTaskDetailDialog } from "@/components/social/SocialTaskDetailDialog";
import { useSmTasks, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { SM_PRIORITY_LABEL } from "@/types/social";
import type { SmPriority } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { SM_NATURES, SM_NATURE_LABEL, SM_NATURE_CLS, SM_BILLABLE_OPTIONS, SM_DISCARD_REASONS, slaLabel, type SmNature } from "@/lib/sm-demands";
import { useSmSlaConfig } from "@/hooks/useSmDemands";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";

const sb = supabase as any;

const STATUS_LABEL: Record<string, string> = { backlog:"Backlog", pendente:"Pendente", em_andamento:"Em andamento", concluido:"Concluído", descartado:"Descartado" };

type StatusChip = "active" | "all" | "open" | "in_progress" | "pending" | "done" | "discarded";
const STATUS_CHIPS: { key: StatusChip; label: string; statuses: string[] }[] = [
  { key: "active", label: "Ativas", statuses: ["backlog","pendente","em_andamento"] },
  { key: "all", label: "Todas", statuses: [] },
  { key: "open", label: "Backlog", statuses: ["backlog"] },
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

type Template = { id: string; name: string; title: string; description: string | null; priority: SmPriority; client_id: string | null };
type TemplateItem = { id: string; template_id: string; title: string; sort_order: number };

export default function SocialTasks() {
  const { data, loading, refresh } = useSmTasks();
  const { data: clients } = useSmClients();
  const { data: assignableProfiles } = useSocialAssignableProfiles();
  const { user } = useAuth();
  const m = useSocialMutations();
  const [open, setOpen] = useState(false);
  const [checklistTaskId, setChecklistTaskId] = useState<string | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [draftChecklist, setDraftChecklist] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([]);
  const [templateManagerOpen, setTemplateManagerOpen] = useState(false);

  const loadTemplates = async () => {
    const [{ data: tpls }, { data: items }] = await Promise.all([
      sb.from("sm_task_templates").select("*").order("name"),
      sb.from("sm_task_template_items").select("*").order("sort_order"),
    ]);
    setTemplates(tpls ?? []);
    setTemplateItems(items ?? []);
  };
  useEffect(() => { loadTemplates(); }, []);

  // Filters
  const [statusChip, setStatusChip] = useState<StatusChip>("active");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [natureFilter, setNatureFilter] = useState<string>("all");
  const [discardFor, setDiscardFor] = useState<string | null>(null);
  const [discardReason, setDiscardReason] = useState<string>(SM_DISCARD_REASONS[0]);
  const [discardNote, setDiscardNote] = useState("");
  const { config: slaConfig } = useSmSlaConfig();

  const [form, setForm] = useState({
    title: "", description: "", client_id: "", priority: "medium" as SmPriority,
    due_date: "", status: "backlog",
    assigned_to: "",
    nature: "avulsa" as SmNature,
    billable: "cobravel",
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

  const assigneeFiltered = useMemo(() => {
    if (!data) return [];
    // Recurring templates are configuration records, not operational tasks.
    // Showing them here makes a completed occurrence look like it returned.
    let list = data.filter(t => !(t as any).is_recurring_template);
    if (assigneeFilter === "mine") list = list.filter(t => t.assigned_to === user?.id);
    else if (assigneeFilter !== "all") list = list.filter(t => t.assigned_to === assigneeFilter);
    if (natureFilter !== "all") list = list.filter(t => ((t as any).nature ?? "avulsa") === natureFilter);
    if (clientFilter !== "all") {
      if (clientFilter === "none") list = list.filter(t => !t.client_id);
      else list = list.filter(t => t.client_id === clientFilter);
    }
    return list;
  }, [data, assigneeFilter, user?.id, clientFilter, natureFilter]);

  const advancedFiltered = useMemo(() => {
    let result = assigneeFiltered;
    const chip = STATUS_CHIPS.find(c => c.key === statusChip);
    if (chip && chip.statuses.length > 0) result = result.filter(t => chip.statuses.includes(t.status));
    if (priorityFilter !== "all") result = result.filter(t => t.priority === priorityFilter);
    if (dateFrom) result = result.filter(t => new Date(t.created_at) >= dateFrom);
    if (dateTo) {
      const end = new Date(dateTo); end.setHours(23,59,59,999);
      result = result.filter(t => new Date(t.created_at) <= end);
    }
    return result;
  }, [assigneeFiltered, statusChip, priorityFilter, dateFrom, dateTo]);

  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    STATUS_CHIPS.forEach(c => {
      counts[c.key] = c.statuses.length === 0 ? assigneeFiltered.length : assigneeFiltered.filter(t => c.statuses.includes(t.status)).length;
    });
    return counts;
  }, [assigneeFiltered]);

  const applyTemplate = (tplId: string) => {
    const tpl = templates.find(t => t.id === tplId);
    if (!tpl) return;
    setForm(f => ({ ...f, title: tpl.title, description: tpl.description ?? "", priority: tpl.priority, client_id: tpl.client_id ?? "" }));
    const items = templateItems.filter(i => i.template_id === tplId).sort((a,b) => a.sort_order - b.sort_order).map(i => i.title);
    setDraftChecklist(items);
    toast.success(`Modelo "${tpl.name}" aplicado`);
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    if (saveAsTemplate && !templateName.trim()) return toast.error("Informe o nome do modelo");
    // "YYYY-MM-DD" é interpretado como UTC pelo Date(); fixamos meio-dia local
    // para o prazo não voltar um dia no fuso do Brasil.
    let dueIso: string | null = form.due_date ? new Date(form.due_date + "T12:00:00").toISOString() : null;
    if (form.is_recurring_template && form.recurrence_type === "weekly" && !form.due_date) {
      dueIso = nextWeekdayDate(Number(form.recurrence_weekday)).toISOString();
    }
    const payload: any = {
      title: form.title, description: form.description || null,
      client_id: form.client_id || null, priority: form.priority,
      due_date: dueIso, status: form.status,
      assigned_to: form.assigned_to || null,
      nature: form.nature,
      billable: form.nature === "avulsa" ? form.billable : null,
      is_recurring_template: form.is_recurring_template,
      recurrence_type: form.is_recurring_template && form.recurrence_type ? form.recurrence_type : null,
      recurrence_interval: form.is_recurring_template ? form.recurrence_interval || 1 : null,
      recurrence_until: form.is_recurring_template && form.recurrence_until ? new Date(form.recurrence_until + "T12:00:00").toISOString() : null,
    };
    const { data: created, error } = await m.createTask(payload);
    if (error) return toast.error(error.message);
    const newId = (created as any)?.id;
    if (newId && draftChecklist.length > 0 && user) {
      const rows = draftChecklist.map((title, i) => ({ task_id: newId, title, created_by: user.id, sort_order: i }));
      const { error: clErr } = await sb.from("sm_task_checklist_items").insert(rows);
      if (clErr) toast.error("Tarefa criada, mas falhou checklist: " + clErr.message);
    }
    if (saveAsTemplate && user) {
      const { data: tpl, error: tplErr } = await sb.from("sm_task_templates").insert({
        name: templateName.trim(), title: form.title, description: form.description || null,
        priority: form.priority, client_id: form.client_id || null, created_by: user.id,
      }).select().single();
      if (tplErr) toast.error("Falha ao salvar modelo: " + tplErr.message);
      else if (tpl && draftChecklist.length > 0) {
        await sb.from("sm_task_template_items").insert(
          draftChecklist.map((title, i) => ({ template_id: tpl.id, title, sort_order: i, created_by: user.id }))
        );
        loadTemplates();
      }
    }
    toast.success("Tarefa criada");
    setOpen(false);
    setForm({ title: "", description: "", client_id: "", priority: "medium", due_date: "", status: "backlog", assigned_to: "", nature: "avulsa", billable: "cobravel", is_recurring_template: false, recurrence_type: "", recurrence_interval: 1, recurrence_until: "", recurrence_weekday: "1" });
    setDraftChecklist([]); setNewChecklistItem("");
    setSaveAsTemplate(false); setTemplateName("");
    refresh();
  };

  const del = async (id: string) => {
    if (!confirm("Excluir tarefa?")) return;
    const { error } = await m.deleteTask(id);
    if (error) toast.error(error.message); else refresh();
  };

  const delTemplate = async (id: string) => {
    if (!confirm("Excluir este modelo?")) return;
    const { error } = await sb.from("sm_task_templates").delete().eq("id", id);
    if (error) toast.error(error.message); else loadTemplates();
  };

  const clearDateFilters = () => { setDateFrom(undefined); setDateTo(undefined); };
  const hasDateFilter = dateFrom || dateTo;

  const initialsOf = (name?: string | null) =>
    name ? name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase() : null;

  const clientName = (id?: string | null) => id ? (clients.find(c => c.id === id)?.name ?? null) : null;

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title="Tarefas"
        description="Gerencie e acompanhe o tempo das tarefas."
        icon={<ListTodo className="h-5 w-5"/>}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="h-9 w-[170px]">
                <Briefcase className="h-4 w-4 mr-1 text-muted-foreground"/>
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos clientes</SelectItem>
                <SelectItem value="none">Sem cliente</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="h-9 w-[170px]">
                <User className="h-4 w-4 mr-1 text-muted-foreground"/>
                <SelectValue/>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mine">Minhas tarefas</SelectItem>
                <SelectItem value="all">Toda equipe</SelectItem>
                {assignableProfiles?.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild variant="outline" className="h-9">
              <Link to="/social/foco"><Target className="h-4 w-4 mr-1"/>Modo Foco</Link>
            </Button>
            <Button variant="outline" className="h-9" onClick={() => setTemplateManagerOpen(true)}>
              <FileStack className="h-4 w-4 mr-1"/>Modelos
            </Button>
            <Button onClick={() => setOpen(true)} className="h-9"><Plus className="h-4 w-4 mr-1"/>Nova Tarefa</Button>
          </div>
        }
      />

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
        {[{ key: "all", label: "Toda natureza" }, ...SM_NATURES.map(n => ({ key: n, label: SM_NATURE_LABEL[n] }))].map(n => (
          <button key={n.key} onClick={() => setNatureFilter(n.key)}
            className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150
              ${natureFilter === n.key ? "bg-accent text-accent-foreground shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            {n.label}
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
            const cName = clientName(t.client_id);
            return (
              <div key={t.id}
                onClick={() => setChecklistTaskId(t.id)}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 cursor-pointer shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all duration-150">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-2">
                    {t.title}
                    {(t as any).is_recurring_template && <Badge variant="secondary" className="text-[10px]">Recorrente</Badge>}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {cName && (
                      <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20 gap-1">
                        <Briefcase className="h-2.5 w-2.5"/>{cName}
                      </Badge>
                    )}
                    {t.due_date && t.status !== "concluido" && t.status !== "descartado" && (
                      <Badge variant="outline" className={`text-[10px] gap-1 ${isOverdue(t.due_date) ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted/50 text-muted-foreground border-border"}`}>
                        <Clock className="h-2.5 w-2.5"/>
                        Prazo {format(new Date(t.due_date), "dd/MM", { locale: ptBR })}
                        {isOverdue(t.due_date) && <span className="font-semibold">· atrasada</span>}
                      </Badge>
                    )}
                    <Badge variant="outline" className={`text-[10px] ${SM_NATURE_CLS[((t as any).nature ?? "avulsa") as SmNature] ?? ""}`}>
                      {SM_NATURE_LABEL[((t as any).nature ?? "avulsa") as SmNature] ?? "Avulsa"}
                    </Badge>
                    {(t as any).billable && (
                      <Badge variant="outline" className="text-[10px]">
                        {(t as any).billable === "cobravel" ? "Cobrável" : "Interna"}
                      </Badge>
                    )}
                    {(t as any).is_approval_step && <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Aprovação</Badge>}
                    {t.status !== "concluido" && t.status !== "descartado" && (() => {
                      const sla = slaLabel(t.created_at, t.priority, slaConfig);
                      return (
                        <Badge variant="outline" className={`text-[10px] gap-1 ${sla.overdue ? "bg-destructive/10 text-destructive border-destructive/30" : "bg-muted/50 text-muted-foreground border-border"}`}>
                          <Timer className="h-2.5 w-2.5"/>{sla.text}
                        </Badge>
                      );
                    })()}
                    {(t as any).discard_reason && (
                      <Badge variant="outline" className="text-[10px] bg-amber-800/10 text-amber-600 border-amber-700/30">
                        Descarte: {(t as any).discard_reason}
                      </Badge>
                    )}
                    {t.description && <p className="text-xs text-muted-foreground truncate">{t.description}</p>}
                  </div>
                </div>

                <Badge variant="outline" className={`text-[10px] ${STATUS_BADGE_CLS[t.status] || ""}`}>{STATUS_LABEL[t.status]}</Badge>
                <Badge variant="outline" className={`text-[10px] ${PRIORITY_BADGE_CLS[t.priority] || ""}`}>{SM_PRIORITY_LABEL[t.priority]}</Badge>

                {initials && (
                  <Avatar className="h-6 w-6 shrink-0">
                    {(profile as any)?.avatar_url && <AvatarImage src={(profile as any).avatar_url} alt="" />}
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
                {t.status !== "descartado" && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-amber-600" title="Desconsiderar"
                    onClick={(e) => { e.stopPropagation(); setDiscardFor(t.id); setDiscardReason(SM_DISCARD_REASONS[0]); setDiscardNote(""); }}>
                    <Ban className="h-3.5 w-3.5"/>
                  </Button>
                )}
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {templates.length > 0 && (
              <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                <Label className="text-xs flex items-center gap-1.5"><Bookmark className="h-3 w-3"/>Usar modelo</Label>
                <Select onValueChange={applyTemplate}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Escolha um modelo..."/></SelectTrigger>
                  <SelectContent>
                    {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
                <Label>Natureza da demanda *</Label>
                <Select value={form.nature} onValueChange={v => setForm({...form, nature: v as SmNature})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{SM_NATURES.map(n => <SelectItem key={n} value={n}>{SM_NATURE_LABEL[n]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {form.nature === "avulsa" && (
                <div>
                  <Label>Cobrança *</Label>
                  <Select value={form.billable} onValueChange={v => setForm({...form, billable: v})}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>{SM_BILLABLE_OPTIONS.map(o => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
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

            <div className="rounded-lg border border-border p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
                <Bookmark className="h-4 w-4 text-primary"/> Salvar como modelo
              </label>
              {saveAsTemplate && (
                <Input placeholder="Nome do modelo (ex.: Post Reels - Cliente X)" value={templateName} onChange={(e) => setTemplateName(e.target.value)} />
              )}
              {saveAsTemplate && (
                <p className="text-[11px] text-muted-foreground">O modelo guarda título, descrição, cliente, prioridade e o checklist abaixo para reutilizar depois.</p>
              )}
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckSquare className="h-4 w-4 text-primary"/> Checklist
                {form.is_recurring_template && draftChecklist.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">Repetirá nas recorrências</Badge>
                )}
              </div>
              {draftChecklist.length > 0 && (
                <ul className="space-y-1">
                  {draftChecklist.map((it, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                      <span className="flex-1">{it}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                        onClick={() => setDraftChecklist(prev => prev.filter((_, i) => i !== idx))}>
                        <X className="h-3 w-3"/>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input placeholder="Nova etapa..." value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = newChecklistItem.trim();
                      if (t) { setDraftChecklist(p => [...p, t]); setNewChecklistItem(""); }
                    }
                  }}/>
                <Button type="button" size="sm" onClick={() => {
                  const t = newChecklistItem.trim();
                  if (t) { setDraftChecklist(p => [...p, t]); setNewChecklistItem(""); }
                }}><Plus className="h-4 w-4"/></Button>
              </div>
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

      <Dialog open={templateManagerOpen} onOpenChange={setTemplateManagerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Modelos de tarefa</DialogTitle></DialogHeader>
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhum modelo ainda. Ao criar uma nova tarefa, marque "Salvar como modelo" para reutilizar depois.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {templates.map(t => {
                const items = templateItems.filter(i => i.template_id === t.id);
                return (
                  <div key={t.id} className="rounded-lg border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.title}</p>
                        {items.length > 0 && (
                          <p className="text-[11px] text-muted-foreground mt-1">{items.length} item(ns) no checklist</p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => delTemplate(t.id)}>
                        <Trash2 className="h-3.5 w-3.5"/>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!discardFor} onOpenChange={(o) => !o && setDiscardFor(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Desconsiderar demanda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motivo *</Label>
              <Select value={discardReason} onValueChange={setDiscardReason}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{SM_DISCARD_REASONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observação</Label>
              <Textarea rows={2} value={discardNote} onChange={e => setDiscardNote(e.target.value)}/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscardFor(null)}>Cancelar</Button>
            <Button onClick={async () => {
              if (!discardFor) return;
              const reason = discardNote.trim() ? `${discardReason} — ${discardNote.trim()}` : discardReason;
              const { error } = await sb.from("sm_tasks").update({ status: "descartado", discard_reason: reason }).eq("id", discardFor);
              if (error) return toast.error(error.message);
              toast.success("Demanda desconsiderada");
              setDiscardFor(null); refresh();
            }}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
