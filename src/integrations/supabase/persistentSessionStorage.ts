// Storage da sessão do Supabase com persistência indefinida.
//
// Objetivo: a sessão sobrevive a recarregamentos, fechamento e reabertura do
// navegador. Ela só é encerrada por um logout explícito
// (supabase.auth.signOut()), que é a única coisa que chama removeItem.
//
// Por que não usar o storage "brokered" de preview (previewAuthStorage.ts):
// nos hosts de preview do Lovable ele entrega a sessão via postMessage e trata
// uma resposta vazia do editor como logout, apagando o token do localStorage
// (linhas 74 e 83). Isso fazia o AuthProvider receber SIGNED_OUT a cada
// recarregamento e o RequireAuth empurrar a pessoa de volta para /auth.

type StorageLike = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function persistentSessionStorage(): StorageLike | undefined {
  if (typeof window === "undefined") return undefined;

  // Espelho em memória: só entra em cena quando o localStorage não está
  // disponível (navegação privada, cookies bloqueados, cota esgotada).
  const memory = new Map<string, string>();

  let durable: Storage | null = null;
  try {
    const probe = "__orcoma_storage_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    durable = window.localStorage;
  } catch {
    durable = null;
  }

  const read = (key: string): string | null => {
    if (durable) {
      try {
        const value = durable.getItem(key);
        if (value !== null) return value;
      } catch {
        // cai para a memória
      }
    }
    return memory.get(key) ?? null;
  };

  return {
    getItem: (key) => read(key),

    setItem: (key, value) => {
      memory.set(key, value);
      if (!durable) return;
      try {
        durable.setItem(key, value);
      } catch {
        // cota esgotada ou storage bloqueado: a sessão continua válida nesta aba
      }
    },

    // Só chega aqui por signOut() ou por invalidação real do token.
    removeItem: (key) => {
      memory.delete(key);
      if (!durable) return;
      try {
        durable.removeItem(key);
      } catch {
        // nada a fazer; a sessão já foi descartada em memória
      }
    },
  };
}