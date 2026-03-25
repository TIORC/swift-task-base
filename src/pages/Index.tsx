import { useMemo, useEffect } from "react";
import { useTasks, useProfiles, COLUMNS } from "@/hooks/useTasks";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AIInsightsPanel } from "@/components/AIInsightsPanel";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  ListTodo, Clock, CheckCircle2, Users, AlertTriangle,
  TrendingUp, Timer, BarChart3, Activity,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";

const PIE_COLORS = [
  "hsl(217, 91%, 60%)",   // primary
  "hsl(38, 92%, 50%)",    // warning
  "hsl(142, 71%, 45%)",   // green
  "hsl(0, 84%, 60%)",     // destructive
  "hsl(262, 83%, 58%)",   // purple
  "hsl(199, 89%, 48%)",   // cyan
  "hsl(217, 33%, 40%)",   // muted
];

const Dashboard = () => {
  const { data: tasks } = useTasks();
  const { data: profiles } = useProfiles();
  const queryClient = useQueryClient();

  // Realtime subscription
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
    if (!tasks) return null;
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === "in_progress").length;
    const done = tasks.filter((t) => t.status === "done").length;
    const review = tasks.filter((t) => t.status === "review").length;
    const members = profiles?.length || 0;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, inProgress, done, review, members, completionRate };
  }, [tasks, profiles]);

  // Tasks per status for pie chart
  const statusData = useMemo(() => {
    if (!tasks) return [];
    const statusMap = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));
    return COLUMNS.map((col) => ({
      name: statusMap[col.status],
      value: tasks.filter((t) => t.status === col.status).length,
    })).filter((d) => d.value > 0);
  }, [tasks]);

  // Time per user for bar chart
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

  // Productivity: tasks done per user
  const productivityData = useMemo(() => {
    if (!tasks || !profiles) return [];
    const userDone: Record<string, number> = {};
    tasks.filter((t) => t.status === "done").forEach((t) => {
      if (t.assigned_to) {
        userDone[t.assigned_to] = (userDone[t.assigned_to] || 0) + 1;
      }
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

  // Bottlenecks: columns with most tasks stuck
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

  // Recent activity (last 10 updated tasks)
  const recentActivity = useMemo(() => {
    if (!tasks) return [];
    return [...tasks]
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 8);
  }, [tasks]);

  const statusLabels = Object.fromEntries(COLUMNS.map((c) => [c.status, c.title]));

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-primary animate-pulse" />
            Visão estratégica em tempo real
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total de Tarefas</CardTitle>
            <ListTodo className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Em Andamento</CardTitle>
            <Clock className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.inProgress}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Concluídas</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.done}</p>
            <Progress value={stats.completionRate} className="mt-2 h-1.5" />
            <p className="text-[10px] text-muted-foreground mt-1">{stats.completionRate}% concluídas</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Em Validação</CardTitle>
            <AlertTriangle className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.review}</p>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{stats.members}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Status Distribution */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Distribuição por Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(217, 33%, 17%)",
                      border: "1px solid hsl(217, 33%, 22%)",
                      borderRadius: "8px",
                      color: "hsl(213, 31%, 91%)",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-10 text-center">Sem dados</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {statusData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-muted-foreground">{d.name}</span>
                  <span className="text-foreground font-medium">{d.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Time per User */}
        <Card className="border-border">
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
                  <XAxis type="number" tick={{ fill: "hsl(215, 20%, 65%)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(213, 31%, 91%)", fontSize: 11 }} width={60} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(217, 33%, 17%)",
                      border: "1px solid hsl(217, 33%, 22%)",
                      borderRadius: "8px",
                      color: "hsl(213, 31%, 91%)",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`${value}h`, "Tempo"]}
                  />
                  <Bar dataKey="hours" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm py-10 text-center">Sem registros de tempo</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Productivity + Bottlenecks */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Productivity Ranking */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Produtividade (Tarefas Concluídas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {productivityData.length > 0 ? (
              <div className="space-y-3">
                {productivityData.map((u, i) => (
                  <div key={u.name} className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}.</span>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="bg-primary/20 text-primary text-[10px]">{u.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{u.full_name}</p>
                      <Progress value={Math.min((u.done / (productivityData[0]?.done || 1)) * 100, 100)} className="h-1.5 mt-1" />
                    </div>
                    <Badge variant="secondary" className="text-xs shrink-0">{u.done}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-6 text-center">Nenhuma tarefa concluída</p>
            )}
          </CardContent>
        </Card>

        {/* Bottlenecks */}
        <Card className="border-border">
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
                    <div key={b.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-foreground">{b.label}</span>
                        <span className="text-muted-foreground text-xs">{b.count} tarefas ({pct}%)</span>
                      </div>
                      <div className="h-2 rounded-full bg-secondary overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct > 40 ? "hsl(0, 84%, 60%)" : pct > 25 ? "hsl(38, 92%, 50%)" : "hsl(217, 91%, 60%)",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-6 text-center">Sem gargalos detectados</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="border-border">
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
                <div key={task.id} className="flex items-center gap-3 rounded-md bg-secondary/30 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{task.title}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(task.updated_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    {statusLabels[task.status] || task.status}
                  </Badge>
                  {task.profiles?.full_name && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarFallback className="bg-primary/20 text-primary text-[9px]">
                        {task.profiles.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Nenhuma atividade recente.</p>
          )}
        </CardContent>
      </Card>

      {/* AI Insights */}
      <AIInsightsPanel />
    </div>
  );
};

export default Dashboard;
