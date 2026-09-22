import { useState } from "react";
import {
  Automation,
  STATUS_LABELS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  RISK_LABELS,
  AutomationStatus,
  computePrediction,
} from "@/types/automation";
import { SECTOR_COLORS } from "@/types/sectors";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Lock, User, Play, Square, Building2,
  ListChecks, Code2, MessageSquare, Activity, Pencil, Check, X, ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useAutomationTotalMinutes,
  useLatestAutomationEvents,
  useLatestAutomationComments,
  useAllAutomationSteps,
  useAllAutomationScopeCounts,
  useRenameAutomation,
} from "@/hooks/useAutomationsData";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatMinutes } from "@/hooks/useTimeTracker";

interface Props {
  automation: Automation;
  onClick: () => void;
  profileName?: string;
  profileMap?: Record<string, string>;
  pendingCount?: number;
  canEditTitle?: boolean;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  created: "criou a automação",
  status_changed: "alterou o status",
  blocker_added: "registrou um bloqueio",
  blocker_resolved: "resolveu um bloqueio",
  comment: "comentou",
  subtask_added: "adicionou etapa",
  subtask_completed: "concluiu etapa",
};

// Pill sólido com a cor do status (versão "cheia" do badge)
const STATUS_FILL: Record<string, string> = {
  backlog: "bg-slate-500",
  analysis: "bg-blue-500",
  requested: "bg-sky-500",
  waiting_info: "bg-yellow-500",
  approved: "bg-teal-500",
  change_requested: "bg-rose-500",
  development: "bg-indigo-500",
  internal_testing: "bg-amber-500",
  homologation: "bg-purple-500",
  waiting_user: "bg-orange-500",
  completed: "bg-emerald-500",
  blocked: "bg-red-500",
  cancelled: "bg-slate-400",
};

function eventLabel(t: string) {
  return EVENT_TYPE_LABELS[t] || t.replace(/_/g, " ");
}

function initials(name?: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = (parts[0]?.[0] || "").toUpperCase();
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] || "").toUpperCase() : "";
  return (first + last) || "?";
}

