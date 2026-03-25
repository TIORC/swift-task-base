import { Task } from "@/hooks/useTasks";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { Draggable } from "@hello-pangea/dnd";

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Baixa", className: "bg-muted text-muted-foreground" },
  medium: { label: "Média", className: "bg-primary/20 text-primary" },
  high: { label: "Alta", className: "bg-warning/20 text-warning" },
  urgent: { label: "Urgente", className: "bg-destructive/20 text-destructive" },
};

interface TaskCardProps {
  task: Task;
  index: number;
  onClick?: (task: Task) => void;
}

export function TaskCard({ task, index, onClick }: TaskCardProps) {
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
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
          className={`rounded-lg border border-border bg-card p-3 space-y-2.5 transition-shadow cursor-pointer hover:ring-1 hover:ring-primary/30 ${
            snapshot.isDragging ? "shadow-lg shadow-primary/10 ring-1 ring-primary/30" : ""
          }`}
        >
          <p className="text-sm font-medium text-foreground leading-snug">{task.title}</p>

          <div className="flex items-center justify-between gap-2">
            <Badge variant="secondary" className={`text-[10px] px-1.5 py-0 ${priority.className}`}>
              {priority.label}
            </Badge>

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
                <AvatarFallback className="bg-primary/20 text-primary text-[9px]">
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
