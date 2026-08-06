import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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

    // Get user display name
    let userName = usuario_windows || "Desconhecido";
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    if (profile?.full_name) {
      userName = profile.full_name;
    } else if (user.email) {
      const prefix = user.email.split("@")[0];
      const displayName = prefix
        .replace(/[._-]/g, " ")
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      await supabase
        .from("profiles")
        .update({ full_name: displayName })
        .eq("id", user.id);
      userName = displayName;
    }

    const title = `[Chamado] ${CATEGORY_LABELS[categoria]} - ${userName}`;
    const description = [
      `**Categoria:** ${CATEGORY_LABELS[categoria]}`,
      `**Solicitante:** ${userName}`,
      `**E-mail:** ${user.email || "N/A"}`,
      `**Usuário Windows:** ${usuario_windows || "N/A"}`,
      `**Máquina:** ${nome_maquina || "N/A"}`,
      `**Origem:** Cliente Windows`,
      descricao ? `\n**Descrição:** ${descricao}` : null,
    ].filter(Boolean).join("\n");

    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .insert({
        title,
        description,
        priority: "medium",
        status: "pending",
        created_by: user.id,
        assigned_to: null,
      })
      .select()
      .single();

    if (taskError) throw taskError;

    await supabase.from("task_events").insert({
      task_id: task.id,
      user_id: user.id,
      event_type: "created",
      description: `Chamado "${CATEGORY_LABELS[categoria]}" criado via cliente Windows por ${userName}`,
    });

    // Notify TI staff (no assignee — ticket goes to the shared queue)
    const { data: tiIds } = await supabase.rpc("get_ti_assignable_user_ids");
    if (Array.isArray(tiIds) && tiIds.length > 0) {
      await supabase.from("notifications").insert(
        tiIds.map((uid: string) => ({
          user_id: uid,
          type: "assigned",
          task_id: task.id,
          message: `Novo chamado sem responsável: ${CATEGORY_LABELS[categoria]} de ${userName} (${nome_maquina || "N/A"})`,
          created_by: user.id,
        }))
      );
    }

    return new Response(JSON.stringify({
      success: true,
      task_id: task.id,
      ticket_number: task.id.substring(0, 8).toUpperCase(),
      category: CATEGORY_LABELS[categoria],
      assigned_to_name: null,
      created_at: task.created_at,
      user_name: userName,
    }), {
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
