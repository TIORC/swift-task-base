import { useMemo } from "react";
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InventoryAsset, InventoryCategory, InventoryCollaborator, InventoryItem } from "@/hooks/useInventory";

const NAVY = "#002060";
const YELLOW = "#FFC000";
const LIGHT_BLUE = "#9DC3E6";

interface Slice { name: string; value: number }

function contar(keys: string[]): Slice[] {
  const totais = new Map<string, number>();
  keys.forEach((k) => totais.set(k, (totais.get(k) ?? 0) + 1));
  return [...totais].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}

interface Props {
  assets: InventoryAsset[];
  items: InventoryItem[];
  collaborators: InventoryCollaborator[];
  categories: InventoryCategory[];
}

export function DashboardSetores({ assets, items, collaborators, categories }: Props) {
  const emUso = useMemo(() => assets.filter((a) => a.status === "in_use"), [assets]);
  const disponiveis = useMemo(() => assets.filter((a) => a.status === "available"), [assets]);

  // Setor = departamento do colaborador responsável pelo patrimônio em uso.
  const porSetor = useMemo(
    () => contar(emUso.map((a) => collaborators.find((c) => c.id === a.collaborator_id)?.department?.trim() || "Sem setor")),
    [emUso, collaborators],
  );

  const status = [
    { name: "Em uso", value: emUso.length, color: YELLOW },
    { name: "Disponível", value: disponiveis.length, color: LIGHT_BLUE },
  ].filter((s) => s.value > 0);

  // Categoria vem do item de cada patrimônio.
  const porCategoria = useMemo(() => {
    const itemPorId = new Map(items.map((i) => [i.id, i]));
    const nomeCategoria = new Map(categories.map((c) => [c.id, c.name]));
    const totais = new Map<string, number>();
    assets
      .filter((a) => a.status !== "discarded")
      .forEach((a) => {
        const categoriaId = itemPorId.get(a.item_id)?.category_id;
        const nome = (categoriaId && nomeCategoria.get(categoriaId)) || "(vazio)";
        totais.set(nome, (totais.get(nome) ?? 0) + 1);
      });
    return [...totais].map(([subject, value]) => ({ subject, value })).sort((a, b) => b.value - a.value);
  }, [assets, items, categories]);

  const percentual = assets.length ? Math.round((emUso.length / assets.length) * 100) : 0;

  return (
    <div className="grid gap-4 rounded-lg p-4 text-white md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr_0.8fr]" style={{ backgroundColor: NAVY }}>
      <div className="min-w-0 md:col-span-2 xl:col-span-1">
        <h3 className="mb-1 text-center text-base font-bold uppercase" style={{ color: YELLOW }}>Ativos por setor</h3>
        <p className="mb-2 text-center text-xs text-white/70">Patrimônios em uso, pelo setor do responsável</p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={porSetor} margin={{ top: 20, right: 10, left: 0, bottom: 30 }}>
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#fff" }} />
              <YAxis hide />
              <Tooltip />
              <Bar dataKey="value" name="Ativos">
                {porSetor.map((s) => <Cell key={s.name} fill={YELLOW} />)}
                <LabelList dataKey="value" position="top" style={{ fill: "#fff", fontWeight: 700, fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="mb-1 text-center text-base font-bold uppercase" style={{ color: YELLOW }}>Ativos por status</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={status} dataKey="value" nameKey="name" innerRadius="50%" outerRadius="85%" stroke="none" label={({ value }) => value}>
                {status.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex justify-center gap-4 text-xs">
          {status.map((s) => (
            <li key={s.name} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name} ({s.value})
            </li>
          ))}
        </ul>
      </div>

      <div className="min-w-0">
        <h3 className="mb-1 text-center text-base font-bold uppercase" style={{ color: YELLOW }}>Quantidade por categoria</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={porCategoria} outerRadius="70%">
              <PolarGrid stroke="#ffffff40" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11, fill: "#fff" }} />
              <PolarRadiusAxis tick={false} axisLine={false} />
              <Radar dataKey="value" stroke={YELLOW} fill={YELLOW} fillOpacity={0.5} name="Ativos" />
              <Tooltip />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="flex flex-col justify-center gap-6 rounded-lg p-4 text-center" style={{ backgroundColor: YELLOW }}>
        <div>
          <p className="text-sm font-bold uppercase text-[#002060]">Quantidade de ativos</p>
          <p className="text-6xl font-bold text-[#002060]">{emUso.length}</p>
        </div>
        <div>
          <p className="text-sm font-bold uppercase text-[#002060]">Patrimônio em %</p>
          <p className="text-5xl font-bold text-[#002060]">{percentual}%</p>
        </div>
      </div>
    </div>
  );
}
