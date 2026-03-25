import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch tasks with profiles
    const { data: tasks } = await supabase
      .from("tasks")
      .select("id, title, status, priority, assigned_to, created_at, updated_at")
      .not("status", "in", '("done","discarded")');

    const { data: profiles } = await supabase.from("profiles").select("id, full_name");
    const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p.full_name || "Sem nome"]));

    // Fetch time logs
    const { data: timeLogs } = await supabase.from("time_logs").select("task_id, duration_minutes");
    const timeMap: Record<string, number> = {};
    (timeLogs || []).forEach((l: any) => {
      timeMap[l.task_id] = (timeMap[l.task_id] || 0) + l.duration_minutes;
    });

    const now = new Date();
    const taskSummaries = (tasks || []).map((t: any) => {
      const createdDaysAgo = Math.floor((now.getTime() - new Date(t.created_at).getTime()) / 86400000);
      const updatedDaysAgo = Math.floor((now.getTime() - new Date(t.updated_at).getTime()) / 86400000);
      const totalMinutes = timeMap[t.id] || 0;
      return `- "${t.title}" | Status: ${t.status} | Prioridade: ${t.priority} | Responsável: ${profileMap[t.assigned_to] || "Nenhum"} | Criada há ${createdDaysAgo} dias | Última atualização: ${updatedDaysAgo} dias atrás | Tempo investido: ${totalMinutes}min`;
    });

    const prompt = `Você é um analista de produtividade de equipes de TI. Analise as tarefas ativas abaixo e forneça insights acionáveis em JSON.

Tarefas:
${taskSummaries.join("\n")}

Responda com insights classificados por tipo.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "Você é um assistente de produtividade para equipes de TI. Sempre responda em português brasileiro." },
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "provide_insights",
              description: "Retorna insights de produtividade sobre as tarefas da equipe.",
              parameters: {
                type: "object",
                properties: {
                  delayed_tasks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task_title: { type: "string" },
                        reason: { type: "string" },
                        suggestion: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high"] },
                      },
                      required: ["task_title", "reason", "suggestion", "severity"],
                      additionalProperties: false,
                    },
                  },
                  priority_suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        task_title: { type: "string" },
                        current_priority: { type: "string" },
                        suggested_priority: { type: "string" },
                        reason: { type: "string" },
                      },
                      required: ["task_title", "current_priority", "suggested_priority", "reason"],
                      additionalProperties: false,
                    },
                  },
                  general_insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        insight: { type: "string" },
                        action: { type: "string" },
                      },
                      required: ["insight", "action"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["delayed_tasks", "priority_suggestions", "general_insights"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_insights" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em breve." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI error:", response.status, text);
      throw new Error("AI gateway error");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    let insights = { delayed_tasks: [], priority_suggestions: [], general_insights: [] };

    if (toolCall?.function?.arguments) {
      insights = JSON.parse(toolCall.function.arguments);
    }

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
