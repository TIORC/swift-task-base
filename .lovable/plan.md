# Carregar 10 tarefas por página em /tasks

## Alteração
- Buscar somente as 10 tarefas da página atual, com controles de página anterior e próxima e total de resultados.
- Aplicar os filtros de responsável, status, prioridade, período, recorrência e dia da semana antes da paginação, para não esconder resultados de outras páginas.
- Voltar à primeira página quando um filtro mudar.
- Manter os totais dos filtros de status considerando todas as tarefas visíveis, sem baixar a lista completa.
- Buscar as horas e os dados dos responsáveis somente das tarefas exibidas.
- Continuar abrindo tarefas por links de notificações, mesmo quando não estiverem na página atual.

## Preservação
- Não alterar dados, permissões, XP, medalhas, cronômetro ou regras de recorrência.
- Não alterar as listas do dashboard, M7, Kanban ou chamados neste pedido.

## Detalhes técnicos
- Criar uma consulta paginada própria para /tasks, sem alterar o contrato de useTasks usado por outras telas.
- Reproduzir os filtros atuais na consulta do servidor, mantendo as políticas de acesso e a visibilidade contextual existentes.
- Usar agregação no servidor para contagens e horas; não paginar apenas uma lista já baixada inteira.
- Adicionar testes para o limite de 10 registros e os intervalos das páginas, verificar filtros e navegação com uma sessão autenticada quando o serviço estiver disponível.

## Verificação
- Confirmar que a primeira página retorna no máximo 10 tarefas e a próxima busca um novo intervalo sem duplicatas.
- Conferir totais, mudança de filtros e abertura de uma tarefa.
- Se o serviço continuar indisponível, informar explicitamente a verificação que ficou bloqueada.