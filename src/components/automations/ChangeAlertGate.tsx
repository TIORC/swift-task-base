import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface PendingChangeAlert {
  event_id: string;
  automation_id: string;
  title: string | null;
  requester: string | null;
  description: string | null;
  created_at: string;
}

const PENDING_KEY = ["pending-change-alerts"] as const;

/**
 * Alerta bloqueante de "Alteração solicitada" para os desenvolvedores.
 * Enquanto houver pedido não confirmado, cobre a tela de /automacoes.
 * O botão "Entendi!" grava a confirmação no banco (por pessoa).
 */
export function ChangeAlertGate() {
  const qc = useQueryClient();

  const { data: alerts = [] } = useQuery({
    queryKey: PENDING_KEY,
    queryFn: async (): Promise<PendingChangeAlert[]> => {
      const { data, error } = await (supabase as any).rpc("pending_change_alerts");
      if (error) throw error;
      return ((data as PendingChangeAlert[]) ?? []);
    },
  });

  const acknowledge = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).rpc("acknowledge_change_alerts");
      if (error) throw error;
    },
    onSuccess: () => qc.setQueryData(PENDING_KEY, []),
    onError: (e: Error) => toast.error(e.message),
  });

  if (alerts.length === 0) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="change-alert-title"
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl space-y-4 rounded-2xl border border-red-500/40 bg-[#2a0d12] p-6 text-white shadow-2xl">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-400" aria-hidden="true" />
          <h2 id="change-alert-title" className="text-lg font-bold">
            Alteração solicitada ({alerts.length})
          </h2>
        </div>
        <p className="text-sm text-white/70">
          Foi solicitada alteração em sistema(s). Leia antes de continuar.
        </p>
        <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {alerts.map((alert) => (
            <article key={alert.event_id} className="rounded-xl border border-red-400/30 bg-red-500/10 p-4">
              <p className="font-semibold">{alert.title || "Sistema sem nome"}</p>
              <p className="text-xs text-white/60">
                Solicitado por {alert.requester || "solicitante"} em {new Date(alert.created_at).toLocaleString("pt-BR")}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm text-white/85">{alert.description}</p>
            </article>
          ))}
        </div>
        <div className="flex justify-end">
          <Button
            className="bg-red-700 text-white hover:bg-red-600"
            disabled={acknowledge.isPending}
            onClick={() => acknowledge.mutate()}
          >
            {acknowledge.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Entendi!
          </Button>
        </div>
      </div>
    </div>
  );
}
