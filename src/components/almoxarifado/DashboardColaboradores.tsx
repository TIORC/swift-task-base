import { useMemo, useState } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InventoryAsset, InventoryCollaborator } from "@/hooks/useInventory";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const NAVY = "#002060";
const YELLOW = "#FFC000";
const PALETTE = [YELLOW, "#9DC3E6", "#FFD966", "#8EA9DB", "#F4B183", "#A9D18E", "#D9D9D9"];
const TOP_N = 10;
const TOP_DONUT = 6;

interface Slice { name: string; value: number }

// Mostra as N maiores fatias e agrupa o resto em "Outros", para o gráfico continuar legível.
function topComOutros(slices: Slice[], n: number): Slice[] {
  if (slices.length <= n) return slices;
  const top = slices.slice(0, n);
  const outros = slices.slice(n).reduce((acc, s) => acc + s.value, 0);
  return [...top, { name: `Outros (${slices.length - n})`, value: outros }];
}

function contar(keys: string[]): Slice[] {
  const totais = new Map<string, number>();
  keys.forEach((k) => totais.set(k, (totais.get(k) ?? 0) + 1));
  return [...totais].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

interface Props {
  assets: InventoryAsset[];
  collaborators: InventoryCollaborator[];
}

export function DashboardColaboradores({ assets, collaborators }: Props) {
  const emUso = useMemo(() => assets.filter((a) => a.status === "in_use"), [assets]);
  const disponiveis = useMemo(() => assets.filter((a) => a.status === "available"), [assets]);

  const colaboradores = useMemo(
    () => contar(emUso.map((a) => collaborators.find((c) => c.id === a.collaborator_id)?.full_name ?? "Sem responsável")),
    [emUso, collaborators],
  );
  const departamentos = useMemo(
    () => contar(emUso.map((a) => collaborators.find((c) => c.id === a.collaborator_id)?.department?.trim() || "Sem departamento")),
    [emUso, collaborators],
  );
  const percentual = assets.length ? Math.round((emUso.length / assets.length) * 100) : 0;

  const [todosAbertos, setTodosAbertos] = useState(false);
  const barras = topComOutros(colaboradores, TOP_N);
  const rosca = topComOutros(departamentos, TOP_DONUT).map((s, i) => ({ ...s, color: PALETTE[i % PALETTE.length] }));
  const status = [
    { name: "Em uso", value: emUso.length, color: YELLOW },
    { name: "Disponível", value: disponiveis.length, color: "#9DC3E6" },
  ].filter((s) => s.value > 0);

  return (
    <div className="grid gap-4 rounded-lg p-4 text-white lg:grid-cols-[1.2fr_1fr]" style={{ backgroundColor: NAVY }}>
      <div className="min-w-0">
        <h3 className="mb-1 text-center text-base font-bold uppercase" style={{ color: YELLOW }}>Ativos por colaborador</h3>
        <p className="mb-2 text-center text-xs text-white/70">Patrimônios em uso · {TOP_N} maiores · clique em "Outros" para ver todos</p>
        <div style={{ height: Math.max(260, barras.length * 32) }}>
          <ColaboradoresBarChart
            data={barras}
            onOutrosClick={() => setTodosAbertos(true)}
          />
        </div>
        <Dialog open={todosAbertos} onOpenChange={setTodosAbertos}>
          <DialogContent className="w-[95vw] max-w-[95vw] bg-[#002060] text-white border-[#FFC000]/40">
            <DialogHeader>
              <DialogTitle style={{ color: YELLOW }}>Ativos por colaborador · todos ({colaboradores.length})</DialogTitle>
            </DialogHeader>
            <div className="max-h-[80vh] overflow-y-auto pr-2">
              <div style={{ height: Math.max(300, colaboradores.length * 28) }}>
                <ColaboradoresBarChart data={colaboradores} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid min-w-0 gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <DonutBlock title="Por departamento" total={emUso.length} slices={rosca} />
          <DonutBlock title="Por status" total={assets.length} slices={status} />
        </div>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-xs font-bold uppercase" style={{ color: YELLOW }}>Ativos em uso</p>
            <p className="text-5xl font-bold" style={{ color: YELLOW }}>{emUso.length}</p>
          </div>
          <div className="rounded-lg bg-white/5 p-3">
            <p className="text-xs font-bold uppercase" style={{ color: YELLOW }}>Percentual em uso</p>
            <p className="text-5xl font-bold" style={{ color: YELLOW }}>{percentual}%</p>
            <p className="text-xs text-white/70">de {assets.length} patrimônios</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ColaboradoresBarChart({ data, onOutrosClick }: { data: Slice[]; onOutrosClick?: () => void }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 10, bottom: 4 }}>
        <XAxis type="number" hide />
        <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12, fill: "#fff" }} interval={0} />
        <Tooltip />
        <Bar
          dataKey="value"
          fill={YELLOW}
          name="Ativos"
          barSize={18}
          onClick={(entry: { name?: string; payload?: Slice }) => {
            const nome = entry?.payload?.name ?? entry?.name ?? "";
            if (onOutrosClick && nome.startsWith("Outros")) onOutrosClick();
          }}
        >
          {data.map((d) => (
            <Cell key={d.name} fill={YELLOW} style={{ cursor: d.name.startsWith("Outros") && onOutrosClick ? "pointer" : "default" }} />
          ))}
          <LabelList dataKey="value" position="right" style={{ fill: "#fff", fontWeight: 700, fontSize: 12 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutBlock({ title, total, slices }: { title: string; total: number; slices: (Slice & { color?: string })[] }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-center text-xs font-bold uppercase" style={{ color: YELLOW }}>{title}</p>
      <div className="relative h-40">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="90%" stroke="none">
              {slices.map((s, i) => <Cell key={s.name} fill={s.color ?? PALETTE[i % PALETTE.length]} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg font-bold">{total}</div>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 truncate">
              <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: s.color ?? PALETTE[i % PALETTE.length] }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="font-bold" style={{ color: YELLOW }}>{s.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
