import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Loader2, Zap, AlertTriangle } from "lucide-react";
import { useAutomations, useAllProfiles, useAllBlockers, useUpdateAutomation } from "@/hooks/useAutomationsData";
import { useUserRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { Automation, AutomationStatus } from "@/types/automation";
import { AutomationSummaryCards } from "@/components/automations/AutomationSummaryCards";
import { AutomationFilters } from "@/components/automations/AutomationFilters";
import { AutomationBoard } from "@/components/automations/AutomationBoard";
import { AutomationDetailPanel } from "@/components/automations/AutomationDetailPanel";
import { AutomationMetrics } from "@/components/automations/AutomationMetrics";
import { CreateAutomationDialog } from "@/components/automations/CreateAutomationDialog";
import { AutomationExport } from "@/components/automations/AutomationExport";
import { WipControl } from "@/components/automations/WipControl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BLOCKER_TYPE_LABELS, computeHealthScore } from "@/types/automation";

export default function AutomacoesPage() {
  const { data: automations = [], isLoading } = useAutomations();
  const { data: profiles = [] } = useAllProfiles();
  const { data: activeBlockers = [] } = useAllBlockers();
  const updateAutomation = useUpdateAutomation();
  const { profile } = useUserRole();
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);

  const profileMap = useMemo(() => {
    const m: Record<string, string> = {};
    profiles.forEach(p => { m[p.id] = p.full_name || "Sem nome"; });
    return m;
  }, [profiles]);

  const filtered = useMemo(() => {
    return automations.filter(a => {
      if (search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (priorityFilter !== "all" && a.priority !== priorityFilter) return false;
      if (assigneeFilter !== "all" && a.assigned_to !== assigneeFilter) return false;
      return true;
    });
  }, [automations, search, statusFilter, priorityFilter, assigneeFilter]);

  // Alerts
  const alerts = useMemo(() => {
    const items: { text: string; type: "warning" | "danger" }[] = [];
    automations.forEach(a => {
      if (a.status === "blocked") items.push({ text: `"${a.title}" está bloqueada`, type: "danger" });
      if (a.final_deadline && new Date(a.final_deadline) < new Date() && !["completed", "cancelled"].includes(a.status)) {
        items.push({ text: `"${a.title}" está atrasada`, type: "danger" });
      }
      const daysSinceUpdate = (Date.now() - new Date(a.updated_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 5 && !["completed", "cancelled"].includes(a.status)) {
        items.push({ text: `"${a.title}" sem atualização há ${Math.floor(daysSinceUpdate)} dias`, type: "warning" });
      }
    });
    return items.slice(0, 5);
  }, [automations]);

  const blockerCounts = useMemo(() => {
    const map: Record<string, number> = {};
    activeBlockers.forEach(b => {
      map[b.automation_id] = (map[b.automation_id] || 0) + 1;
    });
    return map;
  }, [activeBlockers]);

  const handleStatusChange = (id: string, newStatus: AutomationStatus) => {
    updateAutomation.mutate({ id, status: newStatus } as any);
  };

  const isReadOnly = profile === "gestor";

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Gestão de Automações"
        description="Controle técnico e acompanhamento gerencial"
        icon={<Zap className="h-6 w-6" />}
        actions={
          <div className="flex items-center gap-2">
            <AutomationExport automations={filtered} profileMap={profileMap} blockerCounts={blockerCounts} />
            <CreateAutomationDialog profiles={profiles} />
          </div>
        }
      />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-1.5">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg ${alert.type === "danger" ? "bg-red-500/10 text-red-500" : "bg-amber-500/10 text-amber-500"}`}>
              <AlertTriangle className="h-3 w-3 shrink-0" />
              <span>{alert.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <AutomationSummaryCards automations={automations} />

      {/* Main Content with Tabs */}
      <Tabs defaultValue="board" className="space-y-4">
        <TabsList>
          <TabsTrigger value="board">Workflow</TabsTrigger>
          <TabsTrigger value="metrics">Métricas</TabsTrigger>
          <TabsTrigger value="blockers">Bloqueios ({activeBlockers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="board" className="space-y-4">
          {/* Filters */}
          <AutomationFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            priorityFilter={priorityFilter}
            onPriorityFilterChange={setPriorityFilter}
            assigneeFilter={assigneeFilter}
            onAssigneeFilterChange={setAssigneeFilter}
            profiles={profiles}
          />

          {/* Board */}
          <AutomationBoard
            automations={filtered}
            onSelect={setSelectedAutomation}
            profileMap={profileMap}
          />
        </TabsContent>

        <TabsContent value="metrics">
          <AutomationMetrics automations={automations} profileMap={profileMap} />
        </TabsContent>

        <TabsContent value="blockers">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Bloqueios Ativos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeBlockers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum bloqueio ativo</p>
              ) : (
                activeBlockers.map(b => {
                  const auto = automations.find(a => a.id === b.automation_id);
                  return (
                    <div key={b.id} className="flex items-start justify-between p-3 rounded-lg border border-red-500/20 bg-red-500/5">
                      <div>
                        <p className="text-sm font-medium">{auto?.title || "—"}</p>
                        <Badge variant="outline" className="text-[10px] mt-1">{BLOCKER_TYPE_LABELS[b.blocker_type] || b.blocker_type}</Badge>
                        {b.description && <p className="text-xs text-muted-foreground mt-1">{b.description}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Detail Panel */}
      <AutomationDetailPanel
        automation={selectedAutomation}
        open={!!selectedAutomation}
        onClose={() => setSelectedAutomation(null)}
        profileMap={profileMap}
        profiles={profiles}
        isReadOnly={isReadOnly}
      />
    </div>
  );
}
