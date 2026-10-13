import { Draggable } from "@hello-pangea/dnd";
import { AlignLeft, Calendar, CheckSquare, MessageSquare, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KanbanTask } from "@/hooks/useKanbanTasks";
import { getKanbanFileUrl } from "@/hooks/useKanbanAttachments";
import { isOverdue } from "@/lib/dates";
import { labelFor } from "@/lib/kanban-labels";

interface Props {
  task: KanbanTask;
  index: number;
  onClick: (task: KanbanTask) => void;
  isDragDisabled?: boolean;
  // Menções não lidas do usuário nesta tarefa (mostra o número no canto superior direito).
  mentionCount?: number;
}

export function KanbanTaskCard({ task, index, onClick, isDragDisabled, mentionCount = 0 }: Props) {
  const isDone = task.status === "done";
  const isArchived = task.status === "discarded";
  const showDue = !!task.due_date && !isDone && !isArchived;
  const dueLate = showDue && isOverdue(task.due_date);
  const assignees = task.assignees.filter((a) => a.full_name);
  const cover = task.cover_path ? getKanbanFileUrl(task.cover_path) : null;

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={() => onClick(task)}
          className={`relative overflow-hidden rounded-lg border border-border bg-card cursor-pointer transition-all duration-150
            hover:border-primary/30 hover:shadow-card-hover
            ${snapshot.isDragging ? "shadow-card-hover ring-2 ring-primary/20 rotate-1" : "shadow-card"}`}
        >
          {mentionCount > 0 && (
            <span
              title="Menções não lidas"
              className="absolute right-2 top-2 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white shadow ring-2 ring-background"
            >
              {mentionCount}
            </span>
          )}
          {cover && <img src={cover} alt="" className="h-32 w-full object-cover" loading="lazy" />}

          <div className="space-y-2 p-3">
            {assignees.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {assignees.map((a) => (
                  <span
                    key={a.id}
                    className="inline-block max-w-full truncate rounded px-2 py-0.5 text-[11px] font-semibold"
                    style={{ backgroundColor: labelFor(a.full_name!).bg, color: labelFor(a.full_name!).text }}
                  >
                    {a.full_name}
                  </span>
                ))}
              </div>
            )}

            <p className="text-sm font-medium leading-snug text-foreground break-words">{task.title}</p>

            {(showDue || isDone || task.description || task.comments_count > 0 || task.attachments_count > 0 || task.checklist_total > 0) && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                {showDue && (
                  <span className={`flex items-center gap-1 ${dueLate ? "font-medium text-destructive" : ""}`}>
                    <Calendar className="h-3 w-3" />
                    {format(new Date(task.due_date!), "dd MMM", { locale: ptBR })}
                  </span>
                )}
                {isDone && (
                  <span className="flex items-center gap-1 rounded bg-green-500/15 px-1.5 py-0.5 font-medium text-green-600 dark:text-green-400">
                    <Calendar className="h-3 w-3" />
                    Concluída
                  </span>
                )}
                {task.description && <AlignLeft className="h-3 w-3" aria-label="Tem descrição" />}
                {task.comments_count > 0 && (
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {task.comments_count}
                  </span>
                )}
                {task.checklist_total > 0 && (
                  <span
                    className={`flex items-center gap-1 ${task.checklist_done === task.checklist_total ? "font-medium text-green-600 dark:text-green-400" : ""}`}
                  >
                    <CheckSquare className="h-3 w-3" />
                    {task.checklist_done}/{task.checklist_total}
                  </span>
                )}
                {task.attachments_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {task.attachments_count}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
