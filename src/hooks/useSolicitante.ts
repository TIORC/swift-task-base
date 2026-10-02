import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  solicitacoesCall,
  SOLICITANTE_TOKEN_KEY,
  type SolicitanteIdentity,
} from "@/lib/solicitacoesApi";

function readToken(): string | null {
  try {
    return sessionStorage.getItem(SOLICITANTE_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Identidade do solicitante na rota pública /k7f3q9x2/solicitacoes.
 *
 * Intencionalmente NÃO usa useAuth: aqui não existe sessão do Supabase Auth
 * — a identificação é o e-mail validado no SERVIDOR pela Edge Function
 * "solicitacoes", cujo token curto fica em sessionStorage.
 */
export function useSolicitante() {
  const qc = useQueryClient();

  const me = useQuery({
    queryKey: ["solicitante", "me"],
    queryFn: async (): Promise<SolicitanteIdentity | null> => {
      const token = readToken();
      if (!token) return null;
      try {
        const { solicitante } = await solicitacoesCall<{ solicitante: SolicitanteIdentity }>({
          action: "me",
          token,
        });
        return solicitante;
      } catch {
        return null;
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const clear = useCallback(() => {
    try {
      sessionStorage.removeItem(SOLICITANTE_TOKEN_KEY);
    } catch {
      /* sessionStorage indisponível: segue sem persistir */
    }
    qc.setQueryData(["solicitante", "me"], null);
    qc.invalidateQueries({ queryKey: ["solicitante-requests"] });
    qc.invalidateQueries({ queryKey: ["solicitante-comments"] });
  }, [qc]);

  const identify = useMutation({
    mutationFn: async (email: string) => {
      const { token, solicitante } = await solicitacoesCall<{
        token: string;
        solicitante: SolicitanteIdentity;
      }>({ action: "identify", email });
      try {
        sessionStorage.setItem(SOLICITANTE_TOKEN_KEY, token);
      } catch {
        /* sessionStorage indisponível: segue sem persistir */
      }
      return solicitante;
    },
    onSuccess: (solicitante) => {
      qc.setQueryData(["solicitante", "me"], solicitante);
      qc.invalidateQueries({ queryKey: ["solicitante-requests"] });
      qc.invalidateQueries({ queryKey: ["solicitante-comments"] });
    },
  });

  return {
    solicitante: me.data ?? null,
    isLoadingSolicitante: me.isLoading,
    token: readToken(),
    identify,
    signOutSolicitante: clear,
  };
}
