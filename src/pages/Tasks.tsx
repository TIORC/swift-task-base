import { useState, useMemo } from "react";
import { useTasks, useDeleteTask, useUpdateTask, Task, COLUMNS } from "@/hooks/useTasks";
import { useTaskFilter } from "@/hooks/useTaskFilter";
import { useUserRole } from "@/hooks/useUserRole";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatTime, formatMinutes } from "@/hooks/useTimeTracker";
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
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Plus, Loader2, Trash2, Clock, ListTodo,
  Play, Square, CheckCircle, CalendarDays, Filter, Repeat,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type StatusChip = "all" | "open" | "in_progress" | "pending" | "done" | "discarded";

const STATUS_CHIPS: { key: StatusChip; label: string; statuses: string[] }[] = [
  { key: "all", label: "Todas", statuses: [] },
  { key: "open", label: "Abertas", statuses: ["backlog", "todo"] },
  { key: "in_progress", label: "Em andamento", statuses: ["in_progress"] },
  { key: "pending", label: "Pendentes", statuses: ["pending", "review"] },
  { key: "done", label: "Concluídas", statuses: ["done"] },
  { key: "discarded", label: "Desconsideradas", statuses: ["discarded"] },
];

const PRIORITY_CHIPS = [
  { key: "all", label: "Todas" },
  { key: "urgent", label: "Urgente" },
  { key: "high", label: "Alta" },
  { key: "medium", label: "Média" },
  { key: "low", label: "Baixa" },
];

const WEEKDAY_CHIPS = [
  { key: "all", label: "Todos os dias", code: null as string | null },
  { key: "SEG", label: "SEG", code: "SEG" },
  { key: "TER", label: "TER", code: "TER" },
  { key: "QUA", label: "QUA", code: "QUA" },
  { key: "QUI", label: "QUI", code: "QUI" },
  { key: "SEX", label: "SEX", code: "SEX" },
  { key: "SAB", label: "SAB", code: "SAB" },
  { key: "DOM", label: "DOM", code: "DOM" },
];

const isRecurringTask = (t: any) =>
  !!(t?.is_recurring_template || t?.recurrence_type || (Array.isArray(t?.recurrence_days) && t.recurrence_days.length > 0));

