import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSmPosts, useSmTasks, useSocialMutations } from "@/hooks/useSocial";
import { useAuth } from "@/hooks/useAuth";
import { SM_POST_STATUS_LABEL, SM_PRIORITY_LABEL, type SmPriority } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { Target, Play, Pause, RotateCcw, ArrowLeft, Check } from "lucide-react";
import { toast } from "sonner";

const PRIORITY_ORDER: SmPriority[] = ["urgent", "high", "medium", "low"];
const PRIORITY_VARIANT: Record<SmPriority, "destructive" | "default" | "secondary" | "outline"> = {
  urgent: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

const TASK_STATUS = ["backlog", "pendente", "em_andamento", "concluido", "descartado"] as const;
const TASK_STATUS_LABEL: Record<string, string> = {
  backlog: "Backlog", pendente: "Pendente", em_andamento: "Em andamento", concluido: "Concluído", descartado: "Descartado",
};

function fmt(s: number) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h > 0 ? String(h).padStart(2, "0") + ":" : ""}${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export default function SocialFocusMode() {
  const { user } = useAuth();
  const uid = user?.id;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const focusedTaskId = params.get("taskId");
  const focusedPostId = params.get("postId");

  const { data: posts } = useSmPosts();
  const { data: tasks, refresh: refreshTasks } = useSmTasks();
  const m = useSocialMutations();

  const myPosts = useMemo(
    () => posts.filter((p) => p.assigned_to === uid && !["publicado", "reprovado"].includes(p.status)),
    [posts, uid]
  );
  const myTasks = useMemo(
    () => tasks.filter((t) => t.assigned_to === uid && !["concluido", "descartado"].includes(t.status)),
    [tasks, uid]
  );

  const focusedTask = focusedTaskId ? tasks.find((t) => t.id === focusedTaskId) : null;
  const focusedPost = focusedPostId ? posts.find((p) => p.id === focusedPostId) : null;

  // Timer — persiste por tarefa/post em localStorage para não zerar ao sair/voltar
  const timerKey = focusedTaskId ? `sm-focus-timer:task:${focusedTaskId}` : focusedPostId ? `sm-focus-timer:post:${focusedPostId}` : null;
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!timerKey) { setSeconds(0); setRunning(false); return; }
    const stored = Number(localStorage.getItem(timerKey) || "0");
    setSeconds(isNaN(stored) ? 0 : stored);
    setRunning(true);
  }, [timerKey]);

  useEffect(() => {
    if (!running || !timerKey) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        localStorage.setItem(timerKey, String(next));
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, timerKey]);

  const resetTimer = () => {
    setSeconds(0);
    if (timerKey) localStorage.removeItem(timerKey);
  };

  const exitFocus = () => {
    setRunning(false);
    setParams({});
  };

  const updateTaskStatus = async (status: string) => {
    if (!focusedTask) return;
    const { error } = await m.updateTask(focusedTask.id, { status });
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    refreshTasks();
  };

  const completeTask = async () => {
    if (!focusedTask) return;
    const { error } = await m.updateTask(focusedTask.id, { status: "concluido" });
    if (error) return toast.error(error.message);
    toast.success(`Tarefa concluída em ${fmt(seconds)}`);
    if (timerKey) localStorage.removeItem(timerKey);
    refreshTasks();
    exitFocus();
  };

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

  // ============= FOCUSED VIEW =============
  if (focusedTask || focusedPost) {
    const title = focusedTask?.title ?? focusedPost?.title ?? "";
    const description = focusedTask?.description ?? (focusedPost as any)?.notes ?? "";
    const priority = (focusedTask?.priority ?? focusedPost?.priority) as SmPriority;
    const due = focusedTask?.due_date ?? focusedPost?.scheduled_at;

    return (
      <div className="space-y-6">
        <PageHeader
          title="Modo Foco"
          description="Concentre-se em uma única tarefa"
          icon={<Target className="h-6 w-6" />}
          actions={
            <Button variant="outline" onClick={exitFocus}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Sair do foco
            </Button>
          }
        />

        <Card className="border-primary/30">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={PRIORITY_VARIANT[priority]}>{SM_PRIORITY_LABEL[priority]}</Badge>
              <Badge variant="outline">{focusedTask ? "Tarefa" : "Post"}</Badge>
              {due && (
                <span className="text-xs text-muted-foreground">
                  Prazo: {new Date(due).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
            <CardTitle className="text-2xl">{title}</CardTitle>
            {description && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{description}</p>}
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Timer */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-muted/30 p-8">
              <div className="text-6xl font-mono font-semibold tabular-nums">{fmt(seconds)}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                {running ? "Em foco" : "Pausado"}
              </div>
              <div className="mt-4 flex gap-2">
                <Button onClick={() => setRunning((r) => !r)} size="lg">
                  {running ? <><Pause className="h-4 w-4 mr-1" /> Pausar</> : <><Play className="h-4 w-4 mr-1" /> Retomar</>}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setSeconds(0)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Zerar
                </Button>
              </div>
            </div>

            {/* Task controls */}
            {focusedTask && (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-muted-foreground">Status:</span>
                <Select value={focusedTask.status} onValueChange={updateTaskStatus}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS.map((s) => <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button onClick={completeTask} className="ml-auto">
                  <Check className="h-4 w-4 mr-1" /> Concluir tarefa
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Up next */}
        {(myTasks.length > 1 || myPosts.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Próximos da sua fila</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {myTasks.filter((t) => t.id !== focusedTaskId).slice(0, 5).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setParams({ taskId: t.id })}
                  className="w-full flex items-center justify-between gap-2 rounded-md border border-border p-3 hover:bg-muted/50 text-left"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground">Tarefa · {TASK_STATUS_LABEL[t.status] ?? t.status}</div>
                  </div>
                  <Badge variant={PRIORITY_VARIANT[t.priority]}>{SM_PRIORITY_LABEL[t.priority]}</Badge>
                </button>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // ============= LIST VIEW =============

  const total = myPosts.length + myTasks.length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Modo Foco — Social Media"
        description="Suas pendências organizadas por prioridade. Clique em um item para focar."
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
                  {g.posts.map((post) => (
                    <div key={post.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{post.title}</div>
                        <div className="text-xs text-muted-foreground">Post · {SM_POST_STATUS_LABEL[post.status]}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {post.scheduled_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(post.scheduled_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setParams({ postId: post.id })}>
                          <Target className="h-3.5 w-3.5 mr-1" /> Focar
                        </Button>
                      </div>
                    </div>
                  ))}
                  {g.tasks.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border p-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.title}</div>
                        <div className="text-xs text-muted-foreground">Tarefa · {TASK_STATUS_LABEL[t.status] ?? t.status}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        {t.due_date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(t.due_date).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                        <Button size="sm" onClick={() => setParams({ taskId: t.id })}>
                          <Target className="h-3.5 w-3.5 mr-1" /> Focar
                        </Button>
                      </div>
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
