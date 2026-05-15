import { useMemo, useEffect, useState } from "react";
import { useTasks, useProfiles, COLUMNS, Task } from "@/hooks/useTasks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import {
  BarChart3, Users, Clock, AlertTriangle, TrendingUp, Activity,
  CheckCircle2, Timer, ShieldAlert, Heart, Gauge, ListTodo,
  ArrowUpRight, ArrowDownRight, Minus, AlertCircle, Eye,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, CartesianGrid, Legend,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  backlog: "hsl(220, 9%, 46%)",
  pending: "hsl(45, 93%, 50%)",
  todo: "hsl(45, 93%, 50%)",
  in_progress: "hsl(217, 91%, 55%)",
  review: "hsl(262, 83%, 58%)",
  done: "hsl(152, 69%, 40%)",
  discarded: "hsl(25, 50%, 35%)",
  overdue: "hsl(0, 72%, 51%)",
};
const FALLBACK_COLOR = "hsl(220, 9%, 46%)";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
  boxShadow: "var(--shadow-lg)",
};

type PeriodFilter = "today" | "week" | "month" | "all";

function getDateFilter(period: PeriodFilter): Date | null {
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case "week": { const d = new Date(now); d.setDate(d.getDate() - 7); return d; }
    case "month": { const d = new Date(now); d.setMonth(d.getMonth() - 1); return d; }
    default: return null;
  }
}

