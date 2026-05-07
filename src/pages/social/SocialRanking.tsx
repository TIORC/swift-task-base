import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { useSmPosts, useSmTasks } from "@/hooks/useSocial";
import { Trophy } from "lucide-react";

const sb = supabase as any;

export default function SocialRanking() {
  const { data: posts } = useSmPosts();
  const { data: tasks } = useSmTasks();
  const [profiles, setProfiles] = useState<Record<string, { full_name: string }>>({});

  useEffect(() => {
    (async () => {
      const { data } = await sb.from("profiles").select("id, full_name");
      const map: Record<string, { full_name: string }> = {};
      (data ?? []).forEach((p: any) => { map[p.id] = { full_name: p.full_name || "Usuário" }; });
      setProfiles(map);
    })();
  }, []);

  const ranking = useMemo(() => {
    const score: Record<string, { posts: number; publicados: number; tasks: number; tasksDone: number }> = {};
    const ensure = (id: string) => {
      if (!score[id]) score[id] = { posts: 0, publicados: 0, tasks: 0, tasksDone: 0 };
      return score[id];
    };
    posts.forEach((p) => {
      if (!p.assigned_to) return;
      const s = ensure(p.assigned_to);
      s.posts += 1;
      if (p.status === "publicado") s.publicados += 1;
    });
    tasks.forEach((t) => {
      if (!t.assigned_to) return;
      const s = ensure(t.assigned_to);
      s.tasks += 1;
      if (t.status === "concluido") s.tasksDone += 1;
    });
    return Object.entries(score)
      .map(([uid, s]) => ({
        uid,
        name: profiles[uid]?.full_name ?? "Usuário",
        ...s,
        xp: s.publicados * 10 + s.tasksDone * 5 + (s.posts - s.publicados) * 2 + (s.tasks - s.tasksDone),
      }))
      .sort((a, b) => b.xp - a.xp);
  }, [posts, tasks, profiles]);

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Ranking — Social Media"
        description="Produtividade da equipe"
        icon={<Trophy className="h-6 w-6" />}
      />

      {ranking.length === 0 ? (
        <Card><CardContent className="p-0"><EmptyState icon={Trophy} title="Sem dados ainda" /></CardContent></Card>
      ) : (
        <div className="space-y-2">
          {ranking.map((entry, i) => {
            const podium = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
            const initials = entry.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <Card key={entry.uid}>
                <CardContent className="flex items-center gap-4 py-4 px-5">
                  <span className="text-lg font-bold w-8 text-center shrink-0">{podium || `${i + 1}`}</span>
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{entry.name}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <Badge variant="outline" className="text-[10px]">{entry.publicados} publicados</Badge>
                      <Badge variant="outline" className="text-[10px]">{entry.tasksDone} tarefas concluídas</Badge>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-primary">{entry.xp}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">XP</div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
