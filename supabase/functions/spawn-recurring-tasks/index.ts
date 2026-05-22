// Cron-invoked edge function: spawns new task instances from recurring templates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function nextDue(type: string, interval: number, from: Date): Date {
  const d = new Date(from);
  const step = Math.max(1, interval || 1);
  if (type === "daily") d.setDate(d.getDate() + step);
  else if (type === "weekly") d.setDate(d.getDate() + 7 * step);
  else if (type === "decendial") d.setDate(d.getDate() + 10 * step);
  else if (type === "monthly") d.setMonth(d.getMonth() + step);
  else if (type === "bimonthly") d.setMonth(d.getMonth() + 2 * step);
  else if (type === "quarterly") d.setMonth(d.getMonth() + 3 * step);
  else if (type === "semiannual") d.setMonth(d.getMonth() + 6 * step);
  else if (type === "annual") d.setFullYear(d.getFullYear() + step);
  else if (type === "custom") d.setDate(d.getDate() + step);
  return d;
}

// Ajusta para o próximo dia útil (pula sábado/domingo)
function toNextBusinessDay(d: Date): Date {
  const out = new Date(d);
  while (out.getDay() === 0 || out.getDay() === 6) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}

// Normaliza para o primeiro horário do dia (00:00:00 local)
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function nextDate(type: string, interval: number, base: string | null, businessDay: boolean): string | null {
  if (!base) return null;
  let d = nextDue(type, interval, new Date(base));
  if (businessDay) d = toNextBusinessDay(d);
  d = startOfDay(d);
  return d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const now = new Date();
  const { data: templates, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_recurring_template", true)
    .not("recurrence_type", "is", null);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let spawned = 0;
  for (const t of templates ?? []) {
    const interval = t.recurrence_interval || 1;
    const last = t.last_spawned_at ? new Date(t.last_spawned_at) : new Date(t.created_at);
    const next = nextDue(t.recurrence_type, interval, last);

    if (next > now) continue;
    if (t.recurrence_until && now > new Date(t.recurrence_until)) continue;

    // Spawn new instance
    const { error: insErr } = await supabase.from("tasks").insert({
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: "backlog",
      assigned_to: t.assigned_to,
      created_by: t.created_by,
      due_date: t.due_date ? nextDue(t.recurrence_type, interval, new Date(t.due_date)).toISOString() : null,
      legal_date: nextDate(t.recurrence_type, interval, t.legal_date, !!t.legal_is_business_day),
      legal_is_business_day: !!t.legal_is_business_day,
      meta_date: nextDate(t.recurrence_type, interval, t.meta_date, !!t.meta_is_business_day),
      meta_is_business_day: !!t.meta_is_business_day,
      recurrence_type: t.recurrence_type,
      recurrence_interval: t.recurrence_interval,
      parent_recurring_task_id: t.id,
      is_recurring_template: false,
    });

    if (!insErr) {
      await supabase.from("tasks").update({ last_spawned_at: now.toISOString() }).eq("id", t.id);
      spawned++;
    }
  }

  return new Response(JSON.stringify({ spawned, checked: templates?.length ?? 0 }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
