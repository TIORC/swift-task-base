// Cron-invoked edge function: spawns sm_posts and sm_tasks instances from recurring templates.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TIME_ZONE = "America/Sao_Paulo";

function localDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

// Dates selected in the M7 forms are stored as UTC midnight. Keep their literal
// YYYY-MM-DD instead of shifting them to the previous day in the Brazil timezone.
function storedDateKey(value: string | null, fallback: string): string {
  return value?.slice(0, 10) || fallback;
}

function dateNumber(key: string): number {
  return Date.parse(`${key}T00:00:00Z`);
}

function calendarParts(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return { year, month, day };
}

function matchesOccurrence(type: string, intervalN: number, anchorKey: string, todayKey: string): boolean {
  const anchor = calendarParts(anchorKey);
  const today = calendarParts(todayKey);
  const dayDelta = Math.floor((dateNumber(todayKey) - dateNumber(anchorKey)) / 86400000);
  if (dayDelta < 0) return false;

  const interval = Math.max(1, intervalN || 1);
  if (type === "daily" || type === "custom") return dayDelta % interval === 0;
  if (type === "weekly") return dayDelta % (7 * interval) === 0;
  if (type === "monthly") {
    const monthDelta = (today.year - anchor.year) * 12 + today.month - anchor.month;
    const lastDay = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
    return monthDelta >= 0 && monthDelta % interval === 0 && today.day === Math.min(anchor.day, lastDay);
  }
  return false;
}

function brazilDayBounds(key: string): { start: string; end: string } {
  const start = new Date(`${key}T00:00:00-03:00`);
  return { start: start.toISOString(), end: new Date(start.getTime() + 86400000).toISOString() };
}

function occurrenceTime(key: string, source: string | null, endOfDay = false): string {
  if (endOfDay) return new Date(`${key}T23:59:59-03:00`).toISOString();
  const time = source?.slice(11, 19) || "09:00:00";
  return new Date(`${key}T${time}-03:00`).toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) {
    return new Response(JSON.stringify({ error: "Missing backend configuration" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabase = createClient(url, serviceKey);

  const now = new Date();
  const todayKey = localDateKey(now);
  const todayBounds = brazilDayBounds(todayKey);
  let postsSpawned = 0;
  let tasksSpawned = 0;

  // ---------- sm_posts ----------
  const { data: postTpls } = await supabase
    .from("sm_posts").select("*")
    .eq("is_recurring_template", true)
    .not("recurrence_type", "is", null);

  for (const t of postTpls ?? []) {
    const interval = t.recurrence_interval || 1;
    if (t.recurrence_until && now > new Date(t.recurrence_until)) continue;
    const anchorKey = storedDateKey(t.scheduled_at, localDateKey(new Date(t.created_at)));
    if (!matchesOccurrence(t.recurrence_type, interval, anchorKey, todayKey)) continue;

    // Completion never makes an occurrence eligible again. Check immutable creation
    // time rather than status/last_spawned_at so reruns and concurrent cron calls are safe.
    const { count: existing } = await supabase.from("sm_posts")
      .select("id", { count: "exact", head: true })
      .eq("parent_recurring_post_id", t.id)
      .gte("created_at", todayBounds.start)
      .lt("created_at", todayBounds.end);
    if ((existing ?? 0) > 0) continue;

    const { error: insErr } = await supabase.from("sm_posts").insert({
      client_id: t.client_id, campaign_id: t.campaign_id, network_id: t.network_id,
      content_type_id: t.content_type_id, title: t.title, caption: t.caption,
      hashtags: t.hashtags, priority: t.priority, status: "ideia",
      assigned_to: t.assigned_to, created_by: t.created_by, notes: t.notes,
      scheduled_at: occurrenceTime(todayKey, t.scheduled_at),
      parent_recurring_post_id: t.id, is_recurring_template: false,
    });
    if (!insErr) {
      await supabase.from("sm_posts").update({ last_spawned_at: now.toISOString() }).eq("id", t.id);
      postsSpawned++;
    }
  }

  // ---------- sm_tasks ----------
  const { data: taskTpls } = await supabase
    .from("sm_tasks").select("*")
    .eq("is_recurring_template", true)
    .not("recurrence_type", "is", null);

  for (const t of taskTpls ?? []) {
    const interval = t.recurrence_interval || 1;
    if (t.recurrence_until && now > new Date(t.recurrence_until)) continue;
    const anchorKey = storedDateKey(t.due_date, localDateKey(new Date(t.created_at)));
    if (!matchesOccurrence(t.recurrence_type, interval, anchorKey, todayKey)) continue;

    // The occurrence identity is its due day, not the day the cron happened to
    // create it. This also keeps a completed occurrence from returning as a new
    // backlog item when the function is retried or run late.
    const occurrenceBounds = brazilDayBounds(todayKey);
    const { count: existing } = await supabase.from("sm_tasks")
      .select("id", { count: "exact", head: true })
      .eq("parent_recurring_task_id", t.id)
      .gte("due_date", occurrenceBounds.start)
      .lt("due_date", occurrenceBounds.end);
    if ((existing ?? 0) > 0) continue;

    const { data: inserted, error: insErr } = await supabase.from("sm_tasks").insert({
      client_id: t.client_id, campaign_id: t.campaign_id, title: t.title,
      description: t.description, status: "backlog", priority: t.priority,
      assigned_to: t.assigned_to, created_by: t.created_by,
      // The task becomes visible at midnight, but is only overdue after its local day ends.
      due_date: occurrenceTime(todayKey, t.due_date, true),
      parent_recurring_task_id: t.id, is_recurring_template: false,
    }).select().single();
    if (!insErr && inserted) {
      const { data: tplItems } = await supabase
        .from("sm_task_checklist_items").select("title, sort_order")
        .eq("task_id", t.id).order("sort_order");
      if (tplItems && tplItems.length > 0) {
        await supabase.from("sm_task_checklist_items").insert(
          tplItems.map((it: any, i: number) => ({
            task_id: inserted.id, title: it.title,
            created_by: t.created_by, sort_order: it.sort_order ?? i, done: false,
          }))
        );
      }
      await supabase.from("sm_tasks").update({ last_spawned_at: now.toISOString() }).eq("id", t.id);
      tasksSpawned++;
    }
  }

  return new Response(JSON.stringify({ postsSpawned, tasksSpawned }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
