import { useState, type ReactNode } from "react";

export interface PainelView {
  id: string;
  title: string;
  node: ReactNode;
}

const MINI_WIDTH = 1200;
const MINI_SCALE = 0.24;

// Mostra uma visão principal e as outras como miniaturas no canto inferior direito.
// Clicar numa miniatura troca ela com a principal.
export function DashboardPainel({ views }: { views: PainelView[] }) {
  const [principalId, setPrincipalId] = useState(views[0].id);
  const principal = views.find((v) => v.id === principalId) ?? views[0];
  const miniaturas = views.filter((v) => v.id !== principal.id);

  return (
    <div className="relative pb-56">
      {principal.node}

      <div className="absolute bottom-4 right-4 z-10 flex gap-3">
        {miniaturas.map((v) => (
          <button
            key={v.id}
            type="button"
            onClick={() => setPrincipalId(v.id)}
            title={`Abrir ${v.title}`}
            className="w-72 overflow-hidden rounded-lg border-2 border-[#FFC000] bg-[#002060] text-left shadow-xl transition hover:scale-[1.02]"
          >
            <p className="px-2 py-1 text-xs font-bold uppercase text-[#FFC000]">{v.title}</p>
            <div className="relative h-44 overflow-hidden">
              <div
                className="pointer-events-none absolute left-0 top-0 origin-top-left"
                style={{ width: MINI_WIDTH, transform: `scale(${MINI_SCALE})` }}
              >
                {v.node}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
