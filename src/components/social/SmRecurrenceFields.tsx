import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { RecurrenceScheduleFields, type RecurrenceSchedule } from "@/components/RecurrenceScheduleFields";
import { isMonthBased } from "@/lib/recurrence";

export const SM_RECURRENCE_OPTIONS = [
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

export const SM_FREQ_LABELS: Record<string, string> = Object.fromEntries(
  SM_RECURRENCE_OPTIONS.map((o) => [o.value, o.label]),
);

const WEEK_DAYS = [
  { code: "SEG", weekend: false },
  { code: "TER", weekend: false },
  { code: "QUA", weekend: false },
  { code: "QUI", weekend: false },
  { code: "SEX", weekend: false },
  { code: "SAB", weekend: true },
  { code: "DOM", weekend: true },
];

export interface SmRecurrenceState {
  type: string;
  interval: number;
  days: string[];
  startTime: string;
  onlyBusinessDays: boolean;
  until: string; // yyyy-mm-dd
  schedule: RecurrenceSchedule;
}

export const emptySmRecurrence = (): SmRecurrenceState => ({
  type: "daily",
  interval: 1,
  days: [],
  startTime: "09:00",
  onlyBusinessDays: false,
  until: "",
  schedule: { dayOfMonth: null, months: [], direction: "next", deadlineDays: null },
});

export function smRecurrenceFromTask(t: any): SmRecurrenceState {
  return {
    type: t?.recurrence_type || "daily",
    interval: t?.recurrence_interval || 1,
    days: Array.isArray(t?.recurrence_days) ? t.recurrence_days : [],
    startTime: t?.recurrence_start_time || "09:00",
    onlyBusinessDays: !!t?.recurrence_only_business_days,
    until: t?.recurrence_until ? String(t.recurrence_until).slice(0, 10) : "",
    schedule: {
      dayOfMonth: t?.recurrence_day_of_month ?? null,
      months: Array.isArray(t?.recurrence_months) ? t.recurrence_months : [],
      direction: (t?.recurrence_business_day_direction as "next" | "previous") || "next",
      deadlineDays: t?.recurrence_deadline_days ?? null,
    },
  };
}

/** Converte o estado do formulário nas colunas de sm_tasks. */
export function smRecurrencePayload(s: SmRecurrenceState) {
  const monthBased = isMonthBased(s.type);
  const days = s.onlyBusinessDays ? s.days.filter((d) => d !== "SAB" && d !== "DOM") : s.days;
  return {
    recurrence_type: s.type,
    recurrence_interval: s.interval || 1,
    recurrence_days: days,
    recurrence_start_time: s.startTime || "09:00",
    recurrence_only_business_days: s.onlyBusinessDays,
    recurrence_until: s.until ? new Date(s.until + "T12:00:00").toISOString() : null,
    recurrence_day_of_month: monthBased ? s.schedule.dayOfMonth : null,
    recurrence_months: monthBased ? s.schedule.months : [],
    recurrence_business_day_direction: s.schedule.direction,
    recurrence_deadline_days: monthBased ? s.schedule.deadlineDays : null,
  };
}

interface Props {
  value: SmRecurrenceState;
  onChange: (v: SmRecurrenceState) => void;
}

export function SmRecurrenceFields({ value, onChange }: Props) {
  const set = (patch: Partial<SmRecurrenceState>) => onChange({ ...value, ...patch });

  const toggleDay = (code: string) => {
    const has = value.days.includes(code);
    set({ days: has ? value.days.filter((d) => d !== code) : [...value.days, code] });
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Frequência</Label>
        <Select value={value.type} onValueChange={(v) => set({ type: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SM_RECURRENCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value.type === "custom" && (
        <div className="space-y-1">
          <Label className="text-xs">A cada (dias)</Label>
          <Input
            type="number"
            min={1}
            value={value.interval}
            onChange={(e) => set({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
            className="h-9"
          />
        </div>
      )}

      <RecurrenceScheduleFields
        type={value.type}
        value={value.schedule}
        onChange={(schedule) => set({ schedule })}
      />

      <div className="space-y-1">
        <Label className="text-xs">Horário de início</Label>
        <Input
          type="time"
          value={value.startTime}
          onChange={(e) => set({ startTime: e.target.value || "09:00" })}
          className="h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Repetir até (opcional)</Label>
        <Input
          type="date"
          value={value.until}
          onChange={(e) => set({ until: e.target.value })}
          className="h-9"
        />
      </div>

      <div className="space-y-1 col-span-2">
        <Label className="text-xs">Dias da semana</Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((d) => {
            const disabled = value.onlyBusinessDays && d.weekend;
            const active = value.days.includes(d.code) && !disabled;
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
                  disabled && "opacity-40 cursor-not-allowed",
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
          checked={value.onlyBusinessDays}
          onChange={(e) => {
            const checked = e.target.checked;
            onChange({
              ...value,
              onlyBusinessDays: checked,
              days: checked ? value.days.filter((d) => d !== "SAB" && d !== "DOM") : value.days,
            });
          }}
          className="h-4 w-4 rounded border-border"
        />
        <span className="text-xs">Somente em dias úteis (ignora SAB e DOM)</span>
      </label>
    </div>
  );
}
