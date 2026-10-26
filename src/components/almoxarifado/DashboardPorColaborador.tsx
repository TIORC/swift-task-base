import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { InventoryAsset, InventoryCategory, InventoryCollaborator, InventoryItem } from "@/hooks/useInventory";

const NAVY = "#002060";
const YELLOW = "#FFC000";
const POR_PAGINA = 20;
const PALETTE = [YELLOW, "#9DC3E6", NAVY, "#A9D18E", "#F4B183", "#8EA9DB", "#FFD966", "#548235", "#C55A11", "#7F7F7F"];

interface Props {
  assets: InventoryAsset[];
  items: InventoryItem[];
  collaborators: InventoryCollaborator[];
  categories: InventoryCategory[];
}

export function DashboardPorColaborador({ assets, items, collaborators, categories }: Props) {
  const ativos = useMemo(() => assets.filter((a) => a.status !== "discarded"), [assets]);
  const comResponsavel = useMemo(() => ativos.filter((a) => a.collaborator_id), [ativos]);

  // Uma coluna por colaborador; cada coluna é empilhada pelas categorias dos patrimônios dele.
  const { linhas, categoriasUsadas } = useMemo(() => {
    const itemPorId = new Map(items.map((i) => [i.id, i]));
    const nomeCategoria = new Map(categories.map((c) => [c.id, c.name]));
    const porColab = new Map<string, Record<string, string | number>>();
    const totalCategoria = new Map<string, number>();

    comResponsavel.forEach((a) => {
      const colab = collaborators.find((c) => c.id === a.collaborator_id)?.full_name ?? "Sem nome";
      const cat = (itemPorId.get(a.item_id)?.category_id && nomeCategoria.get(itemPorId.get(a.item_id)!.category_id!)) || "(vazio)";
      const linha: Record<string, string | number> = porColab.get(colab) ?? { name: colab };
      linha[cat] = Number(linha[cat] ?? 0) + 1;
      porColab.set(colab, linha);
      totalCategoria.set(cat, (totalCategoria.get(cat) ?? 0) + 1);
    });

    const usadas = [...totalCategoria].sort((a, b) => b[1] - a[1]).map(([nome]) => nome);
    const lista = [...porColab.values()].sort((a, b) =>
      String(a.name).localeCompare(String(b.name), "pt-BR", { sensitivity: "base" }),
    );
    return { linhas: lista, categoriasUsadas: usadas };
  }, [comResponsavel, items, categories, collaborators]);

  const [pagina, setPagina] = useState(0);
  const totalPaginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const inicio = paginaAtual * POR_PAGINA;
  const visiveis = linhas.slice(inicio, inicio + POR_PAGINA);

  return (
    <div className="grid gap-4 rounded-lg p-4 text-white lg:grid-cols-[1fr_220px]" style={{ backgroundColor: NAVY }}>
      <div className="min-w-0">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPagina(Math.max(0, paginaAtual - 1))}
            disabled={paginaAtual === 0}
            aria-label="Colaboradores anteriores"
            className="rounded p-1 text-[#FFC000] hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <h3 className="text-center text-base font-bold uppercase" style={{ color: YELLOW }}>
            Patrimônios por colaborador
            <span className="ml-2 text-xs font-normal text-white/70">
              {inicio + 1}–{Math.min(inicio + POR_PAGINA, linhas.length)} de {linhas.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={() => setPagina(Math.min(totalPaginas - 1, paginaAtual + 1))}
            disabled={paginaAtual >= totalPaginas - 1}
            aria-label="Próximos colaboradores"
            className="rounded p-1 text-[#FFC000] hover:bg-white/10 disabled:opacity-30"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visiveis} margin={{ top: 10, right: 10, left: 0, bottom: 90 }}>
              <XAxis dataKey="name" angle={-60} textAnchor="end" interval={0} tick={{ fontSize: 10, fill: "#fff" }} />
              <YAxis tick={{ fontSize: 11, fill: "#fff" }} />
              <Tooltip />
              {categoriasUsadas.map((cat, i) => (
                <Bar key={cat} dataKey={cat} stackId="colab" fill={PALETTE[i % PALETTE.length]} name={cat}>
                  {i === 0 && <LabelList dataKey={cat} position="inside" style={{ fill: "#000", fontSize: 10 }} />}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {categoriasUsadas.map((cat, i) => (
            <li key={cat} className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: PALETTE[i % PALETTE.length] }} />
              {cat}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col justify-center gap-4">
        <div className="rounded-lg p-4 text-center" style={{ backgroundColor: YELLOW }}>
          <p className="text-xs font-bold uppercase text-[#002060]">Número geral de patrimônios</p>
          <p className="text-5xl font-bold text-[#002060]">{ativos.length}</p>
        </div>
        <div className="rounded-lg p-4 text-center" style={{ backgroundColor: YELLOW }}>
          <p className="text-xs font-bold uppercase text-[#002060]">Patrimônios com responsável</p>
          <p className="text-5xl font-bold text-[#002060]">{comResponsavel.length}</p>
        </div>
      </div>
    </div>
  );
}
