import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { MONTH_LABELS, MONTH_PRESETS, isMonthBased } from "@/lib/recurrence";

export interface RecurrenceSchedule {
  dayOfMonth: number | null;
  months: number[];
  direction: "next" | "previous";
  deadlineDays: number | null;
}

interface Props {
  type: string;
  value: RecurrenceSchedule;
  onChange: (v: RecurrenceSchedule) => void;
}

export function RecurrenceScheduleFields({ type, value, onChange }: Props) {
  if (!isMonthBased(type)) return null;

  const presets = MONTH_PRESETS[type];
  const set = (patch: Partial<RecurrenceSchedule>) => onChange({ ...value, ...patch });

  const toggleMonth = (m: number) => {
    const has = value.months.includes(m);
    set({ months: has ? value.months.filter((x) => x !== m) : [...value.months, m].sort((a, b) => a - b) });
  };

  const presetKey = presets?.findIndex((p) =>
    p.months.length === value.months.length && p.months.every((m) => value.months.includes(m)),
  );

  return (
    <div className="col-span-2 space-y-3 rounded-lg border border-border bg-background/60 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Dia do mês</Label>
          <Input
            type="number"
            min={1}
            max={31}
            value={value.dayOfMonth ?? ""}
            placeholder="Ex: 5"
            onChange={(e) => {
              const n = parseInt(e.target.value);
              set({ dayOfMonth: Number.isFinite(n) ? Math.min(31, Math.max(1, n)) : null });
            }}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Prazo (dias após abrir)</Label>
          <Input
            type="number"
            min={0}
            value={value.deadlineDays ?? ""}
            placeholder="Ex: 5"
            onChange={(e) => {
              const n = parseInt(e.target.value);
              set({ deadlineDays: Number.isFinite(n) ? Math.max(0, n) : null });
            }}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Se cair em fim de semana</Label>
        <Select value={value.direction} onValueChange={(v: "next" | "previous") => set({ direction: v })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="next">Jogar para o próximo dia útil</SelectItem>
            <SelectItem value="previous">Antecipar para o dia útil anterior</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground">O ajuste nunca ultrapassa o mês da ocorrência.</p>
      </div>

      {presets ? (
        <div className="space-y-1">
          <Label className="text-xs">Meses da ocorrência</Label>
          <Select
            value={presetKey !== undefined && presetKey >= 0 ? String(presetKey) : ""}
            onValueChange={(v) => set({ months: presets[Number(v)].months })}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione a combinação" /></SelectTrigger>
            <SelectContent>
              {presets.map((p, i) => (
                <SelectItem key={p.label} value={String(i)}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : type === "annual" ? (
        <div className="space-y-1">
          <Label className="text-xs">Mês do ano</Label>
          <Select
            value={value.months[0] ? String(value.months[0]) : ""}
            onValueChange={(v) => set({ months: [Number(v)] })}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Selecione o mês" /></SelectTrigger>
            <SelectContent>
              {MONTH_LABELS.map((m, i) => (
                <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-1">
          <Label className="text-xs">Meses em que a tarefa ocorre</Label>
          <div className="flex flex-wrap gap-1.5">
            {MONTH_LABELS.map((m, i) => {
              const num = i + 1;
              const active = value.months.includes(num);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMonth(num)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium border transition",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted",
                  )}
                >
                  {m}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-muted-foreground">Vazio = todos os meses.</p>
        </div>
      )}
    </div>
  );
}
