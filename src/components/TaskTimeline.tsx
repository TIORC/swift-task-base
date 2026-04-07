import { useTaskEvents, EVENT_TYPE_CONFIG } from "@/hooks/useTaskEvents";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Circle, Play, Pause, CheckCircle, Send, ThumbsUp, ThumbsDown,
  AtSign, ArrowRightLeft, RefreshCw, AlertTriangle, MessageSquare, XCircle,
} from "lucide-react";

const EVENT_ICONS: Record<string, React.ElementType> = {
  created: Circle,
  started: Play,
  paused: Pause,
  completed: CheckCircle,
  sent_review: Send,
  approved: ThumbsUp,
  rejected: ThumbsDown,
  mentioned: AtSign,
  reassigned: ArrowRightLeft,
  status_changed: RefreshCw,
  priority_changed: AlertTriangle,
  discarded: XCircle,
  comment: MessageSquare,
};

interface TaskTimelineProps {
  taskId: string;
}

export function TaskTimeline({ taskId }: TaskTimelineProps) {
  const { data: events, isLoading } = useTaskEvents(taskId);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-4 text-center">Carregando timeline...</p>;
  }

  if (!events || events.length === 0) {
    return (
      <div className="text-center py-6">
        <p className="text-sm text-muted-foreground">Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 relative">
      {/* Vertical line */}
      <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

      {events.map((event, index) => {
        const config = EVENT_TYPE_CONFIG[event.event_type] || { label: event.event_type, color: "text-muted-foreground" };
        const Icon = EVENT_ICONS[event.event_type] || Circle;
        const userName = event.profiles?.full_name || "Sistema";
        const time = format(new Date(event.created_at), "dd/MM HH:mm", { locale: ptBR });

        return (
          <div key={event.id} className="flex items-start gap-3 relative pl-0 py-2">
            <div className={`shrink-0 h-[30px] w-[30px] rounded-full flex items-center justify-center bg-muted/50 border border-border z-10 ${config.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-baseline gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground">{userName}</span>
                <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{time}</span>
              </div>
              {event.description && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{event.description}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
