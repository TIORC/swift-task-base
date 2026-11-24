# Diagnóstico de lentidão do TAB (nada foi alterado)

## O que encontrei agora
- O servidor está ligado, mas o login não consegue falar com o banco no momento (tempo esgotado). Por isso a tela fica girando.
- Consultas mais pesadas (somando todo o tempo gasto):
  1. Ranking/gamificação: 318 chamadas, média 0,46s, pico 5,8s.
  2. Tarefas M7 (lista completa): 465 chamadas, média 0,22s, pico 4,7s.
  3. Lista completa de tarefas TI (fora da /tasks paginada, usada por dashboards e outras telas): ~670 chamadas, picos de 4,6s.
  4. "Atividade atual" por responsável (status dos devs): 118 chamadas, média 0,36s.
  5. Soma de horas por tarefa: 438 chamadas, pico 2,4s.
  6. Leitura de cargos do usuário: 2.257 chamadas (repetida em muitos lugares).
- O servidor é do menor tamanho (Tiny) e trava quando essas consultas se acumulam.

## Proposta (só executo com sua autorização)
1. Reiniciar o backend agora para destravar o carregamento.
2. Ranking: servir sempre do cache já existente e recalcular no máximo a cada poucos minutos.
3. Tarefas M7: paginar a lista (como na /tasks).
4. Dashboards/outras telas: buscar só os campos e o período necessários, em vez de todas as tarefas.
5. Status dos devs: índice em tarefas por responsável + status + atualização.
6. Cargos do usuário: carregar uma vez por sessão e reaproveitar.
7. Opcional: subir para Mini (~0,02 crédito/hora a mais), só se você aprovar.

## Detalhes técnicos
- Índice `tasks(assigned_to, status, updated_at desc)`.
- `useUserRoles` com cache React Query (staleTime longo) compartilhado.
- `sm_tasks` com `.range()` e filtros no servidor.
- Nenhuma regra de XP, permissão ou tela muda de comportamento.
