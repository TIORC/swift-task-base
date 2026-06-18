import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTasks } from "@/hooks/useTasks";
import {
  useAllDependencies,
  useAddDependency,
  useRemoveDependency,
  useUpdateDependencyColor,
} from "@/hooks/useDependencies";
import { useAutomations } from "@/hooks/useAutomationsData";
import {
  useAllAutomationDependencies,
  useAddAutomationDependency,
  useRemoveAutomationDependency,
  useUpdateAutomationDependencyColor,
} from "@/hooks/useAutomationDependencies";
import {
  useDependencyPositions,
  useSavePosition,
  type NodeType,
} from "@/hooks/useDependencyPositions";
import { STATUS_LABELS as A_LABELS } from "@/types/automation";
import { SECTOR_LABELS } from "@/types/sectors";
import { GitBranch, Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

// ── Helpers ──────────────────────────────────────────────────────────────────
function gridLayout<T extends { id: string }>(items: T[], columnsCount = 4) {
  const colW = 280;
  const rowH = 130;
  return items.map((it, i) => ({
    id: it.id,
    x: (i % columnsCount) * colW,
    y: Math.floor(i / columnsCount) * rowH,
  }));
}

const taskStatusColors: Record<string, string> = {
  backlog: "#6b7280",
  pending: "#f59e0b",
  in_progress: "#3b82f6",
  review: "#a855f7",
  done: "#10b981",
  discarded: "#ef4444",
  todo: "#6b7280",
};

const automationStatusColors: Record<string, string> = {
  backlog: "#6b7280",
  analysis: "#3b82f6",
  development: "#6366f1",
  internal_testing: "#f59e0b",
  homologation: "#a855f7",
  waiting_user: "#fb923c",
  completed: "#10b981",
  blocked: "#ef4444",
  cancelled: "#6b7280",
};

const LINE_COLORS: { value: string; label: string }[] = [
  { value: "#3b82f6", label: "Azul · Dependência comum" },
  { value: "#10b981", label: "Verde · Liberado" },
  { value: "#f59e0b", label: "Amarelo · Aguardando validação" },
  { value: "#fb923c", label: "Laranja · Atenção" },
  { value: "#ef4444", label: "Vermelho · Bloqueio" },
  { value: "#a855f7", label: "Roxo · Automação relacionada" },
  { value: "#ec4899", label: "Rosa · Prioridade especial" },
];
const DEFAULT_COLOR = "#3b82f6";

// ── Edge color picker popover ────────────────────────────────────────────────
function EdgeColorPopover({
  open,
  position,
  currentColor,
  onPick,
  onDelete,
  onClose,
}: {
  open: boolean;
  position: { x: number; y: number } | null;
  currentColor: string;
  onPick: (c: string) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  if (!open || !position) return null;
  return (
    <div
      className="absolute z-50"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <Popover open onOpenChange={(o) => !o && onClose()}>
        <PopoverTrigger asChild>
          <span />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" align="start">
          <p className="text-xs font-medium mb-2">Cor da linha</p>
          <div className="grid grid-cols-7 gap-2 mb-3">
            {LINE_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => onPick(c.value)}
                className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                  currentColor.toLowerCase() === c.value.toLowerCase()
                    ? "border-foreground"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs text-muted-foreground">Personalizada:</label>
            <input
              type="color"
              value={currentColor}
              onChange={(e) => onPick(e.target.value)}
              className="h-6 w-10 rounded cursor-pointer border border-border bg-transparent"
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={onDelete}
          >
            <Trash2 className="h-3 w-3 mr-1.5" />
            Remover ligação
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Generic map shell ────────────────────────────────────────────────────────
function useMapInteractions(nodeType: NodeType) {
  const { data: positions } = useDependencyPositions(nodeType);
  const savePos = useSavePosition();

  const posMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }>();
    (positions ?? []).forEach((p) =>
      m.set(p.node_id, { x: Number(p.position_x), y: Number(p.position_y) })
    );
    return m;
  }, [positions]);

  // Debounce-save when a drag ends
  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      savePos.mutate({
        nodeType,
        nodeId: node.id,
        x: node.position.x,
        y: node.position.y,
      });
    },
    [nodeType, savePos]
  );

  return { posMap, onNodeDragStop };
}

