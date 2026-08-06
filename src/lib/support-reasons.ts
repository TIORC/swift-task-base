export const SUPPORT_REAL_REASONS = [
  "Hardware",
  "Sistema",
  "Site / Portal",
  "Rede / Internet",
  "Software",
  "Externo — Sistema com erro",
  "Elétrica",
  "Impressão / Digitalização",
  "E-mail / Comunicação",
  "Acesso / Senha",
  "Backup / Arquivos",
  "Segurança / Vírus",
  "Mal uso operativo",
  "Avaria / Danos",
  "Treinamento / Orientação",
] as const;

export type SupportRealReason = (typeof SUPPORT_REAL_REASONS)[number];

/** Motivos que exigem informar qual sistema recebeu suporte */
export const REASONS_WITH_SYSTEM: string[] = ["Sistema", "Software", "Externo — Sistema com erro"];
/** Motivos que exigem informar qual site/portal recebeu suporte */
export const REASONS_WITH_SITE: string[] = ["Site / Portal", "Externo — Sistema com erro"];
/** Motivos que exigem informar qual equipamento recebeu suporte */
export const REASONS_WITH_EQUIPMENT: string[] = [
  "Hardware",
  "Avaria / Danos",
  "Impressão / Digitalização",
  "Elétrica",
  "Rede / Internet",
];

export const SUPPORT_TAGS_BY_REASON: Record<SupportRealReason, string[]> = {
  "Hardware": [
    "Memória RAM", "HD/SSD", "Processador", "Placa de vídeo", "Monitor", "Teclado", "Mouse",
    "Fonte", "Placa-mãe", "Cabo", "Cooler / Superaquecimento", "Bateria / Notebook",
    "Computador lento", "Não liga", "Troca de peça", "Formatação", "Upgrade",
    "Limpeza física", "Periférico USB", "Webcam", "Headset / Áudio",
  ],
  "Sistema": [
    "Instalação do sistema", "Atualização de versão", "Configuração", "Erro ao abrir",
    "Travamento / Congelou", "Lentidão", "Erro de licença", "Erro de banco de dados",
    "Certificado digital", "Importação de arquivo", "Exportação de arquivo",
    "Geração de guia", "Geração de relatório", "Cadastro incorreto",
    "Permissão / Perfil de acesso", "Integração entre sistemas", "Reinstalação",
    "Backup do sistema", "Dúvida de uso",
  ],
  "Site / Portal": [
    "Site fora do ar", "Site lento", "Erro de login", "Certificado digital no site",
    "Erro no navegador", "Bloqueio de pop-up", "Download não conclui", "Upload falhou",
    "Emissão de guia", "Emissão de certidão", "Cadastro no portal", "Token / 2FA",
    "Instabilidade do provedor", "Dúvida de navegação",
  ],
  "Rede / Internet": [
    "Sem internet", "Lentidão", "Cabo de rede", "Wi-Fi", "Switch", "Roteador",
    "IP/DNS", "Queda de conexão", "VPN", "Compartilhamento de pasta",
    "Acesso remoto", "Servidor inacessível", "Firewall / Bloqueio",
  ],
  "Software": [
    "Instalação", "Atualização", "Configuração", "Travamento", "Erro de licença",
    "Permissão de acesso", "Lentidão", "Desinstalação", "Compatibilidade",
    "Erro de driver", "Windows / Sistema operacional", "Office / Pacote",
  ],
  "Externo — Sistema com erro": [
    "Domínio", "Thomson Reuters", "M7", "Gestão TI", "Sistema bancário",
    "Portal externo", "Erro do fornecedor", "Instabilidade externa",
    "Chamado aberto no fornecedor", "Aguardando retorno externo",
  ],
  "Elétrica": [
    "Tomada", "Nobreak", "Queda de energia", "Fonte elétrica", "Cabo de energia",
    "Estabilizador", "Curto-circuito", "Sobrecarga",
  ],
  "Impressão / Digitalização": [
    "Impressora offline", "Fila travada", "Toner / Tinta", "Atolamento de papel",
    "Driver de impressão", "Digitalização / Scanner", "Impressão em rede",
    "Qualidade de impressão", "Configuração de impressora",
  ],
  "E-mail / Comunicação": [
    "Outlook", "Thunderbird", "Não recebe e-mail", "Não envia e-mail",
    "Caixa cheia", "Assinatura de e-mail", "Configuração de conta",
    "Spam / Phishing", "Teams", "WhatsApp", "Ramal / Telefonia",
  ],
  "Acesso / Senha": [
    "Reset de senha", "Bloqueio de usuário", "Novo usuário", "Desligamento de usuário",
    "Permissão de pasta", "Permissão no sistema", "Token / Certificado",
    "Login não funciona", "Autenticação em dois fatores",
  ],
  "Backup / Arquivos": [
    "Arquivo perdido", "Restauração de backup", "Cópia de arquivos",
    "Pasta compartilhada", "Google Drive / Nuvem", "Espaço em disco",
    "Migração de dados", "Arquivo corrompido",
  ],
  "Segurança / Vírus": [
    "Vírus / Malware", "Ransomware", "Phishing", "Antivírus",
    "Bloqueio indevido", "Site malicioso", "Política de segurança",
  ],
  "Mal uso operativo": [
    "Procedimento incorreto", "Falta de treinamento", "Erro de operação",
    "Uso indevido do sistema", "Configuração alterada pelo usuário",
    "Exclusão acidental", "Equipamento desligado da tomada",
  ],
  "Avaria / Danos": [
    "Equipamento quebrado", "Tela danificada", "Cabo rompido",
    "Queda de equipamento", "Mau contato", "Dano físico", "Líquido derramado",
  ],
  "Treinamento / Orientação": [
    "Orientação de uso", "Passo a passo", "Boas práticas",
    "Configuração orientada", "Dúvida geral",
  ],
};

export const ALL_SUPPORT_TAGS: string[] = Array.from(
  new Set(Object.values(SUPPORT_TAGS_BY_REASON).flat())
).sort((a, b) => a.localeCompare(b, "pt-BR"));

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

/** Extrai o nome da máquina informado na descrição do chamado */
export function extractMachine(description: string | null | undefined): string {
  if (!description) return "";
  const m = description.match(/\*\*M[áa]quina:\*\*\s*(.+)/);
  const v = m?.[1]?.trim() || "";
  return v && v !== "N/A" ? v : "";
}
