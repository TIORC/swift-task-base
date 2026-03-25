import { useState } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { useTasks, useUpdateTask, COLUMNS, TaskStatus, Task } from "@/hooks/useTasks";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

const Kanban = () => {
  const { data: tasks, isLoading } = useTasks();
  const updateTask = useUpdateTask();
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("backlog");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasksByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = (tasks || []).filter((t) => t.status === col.status);
      return acc;
    },
    {} as Record<TaskStatus, typeof tasks extends (infer T)[] ? T[] : never[]>
  );

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as TaskStatus;
    updateTask.mutate({ id: draggableId, status: newStatus as any });
  };

  const handleAddToColumn = (status: TaskStatus) => {
    setCreateStatus(status);
    setCreateOpen(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Kanban</h1>
          <p className="text-muted-foreground">Arraste as tarefas entre colunas para atualizar o status.</p>
        </div>
        <Button onClick={() => handleAddToColumn("backlog")}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.status] || [];
            return (
              <div key={col.status} className="min-w-[260px] w-[260px] flex-shrink-0">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">
                      {colTasks.length}
                    </span>
                    <button
                      onClick={() => handleAddToColumn(col.status)}
                      className="rounded p-0.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <Droppable droppableId={col.status}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[400px] space-y-2 rounded-lg border border-dashed p-2 transition-colors ${
                        snapshot.isDraggingOver
                          ? "border-primary/50 bg-primary/5"
                          : "border-border bg-secondary/20"
                      }`}
                    >
                      {colTasks.map((task, i) => (
                        <TaskCard key={task.id} task={task} index={i} onClick={setSelectedTask} />
                      ))}
                      {provided.placeholder}
                      {colTasks.length === 0 && !snapshot.isDraggingOver && (
                        <p className="text-center text-xs text-muted-foreground py-10">Sem tarefas</p>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} defaultStatus={createStatus} />
      <TaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)} />
    </div>
  );
};

export default Kanban;
