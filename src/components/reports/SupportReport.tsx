import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { LifeBuoy, CheckCircle2, Clock, AlertTriangle, Users, Loader2, Monitor, Wrench } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { subDays, subMonths, differenceInMinutes } from "date-fns";

const PIE_COLORS = ["hsl(230,80%,60%)", "hsl(38,92%,50%)", "hsl(152,69%,40%)", "hsl(0,72%,51%)", "hsl(262,83%,58%)", "hsl(199,89%,48%)"];
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--foreground))", fontSize: "12px" };

type Period = "week" | "month" | "quarter" | "all";

// Heuristic detectors based on title / description for hardware & systems
const HARDWARE_KEYS = ["monitor", "teclado", "mouse", "hd", "ssd", "memória", "memoria", "ram", "fonte", "placa", "impressora", "cabo", "rede", "roteador", "switch", "nobreak"];
const SYSTEM_KEYS = ["windows", "office", "outlook", "excel", "word", "chrome", "edge", "vpn", "sap", "domínio", "dominio", "ad ", "active directory", "antivírus", "antivirus", "teams", "zoom"];

function detect(text: string, dict: string[]): string | null {
  const t = (text || "").toLowerCase();
  for (const k of dict) if (t.includes(k)) return k;
  return null;
}

export function SupportReport() {
  const [period, setPeriod] = useState<Period>("month");

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

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    let cutoff: Date | null = null;
    if (period === "week") cutoff = subDays(now, 7);
    else if (period === "month") cutoff = subMonths(now, 1);
    else if (period === "quarter") cutoff = subMonths(now, 3);
    return data.tasks.filter((t: any) => !cutoff || new Date(t.created_at) >= cutoff);
  }, [data, period]);

  const kpis = useMemo(() => {
    const total = filtered.length;
    const done = filtered.filter((t: any) => t.status === "done").length;
    const pending = filtered.filter((t: any) => !["done", "discarded"].includes(t.status)).length;
    const resolved = filtered.filter((t: any) => t.status === "done");
    const avgResolution = resolved.length > 0
      ? Math.round(resolved.reduce((s: number, t: any) => s + differenceInMinutes(new Date(t.updated_at), new Date(t.created_at)), 0) / resolved.length)
      : 0;
    return { total, done, pending, avgResolution, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [filtered]);

  const topRequesters = useMemo(() => {
    if (!data) return [];
    const map: Record<string, number> = {};
    filtered.forEach((t: any) => {
      const id = t.created_by;
      if (id) map[id] = (map[id] || 0) + 1;
    });
    return Object.entries(map)
      .map(([uid, count]) => {
        const p = data.profiles.find((p: any) => p.id === uid);
        return { name: p?.full_name || "Desconhecido", count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [filtered, data]);

  const topHardware = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t: any) => {
      const k = detect(`${t.title} ${t.description || ""}`, HARDWARE_KEYS);
      if (k) map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const topSystems = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t: any) => {
      const k = detect(`${t.title} ${t.description || ""}`, SYSTEM_KEYS);
      if (k) map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filtered]);

  const monthlyVolume = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((t: any) => {
      const d = new Date(t.created_at);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0])).map(([month, count]) => ({ month, count }));
  }, [filtered]);

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const fmtMin = (m: number) => m < 60 ? `${m}min` : `${Math.floor(m / 60)}h ${m % 60}min`;

  return (
    <div className="space-y-6">
      <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
        <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="week">Semana</SelectItem>
          <SelectItem value="month">Mês</SelectItem>
          <SelectItem value="quarter">Trimestre</SelectItem>
          <SelectItem value="all">Tudo</SelectItem>
        </SelectContent>
      </Select>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total chamados", value: kpis.total, icon: LifeBuoy, color: "text-primary" },
          { label: "Resolvidos", value: `${kpis.done} (${kpis.rate}%)`, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Pendentes", value: kpis.pending, icon: AlertTriangle, color: "text-amber-500" },
          { label: "Tempo médio", value: fmtMin(kpis.avgResolution), icon: Clock, color: "text-blue-500" },
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

      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Volume mensal</CardTitle></CardHeader>
        <CardContent>
          {monthlyVolume.length === 0 ? <EmptyState icon={LifeBuoy} title="Sem chamados" /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="count" name="Chamados" fill="hsl(230,80%,60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Wrench className="h-4 w-4 text-amber-500" />Peças com mais problemas</CardTitle></CardHeader>
          <CardContent>
            {topHardware.length === 0 ? <EmptyState icon={Wrench} title="Sem identificação" description="Sem palavras-chave reconhecidas no título/descrição." /> : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={topHardware} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" stroke="none">
                    {topHardware.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Monitor className="h-4 w-4 text-indigo-500" />Sistemas com mais problemas</CardTitle></CardHeader>
          <CardContent>
            {topSystems.length === 0 ? <EmptyState icon={Monitor} title="Sem identificação" description="Sem palavras-chave reconhecidas no título/descrição." /> : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topSystems} layout="vertical">
                  <XAxis type="number" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={90} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Bar dataKey="value" fill="hsl(262,83%,58%)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4 text-primary" />Usuários que mais abriram chamados</CardTitle></CardHeader>
        <CardContent>
          {topRequesters.length === 0 ? <EmptyState icon={Users} title="Sem dados" /> : (
            <div className="space-y-2">
              {topRequesters.map((u, i) => {
                const max = topRequesters[0].count;
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
    </div>
  );
}
