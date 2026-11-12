-- Pílula de chat do desenvolvedor: a mensagem do solicitante chega ao app do dev
-- por Realtime Broadcast (websocket), sem polling e sem consulta extra ao banco.
--
-- A policy antiga deixava QUALQUER usuário autenticado assinar QUALQUER canal
-- privado do realtime. O app não usa canais privados hoje (postgres_changes segue
-- a RLS das próprias tabelas, não esta), então restringimos para que cada dev
-- ouça somente o canal `dev-chat:<seu user id>`.

DROP POLICY IF EXISTS "Authenticated users can use realtime" ON realtime.messages;

CREATE POLICY "Dev recebe somente o proprio canal de chat"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    extension = 'broadcast'
    AND realtime.topic() = 'dev-chat:' || auth.uid()::text
  );
