import { useRanking, useMyGamification, LEVELS, MEDAL_DEFS } from "@/hooks/useGamification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Medal, Star, Loader2, Zap, TrendingUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const Ranking = () => {
  const { data: ranking, isLoading } = useRanking();
  const { data: myData } = useMyGamification();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const actionLabels: Record<string, string> = {
    executed: "Tarefa concluída",
    approved_lider: "Aprovação (Líder)",
    approved_gestor: "Aprovação (Gestor)",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Engajamento</h1>
        <p className="text-muted-foreground">XP, ranking, níveis e medalhas do time.</p>
      </div>

      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList className="bg-secondary">
          <TabsTrigger value="ranking">
            <Trophy className="h-4 w-4 mr-1.5" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="me">
            <Star className="h-4 w-4 mr-1.5" />
            Meu Progresso
          </TabsTrigger>
          <TabsTrigger value="medals">
            <Medal className="h-4 w-4 mr-1.5" />
            Medalhas
          </TabsTrigger>
        </TabsList>

        {/* RANKING TAB */}
        <TabsContent value="ranking" className="space-y-3">
          {!ranking || ranking.length === 0 ? (
            <Card className="border-border">
              <CardContent className="flex flex-col items-center py-16">
                <Trophy className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground">Nenhum XP registrado ainda.</p>
              </CardContent>
            </Card>
          ) : (
            ranking.map((entry, i) => {
              const podium = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              const initials = entry.full_name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <Card
                  key={entry.user_id}
                  className={`border-border transition-all ${i === 0 ? "ring-1 ring-primary/30 bg-primary/5" : ""}`}
                >
                  <CardContent className="flex items-center gap-4 py-4">
                    <span className="text-lg font-bold w-8 text-center shrink-0">
                      {podium || `${i + 1}`}
                    </span>
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{entry.full_name}</p>
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {entry.level.icon} {entry.level.name}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={entry.level.progressToNext} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          Nv. {entry.level.level}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-primary">{entry.total_xp}</p>
                      <p className="text-[10px] text-muted-foreground">XP</p>
                    </div>
                    {entry.medals.length > 0 && (
                      <div className="flex gap-0.5 shrink-0">
                        {entry.medals.slice(0, 4).map((key) => (
                          <Tooltip key={key}>
                            <TooltipTrigger asChild>
                              <span className="text-sm cursor-default">{MEDAL_DEFS[key]?.icon || "🏅"}</span>
                            </TooltipTrigger>
                            <TooltipContent>{MEDAL_DEFS[key]?.name || key}</TooltipContent>
                          </Tooltip>
                        ))}
                        {entry.medals.length > 4 && (
                          <span className="text-[10px] text-muted-foreground">+{entry.medals.length - 4}</span>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        {/* MY PROGRESS TAB */}
        <TabsContent value="me" className="space-y-4">
          {myData ? (
            <>
              <Card className="border-border">
                <CardContent className="py-6">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{myData.level.icon}</div>
                    <div className="flex-1">
                      <p className="text-lg font-bold text-foreground">{myData.level.name}</p>
                      <p className="text-sm text-muted-foreground">Nível {myData.level.level}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={myData.level.progressToNext} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {myData.totalXp} XP
                          {myData.level.nextLevel && ` / ${myData.level.nextLevel.minXp}`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">{myData.totalXp}</p>
                      <p className="text-xs text-muted-foreground">XP Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Levels roadmap */}
              <Card className="border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    Níveis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {LEVELS.map((l) => {
                      const reached = myData.totalXp >= l.minXp;
                      return (
                        <div
                          key={l.level}
                          className={`flex items-center gap-3 rounded-md p-2 ${reached ? "bg-primary/10" : "bg-secondary/30 opacity-50"}`}
                        >
                          <span className="text-lg">{l.icon}</span>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${reached ? "text-foreground" : "text-muted-foreground"}`}>
                              {l.name}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">{l.minXp} XP</span>
                          {reached && <Badge className="bg-primary/20 text-primary text-[10px]">✓</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Recent XP */}
              {myData.recentXp.length > 0 && (
                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-foreground flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      XP Recente
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {myData.recentXp.map((log: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{actionLabels[log.action] || log.action}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleDateString("pt-BR")}
                            </span>
                            <Badge variant="secondary" className="text-[10px] text-primary">+{log.xp_earned} XP</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-border">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Conclua tarefas para ganhar XP!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* MEDALS TAB */}
        <TabsContent value="medals" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(MEDAL_DEFS).map(([key, medal]) => {
              const earned = myData?.medals.includes(key);
              return (
                <Card key={key} className={`border-border transition-all ${earned ? "ring-1 ring-primary/30" : "opacity-40"}`}>
                  <CardContent className="flex items-center gap-3 py-4">
                    <span className="text-2xl">{medal.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${earned ? "text-foreground" : "text-muted-foreground"}`}>
                        {medal.name}
                      </p>
                      <p className="text-xs text-muted-foreground">{medal.description}</p>
                    </div>
                    {earned && <Badge className="bg-primary/20 text-primary text-[10px] shrink-0">Conquistada!</Badge>}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Ranking;
