import { useEffect } from "react";

/**
 * Aplica um tema de página via `data-theme` no <body>, para que as variáveis
 * CSS do tema cheguem também ao conteúdo portaleado (Dialog, AlertDialog,
 * Select, Tooltip), que é montado fora da árvore da página.
 */
export function usePageTheme(theme: string) {
  useEffect(() => {
    const { body } = document;
    const previous = body.dataset.theme;
    body.dataset.theme = theme;
    return () => {
      if (previous) body.dataset.theme = previous;
      else delete body.dataset.theme;
    };
  }, [theme]);
}