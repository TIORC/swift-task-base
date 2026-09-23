-- Guarda o tempo trabalhado com precisão de fração de minuto (segundos),
-- para que paradas curtas não contem 1 minuto inteiro por arredondamento.
ALTER TABLE public.automation_time_logs
  ALTER COLUMN duration_minutes TYPE double precision USING duration_minutes::double precision;

ALTER TABLE public.time_logs
  ALTER COLUMN duration_minutes TYPE double precision USING duration_minutes::double precision;

ALTER TABLE public.sm_task_time_logs
  ALTER COLUMN duration_minutes TYPE double precision USING duration_minutes::double precision;