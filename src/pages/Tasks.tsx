import { useState } from "react";
import { useTasks, useDeleteTask, COLUMNS } from "@/hooks/useTasks";
import { CreateTaskDialog } from "@/components/CreateTaskDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, Loader2, Trash2, Clock } from "lucide-react";

const priorityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Baixa", className: "bg-muted text-muted-foreground" },
  medium: { label: "Média", className: "bg-primary/20 text-primary" },
  high: { label: "Alta", className: "bg-warning/20 text-warning" },
  urgent: { label: "Urgente", className: "bg-destructive/20 text-destructive" },
};

const statusMap = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));

const Tasks = () => {
  const { data: tasks, isLoading } = useTasks();
  const deleteTask = useDeleteTask();
  const [createOpen, setCreateOpen] = useState(false);

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
          <h1 className="text-2xl font-bold text-foreground">Tarefas</h1>
          <p className="text-muted-foreground">Gerencie todas as tarefas do time.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-foreground">Lista de Tarefas</CardTitle>
        </CardHeader>
        <CardContent>
          {!tasks || tasks.length === 0 ? (
            <p className="text-muted-foreground">Nenhuma tarefa criada ainda.</p>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const priority = priorityConfig[task.priority] || priorityConfig.medium;
                const initials = task.profiles?.full_name
                  ? task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
                  : null;
                const hours = Math.floor((task.total_minutes || 0) / 60);
                const mins = (task.total_minutes || 0) % 60;

                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 rounded-lg border border-border bg-secondary/30 p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                      )}
                    </div>

                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      {statusMap[task.status] || task.status}
                    </Badge>

                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${priority.className}`}>
                      {priority.label}
                    </Badge>

                    {(task.total_minutes || 0) > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock className="h-3 w-3" />
                        {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
                      </div>
                    )}

                    {initials && (
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarFallback className="bg-primary/20 text-primary text-[9px]">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => deleteTask.mutate(task.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
};

export default Tasks;
