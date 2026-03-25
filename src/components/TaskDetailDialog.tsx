import { Task, useUpdateTask, useDeleteTask, useProfiles, COLUMNS } from "@/hooks/useTasks";
import { useTimeTracker, useTaskTimeLogs, formatTime, formatMinutes } from "@/hooks/useTimeTracker";
import { useLogResponsibilityChange } from "@/hooks/useResponsibilityHistory";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square, Clock, Trash2, User, Timer } from "lucide-react";
import { useState, useEffect } from "react";
import { TaskComments } from "@/components/TaskComments";
import { TaskAttachments } from "@/components/TaskAttachments";
import { ResponsibilityHistorySection } from "@/components/ResponsibilityHistory";
import { TaskApprovalSection } from "@/components/TaskApprovalSection";

const priorityOptions = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const statusMap = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: profiles } = useProfiles();
  const logResponsibility = useLogResponsibilityChange();
  const { isRunning, elapsed, start, stop } = useTimeTracker(task?.id ?? null);
  const { logs, userSummaries, totalMinutes } = useTaskTimeLogs(
    open && task ? task.id : null
  );

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setAssignedTo(task.assigned_to || "");
      setStatus(task.status);
      setEditing(false);
    }
  }, [task]);

  const handleSave = () => {
    if (!task) return;

    // Log responsibility change if assigned_to changed
    const newAssigned = assignedTo === "none" ? null : assignedTo || null;
    const oldAssigned = task.assigned_to || null;
    if (newAssigned !== oldAssigned) {
      logResponsibility.mutate({
        taskId: task.id,
        fromUserId: oldAssigned,
        toUserId: newAssigned,
      });
    }

    updateTask.mutate({
      id: task.id,
      title,
      description: description || null,
      priority: priority as any,
      assigned_to: newAssigned,
      status: status as any,
    });
    setEditing(false);
  };

  const handleDelete = () => {
    if (!task) return;
    deleteTask.mutate(task.id);
    onOpenChange(false);
  };

  const handleClose = async (isOpen: boolean) => {
    if (!isOpen && isRunning) {
      await stop();
    }
    onOpenChange(isOpen);
  };

  if (!task) return null;

  const displayTotal = totalMinutes + Math.floor(elapsed / 60);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-border sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Timer className="h-5 w-5 text-primary" />
            Detalhes da Tarefa
          </DialogTitle>
        </DialogHeader>

        {/* Timer Section */}
        <div className="rounded-lg border border-border bg-secondary/30 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Timer</span>
            </div>
            <div className="flex items-center gap-2">
              {isRunning ? (
                <>
                  <span className="font-mono text-lg text-primary font-semibold animate-pulse">
                    {formatTime(elapsed)}
                  </span>
                  <Button size="sm" variant="destructive" onClick={stop} className="h-8">
                    <Square className="h-3.5 w-3.5 mr-1" />
                    Parar
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={start} className="h-8">
                  <Play className="h-3.5 w-3.5 mr-1" />
                  Iniciar
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <div className="text-muted-foreground">
              Total: <span className="text-foreground font-medium">{formatMinutes(displayTotal)}</span>
            </div>
          </div>
        </div>

        {/* Task Fields */}
        <div className="space-y-4">
          {editing ? (
            <>
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-secondary border-border" />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="bg-secondary border-border" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Prioridade</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {priorityOptions.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COLUMNS.map((c) => (
                        <SelectItem key={c.status} value={c.status}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select value={assignedTo || "none"} onValueChange={setAssignedTo}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {profiles?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} disabled={updateTask.isPending}>Salvar</Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancelar</Button>
              </div>
            </>
          ) : (
            <>
              <div>
                <p className="text-base font-semibold text-foreground">{task.title}</p>
                {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{statusMap[task.status] || task.status}</Badge>
                <Badge variant="secondary" className={
                  task.priority === "urgent" ? "bg-destructive/20 text-destructive" :
                  task.priority === "high" ? "bg-warning/20 text-warning" :
                  task.priority === "medium" ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }>
                  {priorityOptions.find((p) => p.value === task.priority)?.label || task.priority}
                </Badge>
              </div>
              {task.profiles?.full_name && (
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/20 text-primary text-[10px]">
                      {task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">{task.profiles.full_name}</span>
                </div>
              )}
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(true)}>Editar</Button>
                <Button size="sm" variant="destructive" onClick={handleDelete}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Excluir
                </Button>
              </div>
            </>
          )}
        </div>

        {/* Time per user */}
        {userSummaries.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <User className="h-4 w-4 text-muted-foreground" />
              Tempo por Usuário
            </h4>
            <div className="space-y-1.5">
              {userSummaries.map((us) => (
                <div key={us.user_id} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{us.full_name || "Sem nome"}</span>
                  <span className="font-medium text-foreground">{formatMinutes(us.total_minutes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent logs */}
        {logs.length > 0 && (
          <div className="space-y-2 border-t border-border pt-4">
            <h4 className="text-sm font-semibold text-foreground">Registros Recentes</h4>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(log.started_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                  <span className="font-medium text-foreground">{formatMinutes(log.duration_minutes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        <TaskAttachments taskId={task.id} />

        {/* Responsibility History */}
        <ResponsibilityHistorySection taskId={task.id} />

        {/* Comments */}
        <TaskComments taskId={task.id} />
      </DialogContent>
    </Dialog>
  );
}
