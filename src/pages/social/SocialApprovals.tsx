import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2, XCircle, ListTodo } from "lucide-react";
import { useSmPosts, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { SM_POST_STATUS_LABEL } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;

export default function SocialApprovals() {
  const { data: posts, refresh } = useSmPosts();
  const { data: clients } = useSmClients();
  const { data: profiles } = useSocialAssignableProfiles();
  const { user } = useAuth();
  const m = useSocialMutations();

  const [tasks, setTasks] = useState<any[]>([]);

  const loadTasks = useCallback(async () => {
    const { data } = await sb.from("sm_tasks").select("*")
      .eq("approval_status", "pendente").order("created_at", { ascending: false });
    setTasks(data ?? []);
  }, []);
  useEffect(() => { loadTasks(); }, [loadTasks]);

  const pending = posts.filter(p => p.status === "revisao_interna" || p.status === "aprovacao_cliente");
  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name ?? "—";
  const personName = (id: string | null) => profiles?.find((p: any) => p.id === id)?.full_name ?? "Sem responsável";

  const approve = async (id: string, currentStatus: string) => {
    const next = currentStatus === "revisao_interna" ? "aprovacao_cliente" : "agendado";
    const { error } = await m.updatePost(id, { status: next as any });
    if (error) toast.error(error.message); else { toast.success("Aprovado"); refresh(); }
  };
  const reject = async (id: string) => {
    const { error } = await m.updatePost(id, { status: "reprovado" as any });
    if (error) toast.error(error.message); else { toast.success("Reprovado"); refresh(); }
  };

  const decideTask = async (t: any, approved: boolean) => {
    const { error } = await sb.from("sm_tasks").update({
      approval_status: approved ? "aprovado" : "reprovado",
      approver_id: user?.id ?? null,
      status: approved ? "concluido" : "em_andamento",
    }).eq("id", t.id);
    if (error) return toast.error(error.message);
    if (t.assigned_to && user) {
      await sb.from("notifications").insert({
        user_id: t.assigned_to,
        type: "approval",
        message: approved ? `Tarefa aprovada: ${t.title}` : `Tarefa reprovada — ajustes necessários: ${t.title}`,
        created_by: user.id,
      });
    }
    toast.success(approved ? "Tarefa aprovada" : "Tarefa devolvida para ajuste");
    loadTasks();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Aprovações"
        description="Posts e tarefas aguardando aprovação"
        icon={<CheckCircle2 className="h-5 w-5" />}
      />

      <Tabs defaultValue="tarefas">
        <TabsList>
          <TabsTrigger value="tarefas">Tarefas ({tasks.length})</TabsTrigger>
          <TabsTrigger value="posts">Posts ({pending.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tarefas" className="pt-4">
          {tasks.length === 0 ? (
            <EmptyState icon={ListTodo} title="Nenhuma tarefa aguardando aprovação" description="Tudo em dia por aqui." />
          ) : (
            <div className="space-y-3">
              {tasks.map(t => (
                <Card key={t.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {clientName(t.client_id)} • {personName(t.assigned_to)}
                      </p>
                      <p className="font-medium truncate mt-0.5">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{t.description}</p>}
                      {t.is_approval_step && <Badge variant="outline" className="text-[10px] mt-1">Etapa de aprovação do fluxo</Badge>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => decideTask(t, false)}>
                        <XCircle className="h-4 w-4 mr-1" />Reprovar
                      </Button>
                      <Button size="sm" onClick={() => decideTask(t, true)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="posts" className="pt-4">
          {pending.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nenhuma aprovação pendente" description="Tudo em dia por aqui." />
          ) : (
            <div className="space-y-3">
              {pending.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {clientName(p.client_id)} • {SM_POST_STATUS_LABEL[p.status]}
                      </p>
                      <p className="font-medium truncate mt-0.5">{p.title}</p>
                      {p.caption && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{p.caption}</p>}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" className="text-destructive" onClick={() => reject(p.id)}>
                        <XCircle className="h-4 w-4 mr-1" />Reprovar
                      </Button>
                      <Button size="sm" onClick={() => approve(p.id, p.status)}>
                        <CheckCircle2 className="h-4 w-4 mr-1" />Aprovar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
