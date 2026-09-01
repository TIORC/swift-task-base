import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ONBOARDING_CHECKLIST = [
  "Acesso às redes sociais (login, senha e ID)",
  "Dados cadastrais e contatos do cliente",
  "Briefing inicial com o cliente",
  "Definição de temas e formatos",
  "Gravação inicial de conteúdo",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });

  const secret = Deno.env.get("CRM_HANDOFF_SECRET");
  if (!secret || req.headers.get("x-crm-secret") !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }

  const clientName = typeof body?.client_name === "string" ? body.client_name.trim() : "";
  if (!clientName || clientName.length > 255) {
    return json({ error: { client_name: ["Nome do cliente obrigatório"] } }, 400);
  }
  const ownerId = typeof body?.owner_id === "string" ? body.owner_id : null;
  if (!ownerId) return json({ error: { owner_id: ["Informe o usuário responsável"] } }, 400);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // cliente (cria se não existir)
  let clientId: string | null = null;
  const { data: existing } = await supabase
    .from("sm_clients").select("id").ilike("name", clientName).maybeSingle();

  if (existing) clientId = existing.id;
  else {
    const { data: created, error } = await supabase.from("sm_clients").insert({
      name: clientName,
      active: true,
      created_by: ownerId,
      plan_posts_per_month: body?.plan_posts_per_month ?? null,
      plan_formats: body?.plan_formats ?? null,
      plan_notes: body?.plan_notes ?? null,
      onboarding_started_at: new Date().toISOString(),
    }).select("id").single();
    if (error) return json({ error: error.message }, 400);
    clientId = created.id;
  }

  // card de onboarding
  const { data: task, error: taskErr } = await supabase.from("sm_tasks").insert({
    title: `Onboarding — ${clientName}`,
    client_id: clientId,
    status: "backlog",
    priority: "high",
    nature: "onboarding",
    stage: "onboarding",
    due_date: new Date(Date.now() + 30 * 86400_000).toISOString(),
    created_by: ownerId,
  }).select("id").single();
  if (taskErr) return json({ error: taskErr.message }, 400);

  await supabase.from("sm_task_checklist_items").insert(
    ONBOARDING_CHECKLIST.map((title, i) => ({
      task_id: task.id, title, created_by: ownerId, sort_order: i,
    })),
  );

  return json({ ok: true, client_id: clientId, onboarding_task_id: task.id });
});
