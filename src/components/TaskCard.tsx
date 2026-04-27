import { Task } from "@/hooks/useTasks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Clock, Calendar, AlignLeft } from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatTime, formatMinutes } from "@/hooks/useTimeTracker";

interface TaskCardProps {
  task: Task;
  index: number;
  onClick?: (task: Task) => void;
  isDragDisabled?: boolean;
}

export function TaskCard({ task, index, onClick, isDragDisabled }: TaskCardProps) {
  const initials = task.profiles?.full_name
    ? task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : null;

  const { activeTaskId, isRunning, elapsed } = useGlobalTimer();
  const isTimerOnThis = isRunning && activeTaskId === task.id;
  const baseMinutes = task.total_minutes || 0;
  const liveMinutes = isTimerOnThis ? Math.floor(elapsed / 60) : 0;
  const totalWorked = baseMinutes + liveMinutes;
  const timeStr = isTimerOnThis ? formatTime(elapsed) : formatMinutes(totalWorked);

  const createdDate = format(new Date(task.created_at), "dd MMM", { locale: ptBR });

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          className={`rounded-xl border border-border bg-card p-3.5 space-y-2 transition-all duration-150 cursor-pointer
            hover:shadow-card-hover hover:border-primary/20
            ${snapshot.isDragging ? "shadow-card-hover ring-2 ring-primary/20 rotate-1" : "shadow-card"}`}
        >
          {/* Title */}
          <p className="text-sm font-medium text-foreground leading-snug line-clamp-2">{task.title}</p>

          {/* Description preview */}
          {task.description && (
            <div className="flex items-start gap-1.5">
              <AlignLeft className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                {task.description}
              </p>
            </div>
          )}

          {/* Priority + Time */}
          <div className="flex items-center justify-between gap-2">
            <StatusBadge type="priority" value={task.priority} />

            <div className="flex items-center gap-2">
              {(task.total_minutes || 0) > 0 && (
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{timeStr}</span>
                </div>
              )}
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{createdDate}</span>
              </div>
            </div>
          </div>

          {/* Assignee */}
          {initials && (
            <div className="flex items-center gap-1.5 pt-0.5 border-t border-border">
              <Avatar className="h-5 w-5">
                <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {task.profiles?.full_name}
              </span>
            </div>
          )}
        </div>
      )}
    </Draggable>
  );
}
