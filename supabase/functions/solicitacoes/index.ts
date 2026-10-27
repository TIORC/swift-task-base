import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.0";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

/**
 * Edge Function: solicitacoes
 * ----------------------------------------------------------------------------
 * Porta de entrada da rota pública /k7f3q9x2/solicitacoes.
 *
 * A função é propositalmente PÚBLICA (verify_jwt = false no config.toml):
 * o visitante ainda não tem JWT — ele chega aqui justamente para se
 * identificar. Por isso NENHUMA operação confia em dados do corpo: todo
 * acesso a dados passa pelo token de solicitante que a PRÓPRIA função
 * assina (HMAC-SHA256, segredo SOLICITANTE_TOKEN_SECRET).
 *
 * Ações (todas via POST { action, ... }):
 *   - identify        { email }                       -> { token, solicitante } | 403
 *   - me              { token }                         -> { solicitante }
 *   - list            { token }                         -> { requests }
 *   - create          { token, request }                -> { id }
 *   - comments:list   { token, automation_id(s) }       -> { comments, summaries }
 *   - comments:create { token, automation_id, content } -> { id }
 *   - developer-status { token }                        -> { developers }
 *   - support-status   { token }                        -> { technicians }
 *   - team-names       { token }                        -> { names }
 *
 * `developer-status` devolve EXCLUSIVAMENTE Welder e Gabriel (com tarefa
 * atual, automação em aberto e histórico recente). `support-status` devolve
 * EXCLUSIVAMENTE Angel e Sofia, com apenas o PRIMEIRO NOME e o estado do
 * cronômetro — os chamados carregam usuário, máquina, sistema e local, nada
 * disso sai para a tela pública do solicitante.
 *
 * RLS existente NÃO é alterada: anon continua sem acesso direto às tabelas.
 */

const TOKEN_KEY = "orcoma:solicitante-token";
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8h — expira sozinho, sem logout

interface SolicitanteClaims {
  sub: string; // user_id do solicitante (auth.users)
  email: string; // e-mail normalizado usado na identificação
  sector: string; // setor da whitelist
  role: string | null; // papel do usuário (admin, dev, gestor, suporte…) — embutido no token
  exp: number; // epoch ms
}

// Papéis que, ao identificar-se no portal do solicitante, veem TODAS as
// solicitações (e não apenas as que criou). Devs e gestores precisam
// acompanhar solicitações de terceiros, já que eles EXECUTAM o trabalho.
const SEE_ALL_ROLES = new Set(["dev", "admin", "gestor"]);

/**
 * Quantos itens de trabalho cada pessoa mostra nas abas de status — o que está
 * fazendo agora (task/automação em aberto) mais o histórico recente do board.
 */
const TEAM_HISTORY_LIMIT = 5;
const DEVELOPER_EMAILS = new Set(["welder@orcoma.com.br", "gabriel.anacleto@orcoma.com.br"]);

/** Status de `tasks` em que a tarefa ainda está no fluxo (não concluída). */
const OPEN_TASK_STATUSES = new Set(["backlog", "pending", "todo", "in_progress", "review"]);

/** Status de `automations` em que a solicitação ainda está sendo executada. */
const OPEN_AUTOMATION_STATUSES = new Set([
  "requested",
  "analysis",
  "approved",
  "development",
  "internal_testing",
  "homologation",
  "waiting_info",
  "waiting_user",
  "blocked",
]);

/** Um item do histórico de trabalho exibido nas abas de status. */
interface RecentItem {
  kind: "tarefa" | "automacao";
  title: string;
  status: string;
  progress?: number | null;
  when: string;
}

function b64urlEncode(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string, usage: "sign" | "verify") {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

async function signToken(claims: SolicitanteClaims, secret: string): Promise<string> {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify(claims)));
  const key = await hmacKey(secret, "sign");
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return `${payload}.${b64urlEncode(sig)}`;
}

