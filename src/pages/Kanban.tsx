import { useState } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { useTasks, useUpdateTask, COLUMNS, TaskStatus, Task } from "@/hooks/useTasks";
import { useTaskFilter } from "@/hooks/useTaskFilter";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskFilterSelect } from "@/components/TaskFilterSelect";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Columns3 } from "lucide-react";

const Kanban = () => {
  const { data: tasks, isLoading } = useTasks();
  const { filteredTasks, selectedUserId, setSelectedUserId, canFilter } = useTaskFilter(tasks);
  const updateTask = useUpdateTask();
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<TaskStatus>("backlog");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const tasksByStatus = COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = filteredTasks.filter((t) => t.status === col.status);
      return acc;
    },
    {} as Record<TaskStatus, Task[]>
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
      <PageHeader
        title="Kanban"
        description="Arraste as tarefas entre colunas para atualizar o status."
        icon={<Columns3 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            {canFilter && (
              <TaskFilterSelect value={selectedUserId} onChange={setSelectedUserId} />
            )}
            <Button onClick={() => handleAddToColumn("backlog")} className="h-9">
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
          </div>
        }
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-12rem)]">
          {COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.status] || [];
            return (
              <div key={col.status} className="min-w-[272px] w-[272px] flex-shrink-0 flex flex-col h-full">
                <div className="mb-3 flex items-center justify-between px-1 flex-shrink-0">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.title}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {colTasks.length}
                    </span>
                    <button
                      onClick={() => handleAddToColumn(col.status)}
                      className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
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
                      className={`flex-1 overflow-y-auto space-y-2 rounded-xl border border-dashed p-2.5 transition-all duration-200 ${
                        snapshot.isDraggingOver
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-muted/30"
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
