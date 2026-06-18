import { useEffect, useState } from "react";
import { Task, useUpdateTask } from "@/hooks/useTasks";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Diária" },
  { value: "weekly", label: "Semanal" },
  { value: "decendial", label: "Decendial" },
  { value: "monthly", label: "Mensal" },
  { value: "bimonthly", label: "Bimestral" },
  { value: "quarterly", label: "Trimestral" },
  { value: "semiannual", label: "Semestral" },
  { value: "annual", label: "Anual" },
  { value: "custom", label: "Personalizado (N dias)" },
];

const WEEK_DAYS = [
  { code: "SEG", weekend: false },
  { code: "TER", weekend: false },
  { code: "QUA", weekend: false },
  { code: "QUI", weekend: false },
  { code: "SEX", weekend: false },
  { code: "SAB", weekend: true },
  { code: "DOM", weekend: true },
];

interface Props {
  task: Task & {
    recurrence_days?: string[] | null;
    recurrence_start_time?: string | null;
    recurrence_only_business_days?: boolean | null;
  };
}

export function EditRecurrenceSection({ task }: Props) {
  const updateTask = useUpdateTask();
  const [type, setType] = useState<string>(task.recurrence_type || "daily");
  const [interval, setIntervalVal] = useState<number>(task.recurrence_interval || 1);
  const [days, setDays] = useState<string[]>(Array.isArray(task.recurrence_days) ? task.recurrence_days : []);
  const [startTime, setStartTime] = useState<string>(task.recurrence_start_time || "07:00");
  const [onlyBusiness, setOnlyBusiness] = useState<boolean>(!!task.recurrence_only_business_days);

  useEffect(() => {
    setType(task.recurrence_type || "daily");
    setIntervalVal(task.recurrence_interval || 1);
    setDays(Array.isArray(task.recurrence_days) ? task.recurrence_days : []);
    setStartTime(task.recurrence_start_time || "07:00");
    setOnlyBusiness(!!task.recurrence_only_business_days);
  }, [task.id]);

  const toggleDay = (code: string) => {
    setDays((prev) => (prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]));
  };

  const handleSave = () => {
    const cleanedDays = onlyBusiness ? days.filter((d) => d !== "SAB" && d !== "DOM") : days;
    updateTask.mutate({
      id: task.id,
      recurrence_type: type,
      recurrence_interval: interval,
      recurrence_days: cleanedDays,
      recurrence_start_time: startTime || "07:00",
      recurrence_only_business_days: onlyBusiness,
    } as any);
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Repeat className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Editar recorrência</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Frequência</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECURRENCE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {type === "custom" && (
          <div className="space-y-1">
            <Label className="text-xs">A cada (dias)</Label>
            <Input
              type="number"
              min={1}
              value={interval}
              onChange={(e) => setIntervalVal(Math.max(1, parseInt(e.target.value) || 1))}
              className="h-9"
            />
          </div>
        )}
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Horário de início</Label>
          <Input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value || "07:00")}
            className="h-9"
          />
        </div>
        <div className="space-y-1 col-span-2">
          <Label className="text-xs">Dias da semana</Label>
          <div className="flex flex-wrap gap-1.5">
            {WEEK_DAYS.map((d) => {
              const disabled = onlyBusiness && d.weekend;
              const active = days.includes(d.code) && !disabled;
              return (
                <button
                  key={d.code}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleDay(d.code)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium border transition",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted",
                    disabled && "opacity-40 cursor-not-allowed"
                  )}
                >
                  {d.code}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Vazio = todos os dias permitidos pela frequência.</p>
        </div>
        <label className="col-span-2 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={onlyBusiness}
            onChange={(e) => {
              const checked = e.target.checked;
              setOnlyBusiness(checked);
              if (checked) setDays((prev) => prev.filter((d) => d !== "SAB" && d !== "DOM"));
            }}
            className="h-4 w-4 rounded border-border"
          />
          <span className="text-xs">Somente em dias úteis (ignora SAB e DOM)</span>
        </label>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={handleSave} disabled={updateTask.isPending}>
          {updateTask.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
          Salvar recorrência
        </Button>
      </div>
    </div>
  );
}
