import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useTasks, COLUMNS } from "@/hooks/useTasks";
import { useAllDependencies, useAddDependency, useRemoveDependency } from "@/hooks/useDependencies";
import { useAutomations } from "@/hooks/useAutomationsData";
import {
  useAllAutomationDependencies,
  useAddAutomationDependency,
  useRemoveAutomationDependency,
} from "@/hooks/useAutomationDependencies";
import { STATUS_LABELS as A_LABELS } from "@/types/automation";
import { SECTOR_LABELS } from "@/types/sectors";
import { GitBranch, Loader2, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { toast } from "sonner";

// ─── Layout helper ────────────────────────────────────────────────────────────
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

// ─── Tasks Map ────────────────────────────────────────────────────────────────
function TasksMap() {
  const { data: tasks, isLoading: lT } = useTasks();
  const { data: deps, isLoading: lD } = useAllDependencies();
  const addDep = useAddDependency();
  const removeDep = useRemoveDependency();

  const initialNodes = useMemo<Node[]>(() => {
    if (!tasks) return [];
    const positions = gridLayout(tasks);
    const posMap = new Map(positions.map((p) => [p.id, p]));
    return tasks.map((t) => {
      const p = posMap.get(t.id)!;
      const color = taskStatusColors[t.status] ?? "#6b7280";
      return {
        id: t.id,
        position: { x: p.x, y: p.y },
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
  }, [tasks]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!deps) return [];
    return deps.map((d) => ({
      id: d.id,
      source: d.depends_on_task_id,
      target: d.task_id,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#3b82f6", strokeWidth: 2 },
    }));
  }, [deps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      addDep.mutate({ taskId: c.target, dependsOnTaskId: c.source });
      setEdges((eds) => addEdge({ ...c, animated: true, markerEnd: { type: MarkerType.ArrowClosed } }, eds));
    },
    [addDep, setEdges]
  );

  const onEdgeClick = useCallback(
    (_: any, edge: Edge) => {
      if (confirm("Remover este vínculo de dependência?")) {
        removeDep.mutate(edge.id);
      }
    },
    [removeDep]
  );

  if (lT || lD) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tasks?.length) {
    return <EmptyState icon={GitBranch} title="Sem tarefas" description="Crie tarefas para visualizar dependências." />;
  }

  return (
    <div className="h-[calc(100vh-260px)] min-h-[500px] rounded-xl border border-border bg-card overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-right" className="text-xs bg-card/90 backdrop-blur px-3 py-2 rounded-md border border-border">
          Arraste de uma tarefa para outra para criar vínculo. Clique em uma linha para remover.
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ─── Automations Map ──────────────────────────────────────────────────────────
function AutomationsMap() {
  const { data: automations, isLoading: lA } = useAutomations();
  const { data: deps, isLoading: lD } = useAllAutomationDependencies();
  const addDep = useAddAutomationDependency();
  const removeDep = useRemoveAutomationDependency();

  const initialNodes = useMemo<Node[]>(() => {
    if (!automations) return [];
    const positions = gridLayout(automations);
    const posMap = new Map(positions.map((p) => [p.id, p]));
    return automations.map((a) => {
      const p = posMap.get(a.id)!;
      const color = automationStatusColors[a.status] ?? "#6b7280";
      const sectorLabel = a.sector ? SECTOR_LABELS[a.sector] : null;
      return {
        id: a.id,
        position: { x: p.x, y: p.y },
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
  }, [automations]);

  const initialEdges = useMemo<Edge[]>(() => {
    if (!deps) return [];
    const colorByRelation: Record<string, string> = {
      depends_on: "#3b82f6",
      blocks: "#ef4444",
      related: "#a855f7",
    };
    return deps.map((d) => ({
      id: d.id,
      source: d.depends_on_automation_id,
      target: d.automation_id,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: colorByRelation[d.relation_type] ?? "#3b82f6", strokeWidth: 2 },
      label: d.relation_type === "blocks" ? "bloqueia" : d.relation_type === "related" ? "relacionada" : "depende",
      labelBgStyle: { fill: "hsl(var(--card))" },
      labelStyle: { fontSize: 10 },
    }));
  }, [deps]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => setNodes(initialNodes), [initialNodes, setNodes]);
  useEffect(() => setEdges(initialEdges), [initialEdges, setEdges]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      addDep.mutate({ automationId: c.target, dependsOnAutomationId: c.source });
    },
    [addDep]
  );

  const onEdgeClick = useCallback(
    (_: any, edge: Edge) => {
      if (confirm("Remover este vínculo de dependência?")) removeDep.mutate(edge.id);
    },
    [removeDep]
  );

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

  return (
    <div className="h-[calc(100vh-260px)] min-h-[500px] rounded-xl border border-border bg-card overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} />
        <Controls />
        <MiniMap pannable zoomable />
        <Panel position="top-right" className="text-xs bg-card/90 backdrop-blur px-3 py-2 rounded-md border border-border max-w-[280px]">
          Arraste de uma automação a outra para vincular. Cores: azul=depende, vermelho=bloqueia, roxo=relacionada. Clique numa linha para remover.
        </Panel>
      </ReactFlow>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const DependencyMap = () => {
  const { resolvedTheme } = useTheme();
  // react-flow theme via CSS class on root
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
