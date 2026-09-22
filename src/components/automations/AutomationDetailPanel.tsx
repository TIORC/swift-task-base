import { useState, type CSSProperties } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Automation, AutomationSubtask, AutomationBlocker, AutomationEvent,
  STATUS_LABELS, STATUS_COLORS, AUTOMATION_STATUSES, PRIORITY_LABELS, PRIORITY_OPTIONS,
  RISK_LABELS, BLOCKER_TYPES, BLOCKER_TYPE_LABELS,
  COMPLEXITY_OPTIONS, COMPLEXITY_LABELS, COMPLEXITY_BONUS_KEYS,
  computeHealthScore, AutomationStatus,
} from "@/types/automation";
import { SECTORS } from "@/types/sectors";
import { useUpdateAutomation } from "@/hooks/useAutomationsData";
import { useAutomationSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask } from "@/hooks/useAutomationsData";
import { useAutomationScopeItems, useCreateScopeItem, useUpdateScopeItem, useDeleteScopeItem } from "@/hooks/useAutomationsData";
import { useAutomationBlockers, useCreateBlocker, useResolveBlocker } from "@/hooks/useAutomationsData";
import { useAutomationEvents } from "@/hooks/useAutomationsData";
import { useAutomationTimeLogs, useCreateTimeLog, useXpSettings } from "@/hooks/useAutomationsData";
import { TimeLogsEditor } from "@/components/TimeLogsEditor";

