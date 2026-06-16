import { useRanking, useMyGamification, LEVELS, MEDAL_DEFS } from "@/hooks/useGamification";
import { useTeamMetrics } from "@/hooks/useTeamMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Trophy, Medal, Star, Loader2, Zap, TrendingUp, Users, Building2, CheckCircle2, Bot, Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SECTOR_COLORS, SECTOR_LABELS } from "@/types/sectors";


const Ranking = () => {
  const { data: ranking, isLoading } = useRanking();
  const { data: myData } = useMyGamification();
  const { data: team, isLoading: teamLoading } = useTeamMetrics();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const fmtH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;


  const actionLabels: Record<string, string> = {
    executed: "Tarefa concluída",
    approved_lider: "Aprovação (Líder)",
    approved_gestor: "Aprovação (Gestor)",
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader title="Engajamento & Ranking TI" description="XP, equipe, setores, níveis e medalhas." icon={<Trophy className="h-5 w-5" />} />

      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap">
          <TabsTrigger value="ranking" className="rounded-lg"><Trophy className="h-4 w-4 mr-1.5" />Ranking XP</TabsTrigger>
          <TabsTrigger value="team" className="rounded-lg"><Users className="h-4 w-4 mr-1.5" />Equipe</TabsTrigger>
          <TabsTrigger value="sectors" className="rounded-lg"><Building2 className="h-4 w-4 mr-1.5" />Setores</TabsTrigger>
          <TabsTrigger value="me" className="rounded-lg"><Star className="h-4 w-4 mr-1.5" />Meu Progresso</TabsTrigger>
          <TabsTrigger value="medals" className="rounded-lg"><Medal className="h-4 w-4 mr-1.5" />Medalhas</TabsTrigger>
        </TabsList>


        <TabsContent value="ranking" className="space-y-2">
          {!ranking || ranking.length === 0 ? (
            <Card className="shadow-card"><CardContent className="p-0"><EmptyState icon={Trophy} title="Nenhum XP registrado" /></CardContent></Card>
          ) : (
            ranking.map((entry, i) => {
              const podium = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
              const initials = entry.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
              return (
                <Card key={entry.user_id} className={`shadow-card transition-all duration-150 hover:shadow-card-hover ${i === 0 ? "ring-1 ring-primary/20" : ""}`}>
                  <CardContent className="flex items-center gap-4 py-4 px-5">
                    <span className="text-lg font-bold w-8 text-center shrink-0">{podium || `${i + 1}`}</span>
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{entry.full_name}</p>
                        <Badge variant="outline" className="text-[10px] shrink-0">{entry.level.icon} {entry.level.name}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress value={entry.level.progressToNext} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground shrink-0">Nv. {entry.level.level}</span>
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
                            <TooltipTrigger asChild><span className="text-sm cursor-default">{MEDAL_DEFS[key]?.icon || "🏅"}</span></TooltipTrigger>
                            <TooltipContent>{MEDAL_DEFS[key]?.name || key}</TooltipContent>
                          </Tooltip>
                        ))}
                        {entry.medals.length > 4 && <span className="text-[10px] text-muted-foreground">+{entry.medals.length - 4}</span>}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          {teamLoading || !team ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-card"><CardContent className="py-4 px-5"><div className="flex items-center gap-3"><CheckCircle2 className="h-5 w-5 text-emerald-500" /><div><p className="text-xs text-muted-foreground">Tarefas concluídas</p><p className="text-xl font-bold">{team.totals.tasks_done}<span className="text-xs text-muted-foreground font-normal"> / {team.totals.tasks}</span></p></div></div></CardContent></Card>
                <Card className="shadow-card"><CardContent className="py-4 px-5"><div className="flex items-center gap-3"><Bot className="h-5 w-5 text-indigo-500" /><div><p className="text-xs text-muted-foreground">Automações concluídas</p><p className="text-xl font-bold">{team.totals.automations_done}<span className="text-xs text-muted-foreground font-normal"> / {team.totals.automations}</span></p></div></div></CardContent></Card>
                <Card className="shadow-card"><CardContent className="py-4 px-5"><div className="flex items-center gap-3"><Clock className="h-5 w-5 text-amber-500" /><div><p className="text-xs text-muted-foreground">Horas trabalhadas</p><p className="text-xl font-bold">{fmtH(team.totals.minutes)}</p></div></div></CardContent></Card>
                <Card className="shadow-card"><CardContent className="py-4 px-5"><div className="flex items-center gap-3"><Users className="h-5 w-5 text-primary" /><div><p className="text-xs text-muted-foreground">Pessoas ativas</p><p className="text-xl font-bold">{team.users.length}</p></div></div></CardContent></Card>
              </div>

              <Card className="shadow-card">
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ranking por atividade</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {team.users.length === 0 ? (
                    <EmptyState icon={Users} title="Sem atividade registrada" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Pessoa</TableHead>
                          <TableHead className="text-center">Tarefas</TableHead>
                          <TableHead className="text-center">Automações</TableHead>
                          <TableHead className="text-center">Horas</TableHead>
                          <TableHead className="text-center">Comentários</TableHead>
                          <TableHead className="text-right">Conclusão</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {team.users.map((u, i) => {
                          const initials = u.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                          return (
                            <TableRow key={u.user_id}>
                              <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-7 w-7"><AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback></Avatar>
                                  <span className="text-sm font-medium">{u.full_name}</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-center text-sm">{u.tasks_done}<span className="text-muted-foreground">/{u.tasks_total}</span></TableCell>
                              <TableCell className="text-center text-sm">{u.automations_done}<span className="text-muted-foreground">/{u.automations_total}</span></TableCell>
                              <TableCell className="text-center text-sm">{fmtH(u.minutes)}</TableCell>
                              <TableCell className="text-center text-sm">{u.comments}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-2 justify-end">
                                  <Progress value={u.completion_rate} className="h-1.5 w-20" />
                                  <span className="text-xs text-muted-foreground w-8">{u.completion_rate}%</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="sectors" className="space-y-3">
          {teamLoading || !team ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : team.sectors.length === 0 ? (
            <Card className="shadow-card"><CardContent className="p-0"><EmptyState icon={Building2} title="Nenhuma automação por setor" /></CardContent></Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {team.sectors.map((s) => (
                <Card key={s.sector} className="shadow-card">
                  <CardContent className="py-4 px-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={SECTOR_COLORS[s.sector] || ""}>{SECTOR_LABELS[s.sector] || s.sector}</Badge>
                      <span className="text-xs text-muted-foreground">{fmtH(s.minutes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={s.completion_rate} className="h-2 flex-1" />
                      <span className="text-xs font-semibold w-10 text-right">{s.completion_rate}%</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><p className="text-lg font-bold text-emerald-500">{s.done}</p><p className="text-[10px] text-muted-foreground">Concluídas</p></div>
                      <div><p className="text-lg font-bold text-blue-500">{s.in_progress}</p><p className="text-[10px] text-muted-foreground">Em andamento</p></div>
                      <div><p className="text-lg font-bold text-purple-500">{s.pending}</p><p className="text-[10px] text-muted-foreground">Pendentes</p></div>
                      <div><p className="text-lg font-bold text-red-500">{s.blocked}</p><p className="text-[10px] text-muted-foreground">Bloqueadas</p></div>
                    </div>
                    <p className="text-[11px] text-muted-foreground text-right">Total: {s.total}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>



        <TabsContent value="me" className="space-y-4">
          {myData ? (
            <>
              <Card className="shadow-card">
                <CardContent className="py-6 px-6">
                  <div className="flex items-center gap-4">
                    <div className="text-4xl">{myData.level.icon}</div>
                    <div className="flex-1">
                      <p className="text-lg font-bold text-foreground">{myData.level.name}</p>
                      <p className="text-sm text-muted-foreground">Nível {myData.level.level}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={myData.level.progressToNext} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">
                          {myData.totalXp} XP{myData.level.nextLevel && ` / ${myData.level.nextLevel.minXp}`}
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

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />Níveis
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {LEVELS.map((l) => {
                      const reached = myData.totalXp >= l.minXp;
                      return (
                        <div key={l.level} className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors ${reached ? "bg-primary/5" : "bg-muted/30 opacity-50"}`}>
                          <span className="text-lg">{l.icon}</span>
                          <div className="flex-1">
                            <p className={`text-sm font-medium ${reached ? "text-foreground" : "text-muted-foreground"}`}>{l.name}</p>
                          </div>
                          <span className="text-xs text-muted-foreground">{l.minXp} XP</span>
                          {reached && <Badge variant="outline" className="text-[10px] text-primary border-primary/20">✓</Badge>}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {myData.recentXp.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-foreground flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />XP Recente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {myData.recentXp.map((log: any, i: number) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{actionLabels[log.action] || log.action}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{new Date(log.created_at).toLocaleDateString("pt-BR")}</span>
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/20">+{log.xp_earned} XP</Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="shadow-card"><CardContent className="p-0"><EmptyState icon={Star} title="Conclua tarefas para ganhar XP!" /></CardContent></Card>
          )}
        </TabsContent>

        <TabsContent value="medals" className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(MEDAL_DEFS).map(([key, medal]) => {
              const earned = myData?.medals.includes(key);
              return (
                <Card key={key} className={`shadow-card transition-all duration-150 ${earned ? "ring-1 ring-primary/20" : "opacity-40"}`}>
                  <CardContent className="flex items-center gap-3 py-4 px-5">
                    <span className="text-2xl">{medal.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${earned ? "text-foreground" : "text-muted-foreground"}`}>{medal.name}</p>
                      <p className="text-xs text-muted-foreground">{medal.description}</p>
                    </div>
                    {earned && <Badge variant="outline" className="text-[10px] text-primary border-primary/20 shrink-0">✓</Badge>}
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
