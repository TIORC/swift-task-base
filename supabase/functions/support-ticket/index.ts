import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

const ANGEL_ID = "242acd59-00fb-478f-8d78-b25219798aa6";

const CATEGORY_LABELS: Record<string, string> = {
  computador: "💻 Computador",
  sistema: "🧾 Sistema",
  impressora: "🖨️ Impressora",
  ramal: "☎️ Ramal",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user's token
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { categoria, descricao, usuario_windows, nome_maquina } = body;

    if (!categoria || !CATEGORY_LABELS[categoria]) {
      return new Response(JSON.stringify({ error: "Categoria inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const title = `[Chamado] ${CATEGORY_LABELS[categoria]} - ${usuario_windows || "Desconhecido"}`;
    const description = [
      `**Categoria:** ${CATEGORY_LABELS[categoria]}`,
      `**Usuário Windows:** ${usuario_windows || "N/A"}`,
      `**Máquina:** ${nome_maquina || "N/A"}`,
      descricao ? `**Descrição:** ${descricao}` : null,
    ].filter(Boolean).join("\n");

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        priority: "high",
        status: "pending",
        created_by: user.id,
        assigned_to: ANGEL_ID,
      })
      .select()
      .single();

    if (taskError) throw taskError;

    // Log creation event
    await supabase.from("task_events").insert({
      task_id: task.id,
      user_id: user.id,
      event_type: "created",
      description: `Chamado "${title}" criado via app desktop`,
    });

    // Notify Angel
    await supabase.from("notifications").insert({
      user_id: ANGEL_ID,
      type: "assigned",
      task_id: task.id,
      message: `Novo chamado: ${CATEGORY_LABELS[categoria]} de ${usuario_windows || "Desconhecido"}`,
      created_by: user.id,
    });

    return new Response(JSON.stringify({ success: true, task_id: task.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
