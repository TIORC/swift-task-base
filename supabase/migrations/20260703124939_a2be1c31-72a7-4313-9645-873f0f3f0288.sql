
-- Chat de usuários com menções a tarefas
CREATE TABLE public.chat_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_group boolean NOT NULL DEFAULT false,
  name text,
  created_by uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_participants (
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_participants TO authenticated;
GRANT ALL ON public.chat_participants TO service_role;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  mentioned_task_ids uuid[] NOT NULL DEFAULT '{}',
  mentioned_sm_task_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at DESC);
CREATE INDEX idx_chat_participants_user ON public.chat_participants(user_id);

-- Helper: usuário participa da conversa?
CREATE OR REPLACE FUNCTION public.is_chat_participant(_conv uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_participants
    WHERE conversation_id = _conv AND user_id = _user
  );
$$;

-- Policies chat_conversations
CREATE POLICY "participantes veem conversas" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(id, auth.uid()));
CREATE POLICY "usuarios criam conversas" ON public.chat_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "participantes atualizam conversa" ON public.chat_conversations
  FOR UPDATE TO authenticated
  USING (public.is_chat_participant(id, auth.uid()));

-- Policies chat_participants
CREATE POLICY "usuario ve seus participantes e da conversa" ON public.chat_participants
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_chat_participant(conversation_id, auth.uid()));
CREATE POLICY "criador adiciona participantes" ON public.chat_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.chat_conversations c WHERE c.id = conversation_id AND c.created_by = auth.uid())
    OR public.is_chat_participant(conversation_id, auth.uid())
  );
CREATE POLICY "usuario atualiza sua participacao" ON public.chat_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "usuario remove sua participacao" ON public.chat_participants
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- Policies chat_messages
CREATE POLICY "participantes leem mensagens" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.is_chat_participant(conversation_id, auth.uid()));
CREATE POLICY "participantes enviam mensagens" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.is_chat_participant(conversation_id, auth.uid())
  );
CREATE POLICY "remetente edita/apaga" ON public.chat_messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- updated_at
CREATE TRIGGER trg_chat_conversations_updated
BEFORE UPDATE ON public.chat_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ao inserir mensagem, atualiza last_message_at
CREATE OR REPLACE FUNCTION public.bump_chat_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.chat_conversations
  SET last_message_at = NEW.created_at, updated_at = now()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_bump_conv AFTER INSERT ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_chat_conversation();

-- RPC: cria/recupera conversa 1:1
CREATE OR REPLACE FUNCTION public.get_or_create_direct_chat(_other uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me uuid := auth.uid();
  _conv uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _other = _me THEN RAISE EXCEPTION 'Não é possível conversar consigo mesmo'; END IF;

  SELECT c.id INTO _conv
  FROM public.chat_conversations c
  WHERE c.is_group = false
    AND EXISTS (SELECT 1 FROM public.chat_participants p WHERE p.conversation_id = c.id AND p.user_id = _me)
    AND EXISTS (SELECT 1 FROM public.chat_participants p WHERE p.conversation_id = c.id AND p.user_id = _other)
    AND (SELECT count(*) FROM public.chat_participants p WHERE p.conversation_id = c.id) = 2
  LIMIT 1;

  IF _conv IS NOT NULL THEN RETURN _conv; END IF;

  INSERT INTO public.chat_conversations (is_group, created_by) VALUES (false, _me) RETURNING id INTO _conv;
  INSERT INTO public.chat_participants (conversation_id, user_id) VALUES (_conv, _me), (_conv, _other);
  RETURN _conv;
END;
$$;

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_conversations;
