import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Automation, AutomationSubtask, AutomationBlocker, AutomationEvent,
  STATUS_LABELS, STATUS_COLORS, AUTOMATION_STATUSES, PRIORITY_LABELS, PRIORITY_OPTIONS,
  RISK_LABELS, BLOCKER_TYPES, BLOCKER_TYPE_LABELS, DEFAULT_SUBTASKS,
  computeHealthScore, computePrediction, AutomationStatus,
} from "@/types/automation";
import { SECTORS } from "@/types/sectors";
import { useUpdateAutomation } from "@/hooks/useAutomationsData";
import { useAutomationSubtasks, useCreateSubtask, useUpdateSubtask, useDeleteSubtask } from "@/hooks/useAutomationsData";
import { useAutomationBlockers, useCreateBlocker, useResolveBlocker } from "@/hooks/useAutomationsData";
import { useAutomationEvents } from "@/hooks/useAutomationsData";
import { useAutomationTimeLogs, useCreateTimeLog } from "@/hooks/useAutomationsData";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatTime, formatMinutes } from "@/hooks/useTimeTracker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertTriangle, CheckCircle2, Clock, Code2, FileText, History,
  ListChecks, Lock, MessageSquare, Play, Plus, Save, Square, Timer, Trash2, X,
  Sparkles, RefreshCcw, Unlock,
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
import { AutomationComments } from "@/components/automations/AutomationComments";

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
  const { data: subtasks = [] } = useAutomationSubtasks(automation?.id ?? null);
  const createSubtask = useCreateSubtask();
  const updateSubtask = useUpdateSubtask();
  const deleteSubtask = useDeleteSubtask();
  const { data: blockers = [] } = useAutomationBlockers(automation?.id ?? null);
  const createBlocker = useCreateBlocker();
  const resolveBlocker = useResolveBlocker();
  const { data: events = [] } = useAutomationEvents(automation?.id ?? null);
  const { data: timeLogs = [] } = useAutomationTimeLogs(automation?.id ?? null);
  const createTimeLog = useCreateTimeLog();

  const [newSubtask, setNewSubtask] = useState("");
  const [newBlockerType, setNewBlockerType] = useState("other");
  const [newBlockerDesc, setNewBlockerDesc] = useState("");
  const [timeMinutes, setTimeMinutes] = useState("");
  const [timeDesc, setTimeDesc] = useState("");

  if (!automation) return null;

  const a = automation;
  const health = computeHealthScore(a);
  const prediction = computePrediction(a);

  const handleUpdate = (values: Partial<Automation>) => {
    updateAutomation.mutate({ id: a.id, ...values });
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    createSubtask.mutate({ automation_id: a.id, title: newSubtask, sort_order: subtasks.length });
    setNewSubtask("");
  };

  const handleAddDefaultSubtasks = () => {
    DEFAULT_SUBTASKS.forEach((title, i) => {
      createSubtask.mutate({ automation_id: a.id, title, sort_order: i });
    });
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
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-[540px] p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="text-lg leading-snug">{a.title}</SheetTitle>
              {a.requester_department && (
                <p className="text-xs text-muted-foreground mt-0.5">{a.requester} • {a.requester_department}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${health.score >= 70 ? "bg-emerald-500" : health.score >= 40 ? "bg-amber-500" : "bg-red-500"}`} />
              <span className={`text-xs font-medium ${health.color}`}>{health.label}</span>
            </div>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <Badge className={STATUS_COLORS[a.status as AutomationStatus]}>{STATUS_LABELS[a.status as AutomationStatus]}</Badge>
            <span className={`text-xs font-medium ${prediction.color}`}>{prediction.label}</span>
            <span className="text-xs text-muted-foreground">{a.progress_percent}%</span>
          </div>
          <Progress value={a.progress_percent} className="h-2 mt-2" />
        </SheetHeader>

        <Separator />

        <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-2 grid grid-cols-6 h-8">
            <TabsTrigger value="details" className="text-xs"><FileText className="h-3 w-3 mr-1" />Dados</TabsTrigger>
            <TabsTrigger value="checklist" className="text-xs"><ListChecks className="h-3 w-3 mr-1" />Check</TabsTrigger>
            <TabsTrigger value="comments" className="text-xs"><MessageSquare className="h-3 w-3 mr-1" />Chat</TabsTrigger>
            <TabsTrigger value="blockers" className="text-xs"><Lock className="h-3 w-3 mr-1" />Bloq.</TabsTrigger>
            <TabsTrigger value="timeline" className="text-xs"><History className="h-3 w-3 mr-1" />Timeline</TabsTrigger>
            <TabsTrigger value="time" className="text-xs"><Timer className="h-3 w-3 mr-1" />Tempo</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 px-4 pb-4">
            {/* ─── Details Tab ─── */}
            <TabsContent value="details" className="mt-3 space-y-4">
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

              {!isReadOnly && (
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
                      <Select value={a.assigned_to || ""} onValueChange={v => handleUpdate({ assigned_to: v || null })}>
                        <SelectTrigger className="h-8 mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                        <SelectContent>
                          {profiles.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Setor Vinculado</label>
                      <Select
                        value={a.sector || "none"}
                        onValueChange={(v) => handleUpdate({ sector: v === "none" ? null : v } as any)}
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
                    <label className="text-xs font-medium text-muted-foreground">Progresso: {a.progress_percent}%</label>
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

            {/* ─── Checklist Tab ─── */}
            <TabsContent value="checklist" className="mt-3 space-y-3">
              {subtasks.length === 0 && !isReadOnly && (
                <Button variant="outline" size="sm" onClick={handleAddDefaultSubtasks} className="w-full">
                  <Plus className="h-3 w-3 mr-1" /> Adicionar checklist padrão
                </Button>
              )}

              <div className="space-y-1.5">
                {subtasks.map(st => (
                  <div key={st.id} className="flex items-center gap-2 group">
                    <Checkbox
                      checked={st.completed}
                      disabled={isReadOnly}
                      onCheckedChange={v => updateSubtask.mutate({ id: st.id, completed: !!v, automation_id: st.automation_id })}
                    />
                    <span className={`text-sm flex-1 ${st.completed ? "line-through text-muted-foreground" : ""}`}>{st.title}</span>
                    {!isReadOnly && (
                      <button onClick={() => deleteSubtask.mutate(st.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity">
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!isReadOnly && (
                <div className="flex gap-2">
                  <Input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Nova subtarefa..." className="h-8" onKeyDown={e => e.key === "Enter" && handleAddSubtask()} />
                  <Button size="sm" onClick={handleAddSubtask} className="h-8"><Plus className="h-3 w-3" /></Button>
                </div>
              )}

              {subtasks.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {subtasks.filter(s => s.completed).length}/{subtasks.length} concluídas
                </p>
              )}
            </TabsContent>

            {/* ─── Comments Tab ─── */}
            <TabsContent value="comments" className="mt-3">
              <AutomationComments automationId={a.id} />
            </TabsContent>

            {/* ─── Blockers Tab ─── */}
            <TabsContent value="blockers" className="mt-3 space-y-3">
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
                    {!b.resolved_at && !isReadOnly && (
                      <Button size="sm" variant="outline" onClick={() => resolveBlocker.mutate(b.id)} className="h-7 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Resolver
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              {!isReadOnly && (
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
            <TabsContent value="timeline" className="mt-3">
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
                      const newStatus = (ev.metadata as any)?.new_status as string | undefined;
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
            <TabsContent value="time" className="mt-3 space-y-3">
              {/* Live Timer */}
              {!isReadOnly && <AutomationLiveTimer automationId={a.id} />}

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

              {!isReadOnly && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input type="number" value={timeMinutes} onChange={e => setTimeMinutes(e.target.value)} placeholder="Minutos" className="h-8 w-24" />
                    <Input value={timeDesc} onChange={e => setTimeDesc(e.target.value)} placeholder="Descrição (opcional)" className="h-8 flex-1" />
                    <Button size="sm" onClick={handleLogTime} className="h-8"><Timer className="h-3 w-3" /></Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {timeLogs.map(tl => (
                  <div key={tl.id} className="flex justify-between text-sm p-2 rounded bg-muted/30">
                    <div>
                      <span className="font-medium">{tl.duration_minutes}min</span>
                      {tl.description && <span className="text-muted-foreground ml-2">{tl.description}</span>}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(tl.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                ))}
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
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