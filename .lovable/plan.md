# Kanban independente do TI (com XP)

## Objetivo
O /kanban passa a ter as próprias tarefas. O que for criado ou movido nele não aparece em /tarefas, e o contrário também vale. A conclusão de uma tarefa no Kanban continua dando XP e contando no ranking, em "Meu Progresso" e nas medalhas.

## O que muda para o usuário
- O Kanban começa vazio, só com as tarefas novas. As tarefas que já existem continuam em /tarefas.
- As colunas continuam as mesmas: Backlog, Pendente, Em Andamento, Em Validação, Concluído e Descartado.
- No cartão dá para mudar título, descrição, responsável, prioridade, prazo e status, e também comentar.
- Concluir uma tarefa no Kanban dá **1 XP**, só na primeira vez. Se a tarefa for reaberta, o XP não conta de novo. Se ela sair de "Concluído" ou for excluída, o XP é retirado.
- Quem vê o quê continua seguindo as regras de hoje: membros veem as próprias tarefas e as que estão sem responsável, e o gestor só visualiza.

## O que fica de fora nesta primeira versão
Cronômetro e horas, Modo Foco, aprovações, anexos, dependências, recorrência, regras automáticas e relatórios. Esses recursos continuam só em /tarefas. Dá para trazer depois, se você quiser.

## Detalhes técnicos
- Novas tabelas: `kanban_tasks` e `kanban_task_comments`. As duas têm acesso restrito por regras do banco iguais às de `tasks`: quem criou, o responsável, quem tem visibilidade, além de admin, líder e gestor (este só para leitura).
- Um gatilho em `kanban_tasks` faz o lançamento e o estorno no `xp_ledger` quando a tarefa entra ou sai de `done`. Ele usa uma chave única para evitar XP em dobro.
- O cálculo do XP (`_gamification_stats_compute`) passa a somar `kanban_tasks` concluídas em `tasks_done` e nas medalhas do mês.
- `useKanbanTasks.ts` vai ler e gravar em `kanban_tasks`. O `TaskDetailDialog` será trocado por um `KanbanTaskDialog` simples, e o `CreateTaskDialog` por um `CreateKanbanTaskDialog`.
- `useGamification` e `useTeamMetrics` vão passar a atualizar os dados depois de cada mudança no Kanban.
- A mudança no banco pode ser desfeita, e nenhum dado de `tasks` é alterado.
