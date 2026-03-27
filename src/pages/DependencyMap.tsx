import { useTasks, COLUMNS } from "@/hooks/useTasks";
import { useAllDependencies } from "@/hooks/useDependencies";
import { Loader2, GitBranch } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { useMemo, useRef, useEffect, useState } from "react";
import { useTheme } from "next-themes";

const statusColors: Record<string, string> = {
  backlog: "hsl(220 9% 46%)",
  pending: "hsl(38 92% 50%)",
  in_progress: "hsl(230 80% 60%)",
  review: "hsl(280 67% 60%)",
  done: "hsl(152 69% 40%)",
  discarded: "hsl(0 72% 51%)",
  todo: "hsl(220 9% 46%)",
};

const statusLabels = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));

interface NodePos { id: string; x: number; y: number; title: string; status: string; }

const DependencyMap = () => {
  const { data: tasks, isLoading: loadingTasks } = useTasks();
  const { data: deps, isLoading: loadingDeps } = useAllDependencies();
  const { resolvedTheme } = useTheme();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });

  const isDark = resolvedTheme === "dark";
  const textColor = isDark ? "hsl(213 31% 91%)" : "hsl(220 13% 13%)";
  const mutedColor = isDark ? "hsl(215 20% 55%)" : "hsl(220 9% 46%)";

  useEffect(() => {
    const updateSize = () => {
      const container = svgRef.current?.parentElement;
      if (container) setDimensions({ w: container.clientWidth, h: Math.max(500, container.clientHeight) });
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const { nodes, edges } = useMemo(() => {
    if (!tasks || !deps) return { nodes: [], edges: [] };
    const taskIds = new Set(deps.flatMap((d) => [d.task_id, d.depends_on_task_id]));
    const relevantTasks = tasks.filter((t) => taskIds.has(t.id));
    if (relevantTasks.length === 0) return { nodes: [], edges: [] };

    const statusOrder = COLUMNS.map((c) => c.status);
    const grouped: Record<string, typeof relevantTasks> = {};
    relevantTasks.forEach((t) => { if (!grouped[t.status]) grouped[t.status] = []; grouped[t.status].push(t); });

    const colWidth = dimensions.w / (statusOrder.length + 1);
    const nodePositions: NodePos[] = [];
    statusOrder.forEach((status, colIdx) => {
      const group = grouped[status] || [];
      const rowHeight = dimensions.h / (group.length + 1);
      group.forEach((t, rowIdx) => {
        nodePositions.push({
          id: t.id, x: colWidth * (colIdx + 0.5), y: rowHeight * (rowIdx + 1),
          title: t.title.length > 25 ? t.title.slice(0, 22) + "..." : t.title, status: t.status,
        });
      });
    });

    const nodeMap = new Map(nodePositions.map((n) => [n.id, n]));
    const edgeList = deps.map((d) => ({ from: nodeMap.get(d.depends_on_task_id), to: nodeMap.get(d.task_id) }))
      .filter((e) => e.from && e.to) as { from: NodePos; to: NodePos }[];
    return { nodes: nodePositions, edges: edgeList };
  }, [tasks, deps, dimensions]);

  if (loadingTasks || loadingDeps) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Mapa de Dependências" description="Visualize as conexões entre tarefas." icon={<GitBranch className="h-5 w-5" />} />

      <div className="flex flex-wrap gap-3">
        {COLUMNS.map((c) => (
          <div key={c.status} className="flex items-center gap-1.5 text-xs">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColors[c.status] }} />
            <span className="text-muted-foreground">{c.title}</span>
          </div>
        ))}
      </div>

      {nodes.length === 0 ? (
        <EmptyState icon={GitBranch} title="Nenhuma dependência" description="Adicione dependências nos detalhes de uma tarefa." />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-card">
          <svg ref={svgRef} width={dimensions.w} height={dimensions.h} className="w-full">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(230 80% 60%)" opacity="0.6" />
              </marker>
            </defs>
            {edges.map((e, i) => (
              <line key={i} x1={e.from.x} y1={e.from.y} x2={e.to.x} y2={e.to.y}
                stroke="hsl(230 80% 60%)" strokeWidth="2" strokeOpacity="0.3" markerEnd="url(#arrowhead)" />
            ))}
            {nodes.map((n) => (
              <g key={n.id}>
                <circle cx={n.x} cy={n.y} r="28" fill={statusColors[n.status]} opacity="0.15" stroke={statusColors[n.status]} strokeWidth="2" />
                <circle cx={n.x} cy={n.y} r="6" fill={statusColors[n.status]} />
                <text x={n.x} y={n.y + 42} textAnchor="middle" fill={textColor} fontSize="11" fontWeight="500">{n.title}</text>
                <text x={n.x} y={n.y + 56} textAnchor="middle" fill={mutedColor} fontSize="9">{statusLabels[n.status]}</text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

export default DependencyMap;
