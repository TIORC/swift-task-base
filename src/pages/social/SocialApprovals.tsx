import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle } from "lucide-react";
import { useSmPosts, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { SM_POST_STATUS_LABEL } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

export default function SocialApprovals() {
  const { data: posts, refresh } = useSmPosts();
  const { data: clients } = useSmClients();
  const m = useSocialMutations();

  const pending = posts.filter(p => p.status === "revisao_interna" || p.status === "aprovacao_cliente");
  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? "—";

  const approve = async (id: string, currentStatus: string) => {
    const next = currentStatus === "revisao_interna" ? "aprovacao_cliente" : "agendado";
    const { error } = await m.updatePost(id, { status: next as any });
    if (error) toast.error(error.message); else { toast.success("Aprovado"); refresh(); }
  };
  const reject = async (id: string) => {
    const { error } = await m.updatePost(id, { status: "reprovado" as any });
    if (error) toast.error(error.message); else { toast.success("Reprovado"); refresh(); }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Aprovações" description="Posts aguardando revisão interna ou do cliente" icon={<CheckCircle2 className="h-5 w-5"/>} />
      {pending.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nenhuma aprovação pendente" description="Tudo em dia por aqui." />
      ) : (
        <div className="space-y-3">
          {pending.map(p => (
            <Card key={p.id}>
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{clientName(p.client_id)} • {SM_POST_STATUS_LABEL[p.status]}</p>
                  <p className="font-medium truncate mt-0.5">{p.title}</p>
                  {p.caption && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.caption}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" className="text-destructive" onClick={() => reject(p.id)}><XCircle className="h-4 w-4 mr-1"/>Reprovar</Button>
                  <Button size="sm" onClick={() => approve(p.id, p.status)}><CheckCircle2 className="h-4 w-4 mr-1"/>Aprovar</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
