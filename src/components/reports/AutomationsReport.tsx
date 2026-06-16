import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, CheckCircle2, Clock, AlertTriangle, Building2, Loader2, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { subDays, subMonths } from "date-fns";
import { SECTORS, SECTOR_COLORS, SECTOR_LABELS } from "@/types/sectors";
import { STATUS_LABELS } from "@/types/automation";

const PIE_COLORS = ["hsl(230,80%,60%)", "hsl(38,92%,50%)", "hsl(152,69%,40%)", "hsl(0,72%,51%)", "hsl(262,83%,58%)", "hsl(199,89%,48%)", "hsl(220,9%,46%)"];
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--foreground))", fontSize: "12px" };

type Period = "week" | "month" | "quarter" | "all";

export function AutomationsReport() {
  const [period, setPeriod] = useState<Period>("month");
  const [sector, setSector] = useState<string>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["automations-report"],
    queryFn: async () => {
      const [autosRes, timeRes, profilesRes] = await Promise.all([
        supabase.from("automations").select("*"),
        supabase.from("automation_time_logs").select("automation_id, user_id, duration_minutes"),
        supabase.from("profiles").select("id, full_name"),
      ]);
      return {
        autos: autosRes.data || [],
        times: timeRes.data || [],
        profiles: profilesRes.data || [],
      };
    },
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    let cutoff: Date | null = null;
    if (period === "week") cutoff = subDays(now, 7);
    else if (period === "month") cutoff = subMonths(now, 1);
    else if (period === "quarter") cutoff = subMonths(now, 3);
    return data.autos.filter((a: any) => {
      if (cutoff && new Date(a.created_at) < cutoff) return false;
      if (sector !== "all" && a.sector !== sector) return false;
      return true;
    });
  }, [data, period, sector]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((a: any) => a.status === "completed").length;
    const blocked = filtered.filter((a: any) => a.status === "blocked").length;
    const pending = filtered.filter((a: any) => ["homologation", "waiting_user"].includes(a.status)).length;
    const inProgress = filtered.filter((a: any) => ["analysis", "development", "internal_testing"].includes(a.status)).length;
    const ids = new Set(filtered.map((a: any) => a.id));
    const minutes = (data?.times || []).filter((t: any) => ids.has(t.automation_id)).reduce((s: number, t: any) => s + (t.duration_minutes || 0), 0);
    return { total, done, blocked, pending, inProgress, minutes, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [filtered, data]);

  const byStatus = useMemo(() =>
    Object.entries(filtered.reduce((acc: any, a: any) => { acc[a.status] = (acc[a.status] || 0) + 1; return acc; }, {}))
      .map(([k, v]) => ({ name: STATUS_LABELS[k as keyof typeof STATUS_LABELS] || k, value: v as number }))
      .filter((d) => d.value > 0)
  , [filtered]);

  const bySector = useMemo(() => {
    const map: Record<string, { total: number; done: number; minutes: number }> = {};
    const ids = new Map(filtered.map((a: any) => [a.id, a.sector || "—"]));
    filtered.forEach((a: any) => {
      const s = a.sector || "—";
      if (!map[s]) map[s] = { total: 0, done: 0, minutes: 0 };
      map[s].total++;
      if (a.status === "completed") map[s].done++;
    });
    (data?.times || []).forEach((t: any) => {
      const s = ids.get(t.automation_id);
      if (s && map[s]) map[s].minutes += t.duration_minutes || 0;
    });
    return Object.entries(map).map(([sector, m]) => ({ sector, ...m, hours: Math.round(m.minutes / 60 * 10) / 10 })).sort((a, b) => b.total - a.total);
  }, [filtered, data]);

  const byOwner = useMemo(() => {
    if (!data) return [];
    const map: Record<string, { total: number; done: number; minutes: number }> = {};
    filtered.forEach((a: any) => {
      if (!a.owner_id) return;
      if (!map[a.owner_id]) map[a.owner_id] = { total: 0, done: 0, minutes: 0 };
      map[a.owner_id].total++;
      if (a.status === "completed") map[a.owner_id].done++;
    });
    const ids = new Map(filtered.map((a: any) => [a.id, a.owner_id]));
    data.times.forEach((t: any) => {
      const owner = ids.get(t.automation_id);
      if (owner && map[owner]) map[owner].minutes += t.duration_minutes || 0;
    });
    return Object.entries(map).map(([uid, m]) => {
      const p = data.profiles.find((p: any) => p.id === uid);
      return { name: p?.full_name?.split(" ")[0] || "N/A", fullName: p?.full_name || "Sem nome", ...m, hours: Math.round(m.minutes / 60 * 10) / 10 };
    }).sort((a, b) => b.done - a.done);
  }, [filtered, data]);

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const fmtH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Semana</SelectItem>
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="all">Tudo</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-[160px] h-9 text-xs"><SelectValue placeholder="Setor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os setores</SelectItem>
            {SECTORS.map((s) => <SelectItem key={s} value={s}>{SECTOR_LABELS[s] || s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: "Total", value: kpis.total, icon: Bot, color: "text-primary" },
          { label: "Concluídas", value: `${kpis.done} (${kpis.rate}%)`, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Em andamento", value: kpis.inProgress, icon: TrendingUp, color: "text-blue-500" },
          { label: "Pendentes", value: kpis.pending, icon: AlertTriangle, color: "text-amber-500" },
          { label: "Horas totais", value: fmtH(kpis.minutes), icon: Clock, color: "text-purple-500" },
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por status</CardTitle></CardHeader>
          <CardContent>
            {byStatus.length === 0 ? <EmptyState icon={Bot} title="Sem dados" /> : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={byStatus} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value" stroke="none">
                      {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 mt-2">
                  {byStatus.map((d, i) => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="h-2 w-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-semibold">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Setores</CardTitle></CardHeader>
          <CardContent>
            {bySector.length === 0 ? <EmptyState icon={Building2} title="Sem dados" /> : (
              <div className="space-y-2">
                {bySector.map((s) => {
                  const rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
                  return (
                    <div key={s.sector} className="p-2.5 rounded-lg bg-muted/30">
                      <div className="flex items-center justify-between mb-1.5">
                        <Badge variant="outline" className={SECTOR_COLORS[s.sector] || ""}>{SECTOR_LABELS[s.sector] || s.sector}</Badge>
                        <span className="text-xs text-muted-foreground">{s.done}/{s.total} · {s.hours}h</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Progress value={rate} className="h-1.5 flex-1" />
                        <span className="text-xs font-semibold w-10 text-right">{rate}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Automações por responsável</CardTitle></CardHeader>
        <CardContent>
          {byOwner.length === 0 ? <EmptyState icon={Bot} title="Sem dados" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={byOwner}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="done" name="Concluídas" fill="hsl(152,69%,40%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="hsl(230,80%,60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
