import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AutomationComment {
  id: string;
  automation_id: string;
  user_id: string;
  content: string;
  mentions: string[];
  created_at: string;
  profile?: { full_name: string | null; avatar_url: string | null } | null;
}

export function useAutomationComments(automationId: string | null, options?: { live?: boolean }) {
  const qc = useQueryClient();
  const queryKey = ["automation_comments", automationId];

  const query = useQuery({
    queryKey,
    enabled: !!automationId,
    // Rede de segurança: o realtime é o caminho normal, mas se o canal cair
    // (rede instável, hibernação da aba) a conversa ainda se atualiza sozinha.
    refetchInterval: options?.live ? 15000 : false,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_comments")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data as any[]).map((c) => c.user_id))] as string[];
      let map: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
        if (profs) map = Object.fromEntries(profs.map((p) => [p.id, p]));
      }
      return (data as any[]).map((c) => ({
        ...c,
        mentions: (c.mentions as string[]) || [],
        profile: map[c.user_id] || null,
      })) as AutomationComment[];
    },
  });

  // Conversa em tempo real: a mensagem do solicitante cai no chat de /automacoes
  // e a resposta do dev cai no acompanhamento, sem F5.
  // Invalida o prefixo inteiro para que os resumos ("última mensagem") de todos
  // os cards atualizem junto com a conversa que está aberta.
  const live = !!options?.live && !!automationId;
  useEffect(() => {
    if (!live || !automationId) return;
    const channel = supabase
      .channel(`automation-comments-${automationId}-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "automation_comments", filter: `automation_id=eq.${automationId}` },
        () => qc.invalidateQueries({ queryKey: ["automation_comments"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [live, automationId, qc]);

  return query;
}

export interface CommentSummary {
  total: number;
  /** Autor da última mensagem — se for a própria pessoa, não há nada novo. */
  lastAuthor: string | null;
  lastAuthorName: string | null;
  lastContent: string | null;
}

/**
 * Resumo das conversas de um conjunto de automações — quantas mensagens existem
 * e quem falou por último. Existe para o botão "Conversar" mostrar um aviso de
 * resposta nova sem carregar a conversa inteira de cada card da lista.
 */
export function useAutomationCommentSummaries(automationIds: string[]) {
  const key = [...automationIds].sort().join(",");
  return useQuery({
    queryKey: ["automation_comments", "summaries", key],
    enabled: automationIds.length > 0,
    // O realtime da conversa aberta cobre o caso comum; a Sondagem cobre o resto.
    refetchInterval: 20000,
    queryFn: async (): Promise<Record<string, CommentSummary>> => {
      const { data, error } = await supabase
        .from("automation_comments")
        .select("automation_id, user_id, content, created_at")
        .in("automation_id", automationIds)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const rows = (data || []) as { automation_id: string; user_id: string; content: string; created_at: string }[];
      const byAutomation = new Map<string, CommentSummary>();
      for (const row of rows) {
        const previous = byAutomation.get(row.automation_id);
        byAutomation.set(row.automation_id, {
          total: (previous?.total ?? 0) + 1,
          lastAuthor: row.user_id,
          lastAuthorName: null,
          lastContent: row.content,
        });
      }

      // Só o nome do autor da última mensagem interessa — uma consulta pequena.
      const lastAuthorIds = [...new Set([...byAutomation.values()].map((s) => s.lastAuthor).filter((id): id is string => !!id))];
      if (lastAuthorIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", lastAuthorIds);
        const names = Object.fromEntries((profs || []).map((p) => [p.id, p.full_name]));
        for (const [automationId, summary] of byAutomation) {
          summary.lastAuthorName = summary.lastAuthor ? names[summary.lastAuthor] ?? null : null;
          byAutomation.set(automationId, summary);
        }
      }

      return Object.fromEntries(byAutomation);
    },
  });
}

/** Recorte curto da mensagem para a notificação. */
function snippet(content: string, max = 80) {
  const clean = content.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Avisa a outra ponta da conversa. O chat é sempre entre duas partes:
 * - solicitante (requester_id) ⇄ responsável (assigned_to).
 * Se ainda não houver responsável — o que acontece bem no começo do fluxo, que é
 * justamente quando o solicitante mais precisa de resposta — a mensagem vai para
 * os gestores, para não ficar presa sem alguém para ler.
 */
async function notifyCounterpart(params: {
  automationId: string;
  senderId: string;
  requesterId: string | null;
  assignedTo: string | null;
  title: string | null;
  senderName: string;
  content: string;
}) {
  const { automationId, senderId, requesterId, assignedTo, title, senderName, content } = params;
  const label = title || "uma automação";
  const text = snippet(content);

  const isRequesterAuthor = requesterId === senderId;
  const targetUserId = isRequesterAuthor ? assignedTo : requesterId;

  const rows: { user_id: string; type: string; message: string; created_by: string }[] = [];

  if (targetUserId && targetUserId !== senderId) {
    rows.push({
      user_id: targetUserId,
      type: "automation_comment",
      message: isRequesterAuthor
        ? `${senderName} escreveu no chat de "${label}": "${text}"`
        : `${senderName} respondeu no chat de "${label}": "${text}"`,
      created_by: senderId,
    });
  } else if (isRequesterAuthor && !assignedTo) {
    // Sem responsável definido: quem pode destravar é a gestão.
    const { data: gestorIds } = await supabase.rpc("get_gestor_user_ids");
    for (const gestorId of (gestorIds as string[] | null) ?? []) {
      if (gestorId === senderId) continue;
      rows.push({
        user_id: gestorId,
        type: "automation_comment",
        message: `${senderName} escreveu no chat de "${label}" (sem responsável definido): "${text}"`,
        created_by: senderId,
      });
    }
  }

  if (rows.length > 0) await supabase.from("notifications").insert(rows);
}

export function useCreateAutomationComment() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({
      automationId,
      content,
      mentions,
    }: { automationId: string; content: string; mentions: string[] }) => {
      if (!user) throw new Error("Não autenticado");
      const { data, error } = await (supabase as any)
        .from("automation_comments")
        .insert({ automation_id: automationId, user_id: user.id, content, mentions })
        .select()
        .single();
      if (error) throw error;

      // Get automation title for notification
      const { data: auto } = await supabase
        .from("automations")
        .select("title, requester_id, assigned_to")
        .eq("id", automationId)
        .single();

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      const senderName = profile?.full_name || user.email || "Alguém";

      await notifyCounterpart({
        automationId,
        senderId: user.id,
        requesterId: auto?.requester_id ?? null,
        assignedTo: auto?.assigned_to ?? null,
        title: auto?.title ?? null,
        senderName,
        content,
      });

      if (mentions.length > 0) {
        const notifs = mentions
          .filter((uid) => uid !== user.id)
          .map((uid) => ({
            user_id: uid,
            type: "mention",
            message: `${senderName} mencionou você em "${auto?.title || "uma automação"}"`,
            created_by: user.id,
          }));
        if (notifs.length > 0) await supabase.from("notifications").insert(notifs);
      }
      return data;
    },
    onSuccess: () => {
      // Prefixo inteiro: conversa aberta, resumos dos cards e "última mensagem"
      // dos cards no kanban precisam refletir a mensagem nova.
      qc.invalidateQueries({ queryKey: ["automation_comments"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
