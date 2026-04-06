import { useState } from "react";
import { useTasks, useDeleteTask, Task } from "@/hooks/useTasks";
import { useTaskFilter } from "@/hooks/useTaskFilter";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { TaskFilterSelect } from "@/components/TaskFilterSelect";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Loader2, Trash2, Clock, ListTodo } from "lucide-react";

const Tasks = () => {
  const { data: tasks, isLoading } = useTasks();
  const { filteredTasks, selectedUserId, setSelectedUserId, canFilter } = useTaskFilter(tasks);
  const deleteTask = useDeleteTask();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Tarefas"
        description="Gerencie todas as tarefas do time."
        icon={<ListTodo className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            {canFilter && (
              <TaskFilterSelect value={selectedUserId} onChange={setSelectedUserId} />
            )}
            <Button onClick={() => setCreateOpen(true)} className="h-9">
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
          </div>
        }
      />

      {filteredTasks.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <EmptyState
              icon={ListTodo}
              title="Nenhuma tarefa encontrada"
              description="Nenhuma tarefa para o filtro selecionado."
              actionLabel="Criar Tarefa"
              onAction={() => setCreateOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTasks.map((task) => {
            const initials = task.profiles?.full_name
              ? task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              : null;
            const hours = Math.floor((task.total_minutes || 0) / 60);
            const mins = (task.total_minutes || 0) % 60;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="flex items-center gap-4 rounded-xl border border-border bg-card p-3.5 cursor-pointer
                  shadow-card hover:shadow-card-hover hover:border-primary/20 transition-all duration-150"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                  )}
                </div>

                <StatusBadge type="status" value={task.status} />
                <StatusBadge type="priority" value={task.priority} />

                {(task.total_minutes || 0) > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
                  </div>
                )}

                {initials && (
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                  onClick={(e) => { e.stopPropagation(); deleteTask.mutate(task.id); }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)} />
    </div>
  );
};

export default Tasks;
