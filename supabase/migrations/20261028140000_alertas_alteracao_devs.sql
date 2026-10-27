-- Alerta de "Alteração solicitada" para os desenvolvedores (role 'dev').
--
-- Cada pedido de alteração já é gravado em automation_events (event_type
-- 'change_requested' ou 'status_changed' com new_status 'change_requested') e
-- a descrição começa com "Alteração solicitada". Aqui guardamos quem já
-- confirmou ("Entendi!") cada evento. Enquanto um desenvolvedor tiver alerta
-- pendente, /automacoes fica bloqueada para ele.

CREATE TABLE IF NOT EXISTS public.automation_change_acks (
  event_id uuid NOT NULL REFERENCES public.automation_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE public.automation_change_acks ENABLE ROW LEVEL SECURITY;

-- Cada pessoa só lê as próprias confirmações. Gravação só pela função abaixo.
CREATE POLICY "Users read own change acks"
  ON public.automation_change_acks FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Alertas pendentes do usuário logado (somente desenvolvedores; para os demais, vazio).
CREATE OR REPLACE FUNCTION public.pending_change_alerts()
RETURNS TABLE(event_id uuid, automation_id uuid, title text, requester text, description text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT e.id, e.automation_id, a.title, a.requester, e.description, e.created_at
  FROM public.automation_events e
  JOIN public.automations a ON a.id = e.automation_id
  WHERE public.has_role(auth.uid(), 'dev'::app_role)
    AND (
      e.event_type = 'change_requested'
      OR (e.event_type = 'status_changed' AND e.metadata->>'new_status' = 'change_requested')
    )
    AND e.description LIKE 'Alteração solicitada%'
    AND NOT EXISTS (
      SELECT 1 FROM public.automation_change_acks k
      WHERE k.event_id = e.id AND k.user_id = auth.uid()
    )
  ORDER BY e.created_at DESC;
$$;

-- "Entendi!": confirma todos os alertas pendentes do desenvolvedor logado.
CREATE OR REPLACE FUNCTION public.acknowledge_change_alerts()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'dev'::app_role) THEN
    RAISE EXCEPTION 'Somente desenvolvedores podem confirmar alertas de alteração';
  END IF;

  INSERT INTO public.automation_change_acks (event_id, user_id)
  SELECT p.event_id, auth.uid()
  FROM public.pending_change_alerts() p
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.pending_change_alerts() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.acknowledge_change_alerts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pending_change_alerts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.acknowledge_change_alerts() TO authenticated;
