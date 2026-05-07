import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useSmPosts, useSmTasks } from "@/hooks/useSocial";
import { useAuth } from "@/hooks/useAuth";
import { SM_POST_STATUS_LABEL, SM_PRIORITY_LABEL, type SmPriority } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { Target } from "lucide-react";

const PRIORITY_ORDER: SmPriority[] = ["urgent", "high", "medium", "low"];
const PRIORITY_VARIANT: Record<SmPriority, "destructive" | "default" | "secondary" | "outline"> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export default function SocialFocusMode() {
  const { user } = useAuth();
  const uid = user?.id;
  const { data: posts } = useSmPosts();
  const { data: tasks } = useSmTasks();

  const myPosts = useMemo(
    () => posts.filter((p) => p.assigned_to === uid && !["publicado", "reprovado"].includes(p.status)),
    [posts, uid]
  );
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigned_to === uid && !["concluido", "descartado"].includes(t.status)),
    [tasks, uid]
  );

  const grouped = useMemo(() => {
    const map: Record<SmPriority, { posts: typeof myPosts; tasks: typeof myTasks }> = {
      urgent: { posts: [], tasks: [] },
      high: { posts: [], tasks: [] },
      medium: { posts: [], tasks: [] },
      low: { posts: [], tasks: [] },
    };
    myPosts.forEach((p) => map[p.priority].posts.push(p));
    myTasks.forEach((t) => map[t.priority].tasks.push(t));
    return map;
  }, [myPosts, myTasks]);

  const total = myPosts.length + myTasks.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modo Foco — Social Media"
        description="Suas pendências organizadas por prioridade"
        icon={<Target className="h-6 w-6" />}
      />

      {total === 0 ? (
        <EmptyState
          icon={Target}
          title="Nada na sua fila"
          description="Você não tem posts ou tarefas atribuídas pendentes."
        />
      ) : (
        <div className="grid gap-4">
          {PRIORITY_ORDER.map((p) => {
            const g = grouped[p];
            if (g.posts.length === 0 && g.tasks.length === 0) return null;
            return (
              <Card key={p}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Badge variant={PRIORITY_VARIANT[p]}>{SM_PRIORITY_LABEL[p]}</Badge>
                    <span className="text-muted-foreground text-sm font-normal">
                      {g.posts.length + g.tasks.length} item(ns)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {g.posts.map((p) => (
                    <div key={p.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.title}</div>
                        <div className="text-xs text-muted-foreground">Post · {SM_POST_STATUS_LABEL[p.status]}</div>
                      </div>
                      {p.scheduled_at && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.scheduled_at).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  ))}
                  {g.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-muted-foreground">Tarefa · {t.status}</div>
                      </div>
                      {t.due_date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(t.due_date).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
