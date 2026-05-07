import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageIcon } from "lucide-react";
import { useSmPosts, useSmClients, useSmRefData } from "@/hooks/useSocial";
import { SM_POST_STATUS_LABEL } from "@/types/social";

export default function SocialPublishingSchedule() {
  const { data: posts, loading } = useSmPosts();
  const { data: clients } = useSmClients();
  const { networks } = useSmRefData();
  const [client, setClient] = useState<string>("all");
  const [network, setNetwork] = useState<string>("all");
  const [from, setFrom] = useState<string>("");

  const scheduled = useMemo(() => {
    return posts
      .filter(p => p.scheduled_at)
      .filter(p => client === "all" || p.client_id === client)
      .filter(p => network === "all" || p.network_id === network)
      .filter(p => !from || (p.scheduled_at && new Date(p.scheduled_at) >= new Date(from)))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());
  }, [posts, client, network, from]);

  return (
    <div className="space-y-6">
      <PageHeader title="Agenda de Publicações" description="Posts agendados e publicados" icon={<ImageIcon className="h-5 w-5" />} />

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Cliente</Label>
            <Select value={client} onValueChange={setClient}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Rede</Label>
            <Select value={network} onValueChange={setNetwork}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {networks.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">A partir de</Label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
      : scheduled.length === 0 ? <EmptyState icon={ImageIcon} title="Nada agendado" description="Os posts com data de publicação aparecerão aqui." />
      : (
        <div className="space-y-2">
          {scheduled.map(p => {
            const c = clients.find(x => x.id === p.client_id);
            const n = networks.find(x => x.id === p.network_id);
            const d = new Date(p.scheduled_at!);
            return (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-20 text-center shrink-0 border-r border-border pr-4">
                    <div className="text-2xl font-bold">{d.getDate().toString().padStart(2, "0")}</div>
                    <div className="text-[10px] uppercase text-muted-foreground">{d.toLocaleString("pt-BR", { month: "short" })}</div>
                    <div className="text-xs text-muted-foreground">{d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{p.title}</h3>
                    <p className="text-xs text-muted-foreground">{c?.name}{n ? ` • ${n.name}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{SM_POST_STATUS_LABEL[p.status]}</Badge>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
