import { useState, useEffect } from "react";
import { useTasks, Task, useUpdateTask } from "@/hooks/useTasks";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatTime, formatMinutes } from "@/hooks/useTimeTracker";
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
  const { activeTaskId, isRunning, elapsed, start, stop } = useGlobalTimer();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const myTasks = (tasks || []).filter(
    (t) => t.assigned_to === user?.id && t.status !== "done" && t.status !== "discarded"
  );

  // The displayed task: if timer is running, show that task; otherwise use selection
  const focusTaskId = isRunning && activeTaskId ? activeTaskId : selectedTaskId;
  const activeTask = myTasks.find((t) => t.id === focusTaskId) || null;
  const { totalMinutes } = useTaskTimeLogs(focusTaskId);

  // Auto-select a task on mount
  useEffect(() => {
    if (!selectedTaskId && myTasks.length > 0) {
      // If timer is already running on a task, select that
      if (activeTaskId && myTasks.find((t) => t.id === activeTaskId)) {
        setSelectedTaskId(activeTaskId);
      } else {
        const inProgress = myTasks.find((t) => t.status === "in_progress");
        setSelectedTaskId(inProgress?.id || myTasks[0].id);
      }
    }
  }, [myTasks, selectedTaskId, activeTaskId]);

  const handleComplete = async () => {
    if (!activeTask) return;
    if (isRunning && activeTaskId === activeTask.id) await stop();
    updateTask.mutate({ id: activeTask.id, status: "done" as any });
    const next = myTasks.find((t) => t.id !== activeTask.id);
    setSelectedTaskId(next?.id || null);
  };

  const handleNext = () => {
    const idx = myTasks.findIndex((t) => t.id === focusTaskId);
    const next = myTasks[(idx + 1) % myTasks.length];
    if (next) setSelectedTaskId(next.id);
  };

  const handleStart = () => {
    const taskId = selectedTaskId || myTasks[0]?.id;
    if (taskId) start(taskId);
  };

  const displayTotal = totalMinutes + (isRunning && activeTaskId === focusTaskId ? Math.floor(elapsed / 60) : 0);
  const isTimerOnFocusTask = isRunning && activeTaskId === focusTaskId;

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

        {!activeTask && !myTasks.length ? (
          <EmptyState
            icon={Target}
            title="Nenhuma tarefa atribuída"
            description="Tarefas atribuídas a você aparecerão aqui."
          />
        ) : (
          <>
            {/* Timer Hero */}
            <div className="text-center space-y-5">
              <div className={`text-7xl font-mono font-bold tracking-tighter ${isTimerOnFocusTask ? "text-primary" : "text-foreground"}`}>
                {isTimerOnFocusTask ? formatTime(elapsed) : "00:00:00"}
              </div>
              <div className="flex items-center justify-center gap-3">
                {isTimerOnFocusTask ? (
                  <Button size="lg" variant="destructive" onClick={stop} className="px-8 h-12 rounded-xl">
                    <Square className="h-5 w-5 mr-2" />
                    Pausar
                  </Button>
                ) : (
                  <Button size="lg" onClick={handleStart} className="px-8 h-12 rounded-xl">
                    <Play className="h-5 w-5 mr-2" />
                    {isRunning ? "Trocar para esta" : "Iniciar"}
                  </Button>
                )}
              </div>
              {/* Show if timer is running on another task */}
              {isRunning && activeTaskId && activeTaskId !== focusTaskId && (
                <p className="text-xs text-warning">
                  ⚠️ Timer rodando em outra tarefa. Iniciar aqui irá parar a anterior.
                </p>
              )}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Total: <span className="text-foreground font-semibold">{formatMinutes(displayTotal)}</span>
              </div>
            </div>

            {/* Task Card */}
            {activeTask && (
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
            )}

            {/* Task Selector */}
            {myTasks.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Suas tarefas ({myTasks.length})</p>
                <Select value={focusTaskId || ""} onValueChange={setSelectedTaskId}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {myTasks.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                        {activeTaskId === t.id && isRunning ? " ⏱️" : ""}
                      </SelectItem>
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
