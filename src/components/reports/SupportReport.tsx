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
  MonitorSmartphone, Globe, HardDrive, Laptop,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { subDays, subMonths, differenceInMinutes, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  SUPPORT_REAL_REASONS, ALL_SUPPORT_TAGS, INITIAL_CATEGORIES, extractInitialCategory, extractMachine,
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
  const [monthFilter, setMonthFilter] = useState<string>("all"); // "YYYY-MM" or "all"
  const [requesterFilter, setRequesterFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [systemFilter, setSystemFilter] = useState<string>("all");
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [equipmentFilter, setEquipmentFilter] = useState<string>("all");

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
    let cutoffStart: Date | null = null;
    let cutoffEnd: Date | null = null;
    if (monthFilter !== "all") {
      const [y, m] = monthFilter.split("-").map(Number);
      cutoffStart = new Date(y, m - 1, 1);
      cutoffEnd = new Date(y, m, 1);
    } else {
      if (period === "week") cutoffStart = subDays(now, 7);
      else if (period === "month") cutoffStart = subMonths(now, 1);
      else if (period === "quarter") cutoffStart = subMonths(now, 3);
    }
    return data.tasks.filter((t: any) => {
      const created = new Date(t.created_at);
      if (cutoffStart && created < cutoffStart) return false;
      if (cutoffEnd && created >= cutoffEnd) return false;
      if (requesterFilter !== "all") {
        const req = extractRequester(t.description) || profileName(t.created_by);
        if (req !== requesterFilter) return false;
      }
      if (categoryFilter !== "all" && extractInitialCategory(t.title) !== categoryFilter) return false;
      if (reasonFilter !== "all" && t.support_real_reason !== reasonFilter) return false;
      if (tagFilter !== "all" && !(t.support_tags ?? []).includes(tagFilter)) return false;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (systemFilter !== "all" && t.support_system !== systemFilter) return false;
      if (siteFilter !== "all" && t.support_site !== siteFilter) return false;
      if (equipmentFilter !== "all" && t.support_equipment !== equipmentFilter) return false;
      return true;
    });
  }, [data, period, monthFilter, requesterFilter, categoryFilter, reasonFilter, tagFilter, assigneeFilter, statusFilter, systemFilter, siteFilter, equipmentFilter]);



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

  const countBy = (fn: (t: any) => string | null | undefined) => {
    const map = new Map<string, number>();
    filtered.forEach((t: any) => {
      const k = fn(t);
      if (!k) return;
      map.set(k, (map.get(k) || 0) + 1);
    });
    return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  };

  const systemCounts = useMemo(() => countBy((t) => t.support_system), [filtered]);
  const siteCounts = useMemo(() => countBy((t) => t.support_site), [filtered]);
  const equipmentCounts = useMemo(() => countBy((t) => t.support_equipment), [filtered]);
  const machineCounts = useMemo(() => countBy((t) => extractMachine(t.description)), [filtered]);

  const systemOptions = useMemo(
    () => [...new Set((data?.tasks ?? []).map((t: any) => t.support_system).filter(Boolean))].sort() as string[],
    [data]
  );
  const siteOptions = useMemo(
    () => [...new Set((data?.tasks ?? []).map((t: any) => t.support_site).filter(Boolean))].sort() as string[],
    [data]
  );
  const equipmentOptions = useMemo(
    () => [...new Set((data?.tasks ?? []).map((t: any) => t.support_equipment).filter(Boolean))].sort() as string[],
    [data]
  );



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

  const monthOptions = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    data.tasks.forEach((t: any) => {
      const d = new Date(t.created_at);
      set.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    });
    return [...set].sort().reverse().map((ym) => {
      const [y, m] = ym.split("-").map(Number);
      return { value: ym, label: format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR }) };
    });
  }, [data]);

  const periodLabel = monthFilter !== "all"
    ? (monthOptions.find((o) => o.value === monthFilter)?.label || monthFilter)
    : { week: "Última semana", month: "Último mês", quarter: "Último trimestre", all: "Todo o período" }[period];

  const handlePrint = () => {
    const esc = (s: any) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const filtersUsed: string[] = [`Período: ${periodLabel}`];
    if (requesterFilter !== "all") filtersUsed.push(`Solicitante: ${requesterFilter}`);
    if (categoryFilter !== "all") filtersUsed.push(`Categoria inicial: ${categoryFilter}`);
    if (reasonFilter !== "all") filtersUsed.push(`Motivo real: ${reasonFilter}`);
    if (tagFilter !== "all") filtersUsed.push(`Tag: ${tagFilter}`);
    if (assigneeFilter !== "all") filtersUsed.push(`Responsável TI: ${profileName(assigneeFilter)}`);
    if (statusFilter !== "all") filtersUsed.push(`Status: ${statusFilter}`);
    if (systemFilter !== "all") filtersUsed.push(`Sistema: ${systemFilter}`);
    if (siteFilter !== "all") filtersUsed.push(`Site: ${siteFilter}`);
    if (equipmentFilter !== "all") filtersUsed.push(`Equipamento: ${equipmentFilter}`);

    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"/>
<title>Relatório de Chamados — ${esc(format(new Date(), "dd/MM/yyyy HH:mm"))}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#0f172a;margin:0;padding:32px;background:#fff;font-size:12px;line-height:1.4}
  h1{font-size:22px;margin:0 0 4px;color:#0f172a} h2{font-size:14px;margin:24px 0 8px;color:#1e293b;border-bottom:2px solid #e2e8f0;padding-bottom:4px}
  .meta{color:#64748b;font-size:11px;margin-bottom:16px}
  .filters{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;margin-bottom:20px;font-size:11px;color:#475569}
  .filters span{display:inline-block;margin-right:14px}
  .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:20px}
  .kpi{border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#fff}
  .kpi .l{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:.4px}
  .kpi .v{font-size:18px;font-weight:700;margin-top:4px;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:11px}
  th,td{text-align:left;padding:7px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top}
  th{background:#f1f5f9;font-weight:600;color:#334155;font-size:10px;text-transform:uppercase;letter-spacing:.3px}
  tr:nth-child(even) td{background:#fafbfc}
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:20px}
  .footer{margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center}
  .badge{display:inline-block;background:#eef2ff;color:#3730a3;padding:2px 7px;border-radius:10px;font-size:10px;margin:1px 3px 1px 0}
  .num{text-align:right;font-variant-numeric:tabular-nums}
  @media print{body{padding:18px} h2{page-break-after:avoid} table{page-break-inside:auto} tr{page-break-inside:avoid}}
  .noprint{margin-bottom:20px} .noprint button{background:#2563eb;color:#fff;border:0;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:12px}
  @media print{.noprint{display:none}}
</style></head><body>
<div class="noprint"><button onclick="window.print()">🖨️ Imprimir / Salvar PDF</button></div>
<h1>Relatório de Chamados — Suporte TI</h1>
<div class="meta">Gerado em ${esc(format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }))}</div>
<div class="filters"><strong>Filtros aplicados:</strong> ${filtersUsed.map((f) => `<span>• ${esc(f)}</span>`).join("")}</div>

<div class="kpis">
  <div class="kpi"><div class="l">Total</div><div class="v">${kpis.total}</div></div>
  <div class="kpi"><div class="l">Resolvidos</div><div class="v">${kpis.done} (${kpis.rate}%)</div></div>
  <div class="kpi"><div class="l">Em andamento</div><div class="v">${kpis.inProgress}</div></div>
  <div class="kpi"><div class="l">Pendentes</div><div class="v">${kpis.pending}</div></div>
  <div class="kpi"><div class="l">Tempo médio</div><div class="v">${esc(fmtMin(kpis.avg))}</div></div>
</div>

<div class="grid2">
  <div>
    <h2>Motivos reais identificados</h2>
    <table><thead><tr><th>Motivo</th><th class="num">Qtd</th><th class="num">%</th></tr></thead><tbody>
    ${reasonCounts.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.value}</td><td class="num">${kpis.total ? Math.round((r.value / kpis.total) * 100) : 0}%</td></tr>`).join("") || `<tr><td colspan="3" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
  <div>
    <h2>Tags mais recorrentes</h2>
    <table><thead><tr><th>Tag</th><th class="num">Qtd</th></tr></thead><tbody>
    ${tagCounts.map((t) => `<tr><td>${esc(t.name)}</td><td class="num">${t.value}</td></tr>`).join("") || `<tr><td colspan="2" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
</div>

<div class="grid2">
  <div>
    <h2>Sistemas mais solicitados</h2>
    <table><thead><tr><th>Sistema</th><th class="num">Qtd</th><th class="num">%</th></tr></thead><tbody>
    ${systemCounts.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.value}</td><td class="num">${kpis.total ? Math.round((r.value / kpis.total) * 100) : 0}%</td></tr>`).join("") || `<tr><td colspan="3" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
  <div>
    <h2>Sites / Portais mais solicitados</h2>
    <table><thead><tr><th>Site / Portal</th><th class="num">Qtd</th><th class="num">%</th></tr></thead><tbody>
    ${siteCounts.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.value}</td><td class="num">${kpis.total ? Math.round((r.value / kpis.total) * 100) : 0}%</td></tr>`).join("") || `<tr><td colspan="3" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
</div>

<div class="grid2">
  <div>
    <h2>Equipamentos com mais chamados</h2>
    <table><thead><tr><th>Equipamento</th><th class="num">Qtd</th></tr></thead><tbody>
    ${equipmentCounts.map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.value}</td></tr>`).join("") || `<tr><td colspan="2" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
  <div>
    <h2>Máquinas com mais chamados</h2>
    <table><thead><tr><th>Máquina</th><th class="num">Qtd</th></tr></thead><tbody>
    ${machineCounts.slice(0, 20).map((r) => `<tr><td>${esc(r.name)}</td><td class="num">${r.value}</td></tr>`).join("") || `<tr><td colspan="2" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
</div>


<h2>Categoria inicial × Motivo real</h2>
<table><thead><tr><th>Categoria inicial</th><th>Motivo real (TI)</th><th class="num">Qtd</th></tr></thead><tbody>
${comparison.map((r) => `<tr><td style="text-transform:capitalize">${esc(r.initial)}</td><td>${esc(r.reason)}</td><td class="num">${r.count}</td></tr>`).join("") || `<tr><td colspan="3" style="color:#94a3b8">Sem dados</td></tr>`}
</tbody></table>

<div class="grid2">
  <div>
    <h2>Colaboradores que mais solicitaram</h2>
    <table><thead><tr><th>#</th><th>Colaborador</th><th class="num">Chamados</th></tr></thead><tbody>
    ${requesters.slice(0, 15).map((u, i) => `<tr><td>${i + 1}</td><td>${esc(u.name)}</td><td class="num">${u.count}</td></tr>`).join("") || `<tr><td colspan="3" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
  <div>
    <h2>Atendimentos por responsável TI</h2>
    <table><thead><tr><th>#</th><th>Responsável</th><th class="num">Chamados</th></tr></thead><tbody>
    ${assigneeCounts.slice(0, 15).map((u, i) => `<tr><td>${i + 1}</td><td>${esc(u.name)}</td><td class="num">${u.count}</td></tr>`).join("") || `<tr><td colspan="3" style="color:#94a3b8">Sem dados</td></tr>`}
    </tbody></table>
  </div>
</div>

<h2>Detalhamento por colaborador</h2>
<table><thead><tr><th>Colaborador</th><th class="num">Total</th><th>Motivos reais</th><th>Tags frequentes</th><th class="num">Tempo médio</th><th class="num">Último</th></tr></thead><tbody>
${perRequester.map((r) => `<tr>
  <td><strong>${esc(r.name)}</strong></td>
  <td class="num">${r.total}</td>
  <td>${r.reasons.length ? r.reasons.map(([n, c]) => `<span class="badge">${esc(n)}: ${c}</span>`).join("") : "—"}</td>
  <td>${r.tags.length ? r.tags.map(([n, c]) => `<span class="badge">${esc(n)}: ${c}</span>`).join("") : "—"}</td>
  <td class="num">${r.avg ? esc(fmtMin(r.avg)) : "—"}</td>
  <td class="num">${esc(format(r.last, "dd/MM/yy", { locale: ptBR }))}</td>
</tr>`).join("") || `<tr><td colspan="6" style="color:#94a3b8">Sem dados</td></tr>`}
</tbody></table>

<div class="footer">Orcoma TI Gestão — Relatório de Chamados • ${esc(format(new Date(), "dd/MM/yyyy HH:mm"))}</div>
</body></html>`;

    const w = window.open("", "_blank", "width=1100,height=800");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
  };

  if (isLoading)
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <Card className="shadow-card">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap gap-2">
            <Select value={period} onValueChange={(v) => { setPeriod(v as Period); setMonthFilter("all"); }} disabled={monthFilter !== "all"}>
              <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Semana</SelectItem>
                <SelectItem value="month">Mês</SelectItem>
                <SelectItem value="quarter">Trimestre</SelectItem>
                <SelectItem value="all">Tudo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={monthFilter} onValueChange={setMonthFilter}>
              <SelectTrigger className="w-[200px] h-9 text-xs capitalize"><SelectValue placeholder="Mês específico" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos os meses</SelectItem>
                {monthOptions.map((o) => <SelectItem key={o.value} value={o.value} className="capitalize">{o.label}</SelectItem>)}
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
            <Select value={systemFilter} onValueChange={setSystemFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Sistema" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos os sistemas</SelectItem>
                {systemOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={siteFilter} onValueChange={setSiteFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Site / Portal" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos os sites</SelectItem>
                {siteOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={equipmentFilter} onValueChange={setEquipmentFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs"><SelectValue placeholder="Equipamento" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">Todos equipamentos</SelectItem>
                {equipmentOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button onClick={handlePrint} size="sm" className="h-9 ml-auto gap-2">
              <Printer className="h-4 w-4" /> Imprimir relatório
            </Button>
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

      {/* Sistemas / Sites / Equipamentos / Máquinas */}
      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: "Sistemas mais solicitados", icon: MonitorSmartphone, color: "text-blue-500", rows: systemCounts, bar: "hsl(230,80%,60%)" },
          { title: "Sites / Portais mais solicitados", icon: Globe, color: "text-emerald-500", rows: siteCounts, bar: "hsl(152,69%,40%)" },
          { title: "Equipamentos com mais chamados", icon: HardDrive, color: "text-amber-500", rows: equipmentCounts, bar: "hsl(38,92%,50%)" },
          { title: "Máquinas com mais chamados", icon: Laptop, color: "text-indigo-500", rows: machineCounts, bar: "hsl(262,83%,58%)" },
        ].map((block) => (
          <Card key={block.title} className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <block.icon className={`h-4 w-4 ${block.color}`} />{block.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {block.rows.length === 0 ? (
                <EmptyState icon={block.icon} title="Sem dados" description="Nenhum registro no período/filtro selecionado." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(200, Math.min(block.rows.length, 10) * 30)}>
                  <BarChart data={block.rows.slice(0, 10)} layout="vertical" margin={{ left: 12 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" allowDecimals={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "hsl(var(--foreground))", fontSize: 11 }} width={130} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar dataKey="value" name="Chamados" fill={block.bar} radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        ))}
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
