// Cron-invoked edge function: spawns new task instances from recurring templates.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// 0=Sun..6=Sat -> short code used in UI/DB
const DOW_CODES = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

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

function toNextBusinessDay(d: Date): Date {
  const out = new Date(d);
  while (out.getDay() === 0 || out.getDay() === 6) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}

// Apply HH:MM as local start time (defaults to 00:00 — task appears from midnight).
function applyStartTime(d: Date, hhmm: string | null | undefined): Date {
  const out = new Date(d);
  const [h, m] = (hhmm || "00:00").split(":").map((n) => parseInt(n, 10));
  out.setHours(Number.isFinite(h) ? h : 0, Number.isFinite(m) ? m : 0, 0, 0);
  return out;
}

function nextDate(type: string, interval: number, base: string | null, businessDay: boolean, startTime: string): string | null {
  if (!base) return null;
  let d = nextDue(type, interval, new Date(base));
  if (businessDay) d = toNextBusinessDay(d);
  d = applyStartTime(d, startTime);
  return d.toISOString();
}

// Returns true if today matches recurrence_days (and respects only_business_days).
function dayMatches(today: Date, days: string[] | null, onlyBusiness: boolean): boolean {
  const dow = today.getDay();
  if (onlyBusiness && (dow === 0 || dow === 6)) return false;
  if (!days || days.length === 0) return true; // unrestricted
  return days.includes(DOW_CODES[dow]);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Idempotent: only spawns one instance per template per local day.

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

  // Minimum days that must have passed since last spawn for a given frequency.
  // The day-of-week gate handles WHICH day; this only enforces interval spacing.
  function minGapDays(type: string, intervalN: number): number {
    const i = Math.max(1, intervalN || 1);
    switch (type) {
      case "daily": return i;
      case "weekly": return (i - 1) * 7 + 1;
      case "decendial": return (i - 1) * 10 + 1;
      case "monthly": return (i - 1) * 28 + 1;
      case "bimonthly": return (i - 1) * 60 + 27;
      case "quarterly": return (i - 1) * 90 + 85;
      case "semiannual": return (i - 1) * 180 + 175;
      case "annual": return (i - 1) * 365 + 360;
      case "custom": return i;
      default: return 1;
    }
  }
  function daysBetween(a: Date, b: Date): number {
    const da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((db.getTime() - da.getTime()) / 86400000);
  }

  let spawned = 0;
  for (const t of templates ?? []) {
    const interval = t.recurrence_interval || 1;
    const startTime = t.recurrence_start_time || "00:00";
    const days: string[] = Array.isArray(t.recurrence_days) ? t.recurrence_days : [];
    const onlyBusiness = !!t.recurrence_only_business_days;

    if (t.recurrence_until && now > new Date(t.recurrence_until)) continue;

    // Day-of-week / business-day gate: must fire on the right day of week.
    if (!dayMatches(now, days, onlyBusiness)) continue;

    // Must be past the configured start time today.
    if (now < applyStartTime(now, startTime)) continue;

    const lastSpawn = t.last_spawned_at ? new Date(t.last_spawned_at) : null;

    // Never spawn twice in the same local day.
    if (lastSpawn && lastSpawn.toDateString() === now.toDateString()) continue;

    // Enforce interval spacing since last spawn (skipped on the very first spawn).
    if (lastSpawn) {
      const gap = daysBetween(lastSpawn, now);
      if (gap < minGapDays(t.recurrence_type, interval)) continue;
    }

    const spawnedDue = applyStartTime(now, startTime);

    const { error: insErr } = await supabase.from("tasks").insert({
      title: t.title,
      description: t.description,
      priority: t.priority,
      status: "backlog",
      assigned_to: t.assigned_to,
      created_by: t.created_by,
      due_date: spawnedDue.toISOString(),
      legal_date: nextDate(t.recurrence_type, interval, t.legal_date, !!t.legal_is_business_day, startTime),
      legal_is_business_day: !!t.legal_is_business_day,
      meta_date: nextDate(t.recurrence_type, interval, t.meta_date, !!t.meta_is_business_day, startTime),
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
