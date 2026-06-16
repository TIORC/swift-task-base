import { Automation, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, AutomationStatus } from "@/types/automation";
import { SECTOR_COLORS } from "@/types/sectors";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Clock, Lock, User, Timer, Play, Square, Building2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAutomationTotalMinutes } from "@/hooks/useAutomationsData";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatMinutes, formatTime } from "@/hooks/useTimeTracker";
import { isOverdue } from "@/lib/dates";

interface Props {
  automation: Automation;
  onClick: () => void;
  profileName?: string;
}

export function AutomationCard({ automation: a, onClick, profileName }: Props) {
  const { data: totals } = useAutomationTotalMinutes();
  const { activeAutomationId, isRunning, elapsed, startAutomation, stop } = useGlobalTimer();
  const isTimerOnThis = isRunning && activeAutomationId === a.id;
  const baseMinutes = totals?.[a.id] || 0;
  const liveMinutes = isTimerOnThis ? Math.floor(elapsed / 60) : 0;
  const totalWorked = baseMinutes + liveMinutes;
  const isBlocked = a.status === "blocked";
  const isFinished = a.status === "completed" || a.status === "cancelled";

  return (
    <div
      onClick={onClick}
      className={`
        group p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md
        ${isBlocked ? "border-red-500/40 bg-red-500/5" : isTimerOnThis ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/30 bg-card"}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{a.title}</h4>
      </div>

      {a.requester_department && (
        <p className="text-[10px] text-muted-foreground mb-2">{a.requester_department}</p>
      )}

      <Progress value={a.progress_percent} className="h-1.5 mb-2" />

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
        {isBlocked && <Lock className="h-3 w-3 text-red-500" />}
      </div>

      {/* Tempo trabalhado em destaque */}
      <div className={`flex items-center justify-between gap-2 mb-2 px-2 py-1 rounded-md ${isTimerOnThis ? "bg-primary/10" : "bg-muted/50"}`}>
        <div className={`flex items-center gap-1.5 text-xs ${isTimerOnThis ? "text-primary font-semibold" : "text-foreground"}`}>
          <Timer className="h-3.5 w-3.5" />
          <span className="tabular-nums">
            {isTimerOnThis ? formatTime(elapsed) : formatMinutes(totalWorked)}
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

      <div className="flex items-center justify-between text-[10px] text-muted-foreground gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <User className="h-3 w-3 shrink-0" />
          <span className="truncate max-w-[100px]">{profileName || "Não atribuído"}</span>
        </div>
        {a.final_deadline && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(a.final_deadline), "dd/MM", { locale: ptBR })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
