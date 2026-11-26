import { useMemo } from "react";
import type { RequestKind } from "@/types/automation";

// Cores por modalidade: Sistema em azul-claro e Automação em roxo, como na etiqueta do card.
// Sem modalidade, mantém o vermelho do formato de modificações.
const PALETTE: Record<RequestKind | "default", { heading: string; label: string; box: string }> = {
  default: { heading: "border-red-400/25 text-red-200", label: "text-red-200/80", box: "" },
  Sistema: { heading: "border-cyan-400/25 text-cyan-200", label: "text-cyan-200/80", box: "border-l-2 border-cyan-400/40" },
  Automação: { heading: "border-violet-400/25 text-violet-200", label: "text-violet-200/80", box: "border-l-2 border-violet-400/40" },
};

export interface RequestField {
  /** Pergunta do formulário (ex.: "Nome da rotina"). */
  label: string;
  /** Resposta digitada pelo solicitante. Pode ter várias linhas. */
  value: string;
}

export interface RequestSection {
  /** Título da seção numerada (ex.: "2. Como a rotina funciona hoje?"), ou null para o texto introdutório. */
  title: string | null;
  fields: RequestField[];
  /** Linhas soltas que não são pergunta nem resposta (ex.: "Alteração solicitada por Talita:"). */
  notes: string[];
}

// Títulos das seções geradas pelo RequestAutomationDialog. Só estes títulos viram seção,
// para que itens digitados como "1. Abrir o sistema" dentro de uma resposta não quebrem o texto.
const SECTION_RE =
  /^\d+\.\s+(Identificação e objetivo|Como a rotina funciona hoje\?|Entradas, sistemas e saídas|Regras, volume e conferência|Perguntas por setor|Validação final pelo solicitante)/;

// Perguntas geradas pelo RequestAutomationDialog. Só estes rótulos viram pergunta,
// para que "Passo 1: ..." digitado numa resposta continue como texto da resposta.
const FIELD_LABELS = [
  "Manutenção do sistema",
  "Solicitante",
  "E-mail",
  "Setores",
  "Nome da rotina",
  "Quem executa e valida",
  "Problema a resolver",
  "Resultado final esperado",
  "Prioridade",
  "Motivo da prioridade",
  "Data limite real",
  "Gatilhos",
  "Condição exata",
  "Frequência e horário",
  "Processo passo a passo",
  "Decisões",
  "Casos fora do fluxo normal",
  "Tratamento de erros e pendências",
  "Origens dos dados",
  "Detalhes das origens",
  "Campos obrigatórios",
  "Sistemas e ordem de uso",
  "Resultados a criar ou atualizar",
  "Detalhes dos resultados",
  "Volume médio e pico",
  "Prazo máximo da execução",
  "Conferência do resultado",
  "Ação quando itens falham",
  "Detalhes do tratamento de falhas",
  "Níveis de acesso",
  "Detalhes dos níveis de acesso",
  "Recibos, protocolos, valores e vencimentos a confrontar",
  "Informações consultadas ou atualizadas em outros setores",
  "Quem pode solicitar, aprovar, executar e visualizar",
  "Impacto esperado",
  "Exemplos de teste",
  "Demonstração e validação em teste",
];

const FIELD_RE = new RegExp(
  `^(${FIELD_LABELS.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*:\\s?(.*)$`,
);

/**
 * Separa o texto da descrição de uma solicitação em seções, perguntas (rótulos)
 * e respostas (valores). Textos antigos gravados como texto corrido também são lidos.
 */
export function parseRequestDescription(text: string): RequestSection[] {
  const sections: RequestSection[] = [{ title: null, fields: [], notes: [] }];
  let field: RequestField | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;

    if (SECTION_RE.test(line)) {
      sections.push({ title: line, fields: [], notes: [] });
      field = null;
      continue;
    }

    const match = FIELD_RE.exec(line);
    if (match) {
      field = { label: match[1], value: match[2].trim() };
      sections[sections.length - 1].fields.push(field);
      continue;
    }

    if (field) {
      field.value = field.value ? `${field.value}\n${line}` : line;
    } else {
      sections[sections.length - 1].notes.push(line);
    }
  }

  return sections.filter((s) => s.title || s.fields.length > 0 || s.notes.length > 0);
}

export function RequestDescription({ text, kind }: { text: string; kind?: RequestKind | null }) {
  const sections = useMemo(() => parseRequestDescription(text), [text]);
  const palette = PALETTE[kind ?? "default"];

  return (
    <div className="mt-3 space-y-5 text-sm">
      {sections.map((section, i) => (
        <section key={i} className="space-y-2">
          {section.title && (
            <h3 className={`border-b pb-1 text-xs font-bold uppercase tracking-wide ${palette.heading}`}>
              {section.title}
            </h3>
          )}
          {section.notes.map((note, j) => (
            <p key={`n-${j}`} className="whitespace-pre-wrap break-words text-white/65">
              {note}
            </p>
          ))}
          {section.fields.length > 0 && (
            <dl className="space-y-3">
              {section.fields.map((field, j) => (
                <div key={`f-${j}`} className="space-y-0.5">
                  <dt className={`text-xs font-semibold ${palette.label}`}>{field.label}</dt>
                  <dd className={`whitespace-pre-wrap break-words rounded-md bg-white/5 px-2.5 py-1.5 text-white ${palette.box}`}>
                    {field.value || <span className="text-white/40">Não respondido</span>}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      ))}
    </div>
  );
}
