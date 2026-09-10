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
  // Mesma lógica do sistema de Gestão de TI: dias da semana, somente dias úteis,
  // horário de início, dia do mês (ajustado para dia útil), meses da ocorrência
  // e prazo em dias após a abertura.
  const DOW_CODES = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];
  const MONTH_BASED = ["monthly", "bimonthly", "quarterly", "semiannual", "annual"];

  const weekdayOf = (key: string) => new Date(`${key}T12:00:00Z`).getUTCDay();

  const isWeekendDay = (year: number, month1: number, day: number) => {
    const w = new Date(Date.UTC(year, month1 - 1, day, 12)).getUTCDay();
    return w === 0 || w === 6;
  };

  const adjustToBusinessDayInMonth = (year: number, month1: number, day: number, direction: string) => {
    const lastDay = new Date(Date.UTC(year, month1, 0)).getUTCDate();
    const base = Math.min(Math.max(1, day), lastDay);
    const step = direction === "previous" ? -1 : 1;
    let cur = base;
    while (isWeekendDay(year, month1, cur)) {
      cur += step;
      if (cur < 1 || cur > lastDay) {
        cur = base;
        const back = -step;
        while (isWeekendDay(year, month1, cur)) cur += back;
        break;
      }
    }
    return cur;
  };

  const minGapDays = (type: string, intervalN: number) => {
    const i = Math.max(1, intervalN || 1);
    switch (type) {
      case "daily": return i;
      case "weekly": return (i - 1) * 7 + 1;
      case "decendial": return (i - 1) * 10 + 1;
      case "custom": return i;
      default: return 1;
    }
  };

  const addDaysToKey = (key: string, days: number) => {
    const d = new Date(`${key}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const { data: taskTpls } = await supabase
    .from("sm_tasks").select("*")
    .eq("is_recurring_template", true)
    .in("status", ["backlog", "pendente", "em_andamento"])
    .not("recurrence_type", "is", null);

  const today = calendarParts(todayKey);
  const nowLocalHm = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now);

  for (const t of taskTpls ?? []) {
    const interval = t.recurrence_interval || 1;
    if (t.recurrence_until && now > new Date(t.recurrence_until)) continue;

    const startTime: string = t.recurrence_start_time || "09:00";
    if (nowLocalHm < startTime.slice(0, 5)) continue;

    const days: string[] = Array.isArray(t.recurrence_days) ? t.recurrence_days : [];
    const onlyBusiness = !!t.recurrence_only_business_days;
    const monthBased = MONTH_BASED.includes(t.recurrence_type) && !!t.recurrence_day_of_month;

    let dueKey = todayKey;

    if (monthBased) {
      const months: number[] = Array.isArray(t.recurrence_months) ? t.recurrence_months : [];
      if (months.length > 0 && !months.includes(today.month)) continue;
      const targetDay = adjustToBusinessDayInMonth(
        today.year, today.month, t.recurrence_day_of_month,
        t.recurrence_business_day_direction || "next",
      );
      if (today.day !== targetDay) continue;
      const deadlineDays = t.recurrence_deadline_days;
      if (typeof deadlineDays === "number" && deadlineDays > 0) dueKey = addDaysToKey(todayKey, deadlineDays);
    } else {
      const dow = weekdayOf(todayKey);
      if (onlyBusiness && (dow === 0 || dow === 6)) continue;
      if (days.length > 0 && !days.includes(DOW_CODES[dow])) continue;

      if (t.last_spawned_at) {
        const lastKey = localDateKey(new Date(t.last_spawned_at));
        const gap = Math.floor((dateNumber(todayKey) - dateNumber(lastKey)) / 86400000);
        if (gap < minGapDays(t.recurrence_type, interval)) continue;
      }
    }

    // A identidade da ocorrência é o dia do prazo, não o dia em que o cron rodou.
    const occurrenceBounds = brazilDayBounds(dueKey);
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
      nature: t.nature, billable: t.billable,
      // A tarefa aparece no início do dia, mas só fica atrasada após o fim do dia local.
      due_date: occurrenceTime(dueKey, null, true),
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
