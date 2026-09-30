import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUploadAutomationAttachment, isAllowedAttachment, MAX_ATTACHMENT_MB } from "@/hooks/useAutomationAttachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { PRIORITY_LABELS, PRIORITY_OPTIONS } from "@/types/automation";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

const REQUEST_STATIONS = [
  "Identificação e objetivo",
  "Como a rotina funciona hoje?",
  "Entradas, sistemas e saídas",
  "Regras, volume e conferência",
  "Perguntas por setor",
  "Validação final pelo solicitante",
];

const REQUEST_SECTORS = ["Societário", "Pessoal", "Sucesso do Cliente", "Tecnologia da Informação", "Fiscal", "Contábil", "Qualidade", "RH", "BPO", "Financeiro", "Marketing", "Outro"];
const ROUTINE_TRIGGERS = ["Data/horário", "Chegada de e-mail", "Inclusão em planilha", "Solicitação de cliente", "Tarefa no sistema", "Ação manual", "Outro"];
const DATA_SOURCES = ["Planilha", "PDF", "E-mail", "Formulário", "Pasta de rede", "Sistema interno", "Portal externo", "API", "Banco de dados", "Outro"];
const OUTPUT_TYPES = ["Planilha", "PDF", "Lançamento no sistema", "Tarefa", "E-mail", "Mensagem", "Painel", "Log", "Outro"];
const FAILURE_ACTIONS = ["Continuar os demais", "Parar tudo", "Tentar novamente", "Encaminhar para análise"];
const DEMO_OPTIONS = ["Sim", "Sim, com outra pessoa", "Ainda preciso indicar responsável"];

