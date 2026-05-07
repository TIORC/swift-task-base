import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSmPosts, useSmClients, useSmTasks } from "@/hooks/useSocial";
import { SM_POST_STATUS_LABEL, SM_POST_STATUS_ORDER } from "@/types/social";
import { Gauge, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "12px",
  color: "hsl(var(--foreground))",
  fontSize: "12px",
};

export default function SocialManagerDashboard() {
  const { data: posts } = useSmPosts();
  const { data: tasks } = useSmTasks();
  const { data: clients } = useSmClients();

  const stats = useMemo(() => {
    const now = new Date();
    const overdue = posts.filter((p) => {
      if (!p.scheduled_at || p.status === "publicado" || p.status === "reprovado") return false;
      return new Date(p.scheduled_at) < new Date(now.getFullYear(), now.getMonth(), now.getDate());
    });
    const awaiting = posts.filter((p) => p.status === "aprovacao_cliente");
    const publishedThisMonth = posts.filter((p) => {
      if (!p.published_at) return false;
      const d = new Date(p.published_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const openTasks = tasks.filter((t) => t.status !== "concluido" && t.status !== "descartado");
    return { overdue, awaiting, publishedThisMonth, openTasks };
  }, [posts, tasks]);

  const byClient = useMemo(
    () => clients.map((c) => {
      const cp = posts.filter((p) => p.client_id === c.id);
      return {
        name: c.name,
        total: cp.length,
        publicados: cp.filter((p) => p.status === "publicado").length,
        pendentes: cp.filter((p) => !["publicado", "reprovado"].includes(p.status)).length,
      };
    }).filter((x) => x.total > 0),
    [posts, clients]
  );

  const funnel = useMemo(
    () => SM_POST_STATUS_ORDER.map((s) => ({
      name: SM_POST_STATUS_LABEL[s],
      qtd: posts.filter((p) => p.status === s).length,
    })),
    [posts]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel do Gestor — Social Media"
        description="Visão geral, gargalos e produção"
        icon={<Gauge className="h-6 w-6" />}
      />

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { icon: AlertTriangle, label: "Atrasados", value: stats.overdue.length, color: "text-destructive" },
          { icon: Clock, label: "Aguardando cliente", value: stats.awaiting.length, color: "text-amber-500" },
          { icon: CheckCircle2, label: "Publicados no mês", value: stats.publishedThisMonth.length, color: "text-emerald-500" },
          { icon: Gauge, label: "Tarefas abertas", value: stats.openTasks.length, color: "text-primary" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardContent className="pt-6 flex items-center gap-3">
                <Icon className={`h-8 w-8 ${s.color}`} />
                <div>
                  <div className="text-sm text-muted-foreground">{s.label}</div>
                  <div className="text-2xl font-bold">{s.value}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Funil de produção</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={funnel} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={120} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="qtd" fill="hsl(230, 80%, 60%)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Produção por cliente</CardTitle></CardHeader>
          <CardContent style={{ height: 300 }}>
            <ResponsiveContainer>
              <BarChart data={byClient}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="publicados" stackId="a" fill="hsl(152, 69%, 40%)" name="Publicados" />
                <Bar dataKey="pendentes" stackId="a" fill="hsl(38, 92%, 50%)" name="Pendentes" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {stats.overdue.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" /> Posts atrasados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats.overdue.slice(0, 10).map((p) => {
              const client = clients.find((c) => c.id === p.client_id)?.name ?? "—";
              return (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.title}</div>
                    <div className="text-xs text-muted-foreground">{client} · {SM_POST_STATUS_LABEL[p.status]}</div>
                  </div>
                  <Badge variant="destructive">
                    {p.scheduled_at ? new Date(p.scheduled_at).toLocaleDateString("pt-BR") : ""}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
