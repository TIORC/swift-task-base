import { useRanking, useMyGamification, LEVELS, MEDAL_ICON, MEDAL_PER_TASKS, TI_TEAM, XP_PER_AUTOMATION, XP_PER_TASK } from "@/hooks/useGamification";
import { useTeamMetrics } from "@/hooks/useTeamMetrics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Trophy, Medal, Star, Loader2, Zap, TrendingUp, Users, CheckCircle2, Bot, Clock, Building2 } from "lucide-react";
import { SECTOR_COLORS, SECTOR_LABELS } from "@/types/sectors";

const Ranking = () => {
  const { data: ranking, isLoading } = useRanking();
  const { data: myData } = useMyGamification();
  const { data: team, isLoading: teamLoading } = useTeamMetrics();

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const fmtH = (m: number) => `${Math.floor(m / 60)}h ${m % 60}m`;

  return (
    <div className="space-y-6 max-w-6xl">
      <PageHeader
        title="Engajamento & Ranking TI"
        description="XP, equipe, medalhas e progresso individual."
        icon={<Trophy className="h-5 w-5" />}
      />

      <Tabs defaultValue="ranking" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap">
          <TabsTrigger value="ranking" className="rounded-lg"><Trophy className="h-4 w-4 mr-1.5" />Ranking XP</TabsTrigger>
          <TabsTrigger value="team" className="rounded-lg"><Users className="h-4 w-4 mr-1.5" />Equipe</TabsTrigger>
          <TabsTrigger value="me" className="rounded-lg"><Star className="h-4 w-4 mr-1.5" />Meu Progresso</TabsTrigger>
          <TabsTrigger value="medals" className="rounded-lg"><Medal className="h-4 w-4 mr-1.5" />Medalhas</TabsTrigger>
        </TabsList>

        {/* ============ RANKING XP — apenas equipe TI ============ */}
        <TabsContent value="ranking" className="space-y-4">
          <Card className="shadow-card bg-primary/5 border-primary/20">
            <CardContent className="py-3 px-5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Regra de XP:</span>{" "}
              cada tarefa/chamado concluído = <strong>{XP_PER_TASK} XP</strong>, cada automação concluída = <strong>{XP_PER_AUTOMATION} XP</strong>.
              Welder e Angel recebem XP inicial pelo tempo de TI.
            </CardContent>
          </Card>

          {!ranking || ranking.length === 0 ? (
            <Card className="shadow-card"><CardContent className="p-0"><EmptyState icon={Trophy} title="Nenhum XP registrado" /></CardContent></Card>
          ) : (
            <div className="space-y-2">
              {ranking.map((entry, i) => {
                const podium = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                const initials = entry.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
                const seedNote = TI_TEAM[entry.user_id]?.note;
                return (
                  <Card key={entry.user_id} className={`shadow-card transition-all duration-150 hover:shadow-card-hover ${i === 0 ? "ring-1 ring-primary/20" : ""}`}>
                    <CardContent className="flex items-center gap-4 py-4 px-5">
                      <span className="text-lg font-bold w-8 text-center shrink-0">{podium || `${i + 1}`}</span>
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-foreground truncate">{entry.full_name}</p>
                          <Badge variant="outline" className="text-[10px] shrink-0">{entry.level.icon} {entry.level.name}</Badge>
                          {seedNote && <span className="text-[10px] text-muted-foreground">({seedNote})</span>}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Progress value={entry.level.progressToNext} className="h-1.5 flex-1" />
                          <span className="text-[10px] text-muted-foreground shrink-0">Nv. {entry.level.level}</span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                          <span><CheckCircle2 className="inline h-3 w-3 mr-0.5" />{entry.tasks_done} tarefas</span>
                          <span><Bot className="inline h-3 w-3 mr-0.5" />{entry.automations_done} automações</span>
                          {entry.seed_xp > 0 && <span>+{entry.seed_xp} XP inicial</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-bold text-primary">{entry.total_xp}</p>
                        <p className="text-[10px] text-muted-foreground">XP</p>
                      </div>
                      <div className="text-right shrink-0 border-l pl-3 border-border/40">
                        <p className="text-lg font-bold">{MEDAL_ICON} {entry.medals_month}</p>
                        <p className="text-[10px] text-muted-foreground">medalhas no mês</p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Setores (movido para cá) */}
          {team && team.sectors.length > 0 && (
            <Card className="shadow-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Automações por setor</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {team.sectors.map((s) => (
                  <div key={s.sector} className="rounded-xl border border-border/60 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={SECTOR_COLORS[s.sector] || ""}>{SECTOR_LABELS[s.sector] || s.sector}</Badge>
                      <span className="text-xs text-muted-foreground">{fmtH(s.minutes)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Progress value={s.completion_rate} className="h-2 flex-1" />
                      <span className="text-xs font-semibold w-10 text-right">{s.completion_rate}%</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div><p className="text-base font-bold text-emerald-500">{s.done}</p><p className="text-[10px] text-muted-foreground">Concl.</p></div>
                      <div><p className="text-base font-bold text-blue-500">{s.in_progress}</p><p className="text-[10px] text-muted-foreground">Andam.</p></div>
                      <div><p className="text-base font-bold text-purple-500">{s.pending}</p><p className="text-[10px] text-muted-foreground">Pend.</p></div>
                      <div><p className="text-base font-bold text-red-500">{s.blocked}</p><p className="text-[10px] text-muted-foreground">Bloq.</p></div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ============ EQUIPE — ranking por horas ============ */}
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
                <CardHeader className="pb-2"><CardTitle className="text-sm">Ranking por horas trabalhadas (chamados + tarefas + automações)</CardTitle></CardHeader>
                <CardContent className="p-0">
                  {team.users.length === 0 ? (
                    <EmptyState icon={Users} title="Sem atividade registrada" />
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Pessoa</TableHead>
                          <TableHead className="text-center">Horas trabalhadas</TableHead>
                          <TableHead className="text-right">Medalhas (mês)</TableHead>
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
                              <TableCell className="text-center text-sm font-semibold">{fmtH(u.minutes)}</TableCell>
                              <TableCell className="text-right text-sm font-semibold">{MEDAL_ICON} {u.medals_month}</TableCell>
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

        {/* ============ MEU PROGRESSO ============ */}
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
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span><CheckCircle2 className="inline h-3.5 w-3.5 mr-0.5" />{myData.tasksDone} tarefas (+{myData.tasksDone * XP_PER_TASK} XP)</span>
                        <span><Bot className="inline h-3.5 w-3.5 mr-0.5" />{myData.autosDone} automações (+{myData.autosDone * XP_PER_AUTOMATION} XP)</span>
                        {myData.seedXp > 0 && <span>+{myData.seedXp} XP inicial</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-bold text-primary">{myData.totalXp}</p>
                      <p className="text-xs text-muted-foreground">XP Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="shadow-card">
                  <CardContent className="py-4 px-5 flex items-center gap-3">
                    <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                    <div>
                      <p className="text-2xl font-bold">{myData.tasksOnlyDone}</p>
                      <p className="text-xs text-muted-foreground">tarefas concluídas</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardContent className="py-4 px-5 flex items-center gap-3">
                    <Zap className="h-7 w-7 text-amber-500" />
                    <div>
                      <p className="text-2xl font-bold">{myData.chamadosDone}</p>
                      <p className="text-xs text-muted-foreground">chamados concluídos</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardContent className="py-4 px-5 flex items-center gap-3">
                    <Bot className="h-7 w-7 text-indigo-500" />
                    <div>
                      <p className="text-2xl font-bold">{myData.autosDone}</p>
                      <p className="text-xs text-muted-foreground">automações concluídas</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card className="shadow-card">
                  <CardContent className="py-4 px-5 flex items-center gap-3">
                    <span className="text-3xl">{MEDAL_ICON}</span>
                    <div>
                      <p className="text-2xl font-bold">{myData.medalsMonth}</p>
                      <p className="text-xs text-muted-foreground">medalhas este mês</p>
                    </div>
                  </CardContent>
                </Card>
                <Card className="shadow-card">
                  <CardContent className="py-4 px-5 flex items-center gap-3">
                    <span className="text-3xl">🏆</span>
                    <div>
                      <p className="text-2xl font-bold">{myData.medalsYear}</p>
                      <p className="text-xs text-muted-foreground">medalhas no ano</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

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

              {myData.recent.length > 0 && (
                <Card className="shadow-card">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-foreground flex items-center gap-2"><Zap className="h-4 w-4 text-primary" />XP Recente</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5">
                      {myData.recent.map((log, i) => (
                        <div key={i} className="flex items-center justify-between text-sm gap-2">
                          <span className="text-muted-foreground truncate">{log.label}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-muted-foreground">{new Date(log.ts).toLocaleDateString("pt-BR")}</span>
                            <Badge variant="outline" className="text-[10px] text-primary border-primary/20">+{log.xp} XP</Badge>
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

        {/* ============ MEDALHAS — mensal e anual ============ */}
        <TabsContent value="medals" className="space-y-4">
          {!myData ? (
            <Card className="shadow-card"><CardContent className="p-0"><EmptyState icon={Medal} title="Sem medalhas ainda" /></CardContent></Card>
          ) : (
            <>
              <Card className="shadow-card bg-gradient-to-br from-amber-500/10 to-primary/5 border-amber-500/20">
                <CardContent className="py-6 px-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-6xl">{MEDAL_ICON}</span>
                    <div>
                      <p className="text-4xl font-bold">{myData.medalsYear}</p>
                      <p className="text-sm text-muted-foreground">medalhas acumuladas em {new Date().getFullYear()}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{myData.medalsMonth}</p>
                    <p className="text-xs text-muted-foreground">este mês</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-foreground">Como ganhar medalhas</CardTitle>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <p>• A cada <strong>{MEDAL_PER_TASKS} tarefas/chamados</strong> concluídos no mês = <strong>1 {MEDAL_ICON}</strong></p>
                  <p>• Cada <strong>automação concluída</strong> no mês = <strong>1 {MEDAL_ICON}</strong></p>
                  <p>• As medalhas acumulam por mês e contam para o total do ano.</p>
                </CardContent>
              </Card>

              <Card className="shadow-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-foreground">Histórico mensal</CardTitle>
                </CardHeader>
                <CardContent>
                  {myData.monthly.length === 0 ? (
                    <EmptyState icon={Medal} title="Sem conclusões registradas" />
                  ) : (
                    <div className="space-y-2">
                      {myData.monthly.map((m) => (
                        <div key={m.key} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">{m.label}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {m.tasksDone} tarefas · {m.autosDone} automações · {m.xp} XP
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap justify-end max-w-[55%]">
                            {m.total === 0 ? (
                              <span className="text-xs text-muted-foreground">—</span>
                            ) : (
                              <>
                                {Array.from({ length: Math.min(m.total, 12) }).map((_, i) => (
                                  <span key={i} className="text-xl leading-none">{MEDAL_ICON}</span>
                                ))}
                                {m.total > 12 && <span className="text-xs font-semibold ml-1">+{m.total - 12}</span>}
                              </>
                            )}
                          </div>
                          <Badge variant="outline" className="text-[10px] shrink-0">{m.total} {MEDAL_ICON}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Ranking;