function TeamHealthIndicator({ health }: { health: "green" | "yellow" | "red" }) {
  const config = {
    green: { label: "Saudável", color: "text-success", bg: "bg-success/10", icon: Heart },
    yellow: { label: "Atenção", color: "text-warning", bg: "bg-warning/10", icon: AlertTriangle },
    red: { label: "Crítico", color: "text-destructive", bg: "bg-destructive/10", icon: ShieldAlert },
  }[health];

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${config.bg}`}>
      <config.icon className={`h-4 w-4 ${config.color}`} />
      <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
    </div>
  );
}

const ManagerDashboard = () => {
  const { data: tasks } = useTasks();
  const { data: profiles } = useProfiles();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [userFilter, setUserFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    const channel = supabase
      .channel("manager-dashboard-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () =>
        queryClient.invalidateQueries({ queryKey: ["tasks"] })
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "time_logs" }, () =>
        queryClient.invalidateQueries({ queryKey: ["tasks"] })
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const filteredTasks = useMemo(() => {
    if (!tasks) return [];
    let result = tasks;
    const dateLimit = getDateFilter(period);
    if (dateLimit) result = result.filter(t => new Date(t.created_at) >= dateLimit);
    if (userFilter !== "all") result = result.filter(t => t.assigned_to === userFilter);
    if (statusFilter !== "all") result = result.filter(t => t.status === statusFilter);
    return result;
  }, [tasks, period, userFilter, statusFilter]);

  const kpis = useMemo(() => {
    const total = filteredTasks.length;
    const inProgress = filteredTasks.filter(t => t.status === "in_progress").length;
    const done = filteredTasks.filter(t => t.status === "done").length;
    const review = filteredTasks.filter(t => t.status === "review").length;
    const urgent = filteredTasks.filter(t => t.priority === "urgent" || t.priority === "high").length;
    const totalMinutes = filteredTasks.reduce((sum, t) => sum + (t.total_minutes || 0), 0);
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const unassigned = filteredTasks.filter(t => !t.assigned_to).length;

    // Stalled: non-done tasks not updated in 2+ days
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const stalled = filteredTasks.filter(
      t => t.status !== "done" && t.status !== "discarded" && new Date(t.updated_at) < twoDaysAgo
    ).length;

    return { total, inProgress, done, review, urgent, totalMinutes, completionRate, unassigned, stalled };
  }, [filteredTasks]);

  const teamHealth = useMemo(() => {
    if (!kpis) return "green" as const;
    const stalledRatio = kpis.total > 0 ? kpis.stalled / kpis.total : 0;
    if (stalledRatio > 0.3 || kpis.completionRate < 20) return "red" as const;
    if (stalledRatio > 0.15 || kpis.completionRate < 50) return "yellow" as const;
    return "green" as const;
  }, [kpis]);

  const userStats = useMemo(() => {
    if (!filteredTasks || !profiles) return [];
    const map: Record<string, { inProgress: number; done: number; minutes: number; total: number }> = {};
    filteredTasks.forEach(t => {
      if (!t.assigned_to) return;
      if (!map[t.assigned_to]) map[t.assigned_to] = { inProgress: 0, done: 0, minutes: 0, total: 0 };
      map[t.assigned_to].total++;
      if (t.status === "in_progress") map[t.assigned_to].inProgress++;
      if (t.status === "done") map[t.assigned_to].done++;
      map[t.assigned_to].minutes += t.total_minutes || 0;
    });

    return profiles
      .filter(p => map[p.id])
      .map(p => {
        const s = map[p.id];
        const efficiency = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
        return {
          id: p.id,
          name: p.full_name || "Sem nome",
          avatar: p.full_name?.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase() || "?",
          ...s,
          efficiency,
          hours: Math.round((s.minutes / 60) * 10) / 10,
        };
      })
      .sort((a, b) => b.efficiency - a.efficiency);
  }, [filteredTasks, profiles]);

  const statusData = useMemo(() => {
    const statusMap = Object.fromEntries(COLUMNS.map(c => [c.status, c.title]));
    const base = COLUMNS.map(col => ({
      key: col.status,
      name: statusMap[col.status],
      value: filteredTasks.filter(t => t.status === col.status).length,
    }));
    const now = Date.now();
    const overdue = filteredTasks.filter(t =>
      t.due_date && new Date(t.due_date).getTime() < now &&
      t.status !== "done" && t.status !== "discarded"
    ).length;
    if (overdue > 0) base.push({ key: "overdue", name: "Atrasadas", value: overdue });
    return base.filter(d => d.value > 0);
  }, [filteredTasks]);
  const timePerUser = useMemo(() => {
    if (!profiles) return [];
    const map: Record<string, number> = {};
    filteredTasks.forEach(t => {
      if (t.assigned_to && t.total_minutes) map[t.assigned_to] = (map[t.assigned_to] || 0) + t.total_minutes;
    });
    return profiles
      .filter(p => map[p.id])
      .map(p => ({ name: p.full_name?.split(" ")[0] || "N/A", hours: Math.round((map[p.id] / 60) * 10) / 10 }))
      .sort((a, b) => b.hours - a.hours);
  }, [filteredTasks, profiles]);

  const avgMinutesPerTask = useMemo(() => {
    const tasksWithTime = filteredTasks.filter(t => (t.total_minutes || 0) > 0);
    if (tasksWithTime.length === 0) return 0;
    return Math.round(tasksWithTime.reduce((s, t) => s + (t.total_minutes || 0), 0) / tasksWithTime.length);
  }, [filteredTasks]);

  const alerts = useMemo(() => {
    if (!filteredTasks || !profiles) return [];
    const items: { type: "red" | "yellow" | "blue"; message: string }[] = [];
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    // Stalled tasks
    const stalledTasks = filteredTasks.filter(
      t => t.status !== "done" && t.status !== "discarded" && new Date(t.updated_at) < twoDaysAgo
    );
    if (stalledTasks.length > 0) {
      items.push({ type: "red", message: `${stalledTasks.length} tarefa(s) travada(s) há mais de 2 dias` });
    }

    // Unassigned
    const unassigned = filteredTasks.filter(t => !t.assigned_to && t.status !== "done" && t.status !== "discarded");
    if (unassigned.length > 0) {
      items.push({ type: "yellow", message: `${unassigned.length} tarefa(s) sem responsável` });
    }

    // Stuck in review
    const reviewStuck = filteredTasks.filter(
      t => t.status === "review" && new Date(t.updated_at) < twoDaysAgo
    );
    if (reviewStuck.length > 0) {
      items.push({ type: "yellow", message: `${reviewStuck.length} tarefa(s) travada(s) em validação` });
    }

    // Per-user overload (5+ active tasks)
    const userLoad: Record<string, number> = {};
    filteredTasks.filter(t => t.assigned_to && t.status === "in_progress").forEach(t => {
      userLoad[t.assigned_to!] = (userLoad[t.assigned_to!] || 0) + 1;
    });
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p.full_name || "Usuário"]));
    Object.entries(userLoad).forEach(([uid, count]) => {
      if (count >= 5) items.push({ type: "red", message: `${profileMap[uid]} está com ${count} tarefas em andamento (sobrecarga)` });
    });

    // Top performer
    if (userStats.length > 0 && userStats[0].done > 0) {
      items.push({ type: "blue", message: `${userStats[0].name} está com a maior produtividade (${userStats[0].efficiency}%)` });
    }

    return items;
  }, [filteredTasks, profiles, userStats]);

  const bottlenecks = useMemo(() => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return filteredTasks
      .filter(t => t.status !== "done" && t.status !== "discarded" && new Date(t.updated_at) < twoDaysAgo)
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 10);
  }, [filteredTasks]);

  if (!tasks) return null;

  const formatMinutes = (m: number) => {
    if (m < 60) return `${m}min`;
    return `${Math.floor(m / 60)}h ${m % 60}min`;
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title="Painel do Gestor"
          description="Visão estratégica e tomada de decisão"
          icon={<Gauge className="h-5 w-5" />}
        />
        <div className="flex items-center gap-3 flex-wrap">
          <TeamHealthIndicator health={teamHealth} />
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          <Select value={userFilter} onValueChange={setUserFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Usuário" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {profiles?.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name || p.id.slice(0, 8)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              {COLUMNS.map(c => (
                <SelectItem key={c.status} value={c.status}>{c.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {[
          { label: "Tarefas Ativas", value: kpis.inProgress, icon: Activity, iconClass: "text-primary" },
          { label: "Em Validação", value: kpis.review, icon: Eye, iconClass: "text-warning" },
          { label: "Concluídas", value: kpis.done, icon: CheckCircle2, iconClass: "text-success", extra: kpis.completionRate },
          { label: "Críticas", value: kpis.urgent, icon: AlertCircle, iconClass: "text-destructive" },
          { label: "Tempo Total", value: formatMinutes(kpis.totalMinutes), icon: Timer, iconClass: "text-primary" },
        ].map(kpi => (
          <Card key={kpi.label} className="shadow-card hover:shadow-card-hover transition-shadow duration-200">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                <kpi.icon className={`h-4 w-4 ${kpi.iconClass}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              {kpi.extra !== undefined && (
                <>
                  <Progress value={kpi.extra} className="mt-2 h-1.5" />
                  <p className="text-[10px] text-muted-foreground mt-1">{kpi.extra}% concluídas</p>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="shadow-card border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-warning" />
              Alertas Inteligentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`flex items-center gap-3 rounded-xl p-3 ${
                  a.type === "red" ? "bg-destructive/10" : a.type === "yellow" ? "bg-warning/10" : "bg-primary/10"
                }`}>
                  {a.type === "red" ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" /> :
                   a.type === "yellow" ? <AlertTriangle className="h-4 w-4 text-warning shrink-0" /> :
                   <TrendingUp className="h-4 w-4 text-primary shrink-0" />}
                  <span className="text-sm text-foreground">{a.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      {statusData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2">
                  {statusData.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="text-foreground font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState icon={BarChart3} title="Sem dados" description="Nenhuma tarefa no período." />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Timer className="h-4 w-4 text-primary" />
              Tempo por Usuário (horas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {timePerUser.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={timePerUser} layout="vertical" margin={{ left: 10 }}>
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={60} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v}h`, "Tempo"]} />
                  <Bar dataKey="hours" fill="hsl(230, 80%, 60%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Timer} title="Sem registros" description="Nenhum tempo registrado." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Time analysis card */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            Análise de Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Tempo Médio / Tarefa</p>
              <p className="text-xl font-bold text-foreground">{formatMinutes(avgMinutesPerTask)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Tempo Total do Time</p>
              <p className="text-xl font-bold text-foreground">{formatMinutes(kpis.totalMinutes)}</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Membros Ativos</p>
              <p className="text-xl font-bold text-foreground">{userStats.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* User Performance Table */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Performance por Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          {userStats.length > 0 ? (
            <div className="space-y-3">
              {userStats.map((u, i) => {
                const isBest = i === 0 && u.done > 0;
                const isWorst = i === userStats.length - 1 && userStats.length > 1;
                const isOverloaded = u.inProgress >= 5;
                return (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{u.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-foreground truncate font-medium">{u.name}</p>
                        {isBest && <Badge className="text-[9px] bg-success/10 text-success border-success/20">Mais produtivo</Badge>}
                        {isOverloaded && <Badge className="text-[9px] bg-destructive/10 text-destructive border-destructive/20">Sobrecarregado</Badge>}
                        {isWorst && !isOverloaded && <Badge variant="outline" className="text-[9px]">Menor eficiência</Badge>}
                      </div>
                      <Progress value={u.efficiency} className="h-1.5 mt-1.5" />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{u.inProgress}</p>
                        <p>ativas</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{u.done}</p>
                        <p>feitas</p>
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-foreground">{u.hours}h</p>
                        <p>tempo</p>
                      </div>
                      <Badge variant="secondary" className="font-semibold">{u.efficiency}%</Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={Users} title="Sem dados de usuários" description="Atribua tarefas para ver a performance." />
          )}
        </CardContent>
      </Card>

      {/* Bottlenecks */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Tarefas Travadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {bottlenecks.length > 0 ? (
            <div className="space-y-2">
              {bottlenecks.map(task => {
                const daysAgo = Math.floor((Date.now() - new Date(task.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                const severity = daysAgo > 5 ? "destructive" : "warning";
                return (
                  <div key={task.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${severity === "destructive" ? "bg-destructive" : "bg-warning"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate font-medium">{task.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {task.profiles?.full_name || "Sem responsável"} · Parada há {daysAgo} dia(s)
                      </p>
                    </div>
                    <Badge variant={severity === "destructive" ? "destructive" : "outline"} className="text-[10px] shrink-0">
                      {daysAgo}d parada
                    </Badge>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState icon={AlertTriangle} title="Sem gargalos" description="Nenhuma tarefa travada. Tudo fluindo!" />
          )}
        </CardContent>
      </Card>

      {/* Prediction */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Previsão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <div className={`rounded-xl p-4 ${kpis.completionRate >= 50 ? "bg-success/10" : "bg-warning/10"}`}>
              <div className="flex items-center gap-2 mb-1">
                {kpis.completionRate >= 50 ? (
                  <ArrowUpRight className="h-4 w-4 text-success" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-warning" />
                )}
                <span className="text-sm font-semibold text-foreground">Ritmo da Equipe</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {kpis.completionRate >= 50
                  ? "Equipe dentro do prazo. Ritmo de conclusão saudável."
                  : "Equipe pode atrasar. Taxa de conclusão abaixo do ideal."}
              </p>
            </div>
            <div className={`rounded-xl p-4 ${kpis.stalled <= 2 ? "bg-success/10" : "bg-destructive/10"}`}>
              <div className="flex items-center gap-2 mb-1">
                {kpis.stalled <= 2 ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                )}
                <span className="text-sm font-semibold text-foreground">Risco de Atraso</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {kpis.stalled <= 2
                  ? "Baixo risco. Poucas tarefas paradas no sistema."
                  : `${kpis.stalled} tarefas travadas podem causar atrasos em cadeia.`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ManagerDashboard;
