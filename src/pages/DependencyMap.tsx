import { useTasks, COLUMNS } from "@/hooks/useTasks";
import { useAllDependencies } from "@/hooks/useDependencies";
import { Loader2, GitBranch, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMemo, useRef, useEffect, useState } from "react";

const statusColors: Record<string, string> = {
  backlog: "hsl(215 20% 65%)",
  pending: "hsl(38 92% 50%)",
  in_progress: "hsl(217 91% 60%)",
  review: "hsl(280 67% 60%)",
  done: "hsl(142 76% 36%)",
  discarded: "hsl(0 84% 60%)",
  todo: "hsl(215 20% 65%)",
};

const statusLabels = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));

interface NodePos {
  id: string;
  x: number;
  y: number;
  title: string;
  status: string;
}

const DependencyMap = () => {
  const { data: tasks, isLoading: loadingTasks } = useTasks();
  const { data: deps, isLoading: loadingDeps } = useAllDependencies();
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });

  useEffect(() => {
    const updateSize = () => {
      const container = svgRef.current?.parentElement;
      if (container) {
        setDimensions({ w: container.clientWidth, h: Math.max(500, container.clientHeight) });
      }
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

    // Simple force-free layout: arrange by status columns
    const statusOrder = COLUMNS.map((c) => c.status);
    const grouped: Record<string, typeof relevantTasks> = {};
    relevantTasks.forEach((t) => {
      if (!grouped[t.status]) grouped[t.status] = [];
      grouped[t.status].push(t);
    });

    const colWidth = dimensions.w / (statusOrder.length + 1);
    const nodePositions: NodePos[] = [];

    statusOrder.forEach((status, colIdx) => {
      const group = grouped[status] || [];
      const rowHeight = dimensions.h / (group.length + 1);
      group.forEach((t, rowIdx) => {
        nodePositions.push({
          id: t.id,
          x: colWidth * (colIdx + 0.5),
          y: rowHeight * (rowIdx + 1),
          title: t.title.length > 25 ? t.title.slice(0, 22) + "..." : t.title,
          status: t.status,
        });
      });
    });

    const nodeMap = new Map(nodePositions.map((n) => [n.id, n]));
    const edgeList = deps
      .map((d) => ({
        from: nodeMap.get(d.depends_on_task_id),
        to: nodeMap.get(d.task_id),
      }))
      .filter((e) => e.from && e.to) as { from: NodePos; to: NodePos }[];

    return { nodes: nodePositions, edges: edgeList };
  }, [tasks, deps, dimensions]);

  if (loadingTasks || loadingDeps) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <GitBranch className="h-6 w-6 text-primary" />
          Mapa de Dependências
        </h1>
        <p className="text-muted-foreground">Visualize as conexões entre tarefas.</p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {COLUMNS.map((c) => (
          <div key={c.status} className="flex items-center gap-1.5 text-xs">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: statusColors[c.status] }} />
            <span className="text-muted-foreground">{c.title}</span>
          </div>
        ))}
      </div>

      {nodes.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-border rounded-lg">
          <GitBranch className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-3" />
          <p className="text-muted-foreground">Nenhuma dependência criada ainda.</p>
          <p className="text-xs text-muted-foreground mt-1">Adicione dependências nos detalhes de uma tarefa.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <svg ref={svgRef} width={dimensions.w} height={dimensions.h} className="w-full">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(217 91% 60%)" opacity="0.6" />
              </marker>
            </defs>

            {/* Edges */}
            {edges.map((e, i) => (
              <line
                key={i}
                x1={e.from.x}
                y1={e.from.y}
                x2={e.to.x}
                y2={e.to.y}
                stroke="hsl(217 91% 60%)"
                strokeWidth="2"
                strokeOpacity="0.4"
                markerEnd="url(#arrowhead)"
              />
            ))}

            {/* Nodes */}
            {nodes.map((n) => (
              <g key={n.id}>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="28"
                  fill={statusColors[n.status] || "hsl(217 33% 17%)"}
                  opacity="0.2"
                  stroke={statusColors[n.status] || "hsl(217 33% 17%)"}
                  strokeWidth="2"
                />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r="6"
                  fill={statusColors[n.status] || "hsl(217 33% 17%)"}
                />
                <text
                  x={n.x}
                  y={n.y + 42}
                  textAnchor="middle"
                  fill="hsl(213 31% 91%)"
                  fontSize="11"
                  fontWeight="500"
                >
                  {n.title}
                </text>
                <text
                  x={n.x}
                  y={n.y + 56}
                  textAnchor="middle"
                  fill="hsl(215 20% 65%)"
                  fontSize="9"
                >
                  {statusLabels[n.status] || n.status}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
};

export default DependencyMap;
