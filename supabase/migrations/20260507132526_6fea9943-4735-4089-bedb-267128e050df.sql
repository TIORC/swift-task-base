CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'sm-spawn-recurring-hourly',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url:='https://wisbzvooxrgyltbebuyb.supabase.co/functions/v1/sm-spawn-recurring',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indpc2J6dm9veHJneWx0YmVidXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTQ4NzksImV4cCI6MjA5MDAzMDg3OX0.UhZJGeVW5uLJ31TN7JsDfwzUxvbRtz62sWx6wNLlSic"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  ) AS request_id;
  $$
);