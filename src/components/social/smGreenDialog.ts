import type { CSSProperties } from "react";

// Tema verde usado nos modais de tarefas do Social (Nova tarefa e detalhes).
// As variáveis são sobrescritas só no escopo do modal; os componentes do shadcn já usam esses tokens.
export const SM_GREEN_DIALOG_STYLE = {
  "--background": "142 64% 28%",
  "--foreground": "0 0% 100%",
  "--card": "142 64% 28%",
  "--card-foreground": "0 0% 100%",
  "--popover": "142 64% 26%",
  "--popover-foreground": "0 0% 100%",
  "--primary": "0 0% 100%",
  "--primary-foreground": "142 64% 22%",
  "--secondary": "142 56% 36%",
  "--secondary-foreground": "0 0% 100%",
  "--muted": "142 56% 22%",
  "--muted-foreground": "0 0% 92%",
  "--accent": "142 56% 36%",
  "--accent-foreground": "0 0% 100%",
  "--border": "142 55% 42%",
  "--input": "142 60% 20%",
  "--ring": "0 0% 100%",
} as CSSProperties;

// Barra de rolagem verde do próprio modal.
export const SM_GREEN_SCROLLBAR_CLASS =
  "[scrollbar-width:thin] [scrollbar-color:#4ade80_transparent] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-green-400 [&::-webkit-scrollbar-thumb:hover]:bg-green-300 [&_textarea]:[scrollbar-color:#4ade80_transparent] [&_textarea::-webkit-scrollbar]:w-2.5 [&_textarea::-webkit-scrollbar-track]:bg-transparent [&_textarea::-webkit-scrollbar-thumb]:rounded-full [&_textarea::-webkit-scrollbar-thumb]:bg-green-400";
