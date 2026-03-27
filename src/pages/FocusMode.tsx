import { useState, useEffect } from "react";
import { useTasks, Task, useUpdateTask, COLUMNS } from "@/hooks/useTasks";
import { useTimeTracker, formatTime, formatMinutes } from "@/hooks/useTimeTracker";
import { useTaskTimeLogs } from "@/hooks/useTimeTracker";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Target, ChevronLeft, ArrowRight, Clock, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const FocusMode = () => {
  const { data: tasks } = useTasks();
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const navigate = useNavigate();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const myTasks = (tasks || []).filter(
    (t) => t.assigned_to === user?.id && t.status !== "done" && t.status !== "discarded"
  );

  const activeTask = myTasks.find((t) => t.id === activeTaskId) || null;
  const { isRunning, elapsed, start, stop } = useTimeTracker(activeTaskId);
  const { totalMinutes } = useTaskTimeLogs(activeTaskId);

  useEffect(() => {
    if (!activeTaskId && myTasks.length > 0) {
      const inProgress = myTasks.find((t) => t.status === "in_progress");
      setActiveTaskId(inProgress?.id || myTasks[0].id);
    }
  }, [myTasks, activeTaskId]);

  const handleComplete = async () => {
    if (!activeTask) return;
    if (isRunning) await stop();
    updateTask.mutate({ id: activeTask.id, status: "done" as any });
    const next = myTasks.find((t) => t.id !== activeTask.id);
    setActiveTaskId(next?.id || null);
  };

  const handleNext = () => {
    const idx = myTasks.findIndex((t) => t.id === activeTaskId);
    const next = myTasks[(idx + 1) % myTasks.length];
    if (next) setActiveTaskId(next.id);
  };

  const displayTotal = totalMinutes + Math.floor(elapsed / 60);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate(-1)} className="text-muted-foreground h-9">
            <ChevronLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
          <PageHeader title="Modo Foco" icon={<Target className="h-5 w-5" />} />
          <div className="w-20" />
        </div>

        {!activeTask ? (
          <EmptyState
            icon={Target}
            title="Nenhuma tarefa atribuída"
            description="Tarefas atribuídas a você aparecerão aqui."
          />
        ) : (
          <>
            {/* Timer Hero */}
            <div className="text-center space-y-5">
              <div className={`text-7xl font-mono font-bold tracking-tighter ${isRunning ? "text-primary" : "text-foreground"}`}>
                {formatTime(elapsed)}
              </div>
              <div className="flex items-center justify-center gap-3">
                {isRunning ? (
                  <Button size="lg" variant="destructive" onClick={stop} className="px-8 h-12 rounded-xl">
                    <Square className="h-5 w-5 mr-2" />
                    Pausar
                  </Button>
                ) : (
                  <Button size="lg" onClick={start} className="px-8 h-12 rounded-xl">
                    <Play className="h-5 w-5 mr-2" />
                    Iniciar
                  </Button>
                )}
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Total: <span className="text-foreground font-semibold">{formatMinutes(displayTotal)}</span>
              </div>
            </div>

            {/* Task Card */}
            <Card className="shadow-card">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-lg font-semibold text-foreground">{activeTask.title}</h2>
                {activeTask.description && (
                  <p className="text-sm text-muted-foreground leading-relaxed">{activeTask.description}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <StatusBadge type="status" value={activeTask.status} />
                  <StatusBadge type="priority" value={activeTask.priority} />
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" onClick={handleComplete} className="flex-1 h-10 rounded-xl">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Concluir
                  </Button>
                  {myTasks.length > 1 && (
                    <Button variant="secondary" onClick={handleNext} className="flex-1 h-10 rounded-xl">
                      Próxima
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Task Selector */}
            {myTasks.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Suas tarefas ({myTasks.length})</p>
                <Select value={activeTaskId || ""} onValueChange={setActiveTaskId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {myTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default FocusMode;
