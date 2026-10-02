import { useState } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { useQueryClient } from "@tanstack/react-query";
import { useKanbanTasks, useKanbanUpdateTask, useKanbanTaskFilter, KANBAN_COLUMNS, KanbanStatus, KanbanTask } from "@/hooks/useKanbanTasks";
import { useUserRole } from "@/hooks/useUserRole";
import { TaskCard } from "@/components/TaskCard";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskFilterSelect } from "@/components/TaskFilterSelect";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Columns3 } from "lucide-react";

const Kanban = () => {
  const queryClient = useQueryClient();
  const { data: tasks, isLoading } = useKanbanTasks();
  const { filteredTasks, selectedUserId, setSelectedUserId, canFilter } = useKanbanTaskFilter(tasks);
  const updateTask = useKanbanUpdateTask();
  const { isGestor } = useUserRole();
  const [createOpen, setCreateOpen] = useState(false);
  const [createStatus, setCreateStatus] = useState<KanbanStatus>("backlog");
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);

  const tasksByStatus = KANBAN_COLUMNS.reduce(
    (acc, col) => {
      acc[col.status] = filteredTasks.filter((t) => t.status === col.status);
      return acc;
    },
    {} as Record<KanbanStatus, KanbanTask[]>
  );

  const onDragEnd = (result: DropResult) => {
    if (isGestor) return; // read-only
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as KanbanStatus;
    updateTask.mutate({ id: draggableId, status: newStatus as any });
  };

  const handleAddToColumn = (status: KanbanStatus) => {
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
    <div className="relative min-h-[calc(100vh-4rem)] kanban-scroll">
      <div
        className="absolute inset-0 -m-6 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/logo.png')", opacity: 0.5 }}
      />
      <div className="relative z-10 space-y-6">
        <PageHeader
          title="Kanban"
        description={isGestor ? "Visualização do quadro de tarefas (somente leitura)." : "Arraste as tarefas entre colunas para atualizar o status."}
        icon={<Columns3 className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            {canFilter && (
              <TaskFilterSelect value={selectedUserId} onChange={setSelectedUserId} />
            )}
            {!isGestor && (
              <Button onClick={() => handleAddToColumn("backlog")} className="h-9">
                <Plus className="mr-2 h-4 w-4" />
                Nova Tarefa
              </Button>
            )}
          </div>
        }
      />

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-12rem)]">
          {KANBAN_COLUMNS.map((col) => {
            const colTasks = tasksByStatus[col.status] || [];
            return (
              <div key={col.status} className="min-w-[272px] w-[272px] flex-shrink-0 flex flex-col h-full">
                <div className="mb-3 flex items-center justify-between px-1 flex-shrink-0">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{col.title}</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {colTasks.length}
                    </span>
                    {!isGestor && (
                      <button
                        onClick={() => handleAddToColumn(col.status)}
                        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <Droppable droppableId={col.status} isDropDisabled={isGestor}>
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
                        <TaskCard key={task.id} task={task} index={i} onClick={setSelectedTask} isDragDisabled={isGestor} />
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

      {!isGestor && <CreateTaskDialog open={createOpen} onOpenChange={(open) => { if (!open) queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }); setCreateOpen(open); }} defaultStatus={createStatus} />}
      <TaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => { if (!o) { queryClient.invalidateQueries({ queryKey: ["kanban-tasks"] }); setSelectedTask(null); } }} isReadOnly={isGestor} />
      </div>
    </div>
  );
};

export default Kanban;