const Tasks = () => {
  const { data: tasks, isLoading } = useTasks();
  const { filteredTasks, selectedUserId, setSelectedUserId, canFilter } = useTaskFilter(tasks);
  const { isGestor } = useUserRole();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const { user } = useAuth();
  const { activeTaskId, isRunning, elapsed, start, stop } = useGlobalTimer();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Advanced filters
  const [statusChip, setStatusChip] = useState<StatusChip>("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [recurringOnly, setRecurringOnly] = useState(false);
  const [weekdayFilter, setWeekdayFilter] = useState<string>("all");

  // Apply advanced filters on top of user filter
  const advancedFiltered = useMemo(() => {
    let result = filteredTasks;

    // Status chip filter
    if (statusChip !== "all") {
      const chip = STATUS_CHIPS.find(c => c.key === statusChip);
      if (chip) result = result.filter(t => chip.statuses.includes(t.status));
    }

    // Priority filter
    if (priorityFilter !== "all") {
      result = result.filter(t => t.priority === priorityFilter);
    }

    // Date range filter
    if (dateFrom) {
      result = result.filter(t => new Date(t.created_at) >= dateFrom);
    }
    if (dateTo) {
      const endOfDay = new Date(dateTo);
      endOfDay.setHours(23, 59, 59, 999);
      result = result.filter(t => new Date(t.created_at) <= endOfDay);
    }

    // Recurring only
    if (recurringOnly) {
      result = result.filter((t) => isRecurringTask(t));
    }

    // Weekday filter (matches recurrence_days OR due_date weekday)
    if (weekdayFilter !== "all") {
      const codeMap = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
      result = result.filter((t: any) => {
        const days: string[] = Array.isArray(t.recurrence_days) ? t.recurrence_days : [];
        if (days.length > 0) return days.includes(weekdayFilter);
        if (t.due_date) {
          const d = new Date(t.due_date);
          return codeMap[d.getDay()] === weekdayFilter;
        }
        return false;
      });
    }

    return result;
  }, [filteredTasks, statusChip, priorityFilter, dateFrom, dateTo, recurringOnly, weekdayFilter]);

  // Count per status chip
  const chipCounts = useMemo(() => {
    const counts: Record<string, number> = { all: filteredTasks.length };
    STATUS_CHIPS.forEach(chip => {
      if (chip.key !== "all") {
        counts[chip.key] = filteredTasks.filter(t => chip.statuses.includes(t.status)).length;
      }
    });
    return counts;
  }, [filteredTasks]);

  const handleComplete = (task: Task) => {
    if (activeTaskId === task.id && isRunning) stop();
    updateTask.mutate({ id: task.id, status: "done" as any });
  };

  const clearDateFilters = () => { setDateFrom(undefined); setDateTo(undefined); };
  const hasDateFilter = dateFrom || dateTo;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <PageHeader
        title="Tarefas"
        description="Gerencie e acompanhe o tempo das tarefas."
        icon={<ListTodo className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            {canFilter && (
              <TaskFilterSelect value={selectedUserId} onChange={setSelectedUserId} />
            )}
            {!isGestor && (
              <Button onClick={() => setCreateOpen(true)} className="h-9">
                <Plus className="mr-2 h-4 w-4" />
                Nova Tarefa
              </Button>
            )}
          </div>
        }
      />

      {/* Status Chips */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_CHIPS.map(chip => (
          <button
            key={chip.key}
            onClick={() => setStatusChip(chip.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150
              ${statusChip === chip.key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
          >
            {chip.label}
            <span className={`text-[10px] ${statusChip === chip.key ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
              {chipCounts[chip.key] || 0}
            </span>
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Priority filter */}
        {PRIORITY_CHIPS.map(p => (
          <button
            key={p.key}
            onClick={() => setPriorityFilter(p.key)}
            className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-[11px] font-medium transition-all duration-150
              ${priorityFilter === p.key
                ? "bg-accent text-accent-foreground shadow-sm"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
          >
            {p.label}
          </button>
        ))}

        <div className="h-4 w-px bg-border mx-1" />

        {/* Date filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant={hasDateFilter ? "default" : "outline"} size="sm" className="h-7 text-xs rounded-full gap-1.5">
              <CalendarDays className="h-3 w-3" />
              {hasDateFilter
                ? `${dateFrom ? format(dateFrom, "dd/MM", { locale: ptBR }) : "..."} - ${dateTo ? format(dateTo, "dd/MM", { locale: ptBR }) : "..."}`
                : "Período"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">De:</p>
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  locale={ptBR}
                  className="rounded-lg"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Até:</p>
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  locale={ptBR}
                  className="rounded-lg"
                />
              </div>
              {hasDateFilter && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={clearDateFilters}>
                  Limpar período
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-border mx-1" />

        {/* Recurring toggle */}
        <button
          onClick={() => setRecurringOnly((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-150 border ${
            recurringOnly
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/40 shadow-sm"
              : "bg-muted text-muted-foreground border-transparent hover:bg-muted/80 hover:text-foreground"
          }`}
          title="Mostrar apenas tarefas recorrentes"
        >
          <Repeat className="h-3 w-3" />
          Recorrentes
        </button>
      </div>

      {/* Weekday filter */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted-foreground mr-1">Dia:</span>
        {WEEKDAY_CHIPS.map((w) => (
          <button
            key={w.key}
            onClick={() => setWeekdayFilter(w.key)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all ${
              weekdayFilter === w.key
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background text-muted-foreground border-border hover:bg-muted"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {advancedFiltered.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <EmptyState
              icon={ListTodo}
              title="Nenhuma tarefa encontrada"
              description="Nenhuma tarefa para os filtros selecionados."
              actionLabel="Criar Tarefa"
              onAction={() => setCreateOpen(true)}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {advancedFiltered.map((task) => {
            const initials = task.profiles?.full_name
              ? task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
              : null;
            const isMyTask = task.assigned_to === user?.id;
            const isActive = task.status !== "done" && task.status !== "discarded";
            const isTimerOnThis = activeTaskId === task.id && isRunning;
            const hours = Math.floor((task.total_minutes || 0) / 60);
            const mins = (task.total_minutes || 0) % 60;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className={`flex items-center gap-4 rounded-xl border bg-card p-3.5 cursor-pointer
                  shadow-card hover:shadow-card-hover transition-all duration-150
                  ${isTimerOnThis ? "border-primary/40 ring-1 ring-primary/20" : "border-border hover:border-primary/20"}`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{task.description}</p>
                  )}
                </div>

                <StatusBadge type="status" value={task.status} />
                <StatusBadge type="priority" value={task.priority} />

                {!isGestor && isMyTask && isActive && (
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isTimerOnThis && (
                      <span className="text-sm font-mono font-bold text-primary animate-pulse">
                        {formatTime(elapsed)}
                      </span>
                    )}
                    {!isTimerOnThis && (task.total_minutes || 0) > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`}
                      </span>
                    )}
                    {isTimerOnThis ? (
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
                        onClick={(e) => { e.stopPropagation(); start(task.id); }}
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}

                {(isGestor || !isMyTask || !isActive) && (task.total_minutes || 0) > 0 && (
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

                {!isGestor && isMyTask && isActive && (
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

                {!isGestor && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    onClick={(e) => { e.stopPropagation(); deleteTask.mutate(task.id); }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isGestor && <CreateTaskDialog open={createOpen} onOpenChange={setCreateOpen} />}
      <TaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)} isReadOnly={isGestor} />
    </div>
  );
};

export default Tasks;
