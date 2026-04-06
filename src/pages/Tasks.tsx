import { useState } from "react";
import { useTasks, useDeleteTask, useUpdateTask, Task } from "@/hooks/useTasks";
import { useTaskFilter } from "@/hooks/useTaskFilter";
import { useTimeTracker, formatTime, formatMinutes } from "@/hooks/useTimeTracker";
import { useTaskTimeLogs } from "@/hooks/useTimeTracker";
import { useAuth } from "@/hooks/useAuth";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { TaskFilterSelect } from "@/components/TaskFilterSelect";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus, Loader2, Trash2, Clock, ListTodo,
  Play, Square, CheckCircle, Target,
} from "lucide-react";

function FocusTimer({ taskId, taskTitle }: { taskId: string; taskTitle: string }) {
  const { isRunning, elapsed, start, stop } = useTimeTracker(taskId);
  const { totalMinutes } = useTaskTimeLogs(taskId);
  const displayTotal = totalMinutes + Math.floor(elapsed / 60);

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      {isRunning && (
        <span className="text-sm font-mono font-bold text-primary animate-pulse">
          {formatTime(elapsed)}
        </span>
      )}
      {!isRunning && displayTotal > 0 && (
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatMinutes(displayTotal)}
        </span>
      )}
      {isRunning ? (
        <Button
          variant="destructive"
          size="icon"
          className="h-7 w-7 rounded-lg shrink-0"
          onClick={(e) => { e.stopPropagation(); stop(); }}
        >
          <Square className="h-3 w-3" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-lg shrink-0 text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
          onClick={(e) => { e.stopPropagation(); start(); }}
        >
          <Play className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

const Tasks = () => {
  const { data: tasks, isLoading } = useTasks();
  const { filteredTasks, selectedUserId, setSelectedUserId, canFilter } = useTaskFilter(tasks);
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const handleComplete = (task: Task) => {
    updateTask.mutate({ id: task.id, status: "done" as any });
  };

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
        description="Gerencie e acompanhe o tempo das tarefas."
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
            const isMyTask = task.assigned_to === user?.id;
            const isActive = task.status !== "done" && task.status !== "discarded";

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

                {/* Focus Timer - only for own active tasks */}
                {isMyTask && isActive && (
                  <FocusTimer taskId={task.id} taskTitle={task.title} />
                )}

                {/* Time display for non-own or completed tasks */}
                {(!isMyTask || !isActive) && (task.total_minutes || 0) > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    {Math.floor((task.total_minutes || 0) / 60) > 0
                      ? `${Math.floor((task.total_minutes || 0) / 60)}h ${(task.total_minutes || 0) % 60}m`
                      : `${(task.total_minutes || 0) % 60}m`}
                  </div>
                )}

                {initials && (
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                )}

                {isMyTask && isActive && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-success transition-colors"
                    onClick={(e) => { e.stopPropagation(); handleComplete(task); }}
                    title="Concluir tarefa"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                  </Button>
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
