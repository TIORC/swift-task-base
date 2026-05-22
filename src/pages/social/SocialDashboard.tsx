import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Users, Megaphone, CheckCircle2, Calendar as CalendarIcon, ListTodo, Clock } from "lucide-react";
import { useSmClients, useSmPosts, useSmTasks, useSmCampaigns } from "@/hooks/useSocial";
import { Skeleton } from "@/components/ui/skeleton";

function Stat({ icon: Icon, label, value, hint }: { icon: any; label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SocialDashboard() {
  const { data: clients, loading: lc } = useSmClients();
  const { data: posts, loading: lp } = useSmPosts();
  const { data: tasks, loading: lt } = useSmTasks();
  const { data: campaigns } = useSmCampaigns();

  const stats = useMemo(() => {
    // Reseta a cada virada de mês — mantém apenas posts criados no mês atual ou em aberto
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isOpen = (s: string) => !["publicado", "reprovado"].includes(s);
    const monthPosts = posts.filter(p => new Date(p.created_at) >= monthStart || isOpen(p.status));

    const planejados = monthPosts.filter(p => ["ideia","roteiro","design"].includes(p.status)).length;
    const aprovacoes = monthPosts.filter(p => ["revisao_interna","aprovacao_cliente"].includes(p.status)).length;
    const agendados = monthPosts.filter(p => p.status === "agendado").length;
    const publicados = posts.filter(p => {
      if (p.status !== "publicado" || !p.published_at) return false;
      return new Date(p.published_at) >= monthStart;
    }).length;
    const ativasCampanhas = campaigns.filter(c => c.status !== "completed" && c.status !== "cancelled").length;
    const tarefasAbertas = tasks.filter(t => t.status !== "concluido" && t.status !== "descartado").length;
    return { planejados, aprovacoes, agendados, publicados, ativasCampanhas, tarefasAbertas, totalMes: monthPosts.length };
  }, [posts, tasks, campaigns]);

  if (lc || lp || lt) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Visão geral do ambiente Social Media" icon={<Sparkles className="h-5 w-5"/>} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({length:8}).map((_,i)=>(<Skeleton key={i} className="h-28"/>))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Visão geral do ambiente Social Media" icon={<Sparkles className="h-5 w-5"/>} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={Users} label="Clientes ativos" value={clients.filter(c => c.active).length} />
        <Stat icon={Megaphone} label="Campanhas ativas" value={stats.ativasCampanhas} />
        <Stat icon={ListTodo} label="Posts planejados" value={stats.planejados} />
        <Stat icon={CheckCircle2} label="Aprovações pendentes" value={stats.aprovacoes} />
        <Stat icon={CalendarIcon} label="Agendados" value={stats.agendados} />
        <Stat icon={Sparkles} label="Publicados no mês" value={stats.publicados} />
        <Stat icon={ListTodo} label="Tarefas abertas" value={stats.tarefasAbertas} />
        <Stat icon={Clock} label="Posts no mês" value={stats.totalMes} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Próximos posts agendados</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {posts.filter(p => p.scheduled_at && p.status === "agendado")
              .sort((a,b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
              .slice(0,5)
              .map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground">{new Date(p.scheduled_at!).toLocaleDateString("pt-BR")}</span>
                </div>
              ))}
            {posts.filter(p => p.scheduled_at && p.status === "agendado").length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum post agendado.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Aprovações pendentes</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {posts.filter(p => ["revisao_interna","aprovacao_cliente"].includes(p.status))
              .slice(0,5)
              .map(p => (
                <div key={p.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span className="truncate">{p.title}</span>
                  <span className="text-xs text-muted-foreground capitalize">{p.status.replace("_"," ")}</span>
                </div>
              ))}
            {posts.filter(p => ["revisao_interna","aprovacao_cliente"].includes(p.status)).length === 0 && (
              <p className="text-sm text-muted-foreground">Sem aprovações pendentes.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
