// Cron-invoked edge function: spawns sm_posts and sm_tasks instances from recurring templates.
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
  else if (type === "monthly") d.setMonth(d.getMonth() + step);
  else if (type === "custom") d.setDate(d.getDate() + step);
  return d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Idempotent: only spawns one instance per template per local day.

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );


  const now = new Date();
  let postsSpawned = 0;
  let tasksSpawned = 0;

  // sm_posts
  const { data: postTpls } = await supabase
    .from("sm_posts").select("*")
    .eq("is_recurring_template", true)
    .not("recurrence_type", "is", null);

  for (const t of postTpls ?? []) {
    const interval = t.recurrence_interval || 1;
    const last = t.last_spawned_at ? new Date(t.last_spawned_at) : new Date(t.created_at);
    const next = nextDue(t.recurrence_type, interval, last);
    if (next > now) continue;
    if (t.recurrence_until && now > new Date(t.recurrence_until)) continue;

    const { error: insErr } = await supabase.from("sm_posts").insert({
      client_id: t.client_id, campaign_id: t.campaign_id, network_id: t.network_id,
      content_type_id: t.content_type_id, title: t.title, caption: t.caption,
      hashtags: t.hashtags, priority: t.priority, status: "ideia",
      assigned_to: t.assigned_to, created_by: t.created_by, notes: t.notes,
      scheduled_at: t.scheduled_at ? nextDue(t.recurrence_type, interval, new Date(t.scheduled_at)).toISOString() : null,
      parent_recurring_post_id: t.id, is_recurring_template: false,
    });
    if (!insErr) {
      await supabase.from("sm_posts").update({ last_spawned_at: now.toISOString() }).eq("id", t.id);
      postsSpawned++;
    }
  }

  // sm_tasks
  const { data: taskTpls } = await supabase
    .from("sm_tasks").select("*")
    .eq("is_recurring_template", true)
    .not("recurrence_type", "is", null);

  for (const t of taskTpls ?? []) {
    const interval = t.recurrence_interval || 1;
    const last = t.last_spawned_at ? new Date(t.last_spawned_at) : new Date(t.created_at);
    const next = nextDue(t.recurrence_type, interval, last);
    if (next > now) continue;
    if (t.recurrence_until && now > new Date(t.recurrence_until)) continue;

    const { data: inserted, error: insErr } = await supabase.from("sm_tasks").insert({
      client_id: t.client_id, campaign_id: t.campaign_id, title: t.title,
      description: t.description, status: "backlog", priority: t.priority,
      assigned_to: t.assigned_to, created_by: t.created_by,
      due_date: t.due_date ? nextDue(t.recurrence_type, interval, new Date(t.due_date)).toISOString() : null,
      parent_recurring_task_id: t.id, is_recurring_template: false,
    }).select().single();
    if (!insErr && inserted) {
      // Copy checklist items from template
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
