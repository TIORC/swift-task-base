import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { isOverdue } from "@/lib/dates";

interface TaskDueDateProps {
  dueDate: string | null;
  done: boolean;
  className?: string;
}

// Mostra o prazo da tarefa. Sem prazo: "Sem prazo". Vencida (e não concluída): em vermelho.
export function TaskDueDate({ dueDate, done, className }: TaskDueDateProps) {
  if (!dueDate) {
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs text-muted-foreground", className)}>
        <Calendar className="h-3 w-3" />
        Sem prazo
      </span>
    );
  }

  const late = !done && isOverdue(dueDate);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        late ? "text-destructive" : "text-muted-foreground",
        className
      )}
    >
      <Calendar className="h-3 w-3" />
      {late ? "Vencida em " : "Prazo "}
      {format(new Date(dueDate), "dd/MM/yyyy")}
    </span>
  );
}
