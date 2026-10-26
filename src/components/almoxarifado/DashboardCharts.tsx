import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InventoryAsset, InventoryItem } from "@/hooks/useInventory";

const NAVY = "#002060";
const YELLOW = "#FFC000";
const LIGHT_BLUE = "#9DC3E6";
const POR_PAGINA_DEPTO = 8;
const GRAY = "#A6A6A6";

interface Props {
  assets: InventoryAsset[];
  items: InventoryItem[];
}

export function DashboardCharts({ assets, items }: Props) {
  const emUso = useMemo(() => assets.filter((a) => a.status === "in_use"), [assets]);
  const disponiveis = useMemo(() => assets.filter((a) => a.status === "available"), [assets]);
  const outros = useMemo(() => assets.filter((a) => a.status === "damaged" || a.status === "maintenance"), [assets]);

  const equipamentos = useMemo(
    () => items.filter((i) => i.status === "active").reduce((acc, i) => acc + i.quantity + i.in_use_quantity, 0),
    [items],
  );
  const patrimoniosAtivos = emUso.length;
  const percentualAtivos = assets.length ? Math.round((patrimoniosAtivos / assets.length) * 100) : 0;

  const porDepartamento = useMemo(() => {
    const totais = new Map<string, number>();
    emUso.forEach((a) => {
      const nome = a.department?.trim() || "Sem departamento";
      totais.set(nome, (totais.get(nome) ?? 0) + 1);
    });
    return [...totais].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [emUso]);

  const geral = [
    { name: "Ativos", value: emUso.length, color: NAVY },
    { name: "Em estoque", value: disponiveis.length, color: YELLOW },
    { name: "Outros", value: outros.length, color: LIGHT_BLUE },
  ].filter((s) => s.value > 0);

  const ativosEEstoque = [
    { name: "Ativos", value: emUso.length, color: NAVY },
    { name: "Em estoque", value: disponiveis.length, color: YELLOW },
  ].filter((s) => s.value > 0);

  const [pagina, setPagina] = useState(0);
  const totalPaginas = Math.max(1, Math.ceil(porDepartamento.length / POR_PAGINA_DEPTO));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * POR_PAGINA_DEPTO;
  const departamentosVisiveis = porDepartamento.slice(inicio, inicio + POR_PAGINA_DEPTO);

  return (
    <div className="space-y-4">
      <img src="/almoxarifado-banner.png" alt="ORCOMA Contabilidade Inteligente" className="w-full rounded-md" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(180px,220px)_1fr_minmax(220px,280px)] 2xl:grid-cols-[260px_1fr_320px]">
      <div className="flex flex-col justify-between gap-4 rounded-lg p-4 text-white md:col-span-2 xl:col-span-1" style={{ backgroundColor: YELLOW }}>
        <div>
          <p className="text-xs font-bold uppercase text-[#1F1F1F]">Quantidade de equipamentos</p>
          <p className="text-4xl font-bold text-[#002060] xl:text-5xl 2xl:text-6xl" >{equipamentos}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-[#1F1F1F]">Quantidade de patrimônio ativos</p>
          <p className="text-4xl font-bold text-[#002060] xl:text-5xl 2xl:text-6xl">{patrimoniosAtivos}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-[#1F1F1F]">Porcentagem de patrimônio ativos</p>
          <p className="text-4xl font-bold text-[#002060] xl:text-5xl 2xl:text-6xl">{percentualAtivos}%</p>
        </div>
      </div>

      <div className="flex flex-col rounded-lg bg-white p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPagina(Math.max(0, paginaAtual - 1))}
            disabled={paginaAtual === 0}
            aria-label="Departamentos anteriores"
            className="rounded p-1 hover:bg-black/5 disabled:opacity-30"
            style={{ color: NAVY }}
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h3 className="text-center text-lg font-bold" style={{ color: NAVY }}>
            Ativos por departamento
            <span className="ml-2 text-xs font-normal opacity-60">
              {porDepartamento.length ? `${inicio + 1}–${Math.min(inicio + POR_PAGINA_DEPTO, porDepartamento.length)} de ${porDepartamento.length}` : ""}
            </span>
          </h3>
          <button
            type="button"
            onClick={() => setPagina(Math.min(totalPaginas - 1, paginaAtual + 1))}
            disabled={paginaAtual >= totalPaginas - 1}
            aria-label="Próximos departamentos"
            className="rounded p-1 hover:bg-black/5 disabled:opacity-30"
            style={{ color: NAVY }}
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
        <div className="min-h-[18rem] flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={departamentosVisiveis} margin={{ top: 20, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11, fill: NAVY }} height={60} />
              <YAxis hide />
              <Tooltip />
              <Bar dataKey="value" fill={NAVY} name="Ativos">
                <LabelList dataKey="value" position="top" style={{ fill: NAVY, fontWeight: 700, fontSize: 12 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid gap-4">
        <DonutCard title="Geral" total={emUso.length + disponiveis.length + outros.length} slices={geral} />
        <DonutCard title="Ativos e estoque" total={emUso.length + disponiveis.length} slices={ativosEEstoque} />
      </div>
      </div>
    </div>
  );
}

function DonutCard({ title, total, slices }: { title: string; total: number; slices: { name: string; value: number; color: string }[] }) {
  return (
    <div className="rounded-lg bg-white p-3">
      <p className="text-sm font-bold" style={{ color: NAVY }}>{title}</p>
      <div className="relative h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="name" innerRadius="60%" outerRadius="90%" stroke="none">
              {slices.map((s) => <Cell key={s.name} fill={s.color} />)}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-2xl font-bold" style={{ color: NAVY }}>
          {total}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-3 text-xs">
        {slices.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name} ({s.value})
          </span>
        ))}
      </div>
    </div>
  );
}
