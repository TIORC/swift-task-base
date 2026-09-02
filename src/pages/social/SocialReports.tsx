import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSmPosts, useSmClients, useSmTasks } from "@/hooks/useSocial";
import { useSmTimeTotals, formatMinutes } from "@/hooks/useSmTaskExtras";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { SM_NATURE_LABEL, type SmNature } from "@/lib/sm-demands";
import { SM_POST_STATUS_LABEL, SM_POST_STATUS_ORDER } from "@/types/social";
import { BarChart3, FileDown, FileSpreadsheet } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid,
} from "recharts";
import { toast } from "sonner";

const PIE_COLORS = [
  "hsl(230, 80%, 60%)", "hsl(38, 92%, 50%)", "hsl(152, 69%, 40%)",
  "hsl(0, 72%, 51%)", "hsl(262, 83%, 58%)", "hsl(199, 89%, 48%)",
  "hsl(220, 9%, 46%)", "hsl(340, 75%, 55%)",
];

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
};

type PeriodFilter = "week" | "month" | "quarter" | "specific" | "all";

export default function SocialReports() {
  const { data: posts } = useSmPosts();
  const { data: clients } = useSmClients();
  const { data: tasks } = useSmTasks();
  const { byTask: minutesByTask } = useSmTimeTotals();
  const { data: profiles } = useSocialAssignableProfiles();
  const [period, setPeriod] = useState<PeriodFilter>("month");
  const [specificMonth, setSpecificMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [clientId, setClientId] = useState<string>("all");

  const filtered = useMemo(() => {
    const now = new Date();
    let cutoff: Date | null = null;
    let start: Date | null = null;
    let end: Date | null = null;
    if (period === "week") cutoff = new Date(now.getTime() - 7 * 86400000);
    else if (period === "month") cutoff = new Date(now.getTime() - 30 * 86400000);
    else if (period === "quarter") cutoff = new Date(now.getTime() - 90 * 86400000);
    else if (period === "specific") {
      const [y, m] = specificMonth.split("-").map(Number);
      start = new Date(y, m - 1, 1);
      end = new Date(y, m, 1);
    }
    return posts.filter((p) => {
      const created = new Date(p.created_at);
      if (start && end && (created < start || created >= end)) return false;
      if (cutoff && created < cutoff) return false;
      if (clientId !== "all" && p.client_id !== clientId) return false;
      return true;
    });
  }, [posts, period, specificMonth, clientId]);

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
  const tarefasAbertas = tasks.filter((t) => t.status !== "concluido").length;

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
            <SelectItem value="month">Mês</SelectItem>
            <SelectItem value="quarter">Trimestre</SelectItem>
            <SelectItem value="specific">Mês específico</SelectItem>
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
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Posts no período", value: total },
          { label: "Publicados", value: publicados },
          { label: "Aguardando cliente", value: aprovacaoCliente },
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por status</CardTitle></CardHeader>
          <CardContent style={{ height: 280 }}>
            {byStatus.length === 0 ? (
              <div className="text-sm text-muted-foreground">Sem dados</div>
            ) : (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" outerRadius={90} label>
                    {byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
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
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                  <Bar dataKey="total" fill="hsl(230, 80%, 60%)" name="Total" />
                  <Bar dataKey="publicados" fill="hsl(152, 69%, 40%)" name="Publicados" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