// ── Tasks Map ────────────────────────────────────────────────────────────────
function TasksMap() {
  const { data: rawTasks, isLoading: lT } = useTasks();
  // Filter out chamados and completed tasks from the dependency map.
  const tasks = useMemo(
    () =>
      (rawTasks ?? []).filter(
        (t) => !/^\s*\[Chamado\]/i.test(t.title || "") && t.status !== "done"
      ),
    [rawTasks]
  );

  const { data: rawDeps, isLoading: lD } = useAllDependencies();
  const validTaskIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const deps = useMemo(
    () =>
      (rawDeps ?? []).filter(
        (d) => validTaskIds.has(d.task_id) && validTaskIds.has(d.depends_on_task_id)
      ),
    [rawDeps, validTaskIds]
  );

  const addDep = useAddDependency();
  const removeDep = useRemoveDependency();
  const updateColor = useUpdateDependencyColor();
  const { posMap, onNodeDragStop } = useMapInteractions("task");

  const initialNodes = useMemo<Node[]>(() => {
    if (!tasks.length) return [];
    const fallback = gridLayout(tasks);
    const fallbackMap = new Map(fallback.map((p) => [p.id, p]));
    return tasks.map((t) => {
      const saved = posMap.get(t.id);
      const fb = fallbackMap.get(t.id)!;
      const pos = saved ?? { x: fb.x, y: fb.y };
      const color = taskStatusColors[t.status] ?? "#6b7280";
      return {
        id: t.id,
        position: pos,
        data: { label: t.title },
        style: {
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: `2px solid ${color}`,
          borderRadius: 12,
          padding: 10,
          width: 240,
          fontSize: 12,
        },
      } as Node;
    });
  }, [tasks, posMap]);

  const initialEdges = useMemo<Edge[]>(() => {
    return deps.map((d) => {
      const color = d.line_color || DEFAULT_COLOR;
      return {
        id: d.id,
        source: d.depends_on_task_id,
        target: d.task_id,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2 },
      };
    });
  }, [deps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      addDep.mutate({ taskId: c.target, dependsOnTaskId: c.source, lineColor: DEFAULT_COLOR });
    },
    [addDep]
  );

  const [editing, setEditing] = useState<{
    edge: Edge;
    position: { x: number; y: number };
  } | null>(null);

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.stopPropagation();
    setEditing({ edge, position: { x: e.clientX, y: e.clientY } });
  }, []);

  if (lT || lD) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tasks.length) {
    return <EmptyState icon={GitBranch} title="Sem tarefas" description="Crie tarefas para visualizar dependências." />;
  }

  const editingColor =
    (editing && (editing.edge.style as any)?.stroke) || DEFAULT_COLOR;

  return (
    <div className="relative h-[calc(100vh-260px)] min-h-[500px] rounded-xl border border-border bg-card overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        fitView={!posMap.size}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-right" className="text-xs bg-card/90 backdrop-blur px-3 py-2 rounded-md border border-border">
          Arraste de uma tarefa para outra para criar vínculo. Clique numa linha para mudar cor ou remover.
        </Panel>
      </ReactFlow>
      <EdgeColorPopover
        open={!!editing}
        position={editing?.position ?? null}
        currentColor={editingColor}
        onPick={(c) => {
          if (!editing) return;
          updateColor.mutate({ id: editing.edge.id, lineColor: c });
          setEditing(null);
        }}
        onDelete={() => {
          if (!editing) return;
          removeDep.mutate(editing.edge.id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

// ── Automations Map ──────────────────────────────────────────────────────────
function AutomationsMap() {
  const { data: rawAutomations, isLoading: lA } = useAutomations();
  const automations = useMemo(
    () => (rawAutomations ?? []).filter((a) => a.status !== "completed"),
    [rawAutomations]
  );

  const { data: rawDeps, isLoading: lD } = useAllAutomationDependencies();
  const validAutomationIds = useMemo(
    () => new Set(automations.map((a) => a.id)),
    [automations]
  );
  const deps = useMemo(
    () =>
      (rawDeps ?? []).filter(
        (d) =>
          validAutomationIds.has(d.automation_id) &&
          validAutomationIds.has(d.depends_on_automation_id)
      ),
    [rawDeps, validAutomationIds]
  );
  const addDep = useAddAutomationDependency();
  const removeDep = useRemoveAutomationDependency();
  const updateColor = useUpdateAutomationDependencyColor();
  const { posMap, onNodeDragStop } = useMapInteractions("automation");

  const initialNodes = useMemo<Node[]>(() => {
    if (!automations.length) return [];
    const fallback = gridLayout(automations);
    const fallbackMap = new Map(fallback.map((p) => [p.id, p]));
    return automations.map((a) => {
      const saved = posMap.get(a.id);
      const fb = fallbackMap.get(a.id)!;
      const pos = saved ?? { x: fb.x, y: fb.y };
      const color = automationStatusColors[a.status] ?? "#6b7280";
      const sectorLabel = a.sector ? SECTOR_LABELS[a.sector] : null;
      return {
        id: a.id,
        position: pos,
        data: {
          label: (
            <div className="space-y-1">
              <div className="font-medium text-xs leading-tight">{a.title}</div>
              <div className="flex gap-1 items-center text-[10px] opacity-80">
                <span>{A_LABELS[a.status]}</span>
                {sectorLabel && <span>· {sectorLabel}</span>}
              </div>
            </div>
          ),
        },
        style: {
          background: "hsl(var(--card))",
          color: "hsl(var(--card-foreground))",
          border: `2px solid ${color}`,
          borderRadius: 12,
          padding: 10,
          width: 240,
        },
      } as Node;
    });
  }, [automations, posMap]);

  const initialEdges = useMemo<Edge[]>(() => {
    const colorByRelation: Record<string, string> = {
      depends_on: "#3b82f6",
      blocks: "#ef4444",
      related: "#a855f7",
    };
    return deps.map((d) => {
      const color = d.line_color || colorByRelation[d.relation_type] || DEFAULT_COLOR;
      return {
        id: d.id,
        source: d.depends_on_automation_id,
        target: d.automation_id,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color },
        style: { stroke: color, strokeWidth: 2 },
        label: d.relation_type === "blocks" ? "bloqueia" : d.relation_type === "related" ? "relacionada" : "depende",
        labelBgStyle: { fill: "hsl(var(--card))" },
        labelStyle: { fontSize: 10 },
      };
    });
  }, [deps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      addDep.mutate({
        automationId: c.target,
        dependsOnAutomationId: c.source,
        lineColor: DEFAULT_COLOR,
      });
    },
    [addDep]
  );

  const [editing, setEditing] = useState<{
    edge: Edge;
    position: { x: number; y: number };
  } | null>(null);

  const onEdgeClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    e.stopPropagation();
    setEditing({ edge, position: { x: e.clientX, y: e.clientY } });
  }, []);

  if (lA || lD) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!automations?.length) {
    return <EmptyState icon={GitBranch} title="Sem automações" description="Crie automações para visualizar dependências." />;
  }

  const editingColor =
    (editing && (editing.edge.style as any)?.stroke) || DEFAULT_COLOR;

  return (
    <div className="relative h-[calc(100vh-260px)] min-h-[500px] rounded-xl border border-border bg-card overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        fitView={!posMap.size}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-right" className="text-xs bg-card/90 backdrop-blur px-3 py-2 rounded-md border border-border max-w-[280px]">
          Arraste de uma automação a outra para vincular. Clique numa linha para mudar cor ou remover.
        </Panel>
      </ReactFlow>
      <EdgeColorPopover
        open={!!editing}
        position={editing?.position ?? null}
        currentColor={editingColor}
        onPick={(c) => {
          if (!editing) return;
          updateColor.mutate({ id: editing.edge.id, lineColor: c });
          setEditing(null);
        }}
        onDelete={() => {
          if (!editing) return;
          removeDep.mutate(editing.edge.id);
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
const DependencyMap = () => {
  const { resolvedTheme } = useTheme();
  return (
    <div className={`space-y-4 ${resolvedTheme === "dark" ? "dark" : ""}`}>
      <PageHeader
        title="Mapa de Dependências"
        description="Visualize e gerencie vínculos entre tarefas e entre automações."
        icon={<GitBranch className="h-5 w-5" />}
      />

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList>
          <TabsTrigger value="tasks">Tarefas</TabsTrigger>
          <TabsTrigger value="automations">Automações</TabsTrigger>
        </TabsList>
        <TabsContent value="tasks" className="mt-4">
          <TasksMap />
        </TabsContent>
        <TabsContent value="automations" className="mt-4">
          <AutomationsMap />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DependencyMap;
