-- Preenche o destino (link) das notificações de menção antigas, que foram criadas antes da coluna link.
-- Cada notificação é ligada ao comentário que a originou: o comentário menciona o usuário
-- e foi criado a poucos segundos da notificação (a notificação é gravada logo após o comentário).

-- 1) Tarefas (/tasks): já tinham task_id.
UPDATE public.notifications n
   SET link = '/tasks?task=' || n.task_id::text
 WHERE n.type = 'mention'
   AND n.link IS NULL
   AND n.task_id IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = n.task_id);

-- 2) Kanban (/kanban): a mensagem diz "tarefa do Kanban" e não tinha task_id.
WITH m AS (
  SELECT DISTINCT ON (n.id) n.id, c.task_id
    FROM public.notifications n
    JOIN public.kanban_task_comments c
      ON c.mentions @> ARRAY[n.user_id]
     AND abs(extract(epoch FROM (c.created_at - n.created_at))) < 10
   WHERE n.type = 'mention'
     AND n.link IS NULL
     AND n.message LIKE '%tarefa do Kanban%'
   ORDER BY n.id, abs(extract(epoch FROM (c.created_at - n.created_at)))
)
UPDATE public.notifications n
   SET link = '/kanban?task=' || m.task_id::text
  FROM m
 WHERE n.id = m.id;

-- 3) Automações (/automacoes): a mensagem diz 'mencionou você em "<título>"'.
WITH m AS (
  SELECT DISTINCT ON (n.id) n.id, c.automation_id
    FROM public.notifications n
    JOIN public.automation_comments c
      ON c.mentions @> ARRAY[n.user_id]
     AND abs(extract(epoch FROM (c.created_at - n.created_at))) < 10
   WHERE n.type = 'mention'
     AND n.link IS NULL
     AND n.message LIKE '%mencionou você em "%'
   ORDER BY n.id, abs(extract(epoch FROM (c.created_at - n.created_at)))
)
UPDATE public.notifications n
   SET link = '/automacoes?automation=' || m.automation_id::text
  FROM m
 WHERE n.id = m.id;

-- 4) Social (/social/tarefas): comentários de tarefas do M7.
WITH m AS (
  SELECT DISTINCT ON (n.id) n.id, c.task_id
    FROM public.notifications n
    JOIN public.sm_task_comments c
      ON c.mentions @> ARRAY[n.user_id]
     AND abs(extract(epoch FROM (c.created_at - n.created_at))) < 10
   WHERE n.type = 'mention'
     AND n.link IS NULL
     AND n.message LIKE '%comentário de tarefa (M7)%'
   ORDER BY n.id, abs(extract(epoch FROM (c.created_at - n.created_at)))
)
UPDATE public.notifications n
   SET link = '/social/tarefas?task=' || m.task_id::text
  FROM m
 WHERE n.id = m.id;