async function verifyToken(token: string, secret: string): Promise<SolicitanteClaims | null> {
  const [payload, sig] = (token || "").split(".");
  if (!payload || !sig) return null;
  try {
    const key = await hmacKey(secret, "verify");
    const ok = await crypto.subtle.verify("HMAC", key, b64urlDecode(sig), new TextEncoder().encode(payload));
    if (!ok) return null;
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload))) as SolicitanteClaims;
    if (!claims?.sub || !claims?.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const bad = (message: string, status = 400) => json({ error: message }, status);
const needValidToken = () => json({ error: "Identificação inválida ou expirada. Identifique-se novamente." }, 401);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return bad("Use POST.", 405);
  }

  const secret = Deno.env.get("SOLICITANTE_TOKEN_SECRET");
  if (!secret) {
    console.error("[solicitacoes] SOLICITANTE_TOKEN_SECRET não configurado");
    return json({ error: "Serviço de solicitações indisponível no momento." }, 500);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return bad("Corpo inválido.");
  }
  const action = body.action as string | undefined;

  try {
    // ── IDENTIFY (público: não exige token) ───────────────────────────────
    if (action === "identify") {
      const rawEmail = typeof body.email === "string" ? body.email : "";
      const email = rawEmail.trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return bad("Informe um e-mail válido.");
      }

      // Confere no SERVIDOR: e-mail existe em auth.users E está na whitelist.
      const { data: requester, error } = await admin.rpc("get_automation_requester_by_email", { _email: email });
      if (error) throw error;
      // RPC que retorna TABLE devolve array; aceita também objeto único.
      const row = (Array.isArray(requester) ? requester[0] ?? null : requester ?? null) as
        | { user_id: string; sector: string }
        | null;
      if (!row?.user_id) {
        return json({ error: "E-mail não cadastrado como solicitante" }, 403);
      }

      const { data: roleRow, error: roleError } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", row.user_id)
        .maybeSingle();
      if (roleError) throw roleError;
      const userRole = (roleRow as { role?: string } | null)?.role ?? null;

      const claims: SolicitanteClaims = {
        sub: row.user_id,
        email,
        sector: row.sector ?? "",
        role: userRole,
        exp: Date.now() + TOKEN_TTL_MS,
      };
      const token = await signToken(claims, secret);
      return json({
        token,
        tokenKey: TOKEN_KEY,
        solicitante: { id: claims.sub, email, sector: claims.sector, role: userRole },
      });
    }

    // ── Todas as demais ações exigem token válido ─────────────────────────
    const token = typeof body.token === "string" ? body.token : "";
    const claims = await verifyToken(token, secret);
    if (!claims) return needValidToken();
    const solicitanteId = claims.sub;

    // Garante que a whitelist continua valendo a cada chamada.
    const { data: requester } = await admin
      .from("automation_requesters")
      .select("user_id, sector")
      .eq("user_id", solicitanteId)
      .maybeSingle();
    if (!requester) {
      return json({ error: "E-mail não cadastrado como solicitante" }, 403);
    }

    if (action === "me") {
      return json({
        solicitante: {
          id: solicitanteId,
          email: claims.email,
          sector: ((requester as { sector?: string }).sector ?? claims.sector),
          role: claims.role,
        },
      });
    }

    // Pertence ao solicitante? Barreira única de propriedade.
    // Usuários com role de equipe (dev/admin/gestor) têm acesso a tudo.
    const belongsToSolicitante = async (automationId: string) => {
      const { data } = await admin
        .from("automations")
        .select("id, created_by, requester_id")
        .eq("id", automationId)
        .maybeSingle();
      if (!data) return null;
      if (claims.role != null && SEE_ALL_ROLES.has(claims.role)) return data;
      const d = data as { created_by: string | null; requester_id: string | null };
      const owner = d.created_by ?? d.requester_id;
      return owner === solicitanteId ? data : null;
    };

    if (action === "list") {
      const canSeeAll = claims.role != null && SEE_ALL_ROLES.has(claims.role);
      let baseQuery = admin
        .from("automations")
        .select(
          "id, title, description, status, priority, sector, created_at, updated_at, progress_percent, assigned_to, request_kind",
        );
      if (!canSeeAll) {
        baseQuery = baseQuery.or(`created_by.eq.${solicitanteId},requester_id.eq.${solicitanteId}`);
      }
      const { data, error } = await baseQuery.order("created_at", { ascending: false });
      if (error) throw error;
      return json({ requests: data ?? [] });
    }

    if (action === "comments:list") {
      const automationIds = Array.isArray(body.automation_ids)
        ? (body.automation_ids as string[])
        : typeof body.automation_id === "string"
          ? [body.automation_id as string]
          : [];
      if (automationIds.length === 0) return bad("Informe automation_id.");
      const canSeeAll = claims.role != null && SEE_ALL_ROLES.has(claims.role);
      // Filtra pelos ids que pertencem ao solicitante — nunca vaza conversa alheia.
      // Usuários com role de equipe (dev/admin/gestor) veem tudo.
      const { data: owned } = canSeeAll
        ? await admin.from("automations").select("id").in("id", automationIds)
        : await admin
            .from("automations")
            .select("id")
            .in("id", automationIds)
            .or(`created_by.eq.${solicitanteId},requester_id.eq.${solicitanteId}`);
      const ownedIds = new Set((((owned ?? []) as unknown) as { id: string }[]).map((r) => r.id));
      if (ownedIds.size === 0) return json({ comments: [], summaries: {} });

      const { data: comments, error } = await admin
        .from("automation_comments")
        .select("automation_id, user_id, content, created_at")
        .in("automation_id", [...ownedIds])
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = ((comments ?? []) as unknown) as { automation_id: string; user_id: string; content: string; created_at: string }[];
      const summaries: Record<string, { total: number; lastAuthor: string | null; lastContent: string | null }> = {};
      for (const row of rows) {
        const prev = summaries[row.automation_id];
        summaries[row.automation_id] = {
          total: (prev?.total ?? 0) + 1,
          lastAuthor: row.user_id,
          lastContent: row.content,
        };
      }
      // Nomes dos últimos autores (só o necessário, sem expor a base de perfis).
      const lastAuthorIds = [...new Set(Object.values(summaries).map((s) => s.lastAuthor).filter(Boolean))] as string[];
      let names: Record<string, string | null> = {};
      if (lastAuthorIds.length > 0) {
        const { data: profs } = await admin.from("profiles").select("id, full_name").in("id", lastAuthorIds);
        names = Object.fromEntries(
          (((profs ?? []) as unknown) as { id: string; full_name: string | null }[]).map((p) => [p.id, p.full_name]),
        );
      }
      const enriched: Record<string, { total: number; lastAuthor: string | null; lastAuthorName: string | null; lastContent: string | null }> = {};
      for (const [automationId, s] of Object.entries(summaries)) {
        enriched[automationId] = { ...s, lastAuthorName: s.lastAuthor ? (names[s.lastAuthor] ?? null) : null };
      }
      return json({ comments: rows, summaries: enriched });
    }

    if (action === "comments:create") {
      const automationId = typeof body.automation_id === "string" ? body.automation_id : "";
      const content = typeof body.content === "string" ? body.content.trim().slice(0, 2000) : "";
      if (!automationId) return bad("Informe automation_id.");
      if (!content) return bad("Escreva sua mensagem.");
      const owned = await belongsToSolicitante(automationId);
      if (!owned) return json({ error: "Solicitação não encontrada." }, 404);

      const { data: inserted, error } = await admin
        .from("automation_comments")
        .insert({ automation_id: automationId, user_id: solicitanteId, content, mentions: [] })
        .select("id")
        .single();
      if (error) throw error;

      // Avisa a outra ponta (responsável ou gestão), na mesma lógica do app.
      const { data: auto } = await admin
        .from("automations")
        .select("title, requester_id, assigned_to")
        .eq("id", automationId)
        .single();
      const autoRow = (auto as unknown as { title?: string | null; assigned_to?: string | null } | null) ?? null;
      const { data: profile } = await admin.from("profiles").select("full_name").eq("id", solicitanteId).single();
      const profileRow = (profile as unknown as { full_name?: string | null } | null) ?? null;
      const senderName = profileRow?.full_name || claims.email || "Solicitante";
      const snippet = content.replace(/\s+/g, " ").trim().slice(0, 80);
      const label = autoRow?.title || "uma automação";
      const notifRows: { user_id: string; type: string; message: string; created_by: string }[] = [];
      const assignedTo = autoRow?.assigned_to ?? null;
      if (assignedTo && assignedTo !== solicitanteId) {
        notifRows.push({
          user_id: assignedTo,
          type: "automation_comment",
          message: `${senderName} escreveu no chat de "${label}": "${snippet}"`,
          created_by: solicitanteId,
        });
      } else if (!assignedTo) {
        const { data: gestorIds } = await admin.rpc("get_gestor_user_ids");
        for (const gestorId of ((gestorIds as string[] | null) ?? [])) {
          if (gestorId === solicitanteId) continue;
          notifRows.push({
            user_id: gestorId,
            type: "automation_comment",
            message: `${senderName} escreveu no chat de "${label}" (sem responsável definido): "${snippet}"`,
            created_by: solicitanteId,
          });
        }
      }
      if (notifRows.length > 0) await admin.from("notifications").insert(notifRows);
      return json({ id: ((inserted as unknown) as { id: string }).id });
    }

    if (action === "create") {
      const req = ((body.request ?? {}) as unknown) as Record<string, unknown>;
      const title = typeof req.title === "string" ? req.title.trim().slice(0, 200) : "";
      if (!title) return bad("Informe o título da solicitação.");
      const priority = ["low", "medium", "high", "urgent"].includes(req.priority as string)
        ? (req.priority as string)
        : "medium";
      const sector = typeof req.sector === "string" && req.sector
        ? req.sector
        : ((((requester as unknown) as { sector?: string }).sector) ?? claims.sector);
      const requestKind = req.request_kind === "Sistema" || req.request_kind === "Automação"
        ? (req.request_kind as string)
        : null;
      const senderName = typeof req.sender_name === "string" ? req.sender_name.trim().slice(0, 120) : claims.email;
      const description = typeof req.description === "string" ? req.description : null;

      // Manutenção: não cria automação nova. Sistema concluído volta para
      // "Alteração solicitada" (o XP já ganho fica). Sistema em andamento
      // continua no mesmo status; a alteração vira um evento e um alerta.
      const maintenanceSystem = typeof req.maintenance_system === "string" ? req.maintenance_system.trim().slice(0, 200) : "";
      if (maintenanceSystem) {
        const canSeeAll = claims.role != null && SEE_ALL_ROLES.has(claims.role);
        const { data: target, error: targetError } = await admin
          .from("automations")
          .select("id, status, sector, assigned_to")
          .eq("title", maintenanceSystem)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (targetError) throw targetError;
        const system = target as { id: string; status: string; sector: string | null; assigned_to: string | null } | null;
        if (!system) return bad("Sistema não encontrado.");
        if (!canSeeAll && system.sector !== claims.sector) return bad("Este sistema não pertence ao seu setor.");

        const moved = system.status === "completed";
        if (moved) {
          const { error: updateError } = await admin
            .from("automations")
            .update({ status: "change_requested" })
            .eq("id", system.id);
          if (updateError) throw updateError;
        }

        await admin.from("automation_events").insert({
          automation_id: system.id,
          event_type: moved ? "status_changed" : "change_requested",
          description: `Alteração solicitada por ${senderName}:\n${description ?? title}`,
          user_id: solicitanteId,
          metadata: { new_status: moved ? "change_requested" : system.status, old_status: system.status },
        });

        try {
          const { data: gestorIds } = await admin.rpc("get_gestor_user_ids");
          const recipients = new Set<string>(((gestorIds as string[] | null) ?? []));
          if (system.assigned_to) recipients.add(system.assigned_to);
          recipients.delete(solicitanteId);
          if (recipients.size > 0) {
            await admin.from("notifications").insert(
              [...recipients].map((id) => ({
                user_id: id,
                type: "automation",
                message: `${senderName} solicitou alteração no sistema "${maintenanceSystem}"`,
                created_by: solicitanteId,
              })),
            );
          }
        } catch (notifyErr) {
          console.error("[solicitacoes] falha ao notificar alteração", notifyErr);
        }
        return json({ id: system.id, moved });
      }

      const { data: inserted, error } = await admin
        .from("automations")
        .insert({
          title,
          description: typeof req.description === "string" ? req.description : null,
          objective: typeof req.objective === "string" ? req.objective : null,
          process_impact: typeof req.process_impact === "string" ? req.process_impact : null,
          system_process: typeof req.system_process === "string" ? req.system_process : null,
          requester: senderName,
          requester_department: sector,
          sector,
          request_kind: requestKind,
          priority,
          status: "requested",
          created_by: solicitanteId,
          requester_id: solicitanteId,
        })
        .select("id")
        .single();
      if (error) throw error;
      const automationId = ((inserted as unknown) as { id: string }).id;

      await admin.from("automation_events").insert({
        automation_id: automationId,
        event_type: "created",
        description: `Solicitação criada por ${senderName} via portal do solicitante`,
        user_id: solicitanteId,
      });

      const kindLabel = requestKind === "Sistema" ? "sistema" : requestKind === "Automação" ? "automação" : "solicitação";
      try {
        const { data: gestorIds } = await admin.rpc("get_gestor_user_ids");
        const targets = ((gestorIds as string[] | null) ?? []).filter((id) => id !== solicitanteId);
        if (targets.length > 0) {
          await admin.from("notifications").insert(
            targets.map((id) => ({
              user_id: id,
              type: "automation",
              message: `${senderName} solicitou um(a) ${kindLabel}: "${title}"`,
              created_by: solicitanteId,
            })),
          );
        }
      } catch (notifyErr) {
        console.error("[solicitacoes] falha ao notificar gestores", notifyErr);
      }
      return json({ id: automationId });
    }

    if (action === "developer-status" || action === "support-status") {
      const isDevelopers = action === "developer-status";

      // Cada aba tem sua própria equipe, por PAPEL — nunca mais
      // get_ti_assignable_user_ids (member/dev/lider), que trazia qualquer
      // solicitante com o papel padrão `member` para a aba de desenvolvedores.
      //   developer-status -> papel 'dev'      (Welder, Gabriel)
      //   support-status   -> papel 'suporte'  (Angel, Sofia)
      const rosterRpc = isDevelopers ? "get_developer_user_ids" : "get_support_assignable_user_ids";
      const { data: roster, error: rosterError } = await admin.rpc(rosterRpc as "get_developer_user_ids");
      // O SDK do Supabase NÃO lança exceção em erro de RPC: devolve
      // {data:null,error}. Checar `error` explicitamente é o que impede uma aba
      // de voltar vazia em silêncio quando o RPC não existe.
      if (rosterError) throw new Error(`RPC ${rosterRpc} indisponível: ${rosterError.message}`);
      let teamIds = [...new Set(((roster as string[] | null) ?? []).filter(Boolean))];

      // Trava por e-mail também aqui: a aba de desenvolvedores é só Welder e
      // Gabriel, mesmo que o banco ainda devolva outros papéis `dev`.
      if (isDevelopers) {
        const users = await Promise.all(teamIds.map((id) => admin.auth.admin.getUserById(id)));
        teamIds = teamIds.filter((_, i) =>
          DEVELOPER_EMAILS.has((users[i].data.user?.email ?? "").toLowerCase()),
        );
      }

      if (teamIds.length === 0) {
        console.warn(`[solicitacoes] ${rosterRpc} devolveu lista vazia — aba ${action} sairá vazia`);
        return json(isDevelopers ? { developers: [] } : { technicians: [] });
      }

      const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", teamIds);
      const names = Object.fromEntries(
        ((((profiles ?? []) as unknown) as { id: string; full_name: string | null }[])).map((p) => [p.id, p.full_name || "Equipe de TI"]),
      );

      // Janela longa: o histórico precisa cobrir o que já foi feito, não só a
      // última hora.
      const sinceIso = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const [devLogs, taskLogs, tasks, automations] = await Promise.all([
        admin
          .from("automation_time_logs")
          .select("user_id, started_at, ended_at")
          .in("user_id", teamIds)
          .gte("started_at", sinceIso)
          .order("started_at", { ascending: false }),
        admin
          .from("time_logs")
          .select("user_id, started_at, ended_at")
          .in("user_id", teamIds)
          .gte("started_at", sinceIso)
          .order("started_at", { ascending: false }),
        // A lista de trabalho é montada só para a aba de desenvolvedores. Na de
        // suportes o payload é só nome + cronômetro, então nem vale a pena ler
        // `tasks`/`automations` — esta rota é consultada a cada 15s.
        isDevelopers
          ? admin
              .from("tasks")
              .select("id, title, status, assigned_to, updated_at")
              .in("assigned_to", teamIds)
              .order("updated_at", { ascending: false })
              .limit(TEAM_HISTORY_LIMIT * teamIds.length)
          : Promise.resolve({ data: null }),
        isDevelopers
          ? admin
              .from("automations")
              .select("id, title, status, progress_percent, assigned_to, updated_at")
              .in("assigned_to", teamIds)
              .order("updated_at", { ascending: false })
              .limit(TEAM_HISTORY_LIMIT * teamIds.length)
          : Promise.resolve({ data: null }),
      ]);

      type StatusLog = { user_id: string; started_at: string; ended_at: string | null };
      type TaskRow = { id: string; title: string; status: string; assigned_to: string | null; updated_at: string };
      type AutomationRow = {
        id: string;
        title: string;
        status: string;
        progress_percent: number | null;
        assigned_to: string | null;
        updated_at: string;
      };

      const allLogs = [
        ...((((devLogs.data ?? []) as unknown)) as StatusLog[]),
        ...((((taskLogs.data ?? []) as unknown)) as StatusLog[]),
      ];
      const taskRows = (((tasks.data ?? []) as unknown) as TaskRow[]).filter((t) => t.assigned_to);
      const automationRows = (((automations.data ?? []) as unknown) as AutomationRow[]).filter((a) => a.assigned_to);

      const entries = teamIds.map((id) => {
        const mine = allLogs.filter((log) => log.user_id === id);
        const latest = mine[0] ?? null;
        const fullName = names[id] ?? "Equipe de TI";

        if (!isDevelopers) {
          // A aba de Suportes/Infra publica só o primeiro nome e o estado do
          // cronômetro. Os chamados carregam usuário, máquina, sistema e local,
          // então a lista de trabalho nem é montada — e não vai no payload,
          // senão apareceria no DevTools de qualquer solicitante identificado.
          return {
            id,
            name: fullName,
            firstName: fullName.split(/\s+/)[0] || fullName,
            working: latest ? !latest.ended_at : false,
            lastStart: latest?.started_at ?? null,
            dev: false,
            currentTask: null,
            currentAutomation: null,
            recent: [],
          };
        }

        // Tarefa atual: a mais recente que ainda não saiu do fluxo.
        const openTask = taskRows.find((t) => t.assigned_to === id && OPEN_TASK_STATUSES.has(t.status)) ?? null;
        const openAutomation =
          automationRows.find((a) => a.assigned_to === id && OPEN_AUTOMATION_STATUSES.has(a.status)) ?? null;

        // Histórico: tarefas e automações da pessoa, da mais recente para a
        // mais antiga, cortando em TEAM_HISTORY_LIMIT. O trabalho em aberto não é
        // repetido aqui — ele já aparece em currentTask/currentAutomation.
        const history: RecentItem[] = [
          ...taskRows
            .filter((t) => t.assigned_to === id && t.id !== openTask?.id)
            .map((t) => ({ kind: "tarefa" as const, title: t.title, status: t.status, when: t.updated_at })),
          ...automationRows
            .filter((a) => a.assigned_to === id && a.id !== openAutomation?.id)
            .map((a) => ({
              kind: "automacao" as const,
              title: a.title,
              status: a.status,
              progress: a.progress_percent ?? null,
              when: a.updated_at,
            })),
        ]
          .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
          .slice(0, TEAM_HISTORY_LIMIT);

        return {
          id,
          name: fullName,
          firstName: null,
          working: latest ? !latest.ended_at : false,
          lastStart: latest?.started_at ?? null,
          dev: true,
          currentTask: openTask
            ? { kind: "tarefa" as const, title: openTask.title, status: openTask.status }
            : null,
          currentAutomation: openAutomation
            ? {
                kind: "automacao" as const,
                title: openAutomation.title,
                status: openAutomation.status,
                progress: openAutomation.progress_percent ?? null,
              }
            : null,
          recent: history,
        };
      });
      return json(isDevelopers ? { developers: entries } : { technicians: entries });
    }

    // Nome de TODOS os usuários, para resolver o campo "Responsável" dos cards
    // de acompanhamento. Precisa ser separado de developer-status/support-status:
    // aquelas duas abas são travadas em Welder, Gabriel, Angel e Sofia, mas uma
    // solicitação pode estar atribuída a um gestor ou líder — sem esta ação, o
    // responsável cairia em "ainda não atribuído".
    if (action === "team-names") {
      const { data, error: namesError } = await admin.from("profiles").select("id, full_name");
      if (namesError) throw namesError;
      const names: Record<string, string> = {};
      for (const row of (((data ?? []) as unknown) as { id: string; full_name: string | null }[])) {
        names[row.id] = row.full_name || "Equipe de TI";
      }
      return json({ names });
    }

    return bad("Ação desconhecida.", 400);
  } catch (err) {
    console.error("[solicitacoes] erro", err);
    const message = err instanceof Error ? err.message : "Erro interno.";
    return json({ error: message }, 500);
  }
});
