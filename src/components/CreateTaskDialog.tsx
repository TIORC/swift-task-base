import { useState, useMemo } from "react";
import { useCreateTask, useProfiles, TaskStatus } from "@/hooks/useTasks";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon, Loader2, Plus, Repeat } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
] as const;

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "backlog", label: "Backlog" },
  { value: "pending", label: "Pendente" },
  { value: "in_progress", label: "Em Andamento" },
  { value: "review", label: "Em Validação" },
  { value: "done", label: "Concluído" },
  { value: "discarded", label: "Descartado" },
];

const RECURRENCE_OPTIONS = [
  { value: "none", label: "Não repetir" },
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "decendial", label: "Decendial (a cada 10 dias)" },
  { value: "monthly", label: "Mensal" },
  { value: "bimonthly", label: "Bimestral" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
  { value: "custom", label: "Personalizado (a cada N dias)" },
] as const;

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStatus?: TaskStatus;
}

export function CreateTaskDialog({ open, onOpenChange, defaultStatus = "backlog" }: CreateTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");
  const [status, setStatus] = useState<TaskStatus>(defaultStatus);
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
  const [recurrenceType, setRecurrenceType] = useState<string>("none");
  const [recurrenceInterval, setRecurrenceInterval] = useState<number>(1);
  const [recurrenceUntil, setRecurrenceUntil] = useState<Date | undefined>(undefined);

  const { data: profiles } = useProfiles();
  const { data: adminIds } = useQuery({
    queryKey: ["admin-user-ids"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_admin_user_ids");
      return (data as string[]) ?? [];
    },
  });
  const assignableProfiles = useMemo(
    () => profiles?.filter((p) => !adminIds?.includes(p.id)) ?? [],
    [profiles, adminIds]
  );
  const createTask = useCreateTask();

  const isRecurring = recurrenceType !== "none";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTask.mutate(
      {
        title,
        description: description || null,
        priority: priority as any,
        status: status as any,
        assigned_to: assignedTo && assignedTo !== "none" ? assignedTo : null,
        due_date: dueDate ? dueDate.toISOString() : null,
        recurrence_type: isRecurring ? recurrenceType : null,
        recurrence_interval: isRecurring ? recurrenceInterval : null,
        recurrence_until: isRecurring && recurrenceUntil ? recurrenceUntil.toISOString() : null,
        is_recurring_template: isRecurring,
      } as any,
      {
        onSuccess: () => {
          onOpenChange(false);
          setTitle(""); setDescription(""); setPriority("medium"); setStatus(defaultStatus);
          setAssignedTo(""); setDueDate(undefined);
          setRecurrenceType("none"); setRecurrenceInterval(1); setRecurrenceUntil(undefined);
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nova Tarefa
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Corrigir bug na API" required />
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva a tarefa..." rows={3} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as TaskStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {assignableProfiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prazo</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-10", !dueDate && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "dd/MM/yyyy") : "Selecionar..."}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Recurrence */}
          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Repeat className="h-4 w-4 text-primary" />
              <Label className="text-sm font-medium">Recorrência</Label>
              <Switch
                checked={isRecurring}
                onCheckedChange={(v) => setRecurrenceType(v ? "daily" : "none")}
                className="ml-auto"
              />
            </div>
            {isRecurring && (
              <>
                <p className="text-[11px] text-muted-foreground">
                  O sistema abrirá uma nova tarefa automaticamente conforme a frequência. A tarefa criada agora é o modelo.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Frequência</Label>
                    <Select value={recurrenceType} onValueChange={setRecurrenceType}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_OPTIONS.filter(o => o.value !== "none").map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {recurrenceType === "custom" && (
                    <div className="space-y-2">
                      <Label className="text-xs">A cada (dias)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={recurrenceInterval}
                        onChange={(e) => setRecurrenceInterval(Math.max(1, parseInt(e.target.value) || 1))}
                        className="h-9"
                      />
                    </div>
                  )}
                  <div className="space-y-2 col-span-2">
                    <Label className="text-xs">Repetir até (opcional)</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !recurrenceUntil && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {recurrenceUntil ? format(recurrenceUntil, "dd/MM/yyyy") : "Sem data limite"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={recurrenceUntil} onSelect={setRecurrenceUntil} initialFocus className="p-3 pointer-events-auto" />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Criar Tarefa
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
