export const SUPPORT_REAL_REASONS = [
  "Hardware",
  "Rede / Internet",
  "Software",
  "Externo — Sistema com erro",
  "Elétrica",
  "Mal uso operativo",
  "Avaria / Danos",
] as const;

export type SupportRealReason = (typeof SUPPORT_REAL_REASONS)[number];

export const SUPPORT_TAGS_BY_REASON: Record<SupportRealReason, string[]> = {
  "Hardware": [
    "Memória RAM", "HD/SSD", "Monitor", "Teclado", "Mouse",
    "Fonte", "Placa-mãe", "Cabo", "Computador lento", "Troca de peça",
  ],
  "Rede / Internet": [
    "Sem internet", "Lentidão", "Cabo de rede", "Wi-Fi",
    "Switch", "Roteador", "IP/DNS", "Queda de conexão",
  ],
  "Software": [
    "Instalação", "Atualização", "Configuração", "Travamento",
    "Erro de licença", "Permissão de acesso", "Lentidão",
  ],
  "Externo — Sistema com erro": [
    "Domínio", "Thomson Reuters", "M7", "Gestão TI",
    "Sistema bancário", "Portal externo", "Erro do fornecedor", "Instabilidade externa",
  ],
  "Elétrica": [
    "Tomada", "Nobreak", "Queda de energia", "Fonte elétrica", "Cabo de energia",
  ],
  "Mal uso operativo": [
    "Procedimento incorreto", "Falta de treinamento", "Erro de operação",
    "Uso indevido do sistema", "Configuração alterada pelo usuário",
  ],
  "Avaria / Danos": [
    "Equipamento quebrado", "Tela danificada", "Cabo rompido",
    "Queda de equipamento", "Mau contato", "Dano físico",
  ],
};

export const ALL_SUPPORT_TAGS: string[] = Array.from(
  new Set(Object.values(SUPPORT_TAGS_BY_REASON).flat())
);

export const INITIAL_CATEGORIES = [
  { value: "computador", label: "Computador" },
  { value: "sistema", label: "Sistema" },
  { value: "impressora", label: "Impressora" },
  { value: "ramal", label: "Ramal" },
] as const;

export function extractInitialCategory(title: string | null | undefined): string {
  const t = title || "";
  if (t.includes("Computador")) return "computador";
  if (t.includes("Sistema")) return "sistema";
  if (t.includes("Impressora")) return "impressora";
  if (t.includes("Ramal")) return "ramal";
  return "outro";
}
