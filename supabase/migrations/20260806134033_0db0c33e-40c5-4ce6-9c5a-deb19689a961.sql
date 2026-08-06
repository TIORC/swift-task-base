ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS support_system text,
  ADD COLUMN IF NOT EXISTS support_site text,
  ADD COLUMN IF NOT EXISTS support_equipment text;

CREATE TABLE IF NOT EXISTS public.support_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('system','site','equipment')),
  name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_catalog TO authenticated;
GRANT ALL ON public.support_catalog TO service_role;

ALTER TABLE public.support_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view support catalog"
  ON public.support_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "TI can insert support catalog"
  ON public.support_catalog FOR INSERT TO authenticated WITH CHECK (public.has_ti_write(auth.uid()));
CREATE POLICY "TI can update support catalog"
  ON public.support_catalog FOR UPDATE TO authenticated USING (public.has_ti_write(auth.uid())) WITH CHECK (public.has_ti_write(auth.uid()));
CREATE POLICY "TI can delete support catalog"
  ON public.support_catalog FOR DELETE TO authenticated USING (public.has_ti_write(auth.uid()));

CREATE TRIGGER trg_support_catalog_updated
  BEFORE UPDATE ON public.support_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.support_catalog (kind, name) VALUES
  ('system','Domínio'),('system','Sped'),('system','IRPF'),('system','Task To Do'),
  ('system','Assinador Serpro'),('system','Foxit'),('system','Excel'),('system','Word'),
  ('system','Nibo Robô'),('system','Conciliador'),('system','SEFIP'),('system','Teams'),
  ('system','Thunderbird'),('system','Outlook'),('system','DMA VM'),('system','Whatsapp'),
  ('system','Anydesk'),('system','Banco Itaú'),('system','Banco do Brasil'),('system','Banco Bradesco'),
  ('system','Banco Caixa'),('system','GRRF'),
  ('site','Megazap'),('site','Sefaz'),('site','Gov'),('site','Site Governo'),('site','Tributanet'),
  ('site','Tributare.net'),('site','Econet'),('site','Nibo'),('site','Conectividade V2'),
  ('site','Receita Net'),('site','FGTS GOV'),('site','Workmonitor'),('site','ClickUP'),
  ('site','Whatsapp Web'),('site','ZapSign'),('site','Emissor Sebrae'),('site','Conta Azul'),
  ('site','Banco do Brasil'),('site','Banco Bradesco'),('site','Banco Caixa'),('site','Banco C6'),
  ('site','Omie'),('site','Google Drive'),('site','Feedz'),('site','Coalize'),('site','Meet'),
  ('site','Orcoma.Online'),('site','Contagou'),
  ('equipment','Computador / Desktop'),('equipment','Notebook'),('equipment','Monitor'),
  ('equipment','Impressora'),('equipment','Teclado'),('equipment','Mouse'),('equipment','Headset'),
  ('equipment','Nobreak'),('equipment','Telefone / Ramal'),('equipment','Roteador'),
  ('equipment','Switch'),('equipment','Scanner'),('equipment','Celular'),('equipment','Servidor')
ON CONFLICT (kind, name) DO NOTHING;