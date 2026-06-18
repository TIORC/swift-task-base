import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  LifeBuoy, CheckCircle2, Clock, AlertTriangle, Users, Loader2, Wrench, GitCompareArrows, Tag, UserCheck, Printer,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { subDays, subMonths, differenceInMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  SUPPORT_REAL_REASONS, ALL_SUPPORT_TAGS, INITIAL_CATEGORIES, extractInitialCategory,
} from "@/lib/support-reasons";

const PIE_COLORS = [
  "hsl(230,80%,60%)", "hsl(38,92%,50%)", "hsl(152,69%,40%)", "hsl(0,72%,51%)",
  "hsl(262,83%,58%)", "hsl(199,89%,48%)", "hsl(20,90%,55%)",
];
const tooltipStyle = {
  backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
  borderRadius: "12px", color: "hsl(var(--foreground))", fontSize: "12px",
};

type Period = "week" | "month" | "quarter" | "all";

function extractRequester(description: string | null): string {
  if (!description) return "";
  const m = description.match(/\*\*Solicitante:\*\*\s*(.+)/);
  return m?.[1]?.trim() || "";
}

const fmtMin = (m: number) => (m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${m % 60}min`);

export function SupportReport() {
  const [period, setPeriod] = useState<Period>("month");
  const [requesterFilter, setRequesterFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["support-report"],
    queryFn: async () => {
      const [tasksRes, profilesRes] = await Promise.all([
        supabase.from("tasks").select("*").like("title", "[Chamado]%"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return { tasks: tasksRes.data || [], profiles: profilesRes.data || [] };
    },
  });

  const profileName = (id: string | null | undefined) =>
    (id && data?.profiles.find((p) => p.id === id)?.full_name) || "—";

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    let cutoff: Date | null = null;
    if (period === "week") cutoff = subDays(now, 7);
    else if (period === "month") cutoff = subMonths(now, 1);
    else if (period === "quarter") cutoff = subMonths(now, 3);
    return data.tasks.filter((t: any) => {
      if (cutoff && new Date(t.created_at) < cutoff) return false;
      if (requesterFilter !== "all") {
        const req = extractRequester(t.description) || profileName(t.created_by);
        if (req !== requesterFilter) return false;
      }
      if (categoryFilter !== "all" && extractInitialCategory(t.title) !== categoryFilter) return false;
      if (reasonFilter !== "all" && t.support_real_reason !== reasonFilter) return false;
      if (tagFilter !== "all" && !(t.support_tags ?? []).includes(tagFilter)) return false;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [data, period, requesterFilter, categoryFilter, reasonFilter, tagFilter, assigneeFilter, statusFilter]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((t: any) => t.status === "done").length;
    const pending = filtered.filter((t: any) => !["done", "discarded"].includes(t.status)).length;
    const inProgress = filtered.filter((t: any) => t.status === "in_progress").length;
    const resolved = filtered.filter((t: any) => t.status === "done");
    const avg = resolved.length
      ? Math.round(
          resolved.reduce(
            (s: number, t: any) =>
              s + differenceInMinutes(new Date(t.closed_at || t.updated_at), new Date(t.created_at)),
            0
          ) / resolved.length
        )
      : 0;
    return {
      total, done, pending, inProgress, avg,
      rate: total ? Math.round((done / total) * 100) : 0,
    };
  }, [filtered]);

  const requesters = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => {
      const name = extractRequester(t.description) || profileName(t.created_by);
      if (!name || name === "—") return;
      map.set(name, (map.get(name) || 0) + 1);
    });
    return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filtered, data]);

  const reasonCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => {
      const k = t.support_real_reason || "Não informado";
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const tagCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => (t.support_tags ?? []).forEach((tg: string) => map.set(tg, (map.get(tg) || 0) + 1)));
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12);
  }, [filtered]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => {
      const k = extractInitialCategory(t.title);
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Comparativo: categoria inicial x motivo real
  const comparison = useMemo(() => {
    const rows: { initial: string; reason: string; count: number }[] = [];
    const map = new Map<string, number>();
    filtered.forEach((t: any) => {
      const initial = extractInitialCategory(t.title);
      const reason = t.support_real_reason || "Não informado";
      const key = `${initial}|||${reason}`;
      map.set(key, (map.get(key) || 0) + 1);
    });
    map.forEach((count, key) => {
      const [initial, reason] = key.split("|||");
      rows.push({ initial, reason, count });
    });
    return rows.sort((a, b) => b.count - a.count);
  }, [filtered]);

  const assigneeCounts = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => {
      if (!t.assigned_to) return;
      map.set(t.assigned_to, (map.get(t.assigned_to) || 0) + 1);
    });
    return [...map.entries()]
      .map(([uid, count]) => ({ name: profileName(uid), count }))
      .sort((a, b) => b.count - a.count);
  }, [filtered, data]);

  // Tabela por colaborador
  const perRequester = useMemo(() => {
    const map = new Map<string, { name: string; total: number; reasons: Map<string, number>; tags: Map<string, number>; durations: number[]; last: Date }>();
    filtered.forEach((t: any) => {
      const name = extractRequester(t.description) || profileName(t.created_by);
      if (!name || name === "—") return;
      const entry = map.get(name) || { name, total: 0, reasons: new Map(), tags: new Map(), durations: [], last: new Date(t.created_at) };
      entry.total++;
      if (t.support_real_reason) entry.reasons.set(t.support_real_reason, (entry.reasons.get(t.support_real_reason) || 0) + 1);
      (t.support_tags ?? []).forEach((tg: string) => entry.tags.set(tg, (entry.tags.get(tg) || 0) + 1));
      if (t.status === "done") entry.durations.push(differenceInMinutes(new Date(t.closed_at || t.updated_at), new Date(t.created_at)));
      const createdAt = new Date(t.created_at);
      if (createdAt > entry.last) entry.last = createdAt;
      map.set(name, entry);
    });
    return [...map.values()]
      .map((e) => ({
        name: e.name,
        total: e.total,
        reasons: [...e.reasons.entries()].sort((a, b) => b[1] - a[1]),
        tags: [...e.tags.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4),
        avg: e.durations.length ? Math.round(e.durations.reduce((s, x) => s + x, 0) / e.durations.length) : 0,
        last: e.last,
      }))
      .sort((a, b) => b.total - a.total);
  }, [filtered, data]);

  const requesterOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.tasks.forEach((t: any) => {
      const name = extractRequester(t.description) || profileName(t.created_by);
      if (name && name !== "—") set.add(name);
    });
    return [...set].sort();
  }, [data]);

  const assigneeOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.tasks.forEach((t: any) => t.assigned_to && set.add(t.assigned_to));
    return [...set].map((id) => ({ id, name: profileName(id) })).sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  if (isLoading)
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="shadow-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={requesterFilter} onValueChange={setRequesterFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Solicitante" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos solicitantes</SelectItem>
                {requesterOptions.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[170px] h-9 text-xs"><SelectValue placeholder="Categoria inicial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {INITIAL_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={reasonFilter} onValueChange={setReasonFilter}>
              <SelectTrigger className="w-[200px] h-9 text-xs"><SelectValue placeholder="Motivo real" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos motivos</SelectItem>
                {SUPPORT_REAL_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="w-[170px] h-9 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todas tags</SelectItem>
                {ALL_SUPPORT_TAGS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Responsável TI" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos responsáveis</SelectItem>
                {assigneeOptions.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em andamento</SelectItem>
                <SelectItem value="review">Em validação</SelectItem>
                <SelectItem value="done">Concluído</SelectItem>
                <SelectItem value="discarded">Descartado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total chamados", value: kpis.total, icon: LifeBuoy, color: "text-primary" },
          { label: "Resolvidos", value: `${kpis.done} (${kpis.rate}%)`, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Em andamento", value: kpis.inProgress, icon: Clock, color: "text-blue-500" },
          { label: "Pendentes", value: kpis.pending, icon: AlertTriangle, color: "text-amber-500" },
          { label: "Tempo médio", value: fmtMin(kpis.avg), icon: Clock, color: "text-indigo-500" },
        ].map((k) => (
          <Card key={k.label} className="shadow-card">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">{k.label}</span>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
              <p className="text-2xl font-bold">{k.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Motivos reais + Tags */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-500" />Motivos reais identificados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {reasonCounts.length === 0 ? (
              <EmptyState icon={Wrench} title="Sem dados" description="Nenhum chamado concluído com motivo real ainda." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={reasonCounts} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" stroke="none" label={(e) => `${e.name}: ${e.value}`}>
                    {reasonCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Tag className="h-4 w-4 text-indigo-500" />Tags mais recorrentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tagCounts.length === 0 ? (
              <EmptyState icon={Tag} title="Sem tags registradas" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={tagCounts} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={110} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="hsl(262,83%,58%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Categoria inicial x Motivo real */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <GitCompareArrows className="h-4 w-4 text-primary" />
            Categoria inicial × Motivo real
          </CardTitle>
        </CardHeader>
        <CardContent>
          {comparison.length === 0 ? (
            <EmptyState icon={GitCompareArrows} title="Sem comparativos" />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={categoryCounts}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" name="Categoria inicial" fill="hsl(230,80%,60%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div className="overflow-auto max-h-[260px] rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Categoria inicial</TableHead>
                      <TableHead className="text-xs">Motivo real</TableHead>
                      <TableHead className="text-xs text-right">Qtd</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comparison.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs capitalize">{row.initial}</TableCell>
                        <TableCell className="text-xs">{row.reason}</TableCell>
                        <TableCell className="text-xs text-right font-semibold">{row.count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solicitantes + Responsáveis TI */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />Colaboradores que mais solicitaram
            </CardTitle>
          </CardHeader>
          <CardContent>
            {requesters.length === 0 ? <EmptyState icon={Users} title="Sem dados" /> : (
              <div className="space-y-2">
                {requesters.slice(0, 10).map((u, i) => {
                  const max = requesters[0].count;
                  return (
                    <div key={u.name} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                      <span className="text-sm font-medium flex-1 truncate">{u.name}</span>
                      <Progress value={(u.count / max) * 100} className="h-1.5 w-32" />
                      <span className="text-sm font-bold w-8 text-right">{u.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-emerald-500" />Responsáveis TI por atendimento
            </CardTitle>
          </CardHeader>
          <CardContent>
            {assigneeCounts.length === 0 ? <EmptyState icon={UserCheck} title="Sem dados" /> : (
              <div className="space-y-2">
                {assigneeCounts.slice(0, 10).map((u, i) => {
                  const max = assigneeCounts[0].count;
                  return (
                    <div key={u.name + i} className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground w-6">{i + 1}</span>
                      <span className="text-sm font-medium flex-1 truncate">{u.name}</span>
                      <Progress value={(u.count / max) * 100} className="h-1.5 w-32" />
                      <span className="text-sm font-bold w-8 text-right">{u.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento por colaborador */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />Detalhamento por colaborador
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {perRequester.length === 0 ? (
            <div className="p-6"><EmptyState icon={Users} title="Sem dados" /></div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Colaborador</TableHead>
                    <TableHead className="text-xs text-center">Total</TableHead>
                    <TableHead className="text-xs">Motivos reais</TableHead>
                    <TableHead className="text-xs">Tags mais frequentes</TableHead>
                    <TableHead className="text-xs text-right">Tempo médio</TableHead>
                    <TableHead className="text-xs text-right">Último chamado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perRequester.map((r) => (
                    <TableRow key={r.name}>
                      <TableCell className="text-sm font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-center">{r.total}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.reasons.length === 0
                            ? <span className="text-xs text-muted-foreground">—</span>
                            : r.reasons.map(([reason, count]) => (
                                <Badge key={reason} variant="secondary" className="text-[10px]">{reason}: {count}</Badge>
                              ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {r.tags.length === 0
                            ? <span className="text-xs text-muted-foreground">—</span>
                            : r.tags.map(([tag, count]) => (
                                <Badge key={tag} variant="outline" className="text-[10px]">{tag}: {count}</Badge>
                              ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-right">{r.avg ? fmtMin(r.avg) : "—"}</TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground">
                        {format(r.last, "dd/MM/yy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
