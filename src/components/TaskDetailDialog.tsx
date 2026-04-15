import { Task, useUpdateTask, useDeleteTask, useProfiles, COLUMNS } from "@/hooks/useTasks";
import { useTimeTracker, useTaskTimeLogs, formatTime, formatMinutes } from "@/hooks/useTimeTracker";
import { useLogResponsibilityChange } from "@/hooks/useResponsibilityHistory";
import { StatusBadge } from "@/components/StatusBadge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Play, Square, Clock, Trash2, User, Timer, FileText, History, MessageSquare, GitBranch, CalendarIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { TaskComments } from "@/components/TaskComments";
import { TaskAttachments } from "@/components/TaskAttachments";
import { ResponsibilityHistorySection } from "@/components/ResponsibilityHistory";
import { TaskApprovalSection } from "@/components/TaskApprovalSection";
import { TaskDependencies } from "@/components/TaskDependencies";
import { TaskTimeline } from "@/components/TaskTimeline";

const priorityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isReadOnly?: boolean;
}

export function TaskDetailDialog({ task, open, onOpenChange, isReadOnly }: TaskDetailDialogProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: profiles } = useProfiles();
  const logResponsibility = useLogResponsibilityChange();
  const { isRunning, elapsed, start, stop } = useTimeTracker(task?.id ?? null);
  const { logs, userSummaries, totalMinutes } = useTaskTimeLogs(open && task ? task.id : null);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setAssignedTo(task.assigned_to || "");
      setStatus(task.status);
      setDueDate(task.due_date ? new Date(task.due_date) : undefined);
      setEditing(false);
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;
    const newAssigned = assignedTo === "none" ? null : assignedTo || null;
    const oldAssigned = task.assigned_to || null;
    if (newAssigned !== oldAssigned) {
      logResponsibility.mutate({ taskId: task.id, fromUserId: oldAssigned, toUserId: newAssigned });
    }
    updateTask.mutate({
      id: task.id, title, description: description || null,
      priority: priority as any, assigned_to: newAssigned, status: status as any,
      due_date: dueDate ? dueDate.toISOString() : null,
    });
    setEditing(false);
  };

  const handleDelete = () => { if (!task) return; deleteTask.mutate(task.id); onOpenChange(false); };
  const handleClose = async (isOpen: boolean) => { if (!isOpen && isRunning) await stop(); onOpenChange(isOpen); };

  if (!task) return null;

  const displayTotal = totalMinutes + Math.floor(elapsed / 60);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Detalhes da Tarefa
          </DialogTitle>
        </DialogHeader>

        {/* Timer - Prominent */}
        {!isReadOnly && (
        <div className="mx-6 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Timer</span>
              <span className="text-xs text-muted-foreground">
                Total: <span className="text-foreground font-semibold">{formatMinutes(displayTotal)}</span>
              </span>
            </div>
            <div className="flex items-center gap-3">
              {isRunning ? (
                <>
                  <span className="font-mono text-xl text-primary font-bold tabular-nums">{formatTime(elapsed)}</span>
                  <Button size="sm" variant="destructive" onClick={stop} className="h-8 rounded-lg">
                    <Square className="h-3.5 w-3.5 mr-1" />Parar
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={start} className="h-8 rounded-lg">
                  <Play className="h-3.5 w-3.5 mr-1" />Iniciar
                </Button>
              )}
            </div>
          </div>
        </div>
        )}

        <div className="px-6 pb-6 space-y-4">
          {/* Task Info */}
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-2"><Label>Título</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
              <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{priorityOptions.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{COLUMNS.map((c) => <SelectItem key={c.status} value={c.status}>{c.title}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Responsável</Label>
                  <Select value={assignedTo || "none"} onValueChange={setAssignedTo}>
                    <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {profiles?.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prazo</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !dueDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dueDate ? format(dueDate, "dd/MM/yyyy") : "Sem prazo"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateTask.isPending} className="rounded-lg">Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="rounded-lg">Cancelar</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-base font-semibold text-foreground">{task.title}</p>
                {task.description && <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{task.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusBadge type="status" value={task.status} />
                <StatusBadge type="priority" value={task.priority} />
              </div>
              {task.profiles?.full_name && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">
                      {task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{task.profiles.full_name}</span>
                </div>
              )}
              {!isReadOnly && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} className="rounded-lg">Editar</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete} className="rounded-lg">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />Excluir
                </Button>
              </div>
              )}
            </div>
          )}

          {/* Tabs for sections */}
          <Tabs defaultValue="details" className="space-y-3">
            <TabsList className="bg-muted/50 p-1 rounded-xl w-full justify-start">
              <TabsTrigger value="details" className="rounded-lg text-xs"><FileText className="h-3.5 w-3.5 mr-1" />Detalhes</TabsTrigger>
              <TabsTrigger value="comments" className="rounded-lg text-xs"><MessageSquare className="h-3.5 w-3.5 mr-1" />Chat</TabsTrigger>
              <TabsTrigger value="timeline" className="rounded-lg text-xs"><GitBranch className="h-3.5 w-3.5 mr-1" />Timeline</TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg text-xs"><History className="h-3.5 w-3.5 mr-1" />Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              {/* Time per user */}
              {userSummaries.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <User className="h-4 w-4 text-muted-foreground" />Tempo por Usuário
                  </h4>
                  <div className="space-y-1.5">
                    {userSummaries.map((us) => (
                      <div key={us.user_id} className="flex items-center justify-between text-sm rounded-lg bg-muted/30 px-3 py-2">
                        <span className="text-muted-foreground">{us.full_name || "Sem nome"}</span>
                        <span className="font-medium text-foreground">{formatMinutes(us.total_minutes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {logs.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">Registros Recentes</h4>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {logs.slice(0, 10).map((log) => (
                      <div key={log.id} className="flex items-center justify-between text-xs text-muted-foreground px-3 py-1.5">
                        <span>{new Date(log.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="font-medium text-foreground">{formatMinutes(log.duration_minutes)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <TaskDependencies taskId={task.id} />
              <TaskApprovalSection taskId={task.id} taskStatus={task.status} />
              <TaskAttachments taskId={task.id} />
            </TabsContent>

            <TabsContent value="comments">
              <TaskComments taskId={task.id} />
            </TabsContent>

            <TabsContent value="timeline">
              <TaskTimeline taskId={task.id} />
            </TabsContent>

            <TabsContent value="history">
              <ResponsibilityHistorySection taskId={task.id} />
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
