# Deixar as páginas carregarem mais rápido

## O que encontrei
- O banco é pequeno (38 MB), mas o servidor está com o limite de leitura de disco apertado. Hoje de madrugada ele já tinha gastado mais da metade desse limite. Por isso, consultas simples estão levando de 0,4 a 3 segundos.
- **O sininho de notificações baixa todas as tarefas (2.095) e todas as horas lançadas em todas as páginas.** Como ele fica no topo de todas as telas, qualquer página paga esse custo.
- A lista de tarefas ainda baixa todos os lançamentos de horas para somar no navegador. As melhorias de antes (somar as horas no servidor, não recarregar tudo ao trocar de aba, agrupar as atualizações ao vivo) não estão mais no código.
- Toda vez que você volta para a aba do navegador, o app pede todos os dados de novo ao servidor.
- A busca de notificações não tem atalho no banco. Por isso ela lê a tabela inteira (3.686 linhas) a cada abertura e leva 0,4 s em média.
- A análise de IA do Dashboard roda sozinha a cada 10 minutos e envia todas as tarefas. Às vezes ela trava por até 150 s (o erro 504 de antes, que ainda não foi corrigido).

## O que vai mudar
1. **Sininho mais leve:** ele vai mostrar as notificações sem baixar a lista de tarefas. Ao clicar numa notificação, ele abre a tarefa pelo link, como faz hoje.
2. **Horas somadas no servidor:** a lista de tarefas recebe só o total de cada tarefa, sem baixar todos os lançamentos.
3. **Menos recargas:** os dados ficam guardados por 30 segundos, e voltar para a aba não recarrega tudo. Ranking e Meu Progresso ficam guardados por 2 minutos.
4. **Atualizações ao vivo agrupadas:** no Dashboard e no Painel do Gestor, várias mudanças seguidas viram uma única atualização a cada 5 segundos.
5. **Atalho no banco para notificações**, por usuário e por data, e para as menções não lidas.
6. **Análise de IA:** sem atualização automática. Ela vai enviar só as 150 tarefas em aberto mais recentes e desistir depois de 60 s, mostrando um aviso no lugar de deixar a tela em branco.

## O que não muda
Nenhuma regra, nenhum número e nenhuma tela mudam. XP, medalhas, ranking, Tarefas Técnicas, o Kanban e as notificações continuam funcionando igual.

## Se ainda ficar lento
Depois disso, vou medir de novo as consultas mais lentas. Se o limite de disco continuar estourando, a saída é aumentar o servidor em Cloud. Antes de qualquer mudança eu mostro o custo.

## Detalhes técnicos
- `src/components/NotificationBell.tsx`: remover `useTasks()`; resolver o destino por `n.link` / `n.task_id`. Se precisar do título ou do status da tarefa, buscar uma única tarefa por id, sob demanda.
- `src/hooks/useTasks.ts`: trocar `select task_id, duration_minutes from time_logs` por `rpc("task_time_totals")`. A RPC já existe no banco (STABLE).
- `src/App.tsx`: `new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 } } })`.
- `src/hooks/useGamification.ts`: `staleTime: 120_000`. O cache de 60 s no servidor (`gamification_stats_cache`) já está ativo.
- `src/pages/Index.tsx` e `src/pages/ManagerDashboard.tsx`: aplicar debounce de 5 s no `invalidateQueries` dos canais realtime.
- Migration: `CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC)` e `idx_notifications_unread_mentions ON notifications(user_id) WHERE type='mention' AND read=false`.
- `src/hooks/useAIInsights.ts`: remover `refetchInterval`, `staleTime` de 30 min, `retry: false`.
- `supabase/functions/ai-insights/index.ts`: limitar às tarefas não concluídas (`limit 150`, ordenadas por `updated_at`), usar `task_time_totals` e `AbortController` com 60 s, devolvendo uma resposta vazia com aviso. Fazer o deploy em seguida.
- Validar: typecheck, sininho e Dashboard via Playwright logado e `slow_queries` depois de alguns minutos de uso.
