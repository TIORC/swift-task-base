import {
  Automation,
  STATUS_LABELS, STATUS_COLORS,
  PRIORITY_LABELS, PRIORITY_COLORS,
  AutomationStatus,
  computePrediction,
} from "@/types/automation";
import { SECTOR_COLORS } from "@/types/sectors";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Clock, Lock, User, Timer, Play, Square, Building2,
  ListTodo, MessageSquare, Activity, CalendarClock,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useAutomationTotalMinutes,
  useLatestAutomationEvents,
  useLatestAutomationComments,
  useAllAutomationSteps,
} from "@/hooks/useAutomationsData";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatMinutes, formatTime } from "@/hooks/useTimeTracker";

interface Props {
  automation: Automation;
  onClick: () => void;
  profileName?: string;
  profileMap?: Record<string, string>;
  pendingCount?: number;
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  created: "criou a automação",
  status_changed: "mudou o status",
  blocker_added: "registrou um bloqueio",
  blocker_resolved: "resolveu um bloqueio",
  comment: "comentou",
  subtask_added: "adicionou etapa",
  subtask_completed: "concluiu etapa",
};

function eventLabel(t: string) {
  return EVENT_TYPE_LABELS[t] || t.replace(/_/g, " ");
}

export function AutomationCard({ automation: a, onClick, profileName, profileMap, pendingCount = 0 }: Props) {
  const { data: totals } = useAutomationTotalMinutes();
  const { data: latestEvents } = useLatestAutomationEvents();
  const { data: latestComments } = useLatestAutomationComments();
  const { data: steps } = useAllAutomationSteps();
  const { activeAutomationId, isRunning, elapsed, startAutomation, stop } = useGlobalTimer();

  const isTimerOnThis = isRunning && activeAutomationId === a.id;
  const baseMinutes = totals?.[a.id] || 0;
  const liveMinutes = isTimerOnThis ? Math.floor(elapsed / 60) : 0;
  const totalWorked = baseMinutes + liveMinutes;
  const isBlocked = a.status === "blocked";
  const isFinished = a.status === "completed" || a.status === "cancelled";

  const lastEvent = latestEvents?.[a.id];
  const lastComment = latestComments?.[a.id];
  const step = steps?.[a.id];
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

  return (
    <div
      onClick={onClick}
      className={`
        group p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md overflow-hidden
        ${isBlocked ? "border-red-500/40 bg-red-500/5"
          : isTimerOnThis ? "border-primary/40 bg-primary/5"
          : "border-border hover:border-primary/30 bg-card"}
      `}
    >
      {/* Title */}
      <div className="flex items-start justify-between gap-2 mb-2 min-w-0">
        <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-snug flex-1 min-w-0 break-words">
          {a.title}
        </h4>
        {isBlocked && <Lock className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />}
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 flex-wrap mb-2">
        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${STATUS_COLORS[a.status as AutomationStatus] || ""}`}>
          {STATUS_LABELS[a.status as AutomationStatus] || a.status}
        </Badge>
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

      {/* Etapa atual + progresso */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <ListTodo className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {step ? step.title : "Sem etapas"}
            </span>
          </div>
          <span className="tabular-nums shrink-0">
            {step ? `${step.done}/${step.total}` : `${a.progress_percent}%`}
          </span>
        </div>
        <Progress value={a.progress_percent} className="h-1.5" />
      </div>

      {/* Tempo trabalhado */}
      <div className={`flex items-center justify-between gap-2 mb-2 px-2 py-1 rounded-md ${isTimerOnThis ? "bg-primary/10" : "bg-muted/50"}`}>
        <div className={`flex items-center gap-1.5 text-xs ${isTimerOnThis ? "text-primary font-semibold" : "text-foreground"}`}>
          <Timer className="h-3.5 w-3.5" />
          <span className="tabular-nums">
            {formatMinutes(totalWorked)}
          </span>
          <span className="text-[10px] text-muted-foreground font-normal">trabalhadas</span>
        </div>
        {!isFinished && (
          <Button
            size="sm"
            variant={isTimerOnThis ? "destructive" : "ghost"}
            className="h-6 px-2 text-[10px] rounded-md gap-1"
            onClick={(e) => { e.stopPropagation(); isTimerOnThis ? stop() : startAutomation(a.id); }}
          >
            {isTimerOnThis ? <><Square className="h-2.5 w-2.5" />Parar</> : <><Play className="h-2.5 w-2.5" />Iniciar</>}
          </Button>
        )}
      </div>

      {/* Linha do tempo curta — última atividade */}
      <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mb-1.5 px-1">
        <Activity className="h-3 w-3 shrink-0 mt-0.5 text-primary/70" />
        <div className="flex-1 min-w-0">
          <span className="text-foreground/80">
            {formatDistanceToNow(new Date(lastActivity.ts), { addSuffix: true, locale: ptBR })}
          </span>
          {lastEvent && lastEventAuthor && (
            <span className="block truncate">
              <span className="font-medium text-foreground/70">{lastEventAuthor}</span>{" "}
              {eventLabel(lastEvent.event_type)}
              {lastEvent.description ? `: ${lastEvent.description}` : ""}
            </span>
          )}
        </div>
      </div>

      {/* Comentário recente */}
      {lastComment && (
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mb-1.5 px-1">
          <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {lastCommentAuthor && (
              <span className="font-medium text-foreground/70">{lastCommentAuthor}: </span>
            )}
            <span className="line-clamp-1">{lastComment.content}</span>
          </div>
        </div>
      )}

      {/* Footer: responsável + previsão de entrega */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground gap-2 pt-1.5 border-t border-border/40">
        <div className="flex items-center gap-1 min-w-0">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[110px]">{profileName || "Não atribuído"}</span>
        </div>
        {a.final_deadline && (
          <div className="flex items-center gap-1 shrink-0">
            <CalendarClock className="h-3 w-3" />
            <span>{format(new Date(a.final_deadline), "dd/MM/yy", { locale: ptBR })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
