import { useState, useMemo, useRef, useCallback } from "react";
import { useTasks, useProfiles, COLUMNS, Task } from "@/hooks/useTasks";
import { useTaskFilter } from "@/hooks/useTaskFilter";
import { useUserRole } from "@/hooks/useUserRole";
import { TaskFilterSelect } from "@/components/TaskFilterSelect";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  BarChart3, Clock, TrendingUp, CheckCircle2, Timer, Activity,
  AlertTriangle, Users, FileDown, Loader2, Printer, FileSpreadsheet,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { format, subDays, subMonths, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const PIE_COLORS = [
  "hsl(230, 80%, 60%)", "hsl(38, 92%, 50%)", "hsl(152, 69%, 40%)",
  "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)", "hsl(220, 9%, 46%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
};

type PeriodFilter = "week" | "month" | "quarter" | "specific" | "all";

const periodLabels: Record<PeriodFilter, string> = {
  week: "Semana", month: "Mês", quarter: "Trimestre", specific: "Mês específico", all: "Todo período",
};

const Reports = () => {
  const { data: tasks, isLoading } = useTasks();
  const { data: profiles } = useProfiles();
  const { filteredTasks, selectedUserId, setSelectedUserId, canFilter } = useTaskFilter(tasks);
  const { isAdmin, isGestor } = useUserRole();
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [specificMonth, setSpecificMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const reportRef = useRef<HTMLDivElement>(null);

  const periodFiltered = useMemo(() => {
    if (!filteredTasks) return [];
    const now = new Date();
    if (period === "specific") {
      const [y, m] = specificMonth.split("-").map(Number);
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 1);
      return filteredTasks.filter(t => {
        const d = new Date(t.created_at);
        return d >= start && d < end;
      });
    }
    let cutoff: Date | null = null;
    if (period === "week") cutoff = subDays(now, 7);
    else if (period === "month") cutoff = subMonths(now, 1);
    else if (period === "quarter") cutoff = subMonths(now, 3);
    if (cutoff) return filteredTasks.filter(t => new Date(t.created_at) >= cutoff!);
    return filteredTasks;
  }, [filteredTasks, period, specificMonth]);

  const metrics = useMemo(() => {
    const total = periodFiltered.length;
    const done = periodFiltered.filter(t => t.status === "done").length;
    const inProgress = periodFiltered.filter(t => t.status === "in_progress").length;
    const review = periodFiltered.filter(t => t.status === "review").length;
    const discarded = periodFiltered.filter(t => t.status === "discarded").length;

    const tasksWithTime = periodFiltered.filter(t => (t.total_minutes || 0) > 0);
    const totalMinutes = periodFiltered.reduce((s, t) => s + (t.total_minutes || 0), 0);
    const avgExecMinutes = tasksWithTime.length > 0
      ? Math.round(totalMinutes / tasksWithTime.length)
      : 0;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    const discardRate = total > 0 ? Math.round((discarded / total) * 100) : 0;

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const stalled = periodFiltered.filter(
      t => t.status !== "done" && t.status !== "discarded" && new Date(t.updated_at) < twoDaysAgo
    ).length;

    return { total, done, inProgress, review, totalMinutes, avgExecMinutes, completionRate, discardRate, stalled };
  }, [periodFiltered]);

  const userMetrics = useMemo(() => {
    if (!profiles) return [];
    const map: Record<string, { total: number; done: number; minutes: number }> = {};
    periodFiltered.forEach(t => {
      if (!t.assigned_to) return;
      if (!map[t.assigned_to]) map[t.assigned_to] = { total: 0, done: 0, minutes: 0 };
      map[t.assigned_to].total++;
      if (t.status === "done") map[t.assigned_to].done++;
      map[t.assigned_to].minutes += t.total_minutes || 0;
    });
    return profiles
      .filter(p => map[p.id])
      .map(p => ({
        name: p.full_name?.split(" ")[0] || "N/A",
        fullName: p.full_name || "Sem nome",
        total: map[p.id].total,
        done: map[p.id].done,
        hours: Math.round((map[p.id].minutes / 60) * 10) / 10,
        efficiency: map[p.id].total > 0 ? Math.round((map[p.id].done / map[p.id].total) * 100) : 0,
      }))
      .sort((a, b) => b.efficiency - a.efficiency);
  }, [periodFiltered, profiles]);

  const statusData = useMemo(() => {
    return COLUMNS.map(col => ({
      name: col.title,
      value: periodFiltered.filter(t => t.status === col.status).length,
    })).filter(d => d.value > 0);
  }, [periodFiltered]);

  const weeklyEvolution = useMemo(() => {
    const now = new Date();
    const start = subMonths(now, 2);
    const weeks = eachWeekOfInterval({ start, end: now }, { locale: ptBR });
    return weeks.map(weekStart => {
      const weekEnd = endOfWeek(weekStart, { locale: ptBR });
      const created = periodFiltered.filter(t => {
        const d = new Date(t.created_at);
        return d >= weekStart && d <= weekEnd;
      }).length;
      const completed = periodFiltered.filter(t => {
        if (t.status !== "done") return false;
        const d = new Date(t.updated_at);
        return d >= weekStart && d <= weekEnd;
      }).length;
      return {
        week: format(weekStart, "dd/MM", { locale: ptBR }),
        criadas: created,
        concluídas: completed,
      };
    });
  }, [periodFiltered]);

  const stalledTasks = useMemo(() => {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    return periodFiltered
      .filter(t => t.status !== "done" && t.status !== "discarded" && new Date(t.updated_at) < twoDaysAgo)
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 10);
  }, [periodFiltered]);

  const fmtMin = (m: number) => m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${m % 60}min`;

  const handlePrintPDF = useCallback(async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const statusLabels: Record<string, string> = {
      backlog: "Backlog", pending: "Pendente", todo: "A Fazer", in_progress: "Em Andamento",
      review: "Em Validação", done: "Concluído", discarded: "Descartado",
    };
    const priorityLabels: Record<string, string> = {
      low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
    };
    const complexityLabels: Record<string, string> = {
      low: "Baixa", medium: "Média", high: "Alta", very_high: "Muito Alta",
    };

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const periodLabel = period === "specific"
      ? `Mês ${specificMonth}`
      : periodLabels[period];

    // Header
    doc.setFontSize(18);
    doc.setTextColor(30, 41, 59);
    doc.text("Relatório de Produtividade", 40, 50);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Período: ${periodLabel}`, 40, 70);
    doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`, 40, 85);
    if (selectedUserId && selectedUserId !== "all") {
      const u = profiles?.find(p => p.id === selectedUserId);
      if (u) doc.text(`Usuário: ${u.full_name || "—"}`, 40, 100);
    }

    // KPIs
    autoTable(doc, {
      startY: 120,
      head: [["Indicador", "Valor"]],
      body: [
        ["Total de Tarefas", String(metrics.total)],
        ["Concluídas", `${metrics.done} (${metrics.completionRate}%)`],
        ["Em Andamento", String(metrics.inProgress)],
        ["Em Validação", String(metrics.review)],
        ["Tarefas Travadas (>2 dias)", String(metrics.stalled)],
        ["Tempo Total Trabalhado", fmtMin(metrics.totalMinutes)],
        ["Tempo Médio por Tarefa", fmtMin(metrics.avgExecMinutes)],
        ["Taxa de Descarte", `${metrics.discardRate}%`],
      ],
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontSize: 10 },
      bodyStyles: { fontSize: 9 },
      margin: { left: 40, right: 40 },
    });

    // Status distribution
    if (statusData.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Status", "Quantidade", "% do Total"]],
        body: statusData.map(s => [
          s.name,
          String(s.value),
          metrics.total > 0 ? `${Math.round((s.value / metrics.total) * 100)}%` : "0%",
        ]),
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 40, right: 40 },
      });
    }

    // Complexity distribution
    const complexityCounts: Record<string, { count: number; minutes: number }> = {};
    periodFiltered.forEach(t => {
      const c = (t as any).complexity || "não definida";
      if (!complexityCounts[c]) complexityCounts[c] = { count: 0, minutes: 0 };
      complexityCounts[c].count++;
      complexityCounts[c].minutes += t.total_minutes || 0;
    });
    const complexityRows = Object.entries(complexityCounts).map(([k, v]) => [
      complexityLabels[k] || k,
      String(v.count),
      fmtMin(v.minutes),
      v.count > 0 ? fmtMin(Math.round(v.minutes / v.count)) : "—",
    ]);
    if (complexityRows.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Complexidade", "Tarefas", "Tempo Total", "Tempo Médio"]],
        body: complexityRows,
        theme: "striped",
        headStyles: { fillColor: [168, 85, 247], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 40, right: 40 },
      });
    }

    // Priority distribution
    const priorityCounts: Record<string, number> = {};
    periodFiltered.forEach(t => {
      const p = t.priority || "medium";
      priorityCounts[p] = (priorityCounts[p] || 0) + 1;
    });
    const priorityRows = Object.entries(priorityCounts).map(([k, v]) => [
      priorityLabels[k] || k,
      String(v),
      metrics.total > 0 ? `${Math.round((v / metrics.total) * 100)}%` : "0%",
    ]);
    if (priorityRows.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Prioridade", "Quantidade", "% do Total"]],
        body: priorityRows,
        theme: "striped",
        headStyles: { fillColor: [234, 88, 12], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 40, right: 40 },
      });
    }

    // Productivity per user
    if (userMetrics.length > 0) {
      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 20,
        head: [["Usuário", "Total", "Concluídas", "Eficiência", "Horas"]],
        body: userMetrics.map(u => [
          u.fullName,
          String(u.total),
          String(u.done),
          `${u.efficiency}%`,
          `${u.hours}h`,
        ]),
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 10 },
        bodyStyles: { fontSize: 9 },
        margin: { left: 40, right: 40 },
      });
    }

    // Detailed task list
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 20,
      head: [["Título", "Status", "Prioridade", "Complex.", "Resp.", "Tempo"]],
      body: periodFiltered.map(t => [
        t.title.length > 50 ? t.title.slice(0, 50) + "…" : t.title,
        statusLabels[t.status] || t.status,
        priorityLabels[t.priority] || t.priority,
        complexityLabels[(t as any).complexity] || "—",
        t.profiles?.full_name?.split(" ")[0] || "—",
        fmtMin(t.total_minutes || 0),
      ]),
      theme: "grid",
      headStyles: { fillColor: [71, 85, 105], textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 8 },
      margin: { left: 40, right: 40 },
    });

    // Footer page numbers
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Página ${i} de ${pageCount}`, pageWidth - 80, doc.internal.pageSize.getHeight() - 20);
    }

    doc.save(`relatorio-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    toast.success("PDF gerado com sucesso!");
  }, [metrics, userMetrics, periodFiltered, statusData, period, specificMonth, selectedUserId, profiles]);

  const handleExportExcel = useCallback(() => {
    const statusLabels: Record<string, string> = {
      backlog: "Backlog", pending: "Pendente", todo: "A Fazer", in_progress: "Em Andamento",
      review: "Em Validação", done: "Concluído", discarded: "Descartado",
    };
    const priorityLabels: Record<string, string> = {
      low: "Baixa", medium: "Média", high: "Alta", urgent: "Urgente",
    };

    // Sheet 1: Indicadores
    const kpiRows = [
      ["Indicador", "Valor"],
      ["Total de Tarefas", metrics.total],
      ["Concluídas", metrics.done],
      ["Taxa de Conclusão (%)", metrics.completionRate],
      ["Em Andamento", metrics.inProgress],
      ["Em Validação", metrics.review],
      ["Tempo Médio de Execução (min)", metrics.avgExecMinutes],
      ["Tempo Total (min)", metrics.totalMinutes],
      ["Taxa de Descarte (%)", metrics.discardRate],
      ["Tarefas Travadas", metrics.stalled],
    ];

    // Sheet 2: Por Usuário
    const userRows = [
      ["Usuário", "Total", "Concluídas", "Eficiência (%)", "Horas Trabalhadas"],
      ...userMetrics.map(u => [u.fullName, u.total, u.done, u.efficiency, u.hours]),
    ];

    // Sheet 3: Tarefas
    const taskRows = [
      ["Título", "Status", "Prioridade", "Responsável", "Tempo (min)", "Criada em", "Atualizada em"],
      ...periodFiltered.map(t => [
        t.title,
        statusLabels[t.status] || t.status,
        priorityLabels[t.priority] || t.priority,
        t.profiles?.full_name || "Sem responsável",
        t.total_minutes || 0,
        format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
        format(new Date(t.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      ]),
    ];

    // Build CSV (Excel-compatible with BOM + semicolons for PT-BR)
    const toCSV = (rows: any[][]) => rows.map(r => r.map(c => `"${c}"`).join(";")).join("\n");
    const bom = "\uFEFF";
    const content = bom + 
      "=== INDICADORES ===\n" + toCSV(kpiRows) + 
      "\n\n=== PRODUTIVIDADE POR USUÁRIO ===\n" + toCSV(userRows) + 
      "\n\n=== LISTA DE TAREFAS ===\n" + toCSV(taskRows);

    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado com sucesso!");
  }, [metrics, userMetrics, periodFiltered]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <PageHeader
          title="Relatórios"
          description="Análise detalhada de produtividade e execução"
          icon={<BarChart3 className="h-5 w-5" />}
        />
        <div className="flex items-center gap-2 flex-wrap">
          {canFilter && (
            <TaskFilterSelect value={selectedUserId} onChange={setSelectedUserId} />
          )}
          <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Semana</SelectItem>
              <SelectItem value="month">Mês</SelectItem>
              <SelectItem value="quarter">Trimestre</SelectItem>
              <SelectItem value="specific">Mês específico</SelectItem>
              <SelectItem value="all">Tudo</SelectItem>
            </SelectContent>
          </Select>
          {period === "specific" && (
            <input
              type="month"
              value={specificMonth}
              onChange={(e) => setSpecificMonth(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
            />
          )}
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handlePrintPDF}>
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PDF</span>
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExportExcel}>
            <FileSpreadsheet className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Excel</span>
          </Button>
        </div>
      </div>

      <div ref={reportRef}>
        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 mb-6">
          {[
            { label: "Total Tarefas", value: metrics.total, icon: Activity, color: "text-primary" },
            { label: "Concluídas", value: `${metrics.done} (${metrics.completionRate}%)`, icon: CheckCircle2, color: "text-success" },
            { label: "Em Andamento", value: metrics.inProgress, icon: TrendingUp, color: "text-primary" },
            { label: "Tempo Médio", value: fmtMin(metrics.avgExecMinutes), icon: Timer, color: "text-warning" },
            { label: "Travadas", value: metrics.stalled, icon: AlertTriangle, color: "text-destructive" },
          ].map(kpi => (
            <Card key={kpi.label} className="shadow-card">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          {/* Status Distribution */}
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

          {/* Weekly evolution */}
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Evolução Semanal
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weeklyEvolution.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={weeklyEvolution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="week" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                    <Line type="monotone" dataKey="criadas" stroke="hsl(230, 80%, 60%)" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="concluídas" stroke="hsl(152, 69%, 40%)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState icon={TrendingUp} title="Sem dados" description="Nenhum dado de evolução." />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Time per user bar chart */}
        <Card className="shadow-card mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Produtividade por Usuário
            </CardTitle>
          </CardHeader>
          <CardContent>
            {userMetrics.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={userMetrics} layout="vertical" margin={{ left: 10 }}>
                    <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={60} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="hours" name="Horas" fill="hsl(230, 80%, 60%)" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {userMetrics.map(u => (
                    <div key={u.name} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-sm font-medium text-foreground">{u.fullName}</p>
                        <p className="text-xs text-muted-foreground">{u.total} tarefas · {u.done} concluídas</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-foreground">{u.efficiency}%</p>
                        <p className="text-[10px] text-muted-foreground">{u.hours}h trabalhadas</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyState icon={Users} title="Sem dados" description="Nenhum dado de usuário." />
            )}
          </CardContent>
        </Card>

        {/* Stalled tasks */}
        {stalledTasks.length > 0 && (
          <Card className="shadow-card border-destructive/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                Tarefas Travadas ({stalledTasks.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stalledTasks.map(t => {
                  const daysSinceUpdate = Math.floor((Date.now() - new Date(t.updated_at).getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={t.id} className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {t.profiles?.full_name || "Sem responsável"} · {COLUMNS.find(c => c.status === t.status)?.title}
                        </p>
                      </div>
                      <span className="text-xs text-destructive font-medium shrink-0 ml-2">
                        {daysSinceUpdate} dia{daysSinceUpdate !== 1 ? "s" : ""} parada
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Reports;
