# Religar o banco e deixar o ranking mais leve

## O que vai acontecer
1. Reiniciar o banco e esperar ele voltar a responder, o que leva uns 4 minutos.
2. Deixar o cálculo do ranking mais leve sem mudar nenhum resultado. XP, medalhas, tarefas concluídas, Tarefas Técnicas e o Kanban continuam contando exatamente como hoje.
3. Comparar o ranking de antes com o de depois. Se algum número mudar, a mudança é desfeita.

## O que não muda
Nenhuma tela, regra ou dado existente vai mudar. O que muda é só a forma como o servidor faz a conta.

## Detalhes técnicos
- Antes de mudar, salvar a saída atual de `gamification_stats()` como referência.
- Renomear o cálculo atual para `_gamification_stats_compute`, mantendo a mesma lógica (subtasks e kanban_tasks incluídas). Trocar as subqueries correlacionadas por JOINs pré-agregados.
- Criar `gamification_stats_cache`, com uma linha só, RLS ligada e acesso apenas pelo service_role. `gamification_stats()` passa a servir o cache por 60 segundos, com a mesma assinatura e o mesmo formato de retorno.
- Criar `task_time_totals()`, se ainda não existir (é usada por useTasks).
- Criar os índices: task_events (event_type='completed'), automation_events (event_type='status_changed'), tasks(status, assigned_to), tasks(created_at desc), time_logs(task_id).
- Validar se a saída nova é igual à de referência e, depois, conferir com slow_queries.
