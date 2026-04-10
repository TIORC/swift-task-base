import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Automation, computeHealthScore } from "@/types/automation";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

interface Props {
  automations: Automation[];
  profileMap: Record<string, string>;
}

const STATUS_CHART_COLORS = [
  "hsl(var(--muted-foreground))",
  "hsl(210, 90%, 60%)",
  "hsl(240, 60%, 60%)",
  "hsl(40, 90%, 55%)",
  "hsl(270, 60%, 60%)",
  "hsl(30, 90%, 55%)",
  "hsl(150, 60%, 45%)",
  "hsl(0, 70%, 55%)",
];

export function AutomationMetrics({ automations, profileMap }: Props) {
  // Distribution by status
  const statusDist = [
    { name: "Backlog", value: automations.filter(a => a.status === "backlog").length },
    { name: "Análise", value: automations.filter(a => a.status === "analysis").length },
    { name: "Desenvolvimento", value: automations.filter(a => a.status === "development").length },
    { name: "Testes", value: automations.filter(a => a.status === "internal_testing").length },
    { name: "Homologação", value: automations.filter(a => a.status === "homologation").length },
    { name: "Aguardando", value: automations.filter(a => a.status === "waiting_user").length },
    { name: "Concluído", value: automations.filter(a => a.status === "completed").length },
    { name: "Bloqueado", value: automations.filter(a => a.status === "blocked").length },
  ].filter(d => d.value > 0);

  // Workload by user
  const workloadMap: Record<string, number> = {};
  automations.filter(a => a.assigned_to && a.status !== "completed" && a.status !== "cancelled").forEach(a => {
    const name = profileMap[a.assigned_to!] || "Sem nome";
    workloadMap[name] = (workloadMap[name] || 0) + 1;
  });
  const workloadData = Object.entries(workloadMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);

  // Key metrics
  const active = automations.filter(a => !["completed", "cancelled"].includes(a.status));
  const completed = automations.filter(a => a.status === "completed");
  const blocked = automations.filter(a => a.status === "blocked").length;
  const late = automations.filter(a => !!a.final_deadline && new Date(a.final_deadline) < new Date() && !["completed", "cancelled"].includes(a.status)).length;
  const avgProgress = active.length ? Math.round(active.reduce((s, a) => s + a.progress_percent, 0) / active.length) : 0;
  const completionRate = automations.length ? Math.round((completed.length / automations.length) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Key numbers */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Indicadores</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Em andamento</span><span className="font-semibold">{active.length}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Concluídas</span><span className="font-semibold text-emerald-500">{completed.length}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Bloqueadas</span><span className="font-semibold text-red-500">{blocked}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Atrasadas</span><span className="font-semibold text-amber-500">{late}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Progresso médio</span><span className="font-semibold">{avgProgress}%</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Taxa de conclusão</span><span className="font-semibold">{completionRate}%</span></div>
        </CardContent>
      </Card>

      {/* Status distribution chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Status</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusDist} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} innerRadius={35} paddingAngle={2}>
                {statusDist.map((_, i) => (
                  <Cell key={i} fill={STATUS_CHART_COLORS[i % STATUS_CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Workload chart */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Carga por Responsável</CardTitle></CardHeader>
        <CardContent>
          {workloadData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={workloadData} layout="vertical">
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
