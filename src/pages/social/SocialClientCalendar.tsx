import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSmPosts, useSmClients } from "@/hooks/useSocial";
import { Calendar } from "lucide-react";
import { SM_POST_STATUS_LABEL } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";

export default function SocialClientCalendar() {
  const { data: posts } = useSmPosts();
  const { data: clients } = useSmClients();

  const visible = useMemo(
    () => posts.filter((p) => p.scheduled_at && ["agendado", "publicado"].includes(p.status))
      .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime()),
    [posts]
  );

  const cName = (id: string) => clients.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Calendário de Publicações" description="Conteúdos agendados e publicados" icon={<Calendar className="h-6 w-6" />} />
      {visible.length === 0 ? (
        <EmptyState icon={Calendar} title="Sem publicações agendadas" />
      ) : (
        <div className="grid gap-2">
          {visible.map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{p.title}</div>
                  <div className="text-xs text-muted-foreground">{cName(p.client_id)}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline">{SM_POST_STATUS_LABEL[p.status]}</Badge>
                  <span className="text-xs text-muted-foreground">{new Date(p.scheduled_at!).toLocaleString("pt-BR")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
