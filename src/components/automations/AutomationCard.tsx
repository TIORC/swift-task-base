import { Automation, STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, computeHealthScore, computePrediction, AutomationStatus } from "@/types/automation";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Clock, Lock, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  automation: Automation;
  onClick: () => void;
  profileName?: string;
}

export function AutomationCard({ automation: a, onClick, profileName }: Props) {
  const health = computeHealthScore(a);
  const prediction = computePrediction(a);
  const isLate = !!a.final_deadline && new Date(a.final_deadline) < new Date() && a.status !== "completed" && a.status !== "cancelled";
  const isBlocked = a.status === "blocked";

  return (
    <div
      onClick={onClick}
      className={`
        group p-3 rounded-lg border cursor-pointer transition-all hover:shadow-md
        ${isBlocked ? "border-red-500/40 bg-red-500/5" : isLate ? "border-amber-500/40 bg-amber-500/5" : "border-border hover:border-primary/30 bg-card"}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{a.title}</h4>
        <div className={`shrink-0 w-2 h-2 rounded-full mt-1 ${health.score >= 70 ? "bg-emerald-500" : health.score >= 40 ? "bg-amber-500" : "bg-red-500"}`} />
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
        {isBlocked && <Lock className="h-3 w-3 text-red-500" />}
        {isLate && <AlertTriangle className="h-3 w-3 text-amber-500" />}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <div className="flex items-center gap-1">
          <User className="h-3 w-3" />
          <span className="truncate max-w-[80px]">{profileName || "Não atribuído"}</span>
        </div>
        {a.final_deadline && (
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{format(new Date(a.final_deadline), "dd/MM", { locale: ptBR })}</span>
          </div>
        )}
      </div>

      <div className={`text-[9px] mt-1.5 font-medium ${prediction.color}`}>
        {prediction.label}
      </div>
    </div>
  );
}
