import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bot, CheckCircle2, Clock, AlertTriangle, Building2, Loader2, TrendingUp, FileSpreadsheet, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from "recharts";
import { format, subDays, subMonths } from "date-fns";
import { SECTORS, SECTOR_COLORS, SECTOR_LABELS } from "@/types/sectors";
import { STATUS_LABELS } from "@/types/automation";
import { formatMinutes } from "@/lib/utils";

const PIE_COLORS = ["hsl(230,80%,60%)", "hsl(38,92%,50%)", "hsl(152,69%,40%)", "hsl(0,72%,51%)", "hsl(262,83%,58%)", "hsl(199,89%,48%)", "hsl(220,9%,46%)"];
const tooltipStyle = { backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", color: "hsl(var(--foreground))", fontSize: "12px" };
const tooltipTextStyle = { color: "hsl(var(--foreground))" };

type Period = "week" | "month" | "quarter" | "specific" | "all";

export function AutomationsReport() {
  const [period, setPeriod] = useState<Period>("month");
  const [specificMonth, setSpecificMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [sector, setSector] = useState<string>("all");
  const [ownerDetail, setOwnerDetail] = useState<{ key: string; name: string } | null>(null);

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
    let end: Date | null = null;
    if (period === "specific") {
      const [y, m] = specificMonth.split("-").map(Number);
      cutoff = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
    }
    else if (period === "week") cutoff = subDays(now, 7);
    else if (period === "month") cutoff = subMonths(now, 1);
    else if (period === "quarter") cutoff = subMonths(now, 3);
    return data.autos.filter((a: any) => {
      const created = new Date(a.created_at);
      if (cutoff && created < cutoff) return false;
      if (end && created >= end) return false;
      if (sector !== "all" && a.sector !== sector) return false;
      return true;
    });
  }, [data, period, specificMonth, sector]);

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
    // Automações sem responsável entram num grupo próprio, para o gráfico não ficar vazio
    const NO_OWNER = "__sem_responsavel__";
    const ownerKey = (a: any) => a.assigned_to || NO_OWNER;
    filtered.forEach((a: any) => {
      const key = ownerKey(a);
      if (!map[key]) map[key] = { total: 0, done: 0, minutes: 0 };
      map[key].total++;
      if (a.status === "completed") map[key].done++;
    });
    const ids = new Map(filtered.map((a: any) => [a.id, ownerKey(a)]));
    data.times.forEach((t: any) => {
      const owner = ids.get(t.automation_id);
      if (owner && map[owner]) map[owner].minutes += t.duration_minutes || 0;
    });
    return Object.entries(map).map(([uid, m]) => {
      if (uid === NO_OWNER) return { key: uid, name: "Sem responsável", fullName: "Sem responsável", ...m, hours: Math.round(m.minutes / 60 * 10) / 10 };
      const p = data.profiles.find((p: any) => p.id === uid);
      return { key: uid, name: p?.full_name?.split(" ")[0] || "N/A", fullName: p?.full_name || "Sem nome", ...m, hours: Math.round(m.minutes / 60 * 10) / 10 };
    }).sort((a, b) => b.done - a.done);
  }, [filtered, data]);

  const handleExport = () => {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const profileName = (id: string | null) => {
      if (!id) return "Sem responsável";
      return data?.profiles.find((p: any) => p.id === id)?.full_name || "N/A";
    };
    const minutesByAuto = new Map<string, number>();
    (data?.times || []).forEach((t: any) => {
      minutesByAuto.set(t.automation_id, (minutesByAuto.get(t.automation_id) || 0) + (t.duration_minutes || 0));
    });
    const header = ["Automação", "Status", "Setor", "Responsável", "Criada em", "Concluída em", "Horas"];
    const rows = filtered.map((a: any) => [
      a.title,
      STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status,
      SECTOR_LABELS[a.sector] || a.sector || "",
      profileName(a.assigned_to),
      a.created_at ? format(new Date(a.created_at), "dd/MM/yyyy") : "",
      a.completed_at ? format(new Date(a.completed_at), "dd/MM/yyyy") : "",
      ((minutesByAuto.get(a.id) || 0) / 60).toFixed(2).replace(".", ","),
    ]);
    const csv = [header, ...rows].map(r => r.map(esc).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `automacoes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const minutesByAuto = new Map<string, number>();
    (data?.times || []).forEach((t: any) => {
      minutesByAuto.set(t.automation_id, (minutesByAuto.get(t.automation_id) || 0) + (t.duration_minutes || 0));
    });
    const profileName = (id: string | null) => {
      if (!id) return "Sem responsável";
      return data?.profiles.find((p: any) => p.id === id)?.full_name || "N/A";
    };

    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(14);
    doc.text("Relatório de Automações", 14, 16);
    doc.setFontSize(9);
    const specificLabel = (() => { const [y, m] = specificMonth.split("-"); return `${m}/${y}`; })();
    const periodLabel = period === "week" ? "Última semana" : period === "month" ? "Último mês" : period === "quarter" ? "Último trimestre" : period === "specific" ? `Mês ${specificLabel}` : "Todo período";
    doc.text(`Período: ${periodLabel} · Setor: ${sector === "all" ? "Todos" : (SECTOR_LABELS[sector] || sector)} · Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 23);
    doc.text(`Total: ${kpis.total} · Concluídas: ${kpis.done} (${kpis.rate}%) · Em andamento: ${kpis.inProgress} · Pendentes: ${kpis.pending} · Horas: ${formatMinutes(kpis.minutes)}`, 14, 29);

    // Gráficos de resumo (página 1), desenhados direto no PDF
    const countBy = (keyOf: (a: any) => string) => {
      const map = new Map<string, { value: number; done: number }>();
      filtered.forEach((a: any) => {
        const k = keyOf(a);
        const cur = map.get(k) || { value: 0, done: 0 };
        cur.value++;
        if (a.status === "completed") cur.done++;
        map.set(k, cur);
      });
      return [...map.entries()].map(([label, v]) => ({ label, ...v })).sort((x, y) => y.value - x.value);
    };
    const statusRows = countBy(a => STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status);
    const sectorRows = countBy(a => SECTOR_LABELS[a.sector] || a.sector || "—");
    const ownerRows = countBy(a => profileName(a.assigned_to));

    const drawBars = (x: number, y: number, w: number, title: string, rows: { label: string; value: number; done?: number }[]) => {
      doc.setFontSize(10);
      doc.setTextColor(30);
      doc.text(title, x, y);
      const max = Math.max(1, ...rows.map(r => r.value));
      const labelW = 40;
      const barMax = w - labelW - 22;
      rows.slice(0, 10).forEach((r, i) => {
        const yy = y + 6 + i * 8;
        const len = barMax * (r.value / max);
        doc.setFontSize(8);
        doc.setTextColor(60);
        doc.text(r.label.slice(0, 30), x, yy + 3.5);
        doc.setFillColor(79, 70, 229);
        doc.rect(x + labelW, yy, Math.max(0.6, len), 4.5, "F");
        if (r.done !== undefined) {
          doc.setFillColor(16, 185, 129);
          doc.rect(x + labelW, yy, Math.max(0.6, barMax * (r.done / max)), 4.5, "F");
        }
        doc.setTextColor(30);
        doc.text(r.done !== undefined ? `${r.done}/${r.value}` : String(r.value), x + labelW + len + 2, yy + 3.5);
      });
    };

    drawBars(14, 42, 84, "Por status", statusRows);
    drawBars(108, 42, 84, "Por setor (concluídas em verde)", sectorRows);
    drawBars(202, 42, 84, "Por responsável (concluídas em verde)", ownerRows);

    doc.addPage();
    autoTable(doc, {
      startY: 20,
      head: [["Automação", "Status", "Setor", "Responsável", "Criada em", "Concluída em", "Horas"]],
      body: filtered.map((a: any) => [
        a.title,
        STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status,
        SECTOR_LABELS[a.sector] || a.sector || "",
        profileName(a.assigned_to),
        a.created_at ? format(new Date(a.created_at), "dd/MM/yyyy") : "",
        a.completed_at ? format(new Date(a.completed_at), "dd/MM/yyyy") : "",
        ((minutesByAuto.get(a.id) || 0) / 60).toFixed(1).replace(".", ","),
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [79, 70, 229] },
    });

    doc.save(`automacoes-${format(new Date(), "yyyy-MM-dd")}.pdf`);
  };

  if (isLoading) return <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[140px] h-9 text-xs"><SelectValue /></SelectTrigger>
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
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={handleExport}>
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Excel</span>
        </Button>
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
          { label: "Horas totais", value: formatMinutes(kpis.minutes), icon: Clock, color: "text-purple-500" },
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
                    <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
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
              <BarChart data={byOwner} onClick={(e: any) => {
                const row = e?.activePayload?.[0]?.payload;
                if (row) setOwnerDetail({ key: row.key, name: row.fullName });
              }} style={{ cursor: "pointer" }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} itemStyle={tooltipTextStyle} labelStyle={tooltipTextStyle} />
                <Bar dataKey="done" name="Concluídas" fill="hsl(152,69%,40%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="total" name="Total" fill="hsl(230,80%,60%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!ownerDetail} onOpenChange={(open) => { if (!open) setOwnerDetail(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Automações de {ownerDetail?.name}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {ownerDetail && filtered
              .filter((a: any) => (a.assigned_to || "__sem_responsavel__") === ownerDetail.key)
              .map((a: any) => (
                <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 p-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.title}</p>
                    {a.completed_at && (
                      <p className="text-[11px] text-muted-foreground">Concluída em {format(new Date(a.completed_at), "dd/MM/yyyy")}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">{STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status}</Badge>
                </div>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
