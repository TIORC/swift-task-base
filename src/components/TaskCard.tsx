import { Task } from "@/hooks/useTasks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Clock } from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";

interface TaskCardProps {
  task: Task;
  index: number;
  onClick?: (task: Task) => void;
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  const initials = task.profiles?.full_name
    ? task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : null;

  const hours = Math.floor((task.total_minutes || 0) / 60);
  const mins = (task.total_minutes || 0) % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick?.(task)}
          className={`rounded-xl border border-border bg-card p-3.5 space-y-2.5 transition-all duration-150 cursor-pointer
            hover:shadow-card-hover hover:border-primary/20
            ${snapshot.isDragging ? "shadow-card-hover ring-2 ring-primary/20 rotate-1" : "shadow-card"}`}
        >
          <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>

          <div className="flex items-center justify-between gap-2">
            <StatusBadge type="priority" value={task.priority} />

            {(task.total_minutes || 0) > 0 && (
              <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{timeStr}</span>
              </div>
            )}
          </div>

          {initials && (
            <div className="flex items-center gap-1.5">
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
