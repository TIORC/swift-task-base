import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useSmPosts, useSmClients, useSmTasks } from "@/hooks/useSocial";
import { useSmTimeTotals, useSmChecklistProgress, formatMinutes } from "@/hooks/useSmTaskExtras";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { isOverdue } from "@/lib/dates";
import { SM_NATURE_LABEL, type SmNature } from "@/lib/sm-demands";
import { SM_POST_STATUS_LABEL, SM_POST_STATUS_ORDER } from "@/types/social";
import { BarChart3, FileDown, FileSpreadsheet } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateRange } from "react-day-picker";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
};

type PeriodFilter = "week" | "month" | "quarter" | "specific" | "year" | "day" | "custom" | "all";

type TaskStatusFilter = "all" | "concluido" | "pendente" | "atrasada" | "backlog" | "em_andamento";

const TASK_STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", pendente: "Pendente", em_andamento: "Em andamento",
  concluido: "Concluído", descartado: "Descartado",
};

const isTaskOverdue = (t: any) =>
  !!t.due_date && !["concluido", "descartado"].includes(t.status) && isOverdue(t.due_date);

const matchesTaskStatus = (t: any, filter: TaskStatusFilter) => {
  if (filter === "all") return true;
  if (filter === "atrasada") return isTaskOverdue(t);
  return t.status === filter;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addOneDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

export default function SocialReports() {
  const { data: posts } = useSmPosts();
  const { data: clients } = useSmClients();
  const { data: tasks } = useSmTasks();
  const { byTask: minutesByTask } = useSmTimeTotals();
  const { byTask: checklistByTask } = useSmChecklistProgress();
  const { data: profiles } = useSocialAssignableProfiles();
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [specificMonth, setSpecificMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [specificYear, setSpecificYear] = useState<string>(() => String(new Date().getFullYear()));
  const [specificDay, setSpecificDay] = useState<Date | undefined>();
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [clientId, setClientId] = useState<string>("all");
  const [collaboratorId, setCollaboratorId] = useState<string>("all");
  const [taskStatus, setTaskStatus] = useState<TaskStatusFilter>("all");

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "week":
        return { start: new Date(now.getTime() - 7 * 86400000), end: null as Date | null };
      case "month":
        return { start: new Date(now.getTime() - 30 * 86400000), end: null as Date | null };
      case "quarter":
        return { start: new Date(now.getTime() - 90 * 86400000), end: null as Date | null };
      case "specific": {
        const [y, m] = specificMonth.split("-").map(Number);
        return { start: new Date(y, m - 1, 1), end: new Date(y, m, 1) };
      }
      case "year": {
        const y = Number(specificYear);
        return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1) };
      }
      case "day":
        return specificDay
          ? { start: startOfDay(specificDay), end: addOneDay(specificDay) }
          : { start: null, end: null };
      case "custom":
        return {
          start: customRange?.from ? startOfDay(customRange.from) : null,
          end: customRange?.to ? addOneDay(customRange.to) : null,
        };
      default:
        return { start: null, end: null };
    }
  }, [period, specificMonth, specificYear, specificDay, customRange]);

  const filtered = useMemo(() => {
    const { start, end } = dateRange;
    return posts.filter((p) => {
      const created = new Date(p.created_at);
      if (start && created < start) return false;
      if (end && created >= end) return false;
      if (clientId !== "all" && p.client_id !== clientId) return false;
      if (collaboratorId !== "all") {
        if (collaboratorId === "none" ? !!p.assigned_to : p.assigned_to !== collaboratorId) return false;
      }
      return true;
    });
  }, [posts, dateRange, clientId, collaboratorId]);

  const byStatus = useMemo(
    () => SM_POST_STATUS_ORDER.map((s) => ({
      name: SM_POST_STATUS_LABEL[s],
      value: filtered.filter((p) => p.status === s).length,
    })).filter((x) => x.value > 0),
    [filtered]
  );

  const byClient = useMemo(
    () => clients.map((c) => ({
      name: c.name,
      total: filtered.filter((p) => p.client_id === c.id).length,
      publicados: filtered.filter((p) => p.client_id === c.id && p.status === "publicado").length,
    })).filter((x) => x.total > 0),
    [filtered, clients]
  );

  // ---- Tarefas: por colaborador, por cliente e por natureza (com horas) ----
  const tasksFiltered = useMemo(() => {
    const { start, end } = dateRange;
    return (tasks ?? []).filter((t: any) => {
      if (t.is_recurring_template) return false;
      const created = new Date(t.created_at);
      if (start && created < start) return false;
      if (end && created >= end) return false;
      if (clientId !== "all" && t.client_id !== clientId) return false;
      if (collaboratorId !== "all") {
        if (collaboratorId === "none" ? !!t.assigned_to : t.assigned_to !== collaboratorId) return false;
      }
      return true;
    });
  }, [tasks, dateRange, clientId, collaboratorId]);

  const minutesOf = (t: any) => minutesByTask[t.id] ?? 0;
  const checklistOf = (t: any) => checklistByTask[t.id];

  const byCollaborator = useMemo(() => {
    const map: Record<string, { name: string; total: number; done: number; minutes: number; checkTotal: number; checkDone: number }> = {};
    tasksFiltered.forEach((t: any) => {
      const key = t.assigned_to ?? "none";
      const name = key === "none"
        ? "Sem responsável"
        : (profiles?.find((p: any) => p.id === key)?.full_name || "Usuário");
      const e = map[key] ?? { name, total: 0, done: 0, minutes: 0, checkTotal: 0, checkDone: 0 };
      e.total++;
      if (t.status === "concluido") e.done++;
      e.minutes += minutesOf(t);
      const cl = checklistOf(t);
      if (cl) { e.checkTotal += cl.total; e.checkDone += cl.done; }
      map[key] = e;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [tasksFiltered, profiles, minutesByTask, checklistByTask]);

  const byTaskClient = useMemo(() => {
    const map: Record<string, { name: string; total: number; done: number; minutes: number }> = {};
    tasksFiltered.forEach((t: any) => {
      const key = t.client_id ?? "none";
      const name = key === "none" ? "Sem cliente" : (clients.find((c) => c.id === key)?.name ?? "Cliente");
      const e = map[key] ?? { name, total: 0, done: 0, minutes: 0 };
      e.total++;
      if (t.status === "concluido") e.done++;
      e.minutes += minutesOf(t);
      map[key] = e;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [tasksFiltered, clients, minutesByTask]);

  const byNature = useMemo(() => {
    const map: Record<string, { name: string; total: number; minutes: number }> = {};
    tasksFiltered.forEach((t: any) => {
      const key = (t.nature ?? "avulsa") as SmNature;
      const e = map[key] ?? { name: SM_NATURE_LABEL[key] ?? key, total: 0, minutes: 0 };
      e.total++;
      e.minutes += minutesOf(t);
      map[key] = e;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [tasksFiltered, minutesByTask]);

  const totalMinutes = tasksFiltered.reduce((s: number, t: any) => s + minutesOf(t), 0);

  const collaboratorName = collaboratorId === "all"
    ? ""
    : collaboratorId === "none"
      ? "Sem responsável"
      : (profiles?.find((p: any) => p.id === collaboratorId)?.full_name ?? "Usuário");

  const collaboratorStats = useMemo(() => {
    const concluidas = tasksFiltered.filter((t: any) => t.status === "concluido").length;
    const emAndamento = tasksFiltered.filter((t: any) => t.status === "em_andamento").length;
    const atrasadas = tasksFiltered.filter((t: any) =>
      t.due_date && !["concluido", "descartado"].includes(t.status) && isOverdue(t.due_date)
    ).length;
    const checkTotal = tasksFiltered.reduce((s: number, t: any) => s + (checklistOf(t)?.total ?? 0), 0);
    const checkDone = tasksFiltered.reduce((s: number, t: any) => s + (checklistOf(t)?.done ?? 0), 0);
    return { concluidas, emAndamento, atrasadas, checkTotal, checkDone };
  }, [tasksFiltered, checklistByTask]);

  const collaboratorTaskRows = useMemo(() => {
    return tasksFiltered
      .filter((t: any) => matchesTaskStatus(t, taskStatus))
      .map((t: any) => {
        const cl = checklistOf(t);
        return {
          id: t.id,
          title: t.title,
          client: t.client_id ? (clients.find((c) => c.id === t.client_id)?.name ?? "—") : "—",
          status: TASK_STATUS_LABEL[t.status] ?? t.status,
          overdue: !!t.due_date && !["concluido", "descartado"].includes(t.status) && isOverdue(t.due_date),
          due_date: t.due_date,
          checkTotal: cl?.total ?? 0,
          checkDone: cl?.done ?? 0,
          minutes: minutesOf(t),
        };
      })
      .sort((a: any, b: any) => {
        if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
        return b.minutes - a.minutes;
      });
  }, [tasksFiltered, clients, checklistByTask, minutesByTask, taskStatus]);


  const exportCSV = () => {
    const header = "Título,Cliente,Status,Prioridade,Agendado em,Criado em\n";
    const rows = filtered.map((p) => {
      const client = clients.find((c) => c.id === p.client_id)?.name ?? "";
      return [
        p.title.replace(/,/g, " "),
        client.replace(/,/g, " "),
        SM_POST_STATUS_LABEL[p.status],
        p.priority,
        p.scheduled_at ?? "",
        p.created_at,
      ].join(",");
    }).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `social-relatorio-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  const total = filtered.length;
  const publicados = filtered.filter((p) => p.status === "publicado").length;
  const aprovacaoCliente = filtered.filter((p) => p.status === "aprovacao_cliente").length;
  const tarefasAbertas = tasksFiltered.filter((t: any) => t.status !== "concluido" && t.status !== "descartado").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios — Social Media"
        description="Análise de produção e performance"
        icon={<BarChart3 className="h-6 w-6" />}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-1.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileDown className="h-4 w-4 mr-1.5" /> Imprimir
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Select value={period} onValueChange={(v) => setPeriod(v as PeriodFilter)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mês (últimos 30 dias)</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="specific">Mês</SelectItem>
            <SelectItem value="year">Ano</SelectItem>
            <SelectItem value="day">Dia</SelectItem>
            <SelectItem value="custom">Personalizado</SelectItem>
            <SelectItem value="all">Todo período</SelectItem>
          </SelectContent>
        </Select>
        {period === "specific" && (
          <input
            type="month"
            value={specificMonth}
            onChange={(e) => setSpecificMonth(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        )}
        {period === "year" && (
          <Select value={specificYear} onValueChange={setSpecificYear}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Ano" /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }, (_, i) => String(new Date().getFullYear() - i)).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {period === "day" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {specificDay ? format(specificDay, "dd/MM/yyyy", { locale: ptBR }) : "Selecionar dia"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={specificDay} onSelect={setSpecificDay} locale={ptBR} initialFocus />
            </PopoverContent>
          </Popover>
        )}
        {period === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-10 gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {customRange?.from || customRange?.to
                  ? `${customRange.from ? format(customRange.from, "dd/MM/yyyy", { locale: ptBR }) : "..."} — ${customRange.to ? format(customRange.to, "dd/MM/yyyy", { locale: ptBR }) : "..."}`
                  : "De — Até"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <div className="space-y-3">
                <Calendar
                  mode="range"
                  selected={customRange}
                  onSelect={setCustomRange}
                  locale={ptBR}
                />
                {customRange?.from || customRange?.to ? (
                  <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setCustomRange(undefined)}>
                    Limpar período
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground text-center">Primeiro clique: início · segundo clique: fim</p>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={collaboratorId} onValueChange={setCollaboratorId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Colaborador" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os colaboradores</SelectItem>
            {profiles?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
            <SelectItem value="none">Sem responsável</SelectItem>
          </SelectContent>
        </Select>
        <Select value={taskStatus} onValueChange={(v) => setTaskStatus(v as TaskStatusFilter)}>
          <SelectTrigger className="w-52"><SelectValue placeholder="Status da tarefa" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as tarefas</SelectItem>
            <SelectItem value="concluido">Concluídas</SelectItem>
            <SelectItem value="atrasada">Atrasadas</SelectItem>
            <SelectItem value="backlog">Em backlog</SelectItem>
            <SelectItem value="em_andamento">Em andamento</SelectItem>
            <SelectItem value="pendente">Pendentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          ...(collaboratorId === "all"
            ? [
                { label: "Posts no período", value: total },
                { label: "Publicados", value: publicados },
                { label: "Aguardando cliente", value: aprovacaoCliente },
              ]
            : []),
          { label: "Tarefas abertas", value: tarefasAbertas },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">{s.label}</div>
              <div className="text-2xl font-bold mt-1">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {collaboratorId === "all" && (
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por status</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {byStatus.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} label={{ fontSize: 12, fill: "hsl(var(--foreground))" }} labelLine={{ stroke: "hsl(var(--muted-foreground))" }} stroke="#000000" strokeWidth={1.5}>
                    {byStatus.map((d, i) => <Cell key={i} fill={d.name === "Ideia" ? "hsl(210, 100%, 70%)" : d.name === "Roteiro" ? "hsl(45, 100%, 55%)" : d.name === "Publicado" ? "hsl(152, 69%, 55%)" : "hsl(150, 50%, 10%)"} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: "hsl(var(--card-foreground))", fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Posts por cliente</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {byClient.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer>
                <BarChart data={byClient}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} stroke="hsl(var(--border))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ color: "hsl(var(--foreground))", fontSize: 12 }} />
                  <Bar dataKey="total" fill="hsl(210, 100%, 70%)" stroke="hsl(210, 100%, 60%)" strokeWidth={1.5} name="Total" />
                  <Bar dataKey="publicados" fill="hsl(152, 69%, 40%)" name="Publicados" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Tarefas por colaborador · {formatMinutes(totalMinutes)} no período
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-medium">Colaborador</th>
                <th className="px-4 py-2 font-medium">Tarefas</th>
                <th className="px-4 py-2 font-medium">Concluídas</th>
                <th className="px-4 py-2 font-medium">Checklist</th>
                <th className="px-4 py-2 font-medium">Horas</th>
              </tr>
            </thead>
            <tbody>
              {byCollaborator.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-4 text-muted-foreground">Sem dados no período.</td></tr>
              )}
              {byCollaborator.map((r) => (
                <tr key={r.name} className="border-b border-border/50 last:border-0">
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{r.total}</td>
                  <td className="px-4 py-2">{r.done}</td>
                  <td className="px-4 py-2">
                    {r.checkTotal === 0
                      ? <span className="text-muted-foreground">—</span>
                      : <span className={r.checkDone === r.checkTotal ? "text-emerald-400" : ""}>
                          {r.checkDone}/{r.checkTotal}
                        </span>}
                  </td>
                  <td className="px-4 py-2">{formatMinutes(r.minutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {collaboratorId !== "all" && (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { label: "Tarefas concluídas", value: collaboratorStats.concluidas, color: "text-emerald-400" },
              { label: "Em andamento", value: collaboratorStats.emAndamento, color: "" },
              { label: "Em atraso", value: collaboratorStats.atrasadas, color: "text-destructive" },
              { label: "Horas no período", value: formatMinutes(tasksFiltered.reduce((s: number, t: any) => s + minutesOf(t), 0)), color: "" },
            ].map((s) => (
              <Card key={s.label}>
                <CardContent className="pt-6">
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                  <div className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Detalhes do colaborador · {collaboratorName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Checklists preenchidos das tarefas no período</span>
                  <span>{collaboratorStats.checkDone}/{collaboratorStats.checkTotal} ({collaboratorStats.checkTotal ? Math.round((collaboratorStats.checkDone / collaboratorStats.checkTotal) * 100) : 0}%)</span>
                </div>
                <Progress value={collaboratorStats.checkTotal ? Math.round((collaboratorStats.checkDone / collaboratorStats.checkTotal) * 100) : 0} />
              </div>

              {collaboratorTaskRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem tarefas no período.</p>
              ) : (
                <div className="border rounded-lg">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                        <th className="px-4 py-2 font-medium">Tarefa</th>
                        <th className="px-4 py-2 font-medium">Cliente</th>
                        <th className="px-4 py-2 font-medium">Status</th>
                        <th className="px-4 py-2 font-medium">Prazo</th>
                        <th className="px-4 py-2 font-medium">Checklist</th>
                        <th className="px-4 py-2 font-medium">Horas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collaboratorTaskRows.map((r: any) => (
                        <tr key={r.id} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              {r.overdue && <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />}
                              <span className={r.overdue ? "text-destructive" : ""}>{r.title}</span>
                            </div>
                          </td>
                          <td className="px-4 py-2">{r.client}</td>
                          <td className="px-4 py-2">{r.status}</td>
                          <td className="px-4 py-2">{r.due_date ? r.due_date.slice(0, 10) : "—"}</td>
                          <td className="px-4 py-2">
                            {r.checkTotal === 0
                              ? <span className="text-muted-foreground">—</span>
                              : <span className={r.checkDone === r.checkTotal ? "text-emerald-400" : ""}>
                                  {r.checkDone}/{r.checkTotal}
                                </span>}
                          </td>
                          <td className="px-4 py-2">{formatMinutes(r.minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Tarefas por cliente</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">Cliente</th>
                  <th className="px-4 py-2 font-medium">Tarefas</th>
                  <th className="px-4 py-2 font-medium">Concluídas</th>
                  <th className="px-4 py-2 font-medium">Horas</th>
                </tr>
              </thead>
              <tbody>
                {byTaskClient.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-4 text-muted-foreground">Sem dados no período.</td></tr>
                )}
                {byTaskClient.map((r) => (
                  <tr key={r.name} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2">{r.total}</td>
                    <td className="px-4 py-2">{r.done}</td>
                    <td className="px-4 py-2">{formatMinutes(r.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Tarefas por natureza</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-medium">Natureza</th>
                  <th className="px-4 py-2 font-medium">Tarefas</th>
                  <th className="px-4 py-2 font-medium">Horas</th>
                </tr>
              </thead>
              <tbody>
                {byNature.length === 0 && (
                  <tr><td colSpan={3} className="px-4 py-4 text-muted-foreground">Sem dados no período.</td></tr>
                )}
                {byNature.map((r) => (
                  <tr key={r.name} className="border-b border-border/50 last:border-0">
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2">{r.total}</td>
                    <td className="px-4 py-2">{formatMinutes(r.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
