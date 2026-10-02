import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { showAlert } from "@/lib/alertStore";

/**
 * Envia notificações para os gestores quando uma nova automação ou sistema
 * é solicitada. Cada gestor recebe uma linha na tabela notifications
 * (type: "automation") e o realtime dispara o alert card.
 */
export function useNotifyNewAutomationRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { profile } = useProfile();

  return useMutation({
    mutationFn: async (params: { automationId: string; title: string; kind: "Sistema" | "Automação" }) => {
      if (!user) throw new Error("Não autenticado");

      const requesterName = profile?.full_name || user.email || "Alguém";

      // Busca gestores (excluindo o próprio solicitante)
      const { data: gestorIds } = await supabase.rpc("get_gestor_user_ids");
      const targets = ((gestorIds as string[] | null) ?? []).filter((id) => id !== user.id);

      const message = `${requesterName} solicitou um(a) ${params.kind.toLowerCase()}: "${params.title}"`;

      const rows = targets.map((id) => ({
        user_id: id,
        type: "automation",
        message,
        created_by: user.id,
      }));

      if (rows.length > 0) {
        await supabase.from("notifications").insert(rows);
      }

      return { targets, message };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

/**
 * Dispara um alert card imediatamente no client do gestor.
 * Use esta função em componentes que já têm acesso ao profile do usuário.
 */
export function alertGestorsOnNewRequest(params: {
  requesterName: string;
  title: string;
  kind: "Sistema" | "Automação";
}) {
  const { requesterName, title, kind } = params;
  const kindLower = kind.toLowerCase();
  const message = `${requesterName} solicitou um(a) ${kindLower}: "${title}"`;
  showAlert({
    kind: "request",
    title: "Você recebeu uma nova solicitação de desenvolvimento!",
    description: message,
  });
}