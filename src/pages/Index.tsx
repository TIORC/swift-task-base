import { useMemo, useEffect } from "react";
import { useTasks, useProfiles, COLUMNS } from "@/hooks/useTasks";
import { useTaskFilter } from "@/hooks/useTaskFilter";
import { TaskFilterSelect } from "@/components/TaskFilterSelect";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ListTodo, Clock, CheckCircle2, Users, AlertTriangle,
  TrendingUp, Timer, BarChart3, Activity, LayoutDashboard,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = [
  "hsl(230, 80%, 60%)",
  "hsl(38, 92%, 50%)",
  "hsl(152, 69%, 40%)",
  "hsl(0, 72%, 51%)",
  "hsl(262, 83%, 58%)",
  "hsl(199, 89%, 48%)",
  "hsl(220, 9%, 46%)",
];

const Dashboard = () => {
  const { data: tasks } = useTasks();
  const { filteredTasks, selectedUserId, setSelectedUserId, canFilter } = useTaskFilter(tasks);
  const { data: profiles } = useProfiles();
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "time_logs" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const stats = useMemo(() => {
    if (!filteredTasks) return null;
    const total = filteredTasks.length;
    const inProgress = filteredTasks.filter((t) => t.status === "in_progress").length;
    const done = filteredTasks.filter((t) => t.status === "done").length;
    const review = filteredTasks.filter((t) => t.status === "review").length;
    const members = profiles?.length || 0;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, inProgress, done, review, members, completionRate };
  }, [filteredTasks, profiles]);

  const statusData = useMemo(() => {
    if (!filteredTasks) return [];
    const statusMap = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));
    return COLUMNS.map((col) => ({
      name: statusMap[col.status],
      value: filteredTasks.filter((t) => t.status === col.status).length,
    })).filter((d) => d.value > 0);
  }, [filteredTasks]);

  const timePerUser = useMemo(() => {
    if (!tasks || !profiles) return [];
    const userTimeMap: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.assigned_to && t.total_minutes) {
        userTimeMap[t.assigned_to] = (userTimeMap[t.assigned_to] || 0) + t.total_minutes;
      }
    });
    return profiles
      .filter((p) => userTimeMap[p.id])
      .map((p) => ({
        name: p.full_name?.split(" ")[0] || "N/A",
        hours: Math.round((userTimeMap[p.id] / 60) * 10) / 10,
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [tasks, profiles]);

  const productivityData = useMemo(() => {
    if (!tasks || !profiles) return [];
    const userDone: Record<string, number> = {};
    tasks.filter((t) => t.status === "done").forEach((t) => {
      if (t.assigned_to) userDone[t.assigned_to] = (userDone[t.assigned_to] || 0) + 1;
    });
    return profiles
      .filter((p) => userDone[p.id])
      .map((p) => ({
        name: p.full_name?.split(" ")[0] || "N/A",
        full_name: p.full_name || "Sem nome",
        done: userDone[p.id],
        avatar: p.full_name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?",
      }))
      .sort((a, b) => b.done - a.done);
  }, [tasks, profiles]);

  const bottlenecks = useMemo(() => {
    if (!tasks) return [];
    const statusMap = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));
    const activeStatuses = ["backlog", "pending", "in_progress", "review"] as const;
    return activeStatuses
      .map((s) => ({
        status: s,
        label: statusMap[s],
        count: tasks.filter((t) => t.status === s).length,
      }))
      .filter((b) => b.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [tasks]);

  const recentActivity = useMemo(() => {
    if (!tasks) return [];
    return [...tasks]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [tasks]);

  if (!stats) return null;

  const tooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "12px",
    color: "hsl(var(--foreground))",
    fontSize: "12px",
    boxShadow: "var(--shadow-lg)",
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <PageHeader
        title="Dashboard"
        description="Visão estratégica em tempo real"
        icon={<LayoutDashboard className="h-5 w-5" />}
      />

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total de Tarefas", value: stats.total, icon: ListTodo, iconClass: "text-primary" },
          { label: "Em Andamento", value: stats.inProgress, icon: Clock, iconClass: "text-primary" },
          { label: "Concluídas", value: stats.done, icon: CheckCircle2, iconClass: "text-success", extra: stats.completionRate },
          { label: "Em Validação", value: stats.review, icon: AlertTriangle, iconClass: "text-warning" },
          { label: "Membros", value: stats.members, icon: Users, iconClass: "text-muted-foreground" },
        ].map((kpi) => (
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

      {/* Charts */}
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
              <EmptyState icon={BarChart3} title="Sem dados" description="Crie tarefas para visualizar a distribuição." />
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
                  <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value}h`, "Tempo"]} />
                  <Bar dataKey="hours" fill="hsl(230, 80%, 60%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={Timer} title="Sem registros" description="Registre tempo nas tarefas para visualizar." />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Productivity + Bottlenecks */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Produtividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productivityData.length > 0 ? (
              <div className="space-y-3">
                {productivityData.map((u, i) => (
                  <div key={u.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-semibold">{u.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{u.full_name}</p>
                      <Progress value={Math.min((u.done / (productivityData[0]?.done || 1)) * 100, 100)} className="h-1.5 mt-1" />
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0 font-semibold">{u.done}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title="Nenhuma tarefa concluída" />
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Gargalos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bottlenecks.length > 0 ? (
              <div className="space-y-3">
                {bottlenecks.map((b) => {
                  const total = stats.total || 1;
                  const pct = Math.round((b.count / total) * 100);
                  return (
                    <div key={b.status} className="space-y-1.5">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground font-medium">{b.label}</span>
                        <span className="text-muted-foreground text-xs">{b.count} tarefas ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct > 40 ? "hsl(0, 72%, 51%)" : pct > 25 ? "hsl(38, 92%, 50%)" : "hsl(230, 80%, 60%)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={AlertTriangle} title="Sem gargalos" description="Tudo fluindo bem!" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Atividade Recente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length > 0 ? (
            <div className="space-y-2">
              {recentActivity.map((task) => (
                <div key={task.id} className="flex items-center gap-3 rounded-xl bg-muted/50 p-3 hover:bg-muted transition-colors duration-150">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate font-medium">{task.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(task.updated_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <StatusBadge type="status" value={task.status} />
                  {task.profiles?.full_name && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-semibold">
                        {task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={Activity} title="Nenhuma atividade recente" />
          )}
        </CardContent>
      </Card>

      <AIInsightsPanel />
    </div>
  );
};

export default Dashboard;