import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatTime, formatMinutes } from "@/hooks/useTimeTracker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CheckCircle2, Clock, Code2, FileText, History,
  ListChecks, Lock, MessageSquare, Paperclip, Play, Plus, Save, Square, Timer, Trash2, X,
  Sparkles, RefreshCcw, Unlock, Pencil, CalendarClock, Check, User,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TIMELINE_META: Record<string, { label: string; color: string; Icon: LucideIcon }> = {
  created: { label: "criou a automação", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", Icon: Sparkles },
  status_changed: { label: "mudou o status", color: "bg-blue-500/15 text-blue-600 dark:text-blue-400", Icon: RefreshCcw },
  blocker_added: { label: "registrou um bloqueio", color: "bg-red-500/15 text-red-600 dark:text-red-400", Icon: Lock },
  blocker_resolved: { label: "resolveu um bloqueio", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", Icon: Unlock },
  comment: { label: "comentou", color: "bg-muted text-muted-foreground", Icon: MessageSquare },
  subtask_added: { label: "adicionou uma etapa", color: "bg-amber-500/15 text-amber-600 dark:text-amber-400", Icon: Plus },
  subtask_completed: { label: "concluiu uma etapa", color: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", Icon: CheckCircle2 },
};

const MODAL_TABS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: "details", label: "Dados", Icon: FileText },
  { value: "escopo", label: "Escopo", Icon: ListChecks },
  { value: "tarefas", label: "Tarefas", Icon: Code2 },
  { value: "comments", label: "Chat", Icon: MessageSquare },
  { value: "files", label: "Anexos", Icon: Paperclip },
  { value: "blockers", label: "Bloq.", Icon: Lock },
  { value: "timeline", label: "Timeline", Icon: History },
  { value: "time", label: "Tempo", Icon: Timer },
];

import { AutomationComments } from "@/components/automations/AutomationComments";
import { AutomationAttachments } from "@/components/automations/AutomationAttachments";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

interface Props {
  automation: Automation | null;
  open: boolean;
  onClose: () => void;
  profileMap: Record<string, string>;
  profiles: { id: string; full_name: string | null }[];
  isReadOnly?: boolean;
}

export function AutomationDetailPanel({ automation, open, onClose, profileMap, profiles, isReadOnly }: Props) {
  const updateAutomation = useUpdateAutomation();
  const { user } = useAuth();
  const { profile, roles } = useUserRole();
  const { data: subtasks = [] } = useAutomationSubtasks(automation?.id ?? null);
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const { data: scopeItems = [] } = useAutomationScopeItems(automation?.id ?? null);
  const createScopeItem = useCreateScopeItem();
  const updateScopeItem = useUpdateScopeItem();
  const deleteScopeItem = useDeleteScopeItem();
  const { data: blockers = [] } = useAutomationBlockers(automation?.id ?? null);
  const createBlocker = useCreateBlocker();
  const resolveBlocker = useResolveBlocker();
  const { data: events = [] } = useAutomationEvents(automation?.id ?? null);
  const { data: timeLogs = [] } = useAutomationTimeLogs(automation?.id ?? null);
  const createTimeLog = useCreateTimeLog();
  const { data: xpSettings } = useXpSettings();

  const [newSubtask, setNewSubtask] = useState("");
  const [newSubtaskScope, setNewSubtaskScope] = useState("none");
  const [newScopeItem, setNewScopeItem] = useState("");
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
  const [editingScopeDraft, setEditingScopeDraft] = useState("");
  const [newBlockerType, setNewBlockerType] = useState("other");
  const [newBlockerDesc, setNewBlockerDesc] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeDesc, setTimeDesc] = useState("");

  if (!automation) return null;

  const a = automation;

  // ── Papéis ──
  // Equipe técnica (dev) pode mudar status, tarefas, horas etc.
  // Solicitante acompanha, comenta e gerencia o escopo (enquanto aberto).
  const isTech = profile === "admin" || profile === "gestor" || profile === "lider" || roles.includes("dev");
  // Somente admin/gestor reatribui o responsável da automação.
  const canReassign = profile === "admin" || profile === "gestor";
  const isSolicitante = !isTech;
  // Itens de escopo: solicitante edita só quando status em Solicitação/Backlog;
  // a equipe técnica também pode administrar o checklist.
  const scopeOpenStatuses = ["requested", "backlog"] as AutomationStatus[];
  const canEditScope = isSolicitante ? scopeOpenStatuses.includes(a.status) : isTech;

  const canManage = isTech || a.assigned_to === user?.id || a.created_by === user?.id;
  const readOnly = !!isReadOnly || !canManage;
  const health = computeHealthScore(a);

  const handleUpdate = (values: Partial<Automation>) => {
    updateAutomation.mutate({ id: a.id, ...values });
  };

  // ── Barras de progresso (separadas) ──
  const scopeTotal = scopeItems.length;
  const scopeDone = scopeItems.filter((i) => i.concluded).length;
  const scopePct = scopeTotal ? Math.round((scopeDone / scopeTotal) * 100) : 0;
  const execTotal = subtasks.length;
  const execDone = subtasks.filter((t) => t.completed).length;
  const execPct = execTotal ? Math.round((execDone / execTotal) * 100) : 0;

  // Tempo trabalhado acumulado por tarefa técnica (logs com subtask_id).
  const subtaskMinutes: Record<string, number> = {};
  (timeLogs || []).forEach((l) => {
    if (l.subtask_id) subtaskMinutes[l.subtask_id] = (subtaskMinutes[l.subtask_id] || 0) + (l.duration_minutes || 0);
  });

  // XP por tarefa técnica + bônus de conclusão por complexidade (public.xp_settings).
  const perTaskXp = xpSettings?.["xp_per_automation_task"] ?? 1;
  const complexityName = COMPLEXITY_LABELS[a.complexity || "medium"] || "Média";
  const complexityBonus = xpSettings?.[COMPLEXITY_BONUS_KEYS[a.complexity || "medium"]] ?? 0;
  const xpBadgeTitle = complexityBonus > 0
    ? `+${perTaskXp} XP por tarefa concluída · Bônus de conclusão (${complexityName}): +${complexityBonus} XP`
    : `+${perTaskXp} XP por tarefa concluída`;

  // Indicadores visuais do status de saúde.
  const healthDot = health.score >= 70 ? "#22c55e" : health.score >= 40 ? "#f5b942" : "#ef4444";
  const healthPulse = health.score >= 70 ? "rgb(34 197 94 / .35)" : health.score >= 40 ? "rgb(245 185 66 / .4)" : "rgb(239 68 68 / .4)";
  const healthStyle = { background: healthDot, "--pulse-color": healthPulse } as CSSProperties;

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    createSubtask.mutate({
      automation_id: a.id,
      title: newSubtask,
      deadline: new Date().toISOString(),
      sort_order: subtasks.length,
      item_escopo_id: newSubtaskScope !== "none" ? newSubtaskScope : null,
    });
    setNewSubtask("");
    setNewSubtaskScope("none");
  };

  const handleAddScopeItem = () => {
    if (!newScopeItem.trim()) return;
    createScopeItem.mutate({ automation_id: a.id, description: newScopeItem.trim() });
    setNewScopeItem("");
  };

  const startEditScope = (id: string, current: string) => {
    setEditingScopeId(id);
    setEditingScopeDraft(current);
  };

  const commitEditScope = (id: string) => {
    const description = editingScopeDraft.trim();
    if (!description) return;
    updateScopeItem.mutate({ id, description });
    setEditingScopeId(null);
  };

  const handleAddBlocker = () => {
    if (!newBlockerDesc.trim()) return;
    createBlocker.mutate({ automation_id: a.id, blocker_type: newBlockerType, description: newBlockerDesc });
    setNewBlockerDesc("");
  };

  const handleLogTime = () => {
    const mins = parseInt(timeMinutes);
    if (isNaN(mins) || mins <= 0) return;
    createTimeLog.mutate({
      automation_id: a.id,
      duration_minutes: mins,
      description: timeDesc || undefined,
      started_at: new Date().toISOString(),
    });
    setTimeMinutes("");
    setTimeDesc("");
  };

  const totalTimeMinutes = timeLogs.reduce((sum, l) => sum + l.duration_minutes, 0);

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="w-[95vw] sm:max-w-[820px] max-h-[90vh] p-0 flex flex-col gap-0 rounded-2xl [&>button]:hidden">
        {/* ═══ HEADER ═══ */}
        <DialogHeader className="border-b border-border px-6 pt-5 pb-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-xl leading-snug font-bold">{a.title}</DialogTitle>
              <p className="mt-1 text-[13px] text-muted-foreground">
                <span className="text-foreground/80 font-medium">{a.requester || "Solicitante não informado"}</span>
                <span className="mx-1 text-muted-foreground/60">·</span>
                {a.requester_department || a.sector || "Setor não informado"}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`flex items-center gap-2 rounded-full bg-secondary/60 px-2.5 py-[5px] text-xs font-semibold ${health.color}`}>
                <span className="m-pulse h-[7px] w-[7px] rounded-full" style={healthStyle} />
                {health.label}
              </span>
              <button
                onClick={onClose}
                aria-label="Fechar"
                className="ml-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Badges: status · prazo · responsável */}
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
              {STATUS_LABELS[a.status as AutomationStatus] || a.status}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              <CalendarClock className="h-3 w-3" />
              {a.final_deadline ? format(new Date(a.final_deadline), "dd/MM/yy", { locale: ptBR }) : "Sem prazo definido"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
              <User className="h-3 w-3" />
              {a.assigned_to ? (profileMap[a.assigned_to] || "—") : "Não atribuído"}
            </span>
          </div>

          {/* Duas barras de progresso em cards próprios */}
          <div className="mt-5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div className="rounded-[10px] border border-border/70 bg-primary/[0.04] px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ListChecks className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  Escopo
                </span>
                <b className="text-sm font-semibold tabular-nums">{scopePct}%</b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400 transition-all ${scopePct >= 100 ? "from-emerald-500 to-emerald-400" : ""}`}
                  style={{ width: `${scopePct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{scopeDone}/{scopeTotal} itens concluídos</div>
            </div>
            <div className="rounded-[10px] border border-border/70 bg-primary/[0.04] px-3.5 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Code2 className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                  Execução
                </span>
                <b className="text-sm font-semibold tabular-nums">{execPct}%</b>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all ${execPct >= 100 ? "from-emerald-500 to-emerald-400" : ""}`}
                  style={{ width: `${execPct}%` }}
                />
              </div>
              <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">{execDone}/{execTotal} tarefas concluídas</div>
            </div>
          </div>
        </DialogHeader>

        {/* ═══ ABAS — versão compacta ═══ */}
        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="m-tab-bar flex h-auto w-full items-stretch justify-start gap-1 overflow-x-auto rounded-none border-b border-border bg-background px-4 pt-2 scrollbar-thin">
            {MODAL_TABS.map(({ value, label, Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                title={label}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-t-lg border border-b-0 border-transparent px-3 py-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-[inset_0_-2px_0_0_hsl(var(--primary))]"
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="m-tab-label">{label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <ScrollArea className="flex-1 px-5 pb-5">
            {/* ─── Details Tab ─── */}
            <TabsContent value="details" className="mt-4 space-y-4">
              {a.description && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Descrição</label>
                  <p className="text-sm mt-1">{a.description}</p>
                </div>
              )}
              {a.objective && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Objetivo</label>
                  <p className="text-sm mt-1">{a.objective}</p>
                </div>
              )}

              {!readOnly && !isReadOnly && (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Status</label>
                      <Select value={a.status} onValueChange={v => handleUpdate({ status: v as AutomationStatus })}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {AUTOMATION_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Prioridade</label>
                      <Select value={a.priority} onValueChange={v => handleUpdate({ priority: v })}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PRIORITY_OPTIONS.map(p => (
                            <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Risco</label>
                      <Select value={a.risk_level} onValueChange={v => handleUpdate({ risk_level: v })}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["low", "medium", "high", "critical"].map(r => (
                            <SelectItem key={r} value={r}>{RISK_LABELS[r]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Responsável</label>
                      {canReassign && !isReadOnly ? (
                        <Select value={a.assigned_to || ""} onValueChange={v => handleUpdate({ assigned_to: v || null })}>
                          <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                          <SelectContent>
                            {profiles.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-sm mt-1.5 text-foreground">{a.assigned_to ? (profileMap[a.assigned_to] || "—") : "Não atribuído"}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-0.5">Apenas admin/gestor reatribui responsável.</p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Complexidade (bônus de XP)</label>
                      <Select value={a.complexity || "medium"} onValueChange={v => handleUpdate({ complexity: v })}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COMPLEXITY_OPTIONS.map(c => (
                            <SelectItem key={c} value={c}>{COMPLEXITY_LABELS[c]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Setor Vinculado</label>
                      <Select
                        value={a.sector || "none"}
                        onValueChange={(v) => handleUpdate({ sector: v === "none" ? null : v })}
                      >
                        <SelectTrigger className="h-8 mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem setor</SelectItem>
                          {SECTORS.map((s) => (
                            <SelectItem key={s} value={s}>{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>


                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Progresso manual da automação: {a.progress_percent}%</label>
                    <Slider
                      value={[a.progress_percent]}
                      onValueCommit={v => handleUpdate({ progress_percent: v[0] })}
                      max={100}
                      step={5}
                      className="mt-2"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Horas Estimadas</label>
                      <Input type="number" value={a.estimated_hours} onChange={e => handleUpdate({ estimated_hours: parseFloat(e.target.value) || 0 })} className="h-8 mt-1" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Prazo Final</label>
                      <Input type="date" value={a.final_deadline ? a.final_deadline.substring(0, 10) : ""} onChange={e => handleUpdate({ final_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })} className="h-8 mt-1" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Linguagem/Ferramenta</label>
                      <Input value={a.language_tool || ""} onChange={e => handleUpdate({ language_tool: e.target.value })} className="h-8 mt-1" placeholder="Ex: Python, N8N..." />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Ambiente</label>
                      <Input value={a.environment || ""} onChange={e => handleUpdate({ environment: e.target.value })} className="h-8 mt-1" placeholder="Ex: Produção" />
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={a.needs_credentials} onCheckedChange={v => handleUpdate({ needs_credentials: !!v })} />
                      Necessita credencial
                    </label>
                    <label className="flex items-center gap-2 text-xs">
                      <Checkbox checked={a.documentation_done} onCheckedChange={v => handleUpdate({ documentation_done: !!v })} />
                      Documentação concluída
                    </label>
                  </div>
                </div>
              )}

              {/* Gestor: edição apenas de prazos */}
              {isReadOnly && (
                <div className="space-y-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Ajuste de prazos (Gestor)</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Prazo Estimado</label>
                      <Input
                        type="date"
                        value={a.estimated_deadline ? a.estimated_deadline.substring(0, 10) : ""}
                        onChange={e => handleUpdate({ estimated_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="h-8 mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Prazo Final</label>
                      <Input
                        type="date"
                        value={a.final_deadline ? a.final_deadline.substring(0, 10) : ""}
                        onChange={e => handleUpdate({ final_deadline: e.target.value ? new Date(e.target.value).toISOString() : null })}
                        className="h-8 mt-1"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Read-only info */}
              <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div>Criado: {format(new Date(a.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                <div>Atualizado: {format(new Date(a.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}</div>
                <div>Horas gastas: {Math.round(totalTimeMinutes / 60 * 10) / 10}h</div>
                <div>Horas estimadas: {a.estimated_hours}h</div>
              </div>
            </TabsContent>

            {/* ─── Escopo Tab (checklist do solicitante) ─── */}
            <TabsContent value="escopo" className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  Barra de Escopo: <span className="tabular-nums text-foreground">{scopeDone}/{scopeTotal}</span> itens concluídos
                </div>
                <Progress value={scopePct} className="h-2 w-40" />
              </div>

              {isSolicitante && !canEditScope && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 rounded-lg bg-amber-500/10 px-3 py-2">
                  O escopo só pode ser alterado enquanto a automação estiver em <b>Solicitada</b> ou <b>Backlog</b>.
                </p>
              )}
              {!isSolicitante && (
                <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
                  Itens de escopo refletem o que o solicitante pediu. Um item só é concluído quando a tarefa técnica vinculada
                  for finalizada pelo desenvolvedor.
                </p>
              )}

              <div className="space-y-1.5">
                {scopeItems.map(item => (
                  <div key={item.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={item.concluded}
                      disabled
                      title={item.concluded ? "Concluído pela tarefa técnica" : "Concluído automaticamente pela tarefa técnica"}
                    />
                    <div className="flex-1 min-w-0">
                      {editingScopeId === item.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            autoFocus
                            value={editingScopeDraft}
                            onChange={(e) => setEditingScopeDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitEditScope(item.id);
                              if (e.key === "Escape") setEditingScopeId(null);
                            }}
                            className="h-7 text-sm"
                          />
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => commitEditScope(item.id)}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => setEditingScopeId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <span className={`text-sm ${item.concluded ? "line-through text-muted-foreground" : ""}`}>{item.description}</span>
                      )}
                      <span className="block text-[10px] text-muted-foreground">
                        Criado por {profileMap[item.created_by] || "Solicitante"}
                        {item.concluded && " • Atendido"}
                      </span>
                    </div>
                    {canEditScope && editingScopeId !== item.id && (
                      <>
                        <button
                          onClick={() => startEditScope(item.id, item.description)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() => deleteScopeItem.mutate(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {scopeItems.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">Nenhum item de escopo cadastrado.</p>
                )}
              </div>

              {canEditScope && (
                <div className="flex gap-2">
                  <Input
                    value={newScopeItem}
                    onChange={e => setNewScopeItem(e.target.value)}
                    placeholder="Novo item de escopo (o que você espera que seja entregue)..."
                    className="h-8"
                    onKeyDown={e => e.key === "Enter" && handleAddScopeItem()}
                  />
                  <Button size="sm" onClick={handleAddScopeItem} className="h-8" disabled={!newScopeItem.trim()}>
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ─── Tarefas Tab (do desenvolvedor) ─── */}
            <TabsContent value="tarefas" className="mt-4 space-y-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[13px] font-bold text-foreground">Tarefas técnicas</div>
                <div className="text-xs text-muted-foreground tabular-nums">{execDone}/{execTotal} concluídas</div>
              </div>

              {subtasks.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-7 text-center">
                  <b className="mb-1 block text-sm text-foreground">
                    {!readOnly ? "Crie a primeira tarefa técnica" : "Nenhuma tarefa criada ainda"}
                  </b>
                  <span className="text-[13px] text-muted-foreground">
                    {!readOnly
                      ? "Quebre a execução em etapas (ex: levantamento, desenvolvimento, testes). Cada tarefa concluída gera XP."
                      : "A equipe técnica ainda não criou tarefas para esta automação."}
                  </span>
                </div>
              ) : (
                <div className="space-y-2">
                  {subtasks.map(st => {
                    const linkedScope = st.item_escopo_id ? scopeItems.find(i => i.id === st.item_escopo_id) : null;
                    return (
                      <div key={st.id} className="group flex items-center gap-3 rounded-[10px] border border-border bg-card/60 px-3 py-2.5">
                        <button
                          disabled={readOnly}
                          onClick={() => updateSubtask.mutate({ id: st.id, completed: !st.completed, automation_id: st.automation_id })}
                          aria-label={st.completed ? "Desmarcar tarefa" : "Concluir tarefa"}
                          className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 border-primary transition-colors ${st.completed ? "bg-primary" : "bg-transparent"} ${readOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-primary/20"}`}
                        >
                          {st.completed && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={`text-[13px] leading-snug ${st.completed ? "line-through text-muted-foreground" : ""}`}>{st.title}</p>
                          {linkedScope && (
                            <p className="mt-0.5 truncate text-[10px] text-primary/80">
                              {linkedScope.description}
                            </p>
                          )}
                          {st.completed && st.completed_at && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              Concluída em {format(new Date(st.completed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              {st.completed_by ? ` • ${profileMap[st.completed_by] || ""}` : ""}
                            </p>
                          )}
                        </div>
                        <span
                          className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary"
                          title={xpBadgeTitle}
                        >
                          +{perTaskXp} XP
                        </span>
                        <SubtaskTimerButton automationId={a.id} subtaskId={st.id} baseMinutes={subtaskMinutes[st.id] || 0} enabled={!readOnly} />
                        {!readOnly && (
                          <>
                            <Input
                              type="date"
                              value={st.deadline ? st.deadline.substring(0, 10) : ""}
                              onChange={e => updateSubtask.mutate({
                                id: st.id,
                                automation_id: st.automation_id,
                                deadline: e.target.value ? new Date(e.target.value).toISOString() : null,
                              })}
                              className="h-7 w-[122px] text-xs"
                              aria-label={`Prazo de ${st.title}`}
                            />
                            <button
                              onClick={() => deleteSubtask.mutate(st.id)}
                              className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isSolicitante && (
                <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
                  Acompanhe aqui as tarefas técnicas. Só o desenvolvedor cria e conclui tarefas.
                </p>
              )}

              {!readOnly && (
                <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2">
                  <Input
                    value={newSubtask}
                    onChange={e => setNewSubtask(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddSubtask()}
                    placeholder="Nova tarefa técnica..."
                    className="h-9 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  />
                  <Select value={newSubtaskScope} onValueChange={setNewSubtaskScope}>
                    <SelectTrigger className="h-9 w-[210px] shrink-0 text-[11px]">
                      <SelectValue placeholder={scopeItems.length ? "Vincular a item de escopo" : "Sem itens de escopo"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {scopeItems.map(si => (
                        <SelectItem key={si.id} value={si.id}>{si.description}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleAddSubtask}
                    disabled={!newSubtask.trim()}
                    className="h-9 w-9 shrink-0 p-0"
                    aria-label="Adicionar tarefa"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* ─── Comments Tab ─── */}
            <TabsContent value="comments" className="mt-4">
              <AutomationComments automationId={a.id} />
            </TabsContent>

            {/* ─── Attachments Tab ─── */}
            <TabsContent value="files" className="mt-4">
              <AutomationAttachments automationId={a.id} canDelete={canManage} />
            </TabsContent>

            {/* ─── Blockers Tab ─── */}
            <TabsContent value="blockers" className="mt-4 space-y-3">
              {blockers.map(b => (
                <div key={b.id} className={`p-3 rounded-lg border text-sm ${b.resolved_at ? "bg-muted/30 border-border" : "bg-red-500/5 border-red-500/30"}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <Badge variant="outline" className="text-[10px] mb-1">{BLOCKER_TYPE_LABELS[b.blocker_type] || b.blocker_type}</Badge>
                      <p className="text-sm">{b.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Desde {format(new Date(b.pending_since), "dd/MM/yy", { locale: ptBR })}
                        {b.resolved_at && ` • Resolvido em ${format(new Date(b.resolved_at), "dd/MM/yy", { locale: ptBR })}`}
                      </p>
                    </div>
                    {!b.resolved_at && !readOnly && (
                      <Button size="sm" variant="outline" onClick={() => resolveBlocker.mutate(b.id)} className="h-7 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Resolver
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {!readOnly && (
                <div className="space-y-2">
                  <Select value={newBlockerType} onValueChange={setNewBlockerType}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BLOCKER_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{BLOCKER_TYPE_LABELS[t]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Input value={newBlockerDesc} onChange={e => setNewBlockerDesc(e.target.value)} placeholder="Descreva o bloqueio..." className="h-8" />
                    <Button size="sm" onClick={handleAddBlocker} className="h-8"><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}

              {blockers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum bloqueio registrado</p>}
            </TabsContent>

            {/* ─── Timeline Tab ─── */}
            <TabsContent value="timeline" className="mt-4">
              {events.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">Nenhuma atualização registrada ainda.</p>
              ) : (
                <div className="relative pl-6">
                  {/* linha vertical */}
                  <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />
                  <div className="space-y-4">
                    {events.map((ev) => {
                      const meta = TIMELINE_META[ev.event_type] || {
                        label: ev.event_type.replace(/_/g, " "),
                        color: "bg-muted text-muted-foreground",
                        Icon: History,
                      };
                      const Icon = meta.Icon;
                      const newStatus = ev.metadata?.new_status as string | undefined;
                      return (
                        <div key={ev.id} className="relative">
                          {/* dot */}
                          <div className={`absolute -left-[18px] top-0.5 h-4 w-4 rounded-full flex items-center justify-center ${meta.color}`}>
                            <Icon className="h-2.5 w-2.5" />
                          </div>
                          <div className="rounded-md border border-border bg-card/40 px-3 py-2">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-1.5 text-xs">
                                <span className="font-medium text-foreground">
                                  {profileMap[ev.user_id] || "Sistema"}
                                </span>
                                <span className="text-muted-foreground">{meta.label}</span>
                                {newStatus && (
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[newStatus as AutomationStatus] || ""}`}>
                                    {STATUS_LABELS[newStatus as AutomationStatus] || newStatus}
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {format(new Date(ev.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                              </span>
                            </div>
                            {ev.description && (
                              <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{ev.description}</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─── Time Tab ─── */}
            <TabsContent value="time" className="mt-4 space-y-3">
              {/* Live Timer */}
              {!readOnly && <AutomationLiveTimer automationId={a.id} />}

              <div className="flex items-center gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Total</span>
                  <p className="font-semibold">{Math.round(totalTimeMinutes / 60 * 10) / 10}h</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-xs">Estimado</span>
                  <p className="font-semibold">{a.estimated_hours}h</p>
                </div>
              </div>

              {!readOnly && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input type="number" value={timeMinutes} onChange={e => setTimeMinutes(e.target.value)} placeholder="Minutos" className="h-8 w-24" />
                    <Input value={timeDesc} onChange={e => setTimeDesc(e.target.value)} placeholder="Descrição (opcional)" className="h-8 flex-1" />
                    <Button size="sm" onClick={handleLogTime} className="h-8"><Timer className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}

              <TimeLogsEditor scope="automation" targetId={a.id} />

            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function AutomationLiveTimer({ automationId }: { automationId: string }) {
  const { activeAutomationId, isRunning, elapsed, startAutomation, stop } = useGlobalTimer();
  const isActive = isRunning && activeAutomationId === automationId;

  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Cronômetro</span>
        </div>
        <div className="flex items-center gap-3">
          {isActive ? (
            <>
              <span className="font-mono text-lg text-primary font-bold tabular-nums">{formatTime(elapsed)}</span>
              <Button size="sm" variant="destructive" onClick={stop} className="h-7 rounded-lg">
                <Square className="h-3 w-3 mr-1" />Parar
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={() => startAutomation(automationId)} className="h-7 rounded-lg">
              <Play className="h-3 w-3 mr-1" />Iniciar
            </Button>
          )}
        </div>
      </div>
      {isRunning && !isActive && activeAutomationId && (
        <p className="text-[10px] text-amber-500 mt-1">⚠️ Timer ativo em outra automação. Iniciar aqui irá parar a anterior.</p>
      )}
    </div>
  );
}

function SubtaskTimerButton({ automationId, subtaskId, baseMinutes, enabled }: { automationId: string; subtaskId: string | null; baseMinutes: number; enabled: boolean }) {
  const { activeAutomationId, isRunning, elapsed, startAutomation, stop } = useGlobalTimer();
  const isActive = isRunning && activeAutomationId === automationId;

  if (!enabled) return null;

  const totalMinutes = baseMinutes + (isActive ? Math.floor(elapsed / 60) : 0);

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span
        className={`text-[10px] tabular-nums whitespace-nowrap ${isActive ? "text-primary font-semibold" : "text-muted-foreground"}`}
        title="Tempo registrado nessa tarefa"
      >
        {formatMinutes(totalMinutes)}
      </span>
      <Button
        size="sm"
        variant={isActive ? "destructive" : "ghost"}
        className="h-7 px-2 text-[10px] rounded-md gap-1 shrink-0"
        onClick={() => (isActive ? stop() : startAutomation(automationId, subtaskId))}
        title={isActive ? "Parar e registrar as horas trabalhadas" : "Iniciar contagem de horas trabalhadas"}
      >
        {isActive ? (
          <>
            <Square className="h-2.5 w-2.5" />
            <span className="font-mono tabular-nums">{formatTime(elapsed)}</span>
          </>
        ) : (
          <>
            <Play className="h-2.5 w-2.5" />Iniciar
          </>
        )}
      </Button>
    </div>
  );
}