export function RequestAutomationDialog({ openOnMount = false, hideTrigger = false, requestType = "Automação", onClose, onSubmitted }: { openOnMount?: boolean; hideTrigger?: boolean; requestType?: "Sistema" | "Automação"; onClose?: () => void; onSubmitted?: (id: string) => void }) {
  const { user } = useAuth();
  const { profile } = useProfile();
  const qc = useQueryClient();
  const upload = useUploadAutomationAttachment();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(openOnMount);
  const [title, setTitle] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>([]);
  const [otherSector, setOtherSector] = useState("");
  const [routineOwners, setRoutineOwners] = useState("");
  const [problem, setProblem] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [priorityReason, setPriorityReason] = useState("");
  const [deadline, setDeadline] = useState("");
  const [routineTriggers, setRoutineTriggers] = useState<string[]>([]);
  const [triggerDetails, setTriggerDetails] = useState("");
  const [routineFrequency, setRoutineFrequency] = useState("");
  const [station, setStation] = useState(0);
  const [processSteps, setProcessSteps] = useState("");
  const [decisionRules, setDecisionRules] = useState("");
  const [exceptionCases, setExceptionCases] = useState("");
  const [errorHandling, setErrorHandling] = useState("");
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [sourceDetails, setSourceDetails] = useState("");
  const [requiredFields, setRequiredFields] = useState("");
  const [systemsOrder, setSystemsOrder] = useState("");
  const [outputTypes, setOutputTypes] = useState<string[]>([]);
  const [outputDetails, setOutputDetails] = useState("");
  const [volumeAndPeak, setVolumeAndPeak] = useState("");
  const [executionDeadline, setExecutionDeadline] = useState("");
  const [verificationMethod, setVerificationMethod] = useState("");
  const [failureAction, setFailureAction] = useState("");
  const [failureDetails, setFailureDetails] = useState("");
  const [receiptChecks, setReceiptChecks] = useState("");
  const [departmentUpdates, setDepartmentUpdates] = useState("");
  const [accessRoles, setAccessRoles] = useState("");
  const [automationImpact, setAutomationImpact] = useState("");
  const [acceptanceTests, setAcceptanceTests] = useState("");
  const [demoAvailability, setDemoAvailability] = useState("");
  const [finalConfirmed, setFinalConfirmed] = useState(false);
  const [priority, setPriority] = useState("medium");
  const [files, setFiles] = useState<File[]>([]);
  const resolvedSectors = selectedSectors.map((item) => item === "Outro" ? otherSector.trim() : item).filter(Boolean);
  const effectiveSector = resolvedSectors[0] || "";

  useEffect(() => {
    if (!requesterName && profile?.full_name) setRequesterName(profile.full_name);
    if (!requesterEmail && user?.email) setRequesterEmail(user.email);
  }, [profile?.full_name, user?.email, requesterName, requesterEmail]);

  const reset = () => {
    setTitle(""); setRequesterName(""); setRequesterEmail(""); setSelectedSectors([]); setOtherSector("");
    setRoutineOwners(""); setProblem(""); setExpectedResult(""); setPriorityReason(""); setDeadline(""); setPriority("medium");
    setRoutineTriggers([]); setTriggerDetails(""); setRoutineFrequency(""); setProcessSteps(""); setDecisionRules(""); setExceptionCases(""); setErrorHandling("");
    setStation(0); setDataSources([]); setSourceDetails(""); setRequiredFields(""); setSystemsOrder(""); setOutputTypes([]); setOutputDetails(""); setVolumeAndPeak(""); setExecutionDeadline(""); setVerificationMethod(""); setFailureAction(""); setFailureDetails(""); setReceiptChecks(""); setDepartmentUpdates(""); setAccessRoles(""); setAutomationImpact(""); setAcceptanceTests(""); setDemoAvailability(""); setFinalConfirmed(false);
    setFiles([]);
  };

  const accent = requestType === "Sistema"
    ? { active: "text-sky-300", border: "border-sky-400/40", bg: "bg-sky-500/10", rail: "bg-sky-400", ring: "focus-visible:ring-sky-400", button: "bg-sky-600 hover:bg-sky-500" }
    : { active: "text-violet-300", border: "border-violet-400/40", bg: "bg-violet-500/10", rail: "bg-violet-400", ring: "focus-visible:ring-violet-400", button: "bg-violet-600 hover:bg-violet-500" };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach((file) => {
      if (!isAllowedAttachment(file)) {
        toast.error(`"${file.name}": apenas imagens, vídeos ou PDF.`);
        return;
      }
      if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
        toast.error(`"${file.name}": arquivo muito grande (limite de ${MAX_ATTACHMENT_MB} MB).`);
        return;
      }
      setFiles((prev) => [...prev, file]);
    });
    if (inputRef.current) inputRef.current.value = "";
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      if (!requesterName.trim()) throw new Error("Informe o nome do solicitante.");
      if (!requesterEmail.trim() || !/^\S+@\S+\.\S+$/.test(requesterEmail.trim())) throw new Error("Informe um e-mail válido.");
      if (selectedSectors.length === 0) throw new Error("Selecione ao menos um setor.");
      if (selectedSectors.includes("Outro") && !otherSector.trim()) throw new Error("Informe o nome do outro setor.");
      if (title.trim().length < 5) throw new Error("Informe o nome da rotina com pelo menos 5 caracteres.");
      if (!routineOwners.trim()) throw new Error("Informe quem executa a rotina e quem valida o resultado.");
      if (!problem.trim()) throw new Error("Descreva qual problema a automação deve resolver.");
      if (!expectedResult.trim()) throw new Error("Descreva o resultado final esperado.");
      if (!priorityReason.trim()) throw new Error("Explique o motivo da prioridade escolhida.");
      if (routineTriggers.length === 0) throw new Error("Selecione ao menos um gatilho da rotina.");
      if (!triggerDetails.trim()) throw new Error("Detalhe a condição exata que dispara a rotina.");
      if (!routineFrequency.trim()) throw new Error("Informe a frequência e o horário da rotina.");
      if (!processSteps.trim()) throw new Error("Descreva o processo do início ao fim.");
      if (!decisionRules.trim()) throw new Error("Descreva as decisões tomadas durante o processo.");
      if (!exceptionCases.trim()) throw new Error("Informe os casos que fogem do fluxo normal.");
      if (!errorHandling.trim()) throw new Error("Explique como erros e pendências são tratados.");
      if (dataSources.length === 0) throw new Error("Selecione ao menos uma origem de dados.");
      if (!sourceDetails.trim()) throw new Error("Detalhe a origem dos dados e onde encontrá-los.");
      if (!requiredFields.trim()) throw new Error("Informe os campos obrigatórios para iniciar cada caso.");
      if (!systemsOrder.trim()) throw new Error("Informe os sistemas usados e a ordem de utilização.");
      if (outputTypes.length === 0) throw new Error("Selecione ao menos um resultado a criar ou atualizar.");
      if (!outputDetails.trim()) throw new Error("Detalhe o que deve ser criado ou atualizado ao final.");
      if (!volumeAndPeak.trim()) throw new Error("Informe o volume médio e o pico da rotina.");
      if (!verificationMethod.trim()) throw new Error("Descreva como o resultado é conferido.");
      if (!failureAction) throw new Error("Escolha o que deve acontecer quando parte dos itens falha.");
      if (!failureDetails.trim()) throw new Error("Defina tentativas, prazo e informações do relatório de falhas.");
      if (!automationImpact.trim()) throw new Error("Descreva o que mudará quando a automação funcionar.");
      if (!acceptanceTests.trim()) throw new Error("Informe três exemplos para a TI testar antes da entrega.");
      if (!demoAvailability) throw new Error("Informe se pode demonstrar e validar o processo em teste.");
      if (!finalConfirmed) throw new Error("Confirme a validação final antes de enviar.");

      const completeDescription = [
        `1. Identificação e objetivo\nSolicitante: ${requesterName.trim()}\nE-mail: ${requesterEmail.trim()}\nSetores: ${resolvedSectors.join(", ")}\nNome da rotina: ${title.trim()}\nQuem executa e valida: ${routineOwners.trim()}\nProblema a resolver: ${problem.trim()}\nResultado final esperado: ${expectedResult.trim()}\nPrioridade: ${PRIORITY_LABELS[priority]}\nMotivo da prioridade: ${priorityReason.trim()}\nData limite real: ${deadline || "Não informada"}`,
        `2. Como a rotina funciona hoje?\nGatilhos: ${routineTriggers.join(", ")}\nCondição exata: ${triggerDetails.trim()}\nFrequência e horário: ${routineFrequency.trim()}\nProcesso passo a passo: ${processSteps.trim()}\nDecisões: ${decisionRules.trim()}\nCasos fora do fluxo normal: ${exceptionCases.trim()}\nTratamento de erros e pendências: ${errorHandling.trim()}`,
        `3. Entradas, sistemas e saídas\nOrigens dos dados: ${dataSources.join(", ")}\nDetalhes das origens: ${sourceDetails.trim()}\nCampos obrigatórios: ${requiredFields.trim()}\nSistemas e ordem de uso: ${systemsOrder.trim()}\nResultados a criar ou atualizar: ${outputTypes.join(", ")}\nDetalhes dos resultados: ${outputDetails.trim()}`,
        `4. Regras, volume e conferência\nVolume médio e pico: ${volumeAndPeak.trim()}\nPrazo máximo da execução: ${executionDeadline.trim() || "Não informado"}\nConferência do resultado: ${verificationMethod.trim()}\nAção quando itens falham: ${failureAction}\nDetalhes do tratamento de falhas: ${failureDetails.trim()}`,
        `5. Perguntas por setor (${effectiveSector || "Setor não informado"})\nRecibos, protocolos, valores e vencimentos a confrontar: ${receiptChecks.trim() || "Não informado"}\nInformações consultadas ou atualizadas em outros setores: ${departmentUpdates.trim() || "Não informado"}\nQuem pode solicitar, aprovar, executar e visualizar: ${accessRoles.trim() || "Não informado"}`,
        `6. Validação final pelo solicitante\nImpacto esperado: ${automationImpact.trim()}\nExemplos de teste: ${acceptanceTests.trim()}\nDemonstração e validação em teste: ${demoAvailability}`,
      ].join("\n\n");

      const { data, error } = await supabase
        .from("automations")
        .insert({
          title: title.trim(),
          description: completeDescription,
          objective: expectedResult.trim() || null,
          priority,
          status: "requested",
          sector: effectiveSector,
          created_by: user.id,
          requester_id: user.id,
          requester: requesterName.trim(),
          requester_department: effectiveSector,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      await supabase.from("automation_events").insert({
        automation_id: (data as any).id,
        event_type: "created",
        description: "Solicitação registrada pelo colaborador",
        user_id: user.id,
      } as any);

      return (data as any).id as string;
    },
    onSuccess: async (id) => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      // Envia os anexos após a automação existir (imagens, vídeos e PDFs).
      for (const file of files) {
        try {
          await upload.mutateAsync({ automationId: id, file });
        } catch {
          // erro já exibido pelo hook; segue com os demais arquivos.
        }
      }
      toast.success("Solicitação enviada para a equipe de TI!");
      reset();
      setOpen(false);
      onSubmitted?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploading = create.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { reset(); onClose?.(); } }}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Send className="h-4 w-4 mr-1.5" /> Solicitar automação
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={`flex max-h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden border ${accent.border} ${requestType === "Sistema" ? "bg-[#0c2034]" : "bg-[#1b1534]"}`}>
        <DialogHeader>
          <DialogTitle className={accent.active}>{requestType}</DialogTitle>
          <DialogDescription>
            {requestType === "Sistema"
              ? "Descreva sua necessidade de sistema para a equipe de TI avaliar."
              : "A equipe de TI vai analisar, definir prioridade, responsável e prazo. Você acompanha tudo por aqui."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-5 overflow-hidden md:grid-cols-[245px_minmax(0,1fr)]">
          <nav aria-label="Etapas da solicitação" className="flex gap-2 overflow-x-auto pb-2 md:block md:overflow-y-auto md:border-r md:border-white/10 md:pr-4">
            {REQUEST_STATIONS.map((name, index) => {
              const reached = index <= station;
              return (
                <button key={name} type="button" onClick={() => setStation(index)} aria-current={station === index ? "step" : undefined}
                  className={`relative flex min-w-[145px] items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors md:mb-2 md:w-full ${station === index ? `${accent.bg} ${accent.active}` : "text-white/55 hover:bg-white/5 hover:text-white/85"}`}>
                  <span className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${reached ? `${accent.rail} border-transparent text-slate-950` : "border-white/25 bg-transparent text-white/55"}`}>{index + 1}</span>
                  <span className="leading-snug">{name}</span>
                  {index < REQUEST_STATIONS.length - 1 && <span className={`absolute bottom-[-8px] left-[26px] hidden h-3 w-px md:block ${index < station ? accent.rail : "bg-white/15"}`} />}
                </button>
              );
            })}
          </nav>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className={`text-xs font-medium uppercase tracking-wider ${accent.active}`}>Estação {station + 1} de {REQUEST_STATIONS.length}</p>
              <div className="flex gap-1" aria-hidden="true">{REQUEST_STATIONS.map((_, i) => <span key={i} className={`h-1 w-6 rounded-full ${i <= station ? accent.rail : "bg-white/15"}`} />)}</div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-2">
              <section className="space-y-4 pb-4">
                {station === 0 && <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Nome do Solicitante <span className="text-red-400">*</span></Label><Input required value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Seu nome completo" className="mt-1" /></div>
                    <div><Label>E-mail <span className="text-red-400">*</span></Label><Input required type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} placeholder="voce@empresa.com" className="mt-1" /></div>
                  </div>
                  <div>
                    <Label>Setor <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {REQUEST_SECTORS.map((item) => (
                        <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${selectedSectors.includes(item) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={selectedSectors.includes(item)} onChange={(e) => setSelectedSectors((prev) => e.target.checked ? [...prev, item] : prev.filter((s) => s !== item))} className="h-4 w-4" style={{ accentColor: requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {item}
                        </label>
                      ))}
                    </div>
                    {selectedSectors.includes("Outro") && <Input value={otherSector} onChange={(e) => setOtherSector(e.target.value)} placeholder="Digite o nome do setor" className="mt-2" />}
                  </div>
                  <div><Label>Nome da rotina que deseja automatizar <span className="text-red-400">*</span></Label><Input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Conferência de notificações do DTE" className="mt-1" /></div>
                  <div><Label>Quem executa a rotina hoje e quem valida o resultado? <span className="text-red-400">*</span></Label><Textarea required value={routineOwners} onChange={(e) => setRoutineOwners(e.target.value)} rows={3} placeholder="Informe funções e responsáveis, inclusive quando atravessa mais de um setor." className="mt-1" /></div>
                  <div><Label>Qual problema a automação deve resolver? <span className="text-red-400">*</span></Label><Textarea required value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} placeholder="Diga o que consome tempo, gera erro, atrasa uma entrega ou dificulta o acompanhamento." className="mt-1" /></div>
                  <div><Label>Qual resultado final espera receber? <span className="text-red-400">*</span></Label><Textarea required value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={3} placeholder="Ex.: guias salvas por colaborador, relatório de empresas com erro, tarefa criada no Gestta ou aviso enviado." className="mt-1" /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Qual a prioridade? <span className="text-red-400">*</span></Label><Select value={priority} onValueChange={setPriority}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Data limite real (se existir)</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1" /></div>
                  </div>
                  <div><Label>Por que escolheu essa prioridade? <span className="text-red-400">*</span></Label><Textarea required value={priorityReason} onChange={(e) => setPriorityReason(e.target.value)} rows={2} placeholder="Explique o impacto e o prazo relacionado, se houver." className="mt-1" /></div>
                  <p className="text-xs font-semibold text-red-400">Lembrando que o prazo escolhido não significa que vai ser resolvido nesse prazo.</p>
                </>}
                {station === 1 && <>
                  <div>
                    <Label>O que dispara a rotina? <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {ROUTINE_TRIGGERS.map((trigger) => (
                        <label key={trigger} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${routineTriggers.includes(trigger) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={routineTriggers.includes(trigger)} onChange={(e) => setRoutineTriggers((prev) => e.target.checked ? [...prev, trigger] : prev.filter((item) => item !== trigger))} className="h-4 w-4" style={{ accentColor: requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {trigger}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div><Label>Detalhe a condição exata <span className="text-red-400">*</span></Label><Textarea required value={triggerDetails} onChange={(e) => setTriggerDetails(e.target.value)} rows={2} placeholder="Em que situação a rotina deve começar?" className="mt-1" /></div>
                  <div><Label>Qual a frequência e em que horário deve ocorrer? <span className="text-red-400">*</span></Label><Textarea required value={routineFrequency} onChange={(e) => setRoutineFrequency(e.target.value)} rows={3} placeholder="Informe dias úteis, fins de semana, feriados e competência, se aplicável." className="mt-1" /></div>
                  <div><Label>Descreva o processo do início ao fim, na ordem em que é realizado. <span className="text-red-400">*</span></Label><Textarea required value={processSteps} onChange={(e) => setProcessSteps(e.target.value)} rows={5} placeholder="Numere as etapas; informe telas, menus, cliques, cálculos, conferências e aprovações." className="mt-1" /></div>
                  <div><Label>Que decisões a pessoa toma durante o processo? <span className="text-red-400">*</span></Label><Textarea required value={decisionRules} onChange={(e) => setDecisionRules(e.target.value)} rows={4} placeholder="Para cada decisão, escreva: se acontecer X, faço Y; caso contrário, faço Z." className="mt-1" /></div>
                  <div><Label>Quais casos fogem do fluxo normal? <span className="text-red-400">*</span></Label><Textarea required value={exceptionCases} onChange={(e) => setExceptionCases(e.target.value)} rows={4} placeholder="Ex.: empresa inativa, ausência de movimento, senha vencida, cadastro duplicado, guia já emitida, portal indisponível ou documento ilegível." className="mt-1" /></div>
                  <div><Label>O que acontece hoje quando há erro ou pendência? Quem resolve e em quanto tempo? <span className="text-red-400">*</span></Label><Textarea required value={errorHandling} onChange={(e) => setErrorHandling(e.target.value)} rows={4} placeholder="Descreva como o problema é identificado, encaminhado e resolvido." className="mt-1" /></div>
                </>}
                {station === 2 && <>
                  <div>
                    <Label>De onde vêm os dados de entrada? <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {DATA_SOURCES.map((source) => (
                        <label key={source} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${dataSources.includes(source) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={dataSources.includes(source)} onChange={(e) => setDataSources((prev) => e.target.checked ? [...prev, source] : prev.filter((item) => item !== source))} className="h-4 w-4" style={{ accentColor: requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {source}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div><Label>Informe nome do arquivo, aba/colunas, pasta, endereço ou tela. <span className="text-red-400">*</span></Label><Textarea required value={sourceDetails} onChange={(e) => setSourceDetails(e.target.value)} rows={3} placeholder="Detalhe onde encontrar os dados de entrada." className="mt-1" /></div>
                  <div><Label>Quais campos são obrigatórios para iniciar cada caso? <span className="text-red-400">*</span></Label><Textarea required value={requiredFields} onChange={(e) => setRequiredFields(e.target.value)} rows={3} placeholder="Ex.: CNPJ, razão social, competência, responsável, matrícula, prazo." className="mt-1" /></div>
                  <div><Label>Quais sistemas são usados e em que ordem? <span className="text-red-400">*</span></Label><Textarea required value={systemsOrder} onChange={(e) => setSystemsOrder(e.target.value)} rows={4} placeholder="Informe o nome e a finalidade de cada sistema, inclusive Domínio, Gestta, Onvio, SEFAZ e portais específicos." className="mt-1" /></div>
                  <div>
                    <Label>O que deve ser criado ou atualizado ao final? <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {OUTPUT_TYPES.map((output) => (
                        <label key={output} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${outputTypes.includes(output) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={outputTypes.includes(output)} onChange={(e) => setOutputTypes((prev) => e.target.checked ? [...prev, output] : prev.filter((item) => item !== output))} className="h-4 w-4" style={{ accentColor: requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {output}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div><Label>Informe campos, nome do arquivo e padrão de pasta. <span className="text-red-400">*</span></Label><Textarea required value={outputDetails} onChange={(e) => setOutputDetails(e.target.value)} rows={3} placeholder="Descreva o conteúdo e onde salvar ou registrar cada resultado." className="mt-1" /></div>
                </>}
                {station === 3 && <>
                  <div><Label>Qual o volume médio e o pico? <span className="text-red-400">*</span></Label><Textarea required value={volumeAndPeak} onChange={(e) => setVolumeAndPeak(e.target.value)} rows={3} placeholder="Informe itens por execução, execuções por dia/mês e tempo gasto hoje em cada execução." className="mt-1" /></div>
                  <div><Label>Qual o prazo máximo para concluir uma execução?</Label><Input value={executionDeadline} onChange={(e) => setExecutionDeadline(e.target.value)} placeholder="Há horário limite para enviar, consultar ou protocolar?" className="mt-1" /></div>
                  <div><Label>Como você confere que o resultado está correto? <span className="text-red-400">*</span></Label><Textarea required value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)} rows={4} placeholder="Informe totais esperados, reconciliação, amostra, recibo, status no sistema e pessoa responsável pela conferência." className="mt-1" /></div>
                  <div><Label>O que deve acontecer quando parte dos itens falha? <span className="text-red-400">*</span></Label><Select value={failureAction} onValueChange={setFailureAction}><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma ação" /></SelectTrigger><SelectContent>{FAILURE_ACTIONS.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}</SelectContent></Select></div>
                  <div><Label>Detalhes do tratamento de falhas <span className="text-red-400">*</span></Label><Textarea required value={failureDetails} onChange={(e) => setFailureDetails(e.target.value)} rows={4} placeholder="Defina número de tentativas, prazo e informação que deve constar no relatório." className="mt-1" /></div>
                </>}
                {station === 4 && <>
                  <div><Label>Quais recibos, protocolos, valores e vencimentos precisam ser confrontados com a origem?</Label><Textarea value={receiptChecks} onChange={(e) => setReceiptChecks(e.target.value)} rows={3} placeholder="Informe quais dados precisam ser comparados com a fonte original." className="mt-1" /></div>
                  <div><Label>Quais informações precisam ser consultadas ou atualizadas em outros setores?</Label><Textarea value={departmentUpdates} onChange={(e) => setDepartmentUpdates(e.target.value)} rows={3} placeholder="Indique as informações e os setores envolvidos." className="mt-1" /></div>
                  <div><Label>Quem pode solicitar, aprovar, executar e visualizar o resultado?</Label><Textarea value={accessRoles} onChange={(e) => setAccessRoles(e.target.value)} rows={3} placeholder="Informe as pessoas ou funções envolvidas em cada etapa." className="mt-1" /></div>
                  <Label className="block">Anexos (opcional)</Label>
                  <div className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed ${accent.border} ${accent.bg} px-4 py-5 text-center`} onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
                    <Paperclip className={`h-5 w-5 ${accent.active}`} /><p className="text-xs text-white/65">Anexe documentos, imagens, vídeos ou PDF para contextualizar.</p>
                    <Button size="sm" variant="outline" type="button" className="pointer-events-none h-7 text-xs">Escolher arquivos</Button>
                    <input ref={inputRef} type="file" multiple accept="image/*,video/*,application/pdf" hidden onChange={(e) => addFiles(e.target.files)} />
                  </div>
                  {files.length > 0 && <ul className="space-y-1">{files.map((f, i) => <li key={i} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/10 px-2.5 py-1.5"><Paperclip className="h-3 w-3 shrink-0" /><span className="min-w-0 flex-1 truncate text-xs">{f.name}</span><span className="shrink-0 text-[10px]">{(f.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 hover:text-red-300" aria-label={`Remover ${f.name}`}><X className="h-3.5 w-3.5" /></button></li>)}</ul>}
                </>}
                {station === 5 && <>
                  <div className={`rounded-xl border ${accent.border} ${accent.bg} p-4 text-sm`}>
                    <p className="font-semibold">Revise sua solicitação</p>
                    <dl className="mt-3 space-y-2 text-xs text-white/70"><div><dt className="inline font-medium text-white">Solicitante: </dt><dd className="inline">{requesterName || "Não informado"} ({requesterEmail || "sem e-mail"})</dd></div><div><dt className="inline font-medium text-white">Rotina: </dt><dd className="inline">{title || "Não informado"}</dd></div><div><dt className="inline font-medium text-white">Setor: </dt><dd className="inline">{resolvedSectors.join(", ") || "Não informado"}</dd></div><div><dt className="inline font-medium text-white">Resultado esperado: </dt><dd className="inline">{expectedResult || "Não informado"}</dd></div><div><dt className="inline font-medium text-white">Prioridade: </dt><dd className="inline">{PRIORITY_LABELS[priority]}{deadline ? ` — prazo ${deadline}` : ""}</dd></div></dl>
                  </div>
                  <div><Label>Se a automação funcionar perfeitamente, o que você conseguirá fazer ou deixar de fazer? <span className="text-red-400">*</span></Label><Textarea required value={automationImpact} onChange={(e) => setAutomationImpact(e.target.value)} rows={4} placeholder="Descreva o impacto esperado no seu trabalho." className="mt-1" /></div>
                  <div><Label>Quais são três exemplos que a TI deve testar antes da entrega? <span className="text-red-400">*</span></Label><Textarea required value={acceptanceTests} onChange={(e) => setAcceptanceTests(e.target.value)} rows={4} placeholder="Inclua um caso comum, uma exceção e uma falha recuperável." className="mt-1" /></div>
                  <div><Label>Você pode demonstrar o processo completo com um caso real e validar o resultado em teste? <span className="text-red-400">*</span></Label><Select value={demoAvailability} onValueChange={setDemoAvailability}><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger><SelectContent>{DEMO_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={finalConfirmed} onChange={(e) => setFinalConfirmed(e.target.checked)} className={`mt-0.5 h-4 w-4 accent-current ${accent.active}`} /><span>Revisei as informações e confirmo que representam minha necessidade.</span></label>
                </>}
              </section>
            </div>
            <DialogFooter className="mt-4 flex-row justify-between border-t border-white/10 pt-4 sm:justify-between">
              <Button variant="ghost" disabled={uploading} onClick={() => station === 0 ? setOpen(false) : setStation((s) => s - 1)}>{station === 0 ? "Cancelar" : "Voltar"}</Button>
              {station < REQUEST_STATIONS.length - 1 ? (
                <Button className={accent.button} onClick={() => setStation((s) => Math.min(REQUEST_STATIONS.length - 1, s + 1))}>Próxima estação</Button>
              ) : (
                <Button className={accent.button} onClick={() => create.mutate()} disabled={uploading || !finalConfirmed}>{uploading && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}<Send className="mr-1.5 h-4 w-4" /> Enviar solicitação</Button>
              )}
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