export function AutomationCard({ automation: a, onClick, profileName, profileMap, pendingCount = 0, canEditTitle }: Props) {
  const { data: totals } = useAutomationTotalMinutes();
  const { data: latestEvents } = useLatestAutomationEvents();
  const { data: latestComments } = useLatestAutomationComments();
  const { data: steps } = useAllAutomationSteps();
  const { data: scopeCounts } = useAllAutomationScopeCounts();
  const { activeAutomationId, isRunning, elapsed, startAutomation, stop } = useGlobalTimer();
  const renameAutomation = useRenameAutomation();

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(a.title);

  const isTimerOnThis = isRunning && activeAutomationId === a.id;
  const baseMinutes = totals?.[a.id] || 0;
  const liveMinutes = isTimerOnThis ? Math.floor(elapsed / 60) : 0;
  const totalWorked = baseMinutes + liveMinutes;
  const isBlocked = a.status === "blocked";
  const isFinished = a.status === "completed" || a.status === "cancelled";

  const lastEvent = latestEvents?.[a.id];
  const lastComment = latestComments?.[a.id];
  const step = steps?.[a.id];
  const scope = scopeCounts?.[a.id];
  const scopePct = scope && scope.total ? Math.round((scope.done / scope.total) * 100) : 0;
  const execPct = step && step.total ? Math.round((step.done / step.total) * 100) : 0;
  const prediction = computePrediction(a);

  const lastEventAuthor = lastEvent ? profileMap?.[lastEvent.user_id] : null;
  const lastCommentAuthor = lastComment ? profileMap?.[lastComment.user_id] : null;

  // Última atualização efetiva: o mais recente entre evento, comentário e updated_at da automação.
  const lastActivity = (() => {
    const candidates: { ts: string; label: string }[] = [
      { ts: a.updated_at, label: "atualização" },
    ];
    if (lastEvent) candidates.push({ ts: lastEvent.created_at, label: eventLabel(lastEvent.event_type) });
    if (lastComment) candidates.push({ ts: lastComment.created_at, label: "comentou" });
    candidates.sort((x, y) => +new Date(y.ts) - +new Date(x.ts));
    return candidates[0];
  })();

  const isRecent = !isFinished && Date.now() - new Date(lastActivity.ts).getTime() < 24 * 60 * 60 * 1000;

  const cancelTitleEdit = () => {
    setEditingTitle(false);
    setDraftTitle(a.title);
  };

  const commitTitle = () => {
    const title = draftTitle.trim();
    if (!title || title === a.title) {
      cancelTitleEdit();
      return;
    }
    renameAutomation.mutate(
      { id: a.id, title },
      { onSuccess: () => setEditingTitle(false), onError: () => cancelTitleEdit() },
    );
  };

  return (
    <div
      onClick={onClick}
      className={`
        group relative h-auto px-4 pt-4 pb-3.5 rounded-lg border cursor-pointer
        transition-all duration-200 hover:shadow-md hover:border-primary/40
        bg-gradient-to-b from-card to-card/60
        shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)]
        overflow-visible
        ${isBlocked ? "border-red-500/40 from-red-500/10 to-card/60"
          : isTimerOnThis ? "border-primary/40 from-primary/5 to-card/60 ring-1 ring-primary/10"
          : "border-border"}
      `}
    >
      {/* Ponto azul indicando atualização recente */}
      {isRecent && (
        <span
          className="absolute top-3 right-3 h-[7px] w-[7px] rounded-full bg-primary shadow-[0_0_0_2px_rgba(59,130,246,0.25)]"
          title="Atualizado recentemente"
        />
      )}

      {/* Badges row */}
      <div className="flex items-center gap-1 flex-wrap pr-4 mb-0">
        <span className={`inline-flex items-center rounded-full px-[7px] py-1 text-[10px] font-bold leading-none text-white ${STATUS_FILL[a.status as AutomationStatus] || "bg-primary"}`}>
          {STATUS_LABELS[a.status as AutomationStatus] || a.status}
        </span>
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${PRIORITY_COLORS[a.priority]}`}>
          {PRIORITY_LABELS[a.priority] || a.priority}
        </Badge>
        {a.sector && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-1 ${SECTOR_COLORS[a.sector] || ""}`}>
            <Building2 className="h-2.5 w-2.5" />
            {a.sector}
          </Badge>
        )}
        {!isFinished && (
          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${prediction.color}`}>
            {prediction.label}
          </Badge>
        )}
        {pendingCount > 0 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
            {pendingCount} pend.
          </Badge>
        )}
      </div>

      {/* Title */}
      <div className="flex items-start justify-between gap-2 mt-2.5 mb-2 min-w-0">
        {canEditTitle && editingTitle ? (
          <div
            className="flex items-center gap-1 flex-1 min-w-0"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <Input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") cancelTitleEdit();
              }}
              className="h-7 text-xs"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0 shrink-0"
              onClick={commitTitle}
              disabled={renameAutomation.isPending || !draftTitle.trim()}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={cancelTitleEdit}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <>
            <h4 className="text-[14px] font-bold text-foreground leading-snug flex-1 min-w-0 break-words whitespace-normal">
              {a.title}
            </h4>
            {canEditTitle && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setDraftTitle(a.title);
                  setEditingTitle(true);
                }}
                className="p-1 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0 mt-0.5 transition-colors"
                title="Renomear automação"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </>
        )}
        {isBlocked && <Lock className="h-3 w-3 text-red-500 shrink-0 mt-1" />}
      </div>

      {/* Meta line: prioridade · risco · prazo */}
      <div className="flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground mb-3">
        <span>
          Prioridade <b className="font-semibold text-foreground">{PRIORITY_LABELS[a.priority] || a.priority}</b>
        </span>
        <span className="opacity-50">•</span>
        <span>
          Risco <b className="font-semibold text-foreground">{RISK_LABELS[a.risk_level] || a.risk_level}</b>
        </span>
        <span className="opacity-50">•</span>
        <b className={`font-semibold ${a.final_deadline ? "text-foreground" : "text-muted-foreground"}`}>
          {a.final_deadline ? `Prazo ${format(new Date(a.final_deadline), "dd/MM/yy", { locale: ptBR })}` : "Sem prazo definido"}
        </b>
      </div>

      {/* Bloco das 2 barras de progresso */}
      <div className="rounded-lg border border-border/70 bg-primary/[0.05] p-3 mb-3 space-y-3">
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 gap-2">
            <span className="flex items-center gap-1 min-w-0">
              <ListChecks className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">Escopo</span>
            </span>
            <b className="font-semibold text-foreground tabular-nums shrink-0">{scopePct}%</b>
          </div>
          <div className="h-[7px] rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all ${scopePct >= 100 ? "from-emerald-500 to-emerald-400" : ""}`}
              style={{ width: `${scopePct}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 gap-2">
            <span className="flex items-center gap-1 min-w-0">
              <Code2 className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">Execução</span>
            </span>
            <b className="font-semibold text-foreground tabular-nums shrink-0">{execPct}%</b>
          </div>
          <div className="h-[7px] rounded-full bg-secondary overflow-hidden">
            <div
              className={`h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all ${execPct >= 100 ? "from-emerald-500 to-emerald-400" : ""}`}
              style={{ width: `${execPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bloco de tempo trabalhado + botão iniciar */}
      <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 mb-3 ${isTimerOnThis ? "border-primary/30 bg-primary/10" : "border-border/70 bg-secondary/40"}`}>
        <div>
          <div className={`text-[11px] font-semibold leading-tight tabular-nums ${isTimerOnThis ? "text-primary" : "text-foreground"}`}>
            {formatMinutes(totalWorked)} trabalhadas
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">
            {a.estimated_hours > 0 ? `de ${a.estimated_hours}h estimadas` : "sem estimativa de horas"}
          </div>
        </div>
        {!isFinished && (
          <Button
            size="sm"
            variant={isTimerOnThis ? "destructive" : "default"}
            className="h-auto px-3 py-[7px] text-[11px] rounded-md gap-1 shrink-0"
            onClick={(e) => { e.stopPropagation(); if (isTimerOnThis) stop(); else startAutomation(a.id); }}
          >
            {isTimerOnThis ? <><Square className="h-2.5 w-2.5" />Parar</> : <><Play className="h-2.5 w-2.5" />Iniciar</>}
          </Button>
        )}
      </div>

      {/* Linha de última atualização relevante */}
      <div className="flex items-start gap-2 rounded-r-[8px] border-l-2 border-l-primary bg-primary/5 px-2.5 py-2.5 mb-3">
        <Activity className="h-2.5 w-2.5 shrink-0 mt-0.5 text-primary/70" />
        <div className="flex-1 min-w-0 text-[10px] text-muted-foreground">
          {lastEvent && lastEventAuthor ? (
            <span className="break-words whitespace-normal">
              <b className="font-semibold text-foreground">{lastEventAuthor}</b> {eventLabel(lastEvent.event_type)}
            </span>
          ) : (
            <span>{eventLabel(lastEvent?.event_type || lastActivity.label)}</span>
          )}
          <span className="text-muted-foreground/70"> · {formatDistanceToNow(new Date(lastActivity.ts), { addSuffix: true, locale: ptBR })}</span>
          {lastEvent?.description && (
            <span className="block mt-0.5 text-muted-foreground/80 truncate">{lastEvent.description}</span>
          )}
        </div>
      </div>

      {/* Comentário recente */}
      {lastComment && (
        <div className="flex items-start gap-2 text-[10px] text-muted-foreground mb-2 px-1">
          <MessageSquare className="h-2.5 w-2.5 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {lastCommentAuthor && (
              <span className="font-medium text-foreground/70">{lastCommentAuthor}: </span>
            )}
            <span className="break-words whitespace-normal">{lastComment.content}</span>
          </div>
        </div>
      )}

      {/* Rodapé: avatar + responsável + ver detalhes */}
      <div className="flex items-center justify-between gap-2 pt-2.5 mt-1.5 border-t border-border/60">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-[21px] w-[21px] shrink-0 rounded-full bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center text-[10px] font-bold text-white">
            {initials(profileName)}
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium text-foreground truncate">
              {profileName ? (
                <span className="flex items-center gap-1">
                  <User className="h-2.5 w-2.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{profileName}</span>
                </span>
              ) : (
                "Não atribuído"
              )}
            </div>
            <div className="text-[9px] text-muted-foreground truncate">Responsável</div>
          </div>
        </div>
        <span className="flex items-center gap-1 shrink-0 text-[10px] font-semibold text-primary cursor-pointer">
          Ver detalhes
          <ArrowRight className="h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  );
}