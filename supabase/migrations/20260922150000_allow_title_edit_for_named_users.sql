-- ============================================================
-- Renomear automações: usuários nomeados (full_name) + acesso global
-- ============================================================

-- Quem pode editar o título de automações:
--   - qualquer usuário com acesso global a automações (admin/gestor/lider/dev),
--   - os usuários cujo nome completo é (ou começa com) um dos nomes permitidos.
CREATE OR REPLACE FUNCTION public.can_edit_automation_title(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_global_automation_access(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = _user_id
        AND (
          lower(p.full_name) IN ('timaracas', 'gabriel anacleto', 'welder')
          OR lower(p.full_name) LIKE 'timaracas %'
          OR lower(p.full_name) LIKE 'gabriel anacleto %'
          OR lower(p.full_name) LIKE 'welder %'
        )
    );
$$;

REVOKE ALL ON FUNCTION public.can_edit_automation_title(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_automation_title(uuid) TO authenticated;

-- Renomeia o título de uma automação visível ao chamador.
-- SECURITY DEFINER: não enfraquece as policies de UPDATE da tabela.
CREATE OR REPLACE FUNCTION public.rename_automation(_automation_id uuid, _new_title text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean text;
  _result jsonb;
BEGIN
  IF NOT public.can_edit_automation_title(auth.uid()) THEN
    RAISE EXCEPTION 'Sem permissão para renomear automações';
  END IF;

  _clean := TRIM(COALESCE(_new_title, ''));
  IF _clean = '' THEN
    RAISE EXCEPTION 'O título não pode ficar vazio';
  END IF;

  -- Aplica a mesma visibilidade da tela: acesso global, criador, responsável,
  -- solicitante, setor OU liberação explícita em user_automation_visibility.
  IF NOT (
    public.can_view_automation(_automation_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_automation_visibility uav
      WHERE uav.user_id = auth.uid() AND uav.automation_id = _automation_id
    )
  ) THEN
    RAISE EXCEPTION 'Automação não encontrada';
  END IF;

  UPDATE public.automations AS a
  SET title = _clean
  WHERE id = _automation_id
  RETURNING to_jsonb(a) INTO _result;

  IF _result IS NULL THEN
    RAISE EXCEPTION 'Automação não encontrada';
  END IF;

  INSERT INTO public.automation_events (automation_id, event_type, description, user_id)
  VALUES (_automation_id, 'title_changed', 'Título alterado para: ' || _clean, auth.uid());

  RETURN _result;
END;
$$;

REVOKE ALL ON FUNCTION public.rename_automation(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rename_automation(uuid, text) TO authenticated;