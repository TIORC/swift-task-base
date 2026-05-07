import { useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSmPosts, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CheckCircle2, XCircle, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { SM_POST_STATUS_LABEL } from "@/types/social";

const sb = supabase as any;

export default function SocialClientApprovals() {
  const { user } = useAuth();
  const { data: posts, refresh } = useSmPosts({ status: "aprovacao_cliente" });
  const { data: clients } = useSmClients();
  const m = useSocialMutations();
  const [comment, setComment] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const clientName = useMemo(() => {
    const map: Record<string, string> = {};
    clients.forEach((c) => { map[c.id] = c.name; });
    return map;
  }, [clients]);

  const decide = async (postId: string, decision: "approved" | "rejected") => {
    if (!user) return;
    setBusy(postId);
    try {
      await sb.from("sm_post_approvals").insert({
        post_id: postId,
        approver_id: user.id,
        level: "cliente",
        status: decision,
        comments: comment[postId] ?? null,
      });
      await m.updatePost(postId, { status: decision === "approved" ? "agendado" : "reprovado" });
      toast.success(decision === "approved" ? "Aprovado" : "Reprovado");
      setComment((c) => ({ ...c, [postId]: "" }));
      refresh();
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao registrar aprovação");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações pendentes"
        description="Revise e aprove os conteúdos enviados pela equipe"
        icon={<CheckCircle2 className="h-6 w-6" />}
      />

      {posts.length === 0 ? (
        <EmptyState icon={CheckCircle2} title="Nada pendente" description="Não há conteúdos aguardando sua aprovação." />
      ) : (
        <div className="grid gap-4">
          {posts.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">{p.title}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{clientName[p.client_id]}</p>
                  </div>
                  <Badge variant="outline">{SM_POST_STATUS_LABEL[p.status]}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {p.caption && <div className="text-sm whitespace-pre-wrap">{p.caption}</div>}
                {p.hashtags && <div className="text-xs text-primary">{p.hashtags}</div>}
                {p.scheduled_at && (
                  <div className="text-xs text-muted-foreground">
                    Previsto para: {new Date(p.scheduled_at).toLocaleString("pt-BR")}
                  </div>
                )}
                <Textarea
                  placeholder="Comentário (opcional)..."
                  value={comment[p.id] ?? ""}
                  onChange={(e) => setComment({ ...comment, [p.id]: e.target.value })}
                  rows={2}
                />
                <div className="flex gap-2">
                  <Button size="sm" disabled={busy === p.id} onClick={() => decide(p.id, "approved")}>
                    <CheckCircle2 className="h-4 w-4 mr-1.5" /> Aprovar
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy === p.id} onClick={() => decide(p.id, "rejected")}>
                    <XCircle className="h-4 w-4 mr-1.5" /> Reprovar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
