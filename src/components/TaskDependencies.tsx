import { useTaskDependencies, useAddDependency, useRemoveDependency } from "@/hooks/useDependencies";
import { useTasks, Task } from "@/hooks/useTasks";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GitBranch, X, ArrowRight } from "lucide-react";
import { useState } from "react";

interface TaskDependenciesProps {
  taskId: string;
}

export function TaskDependencies({ taskId }: TaskDependenciesProps) {
  const { data: deps } = useTaskDependencies(taskId);
  const { data: allTasks } = useTasks();
  const addDep = useAddDependency();
  const removeDep = useRemoveDependency();
  const [selectedTask, setSelectedTask] = useState("");

  const blockedBy = deps?.filter((d) => d.task_id === taskId) || [];
  const blocking = deps?.filter((d) => d.depends_on_task_id === taskId) || [];

  const usedIds = new Set([
    taskId,
    ...blockedBy.map((d) => d.depends_on_task_id),
    ...blocking.map((d) => d.task_id),
  ]);
  const available = allTasks?.filter((t) => !usedIds.has(t.id)) || [];

  const taskMap = new Map((allTasks || []).map((t) => [t.id, t]));

  const handleAdd = () => {
    if (!selectedTask) return;
    addDep.mutate({ taskId, dependsOnTaskId: selectedTask });
    setSelectedTask("");
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        Dependências
      </h4>

      {blockedBy.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Bloqueada por:</p>
          {blockedBy.map((d) => {
            const t = taskMap.get(d.depends_on_task_id);
            return (
              <div key={d.id} className="flex items-center justify-between rounded bg-destructive/10 px-2 py-1">
                <span className="text-xs text-foreground truncate">{t?.title || "Tarefa removida"}</span>
                <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => removeDep.mutate(d.id)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {blocking.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium">Bloqueia:</p>
          {blocking.map((d) => {
            const t = taskMap.get(d.task_id);
            return (
              <div key={d.id} className="flex items-center justify-between rounded bg-primary/10 px-2 py-1">
                <span className="text-xs text-foreground truncate flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-primary" />
                  {t?.title || "Tarefa removida"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-2">
        <Select value={selectedTask} onValueChange={setSelectedTask}>
          <SelectTrigger className="bg-secondary border-border text-xs h-8 flex-1">
            <SelectValue placeholder="Adicionar dependência..." />
          </SelectTrigger>
          <SelectContent>
            {available.map((t) => (
              <SelectItem key={t.id} value={t.id} className="text-xs">
                {t.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" className="h-8" onClick={handleAdd} disabled={!selectedTask || addDep.isPending}>
          Adicionar
        </Button>
      </div>
    </div>
  );
}
