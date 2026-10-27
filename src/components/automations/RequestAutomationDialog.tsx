import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useUploadAutomationAttachment, isAllowedAttachment, MAX_ATTACHMENT_MB } from "@/hooks/useAutomationAttachments";
import { useNotifyNewAutomationRequest, alertGestorsOnNewRequest } from "@/hooks/useNotifyNewAutomationRequest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { PRIORITY_LABELS, PRIORITY_OPTIONS } from "@/types/automation";
import { solicitanteCall } from "@/lib/solicitacoesApi";
import { Loader2, Lock, Paperclip, Send, X } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";

const REQUEST_STATIONS = [
  "Identificação e objetivo",
  "Como a rotina funciona hoje?",
  "Entradas, sistemas e saídas",
  "Regras, volume e conferência",
  "Perguntas por setor",
  "Validação final pelo solicitante",
];

const REQUEST_SECTORS = ["Societário", "Pessoal", "Sucesso do Cliente", "Tecnologia da Informação", "Fiscal", "Contábil", "Qualidade", "RH", "BPO", "Financeiro", "Marketing", "Diretoria", "Outro"];
const ROUTINE_TRIGGERS = ["Data/horário", "Chegada de e-mail", "Inclusão em planilha", "Solicitação de cliente", "Tarefa no sistema", "Ação manual", "Outro"];
const DATA_SOURCES = ["Planilha", "PDF", "E-mail", "Formulário", "Pasta de rede", "Sistema interno", "Portal externo", "API", "Banco de dados", "Outro"];
const OUTPUT_TYPES = ["Planilha", "PDF", "Lançamento no sistema", "Tarefa", "E-mail", "Mensagem", "Painel", "Log", "Outro"];
const FAILURE_ACTIONS = ["Continuar os demais", "Parar tudo", "Tentar novamente", "Encaminhar para análise"];
const DEMO_OPTIONS = ["Sim", "Sim, com outra pessoa", "Ainda preciso indicar responsável"];

type RequiredCheck = { field: string; isEmpty: () => boolean; message: string };

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-400">{message}</p>;
}

const invalidInput = "border-red-500/70 focus-visible:ring-red-500/40";

export function RequestAutomationDialog({ openOnMount = false, hideTrigger = false, requestType = "Automação", maintenanceSystem, solicitanteEmail = "", solicitanteSector = "", onClose, onSubmitted }: { openOnMount?: boolean; hideTrigger?: boolean; requestType?: "Sistema" | "Automação"; maintenanceSystem?: string; solicitanteEmail?: string; solicitanteSector?: string; onClose?: () => void; onSubmitted?: (id: string) => void }) {
  // Manutenção de sistema existente: usa o formulário do Sistema, em índigo.
  const isMaintenance = !!maintenanceSystem;
  const { user } = useAuth();
  const { profile } = useProfile();
  const qc = useQueryClient();
  const upload = useUploadAutomationAttachment();
  const notifyNewRequest = useNotifyNewAutomationRequest();
  const inputRef = useRef<HTMLInputElement>(null);

  // No portal público (/k7f3q9x2/solicitacoes) não existe sessão do Supabase
  // Auth: a identidade vem do token curto emitido pela Edge Function
  // "solicitacoes". Nesse fluxo nada é gravado direto no banco — o insert
  // acontece no servidor e os anexos ficam indisponíveis, porque o Storage
  // exige o dono autenticado.
  const isPortal = !user;

  const [open, setOpen] = useState(openOnMount);
  const [title, setTitle] = useState("");
  const [requesterName, setRequesterName] = useState("");
  const [requesterEmail, setRequesterEmail] = useState("");
  // O código salvo do setor ("TI") vira o rótulo da lista ("Tecnologia da Informação") para pré-selecionar.
  const presetSector = solicitanteSector === "TI" ? "Tecnologia da Informação" : solicitanteSector;
  const [selectedSectors, setSelectedSectors] = useState<string[]>(REQUEST_SECTORS.includes(presetSector) ? [presetSector] : []);
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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const resolvedSectors = selectedSectors.map((item) => item === "Outro" ? otherSector.trim() : item).filter(Boolean);
  const effectiveSector = resolvedSectors[0] || "";

  // Fonte única de verdade: apenas os campos marcados com (*) na interface são obrigatórios.
  // Os campos sem (*) nunca bloqueiam o avanço nem o envio.
  const requiredByStation: RequiredCheck[][] = [
    [
      { field: "requesterName", isEmpty: () => !requesterName.trim(), message: "Informe o nome do solicitante." },
      { field: "requesterEmail", isEmpty: () => !/^\S+@\S+\.\S+$/.test(requesterEmail.trim()), message: "Informe um e-mail válido." },
      { field: "selectedSectors", isEmpty: () => selectedSectors.length === 0, message: "Selecione ao menos um setor." },
      { field: "otherSector", isEmpty: () => selectedSectors.includes("Outro") && !otherSector.trim(), message: "Informe o nome do outro setor." },
      { field: "title", isEmpty: () => title.trim().length < 5, message: "Informe o nome da rotina com pelo menos 5 caracteres." },
      { field: "routineOwners", isEmpty: () => !routineOwners.trim(), message: "Informe quem executa a rotina e quem valida o resultado." },
      { field: "problem", isEmpty: () => !problem.trim(), message: "Descreva qual problema a automação deve resolver." },
      { field: "expectedResult", isEmpty: () => !expectedResult.trim(), message: "Descreva o resultado final esperado." },
      { field: "priorityReason", isEmpty: () => !priorityReason.trim(), message: "Explique o motivo da prioridade escolhida." },
    ],
    [
      { field: "routineTriggers", isEmpty: () => routineTriggers.length === 0, message: "Selecione ao menos um gatilho da rotina." },
      ...(isMaintenance ? [] : [
        { field: "triggerDetails", isEmpty: () => !triggerDetails.trim(), message: "Detalhe a condição exata que dispara a rotina." },
      ]),
      { field: "routineFrequency", isEmpty: () => !routineFrequency.trim(), message: "Informe a frequência e o horário da rotina." },
      ...(isMaintenance ? [] : [
        { field: "processSteps", isEmpty: () => !processSteps.trim(), message: "Descreva o processo do início ao fim." },
      ]),
      { field: "decisionRules", isEmpty: () => !decisionRules.trim(), message: "Descreva as decisões tomadas durante o processo." },
      { field: "exceptionCases", isEmpty: () => !exceptionCases.trim(), message: "Informe os casos que fogem do fluxo normal." },
      { field: "errorHandling", isEmpty: () => !errorHandling.trim(), message: "Explique como erros e pendências são tratados." },
    ],
    [
      { field: "dataSources", isEmpty: () => dataSources.length === 0, message: "Selecione ao menos uma origem de dados." },
      { field: "sourceDetails", isEmpty: () => !sourceDetails.trim(), message: "Detalhe a origem dos dados e onde encontrá-los." },
      { field: "requiredFields", isEmpty: () => !requiredFields.trim(), message: "Informe os campos obrigatórios para iniciar cada caso." },
      { field: "systemsOrder", isEmpty: () => !systemsOrder.trim(), message: "Informe os sistemas usados e a ordem de utilização." },
      { field: "outputTypes", isEmpty: () => outputTypes.length === 0, message: "Selecione ao menos um resultado a criar ou atualizar." },
      { field: "outputDetails", isEmpty: () => !outputDetails.trim(), message: "Detalhe o que deve ser criado ou atualizado ao final." },
    ],
    [
      { field: "volumeAndPeak", isEmpty: () => !volumeAndPeak.trim(), message: "Informe o volume médio e o pico da rotina." },
      { field: "verificationMethod", isEmpty: () => !verificationMethod.trim(), message: "Descreva como o resultado é conferido." },
      { field: "failureAction", isEmpty: () => !failureAction, message: "Escolha o que deve acontecer quando parte dos itens falha." },
      { field: "failureDetails", isEmpty: () => !failureDetails.trim(), message: "Defina tentativas, prazo e informações do relatório de falhas." },
    ],
    [],
    [
      { field: "automationImpact", isEmpty: () => !automationImpact.trim(), message: "Descreva o que mudará quando a automação funcionar." },
      { field: "acceptanceTests", isEmpty: () => !acceptanceTests.trim(), message: "Informe três exemplos para a TI testar antes da entrega." },
      { field: "demoAvailability", isEmpty: () => !demoAvailability, message: "Informe se pode demonstrar e validar o processo em teste." },
    ],
  ];

  const runStationValidation = (index: number) => {
    const failures: Record<string, string> = {};
    for (const check of requiredByStation[index]) {
      if (check.isEmpty()) failures[check.field] = check.message;
    }
    setErrors((prev) => {
      const next = { ...prev };
      for (const check of requiredByStation[index]) {
        if (failures[check.field]) next[check.field] = failures[check.field];
        else delete next[check.field];
      }
      return next;
    });
    return Object.keys(failures).length;
  };

  const goToStation = (index: number) => {
    setErrors({});
    setStation(index);
  };

  const requestStation = (index: number) => {
    if (index <= station) {
      goToStation(index);
      return;
    }
    toast.error("Para avançar, preencha os campos obrigatórios (*) desta estação e clique em \"Próxima estação\".");
  };

  const goNextStation = () => {
    if (runStationValidation(station) > 0) {
      toast.error("Responda as perguntas obrigatórias marcadas com (*) para continuar.");
      return;
    }
    goToStation(visibleStations[Math.min(visibleStations.length - 1, visibleStations.indexOf(station) + 1)]);
  };

  useEffect(() => {
    if (!requesterName && profile?.full_name) setRequesterName(profile.full_name);
    if (!requesterEmail && (user?.email ?? solicitanteEmail)) setRequesterEmail(user?.email ?? solicitanteEmail);
  }, [profile?.full_name, user?.email, solicitanteEmail, requesterName, requesterEmail]);

  const reset = () => {
    setTitle(""); setRequesterName(""); setRequesterEmail(""); setSelectedSectors([]); setOtherSector("");
    setRoutineOwners(""); setProblem(""); setExpectedResult(""); setPriorityReason(""); setDeadline(""); setPriority("medium");
    setRoutineTriggers([]); setTriggerDetails(""); setRoutineFrequency(""); setProcessSteps(""); setDecisionRules(""); setExceptionCases(""); setErrorHandling("");
    setStation(0); setDataSources([]); setSourceDetails(""); setRequiredFields(""); setSystemsOrder(""); setOutputTypes([]); setOutputDetails(""); setVolumeAndPeak(""); setExecutionDeadline(""); setVerificationMethod(""); setFailureAction(""); setFailureDetails(""); setReceiptChecks(""); setDepartmentUpdates(""); setAccessRoles(""); setAutomationImpact(""); setAcceptanceTests(""); setDemoAvailability(""); setFinalConfirmed(false);
    setErrors({});
    setFiles([]);
  };

  // Manutenção usa só as estações 1 e 2; as demais não se aplicam.
  const visibleStations = isMaintenance ? [0, 1] : REQUEST_STATIONS.map((_, i) => i);
  const lastStation = visibleStations[visibleStations.length - 1];

  const accent = isMaintenance
    ? { active: "text-red-300", border: "border-red-400/40", bg: "bg-red-500/10", rail: "bg-red-400", ring: "focus-visible:ring-red-400", button: "bg-red-800 hover:bg-red-700" }
    : requestType === "Sistema"
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
      const allFailures: Record<string, string> = {};
      let firstFailingStation = -1;
      requiredByStation.forEach((checks, index) => {
        if (!visibleStations.includes(index)) return;
        const stationFails = checks.filter((check) => check.isEmpty());
        if (stationFails.length === 0) return;
        if (firstFailingStation === -1) firstFailingStation = index;
        for (const check of stationFails) {
          allFailures[check.field] = `${REQUEST_STATIONS[index]} — ${check.message}`;
        }
      });
      if (Object.keys(allFailures).length > 0) {
        setErrors(allFailures);
        setStation(firstFailingStation);
        throw new Error(`Responda as perguntas obrigatórias marcadas com (*) na estação ${firstFailingStation + 1}.`);
      }
      if (!finalConfirmed) throw new Error("Confirme a validação final antes de enviar.");

      const completeDescription = [
        `1. Identificação e objetivo\n${isMaintenance ? `Manutenção do sistema: ${maintenanceSystem}\n` : ""}Solicitante: ${requesterName.trim()}\nE-mail: ${requesterEmail.trim()}\nSetores: ${resolvedSectors.join(", ")}\nNome da rotina: ${title.trim()}\nQuem executa e valida: ${routineOwners.trim()}\nProblema a resolver: ${problem.trim()}\nResultado final esperado: ${expectedResult.trim()}\nPrioridade: ${PRIORITY_LABELS[priority]}\nMotivo da prioridade: ${priorityReason.trim()}\nData limite real: ${deadline || "Não informada"}`,
        `2. Como a rotina funciona hoje?\nGatilhos: ${routineTriggers.join(", ")}\nCondição exata: ${triggerDetails.trim()}\nFrequência e horário: ${routineFrequency.trim()}\nProcesso passo a passo: ${processSteps.trim()}\nDecisões: ${decisionRules.trim()}\nCasos fora do fluxo normal: ${exceptionCases.trim()}\nTratamento de erros e pendências: ${errorHandling.trim()}`,
        `3. Entradas, sistemas e saídas\nOrigens dos dados: ${dataSources.join(", ")}\nDetalhes das origens: ${sourceDetails.trim()}\nCampos obrigatórios: ${requiredFields.trim()}\nSistemas e ordem de uso: ${systemsOrder.trim()}\nResultados a criar ou atualizar: ${outputTypes.join(", ")}\nDetalhes dos resultados: ${outputDetails.trim()}`,
        `4. Regras, volume e conferência\nVolume médio e pico: ${volumeAndPeak.trim()}\nPrazo máximo da execução: ${executionDeadline.trim() || "Não informado"}\nConferência do resultado: ${verificationMethod.trim()}\nAção quando itens falham: ${failureAction}\nDetalhes do tratamento de falhas: ${failureDetails.trim()}`,
        `5. Perguntas por setor (${effectiveSector || "Setor não informado"})\nRecibos, protocolos, valores e vencimentos a confrontar: ${receiptChecks.trim() || "Não informado"}\nInformações consultadas ou atualizadas em outros setores: ${departmentUpdates.trim() || "Não informado"}\nQuem pode solicitar, aprovar, executar e visualizar: ${accessRoles.trim() || "Não informado"}`,
        `6. Validação final pelo solicitante\nImpacto esperado: ${automationImpact.trim()}\nExemplos de teste: ${acceptanceTests.trim()}\nDemonstração e validação em teste: ${demoAvailability}`,
      ].join("\n\n");

      if (isPortal) {
        // Portal público: o front não toca o banco. A função preenche
        // created_by/requester_id a partir do token, grava o evento e notifica
        // os gestores.
        const { id } = await solicitanteCall<{ id: string }>("create", {
          request: {
            title: isMaintenance ? maintenanceSystem! : title.trim(),
            maintenance_system: isMaintenance ? maintenanceSystem : undefined,
            description: completeDescription,
            objective: expectedResult.trim() || null,
            process_impact: expectedResult.trim() || null,
            sector: effectiveSector,
            request_kind: requestType,
            priority,
            sender_name: requesterName.trim() || requesterEmail.trim() || undefined,
          },
        });
        return id;
      }

      if (!user) throw new Error("Não autenticado");
      if (isMaintenance) {
        const { data: target, error: findError } = await supabase
          .from("automations")
          .select("id, status")
          .eq("title", maintenanceSystem!)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (findError) throw findError;
        if (!target) throw new Error("Sistema não encontrado.");
        const system = target as { id: string; status: string };
        // Concluído volta para "Alteração solicitada"; em andamento só registra o evento.
        const moved = system.status === "completed";
        if (moved) {
          const { error: updateError } = await supabase
            .from("automations")
            .update({ status: "change_requested" } as any)
            .eq("id", system.id);
          if (updateError) throw updateError;
        }
        await supabase.from("automation_events").insert({
          automation_id: system.id,
          event_type: moved ? "status_changed" : "change_requested",
          description: `Alteração solicitada pelo colaborador:\n${completeDescription}`,
          user_id: user.id,
          metadata: { new_status: moved ? "change_requested" : system.status, old_status: system.status },
        } as any);
        return system.id;
      }

      const { data, error } = await supabase
        .from("automations")
        .insert({
          title: title.trim(),
          description: completeDescription,
          objective: expectedResult.trim() || null,
          priority,
          status: "requested",
          sector: effectiveSector,
          // A modalidade escolhida nos cartões SISTEMAS / AUTOMAÇÃO DE PROCESSOS.
          // É ela que separa as duas filas em /automacoes e no acompanhamento.
          request_kind: requestType,
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
      if (isPortal) {
        // No portal a notificação dos gestores e o registro do evento já
        // saíram da Edge Function; aqui só invalida a lista do solicitante.
        qc.invalidateQueries({ queryKey: ["solicitante-requests"] });
        toast.success("Solicitação enviada para a equipe de TI!");
        reset();
        setOpen(false);
        onSubmitted?.(id);
        return;
      }
      qc.invalidateQueries({ queryKey: ["automations"] });
      qc.invalidateQueries({ queryKey: ["my-automation-requests"] });
      // Envia os anexos após a automação existir (imagens, vídeos e PDFs).
      for (const file of files) {
        try {
          await upload.mutateAsync({ automationId: id, file });
        } catch {
          // erro já exibido pelo hook; segue com os demais arquivos.
        }
      }
      // Manutenção não cria solicitação nova: o alerta para os devs vem de automation_events
      // (ChangeAlertGate), então não há aviso de "nova solicitação" aqui.
      if (!isMaintenance) {
        // Notifica os gestores via DB (realtime) e dispara alert card imediato.
        notifyNewRequest.mutate({ automationId: id, title: title.trim(), kind: requestType });
        alertGestorsOnNewRequest({
          requesterName: requesterName.trim() || profile?.full_name || user?.email || "Alguém",
          title: title.trim(),
          kind: requestType,
        });
      }
      toast.success(isMaintenance ? "Alteração registrada para a equipe de TI!" : "Solicitação enviada para a equipe de TI!");
      reset();
      setOpen(false);
      onSubmitted?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploading = create.isPending;

  const attachmentsField = isPortal ? (
    <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-white/60">
      <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      Anexos (imagem, vídeo ou PDF) exigem login no sistema. Se precisar
      enviar arquivos, mencione no chat da solicitação após o envio.
    </p>
  ) : (
    <>
    <Label className="block">Anexos (opcional)</Label>
    <div className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed ${accent.border} ${accent.bg} px-4 py-5 text-center`} onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}>
      <Paperclip className={`h-5 w-5 ${accent.active}`} /><p className="text-xs text-white/65">Anexe documentos, imagens, vídeos ou PDF para contextualizar.</p>
      <Button size="sm" variant="outline" type="button" className={`pointer-events-none h-7 text-xs ${isMaintenance ? "border-red-400/40 bg-red-950/60 text-white hover:bg-red-900 hover:text-white" : ""}`}>Escolher arquivos</Button>
      <input ref={inputRef} type="file" multiple accept="image/*,video/*,application/pdf" hidden onChange={(e) => addFiles(e.target.files)} />
    </div>
    {files.length > 0 && <ul className="space-y-1">{files.map((f, i) => <li key={i} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/10 px-2.5 py-1.5"><Paperclip className="h-3 w-3 shrink-0" /><span className="min-w-0 flex-1 truncate text-xs">{f.name}</span><span className="shrink-0 text-[10px]">{(f.size / 1024 / 1024).toFixed(1)} MB</span><button type="button" onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))} className="shrink-0 hover:text-red-300" aria-label={`Remover ${f.name}`}><X className="h-3.5 w-3.5" /></button></li>)}</ul>}
    </>
  );

  const finalConfirmField = (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3 text-sm"><input type="checkbox" checked={finalConfirmed} onChange={(e) => setFinalConfirmed(e.target.checked)} className={`mt-0.5 h-4 w-4 accent-current ${accent.active}`} /><span>Revisei as informações e confirmo que representam minha necessidade.</span></label>
  );

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { reset(); onClose?.(); } }}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm" variant="outline">
            <Send className="h-4 w-4 mr-1.5" /> Solicitar automação
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className={`flex max-h-[92vh] w-[96vw] max-w-5xl flex-col overflow-hidden border text-white ${isMaintenance ? "[&_input]:bg-red-950/60 [&_input]:text-white [&_input]:border-red-400/30 [&_textarea]:bg-red-950/60 [&_textarea]:text-white [&_textarea]:border-red-400/30 [&_button[role=combobox]]:bg-red-950/60 [&_button[role=combobox]]:text-white [&_button[role=combobox]]:border-red-400/30 [&_input]:placeholder:text-slate-400 [&_textarea]:placeholder:text-slate-400" : "[&_input]:text-black [&_textarea]:text-black"} ${accent.border} ${isMaintenance ? "bg-[#2a0d12]" : requestType === "Sistema" ? "bg-[#0c2034]" : "bg-[#1b1534]"}`}>
        <DialogHeader>
          <DialogTitle className={accent.active}>{isMaintenance ? `Manutenção — ${maintenanceSystem}` : requestType}</DialogTitle>
          <DialogDescription>
            {requestType === "Sistema"
              ? "Descreva sua necessidade de sistema para a equipe de TI avaliar."
              : "A equipe de TI vai analisar, definir prioridade, responsável e prazo. Você acompanha tudo por aqui."}
          </DialogDescription>
          {isPortal && (solicitanteEmail || solicitanteSector) && (
            <p className="text-xs text-white/55">
              Identificado como <b className="text-white/80">{solicitanteEmail}</b>
              {solicitanteSector && <> · setor <b className="text-white/80">{solicitanteSector}</b></>}.
            </p>
          )}
        </DialogHeader>

        <div className="grid min-h-0 flex-1 gap-5 overflow-hidden md:grid-cols-[245px_minmax(0,1fr)]">
          <nav aria-label="Etapas da solicitação" className="flex gap-2 overflow-x-auto pb-2 md:block md:overflow-y-auto md:border-r md:border-white/10 md:pr-4">
            {visibleStations.map((index, position) => {
              const name = REQUEST_STATIONS[index];
              const reached = index <= station;
              const locked = index > station;
              return (
                <button key={name} type="button" onClick={() => requestStation(index)} aria-disabled={locked} aria-current={station === index ? "step" : undefined}
                  className={`relative flex min-w-[145px] items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs transition-colors md:mb-2 md:w-full ${station === index ? `${accent.bg} ${accent.active}` : locked ? "cursor-not-allowed text-white/25" : "text-white/55 hover:bg-white/5 hover:text-white/85"}`}>
                  <motion.span
                    animate={{ scale: [1, station === index ? 1.18 : 1.08, 1] }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: index * 0.2 }}
                    className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold ${reached ? `${accent.rail} border-transparent text-slate-950` : "border-white/25 bg-transparent text-white/55"}`}>{index + 1}</motion.span>
                  <span className="leading-snug">{name}</span>
                  {locked && <Lock className="ml-auto h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
                  {position < visibleStations.length - 1 && <span className={`absolute bottom-[-8px] left-[26px] hidden h-3 w-px md:block ${index < station ? accent.rail : "bg-white/15"}`} />}
                </button>
              );
            })}
          </nav>

          <div className="flex min-h-0 flex-col overflow-hidden">
            <div className="mb-3 flex items-center justify-between">
              <p className={`text-xs font-medium uppercase tracking-wider ${accent.active}`}>Estação {visibleStations.indexOf(station) + 1} de {visibleStations.length}</p>
              <div className="flex gap-1" aria-hidden="true">{visibleStations.map((s) => <span key={s} className={`h-1 w-6 rounded-full ${s <= station ? accent.rail : "bg-white/15"}`} />)}</div>
            </div>
            <div className={`min-h-0 flex-1 overflow-y-auto pr-2 ${isMaintenance ? "[scrollbar-color:#7f1d1d_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-red-800 [&::-webkit-scrollbar-thumb:hover]:bg-red-700" : ""}`}>
              <section className="space-y-4 pb-4">
                {station === 0 && <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Nome do Solicitante <span className="text-red-400">*</span></Label><Input required aria-invalid={!!errors.requesterName} value={requesterName} onChange={(e) => setRequesterName(e.target.value)} placeholder="Seu nome completo" className={`mt-1 ${errors.requesterName ? invalidInput : ""}`} /><FieldError message={errors.requesterName} /></div>
                    <div><Label>E-mail <span className="text-red-400">*</span></Label><Input required aria-invalid={!!errors.requesterEmail} type="email" value={requesterEmail} onChange={(e) => setRequesterEmail(e.target.value)} placeholder="voce@empresa.com" className={`mt-1 ${errors.requesterEmail ? invalidInput : ""}`} /><FieldError message={errors.requesterEmail} /></div>
                  </div>
                  <div>
                    <Label>Setor <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-3">
                      {REQUEST_SECTORS.map((item) => (
                        <label key={item} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${selectedSectors.includes(item) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={selectedSectors.includes(item)} onChange={(e) => setSelectedSectors((prev) => e.target.checked ? [...prev, item] : prev.filter((s) => s !== item))} className="h-4 w-4" style={{ accentColor: isMaintenance ? "#f87171" : requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {item}
                        </label>
                      ))}
                    </div>
                    <FieldError message={errors.selectedSectors} />
                    {selectedSectors.includes("Outro") && <Input aria-invalid={!!errors.otherSector} value={otherSector} onChange={(e) => setOtherSector(e.target.value)} placeholder="Digite o nome do setor" className={`mt-2 ${errors.otherSector ? invalidInput : ""}`} />}
                    <FieldError message={errors.otherSector} />
                  </div>
                  {isMaintenance ? (
                    <div className="space-y-3">
                      <div>
                        <Label>Descreva quais as mudanças que o sistema precisa atender: <span className="text-red-400">*</span></Label>
                        <Textarea required maxLength={6000} aria-invalid={!!errors.title} value={title} onChange={(e) => setTitle(e.target.value)} rows={6} placeholder="Descreva as mudanças necessárias no sistema (até 6000 caracteres)." className={`mt-1 ${errors.title ? invalidInput : ""}`} />
                        <FieldError message={errors.title} />
                      </div>
                      <p className="text-xs text-white/65">Se for necessário, envie anexos ou vídeos comentados para facilitar a compreensão dos desenvolvedores.</p>
                      {attachmentsField}
                    </div>
                  ) : (
                    <div><Label>Nome da rotina que deseja automatizar <span className="text-red-400">*</span></Label><Input required aria-invalid={!!errors.title} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Conferência de notificações do DTE" className={`mt-1 ${errors.title ? invalidInput : ""}`} /><FieldError message={errors.title} /></div>
                  )}
                  <div><Label>Quem executa a rotina hoje e quem valida o resultado? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.routineOwners} value={routineOwners} onChange={(e) => setRoutineOwners(e.target.value)} rows={3} placeholder="Informe funções e responsáveis, inclusive quando atravessa mais de um setor." className={`mt-1 ${errors.routineOwners ? invalidInput : ""}`} /><FieldError message={errors.routineOwners} /></div>
                  <div><Label>Qual problema a automação deve resolver? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.problem} value={problem} onChange={(e) => setProblem(e.target.value)} rows={3} placeholder="Diga o que consome tempo, gera erro, atrasa uma entrega ou dificulta o acompanhamento." className={`mt-1 ${errors.problem ? invalidInput : ""}`} /><FieldError message={errors.problem} /></div>
                  <div><Label>Qual resultado final espera receber? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.expectedResult} value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={3} placeholder="Ex.: guias salvas por colaborador, relatório de empresas com erro, tarefa criada no Gestta ou aviso enviado." className={`mt-1 ${errors.expectedResult ? invalidInput : ""}`} /><FieldError message={errors.expectedResult} /></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div><Label>Qual a prioridade? <span className="text-red-400">*</span></Label><Select value={priority} onValueChange={setPriority}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label>Data limite real (se existir)</Label><Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="mt-1" /></div>
                  </div>
                  <div><Label>Por que escolheu essa prioridade? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.priorityReason} value={priorityReason} onChange={(e) => setPriorityReason(e.target.value)} rows={2} placeholder="Explique o impacto e o prazo relacionado, se houver." className={`mt-1 ${errors.priorityReason ? invalidInput : ""}`} /><FieldError message={errors.priorityReason} /></div>
                  <p className="text-xs font-semibold text-red-400">Lembrando que o prazo escolhido não significa que vai ser resolvido nesse prazo.</p>
                </>}
                {station === 1 && <>
                  <div>
                    <Label>O que dispara a rotina? <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {ROUTINE_TRIGGERS.map((trigger) => (
                        <label key={trigger} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${routineTriggers.includes(trigger) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={routineTriggers.includes(trigger)} onChange={(e) => setRoutineTriggers((prev) => e.target.checked ? [...prev, trigger] : prev.filter((item) => item !== trigger))} className="h-4 w-4" style={{ accentColor: isMaintenance ? "#f87171" : requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {trigger}
                        </label>
                      ))}
                    </div>
                    <FieldError message={errors.routineTriggers} />
                  </div>
                  {!isMaintenance && <div><Label>Detalhe a condição exata <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.triggerDetails} value={triggerDetails} onChange={(e) => setTriggerDetails(e.target.value)} rows={2} placeholder="Em que situação a rotina deve começar?" className={`mt-1 ${errors.triggerDetails ? invalidInput : ""}`} /><FieldError message={errors.triggerDetails} /></div>}
                  <div><Label>Qual a frequência e em que horário deve ocorrer? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.routineFrequency} value={routineFrequency} onChange={(e) => setRoutineFrequency(e.target.value)} rows={3} placeholder="Informe dias úteis, fins de semana, feriados e competência, se aplicável." className={`mt-1 ${errors.routineFrequency ? invalidInput : ""}`} /><FieldError message={errors.routineFrequency} /></div>
                  {!isMaintenance && <div><Label>Descreva o processo do início ao fim, na ordem em que é realizado. <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.processSteps} value={processSteps} onChange={(e) => setProcessSteps(e.target.value)} rows={5} placeholder="Numere as etapas; informe telas, menus, cliques, cálculos, conferências e aprovações." className={`mt-1 ${errors.processSteps ? invalidInput : ""}`} /><FieldError message={errors.processSteps} /></div>}
                  <div><Label>Que decisões a pessoa toma durante o processo? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.decisionRules} value={decisionRules} onChange={(e) => setDecisionRules(e.target.value)} rows={4} placeholder="Para cada decisão, escreva: se acontecer X, faço Y; caso contrário, faço Z." className={`mt-1 ${errors.decisionRules ? invalidInput : ""}`} /><FieldError message={errors.decisionRules} /></div>
                  <div><Label>Quais casos fogem do fluxo normal? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.exceptionCases} value={exceptionCases} onChange={(e) => setExceptionCases(e.target.value)} rows={4} placeholder="Ex.: empresa inativa, ausência de movimento, senha vencida, cadastro duplicado, guia já emitida, portal indisponível ou documento ilegível." className={`mt-1 ${errors.exceptionCases ? invalidInput : ""}`} /><FieldError message={errors.exceptionCases} /></div>
                  <div><Label>O que acontece hoje quando há erro ou pendência? Quem resolve e em quanto tempo? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.errorHandling} value={errorHandling} onChange={(e) => setErrorHandling(e.target.value)} rows={4} placeholder="Descreva como o problema é identificado, encaminhado e resolvido." className={`mt-1 ${errors.errorHandling ? invalidInput : ""}`} /><FieldError message={errors.errorHandling} /></div>
                </>}
                {station === 2 && <>
                  <div>
                    <Label>De onde vêm os dados de entrada? <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {DATA_SOURCES.map((source) => (
                        <label key={source} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${dataSources.includes(source) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={dataSources.includes(source)} onChange={(e) => setDataSources((prev) => e.target.checked ? [...prev, source] : prev.filter((item) => item !== source))} className="h-4 w-4" style={{ accentColor: isMaintenance ? "#f87171" : requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {source}
                        </label>
                      ))}
                    </div>
                    <FieldError message={errors.dataSources} />
                  </div>
                  <div><Label>Informe nome do arquivo, aba/colunas, pasta, endereço ou tela. <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.sourceDetails} value={sourceDetails} onChange={(e) => setSourceDetails(e.target.value)} rows={3} placeholder="Detalhe onde encontrar os dados de entrada." className={`mt-1 ${errors.sourceDetails ? invalidInput : ""}`} /><FieldError message={errors.sourceDetails} /></div>
                  <div><Label>Quais campos são obrigatórios para iniciar cada caso? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.requiredFields} value={requiredFields} onChange={(e) => setRequiredFields(e.target.value)} rows={3} placeholder="Ex.: CNPJ, razão social, competência, responsável, matrícula, prazo." className={`mt-1 ${errors.requiredFields ? invalidInput : ""}`} /><FieldError message={errors.requiredFields} /></div>
                  <div><Label>Quais sistemas são usados e em que ordem? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.systemsOrder} value={systemsOrder} onChange={(e) => setSystemsOrder(e.target.value)} rows={4} placeholder="Informe o nome e a finalidade de cada sistema, inclusive Domínio, Gestta, Onvio, SEFAZ e portais específicos." className={`mt-1 ${errors.systemsOrder ? invalidInput : ""}`} /><FieldError message={errors.systemsOrder} /></div>
                  <div>
                    <Label>O que deve ser criado ou atualizado ao final? <span className="text-red-400">*</span></Label>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {OUTPUT_TYPES.map((output) => (
                        <label key={output} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors ${outputTypes.includes(output) ? `${accent.border} ${accent.bg}` : "border-white/10 bg-black/10 hover:bg-white/5"}`}>
                          <input type="checkbox" checked={outputTypes.includes(output)} onChange={(e) => setOutputTypes((prev) => e.target.checked ? [...prev, output] : prev.filter((item) => item !== output))} className="h-4 w-4" style={{ accentColor: isMaintenance ? "#f87171" : requestType === "Sistema" ? "#38bdf8" : "#a78bfa" }} />
                          {output}
                        </label>
                      ))}
                    </div>
                    <FieldError message={errors.outputTypes} />
                  </div>
                  <div><Label>Informe campos, nome do arquivo e padrão de pasta. <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.outputDetails} value={outputDetails} onChange={(e) => setOutputDetails(e.target.value)} rows={3} placeholder="Descreva o conteúdo e onde salvar ou registrar cada resultado." className={`mt-1 ${errors.outputDetails ? invalidInput : ""}`} /><FieldError message={errors.outputDetails} /></div>
                </>}
                {station === 3 && <>
                  <div><Label>Qual o volume médio e o pico? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.volumeAndPeak} value={volumeAndPeak} onChange={(e) => setVolumeAndPeak(e.target.value)} rows={3} placeholder="Informe itens por execução, execuções por dia/mês e tempo gasto hoje em cada execução." className={`mt-1 ${errors.volumeAndPeak ? invalidInput : ""}`} /><FieldError message={errors.volumeAndPeak} /></div>
                  <div><Label>Qual o prazo máximo para concluir uma execução?</Label><Input value={executionDeadline} onChange={(e) => setExecutionDeadline(e.target.value)} placeholder="Há horário limite para enviar, consultar ou protocolar?" className="mt-1" /></div>
                  <div><Label>Como você confere que o resultado está correto? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.verificationMethod} value={verificationMethod} onChange={(e) => setVerificationMethod(e.target.value)} rows={4} placeholder="Informe totais esperados, reconciliação, amostra, recibo, status no sistema e pessoa responsável pela conferência." className={`mt-1 ${errors.verificationMethod ? invalidInput : ""}`} /><FieldError message={errors.verificationMethod} /></div>
                  <div><Label>O que deve acontecer quando parte dos itens falha? <span className="text-red-400">*</span></Label><Select value={failureAction} onValueChange={setFailureAction}><SelectTrigger aria-invalid={!!errors.failureAction} className={`mt-1 ${errors.failureAction ? invalidInput : ""}`}><SelectValue placeholder="Selecione uma ação" /></SelectTrigger><SelectContent>{FAILURE_ACTIONS.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}</SelectContent></Select><FieldError message={errors.failureAction} /></div>
                  <div><Label>Detalhes do tratamento de falhas <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.failureDetails} value={failureDetails} onChange={(e) => setFailureDetails(e.target.value)} rows={4} placeholder="Defina número de tentativas, prazo e informação que deve constar no relatório." className={`mt-1 ${errors.failureDetails ? invalidInput : ""}`} /><FieldError message={errors.failureDetails} /></div>
                </>}
                {station === 4 && <>
                  <div><Label>Quais recibos, protocolos, valores e vencimentos precisam ser confrontados com a origem?</Label><Textarea value={receiptChecks} onChange={(e) => setReceiptChecks(e.target.value)} rows={3} placeholder="Informe quais dados precisam ser comparados com a fonte original." className="mt-1" /></div>
                  <div><Label>Quais informações precisam ser consultadas ou atualizadas em outros setores?</Label><Textarea value={departmentUpdates} onChange={(e) => setDepartmentUpdates(e.target.value)} rows={3} placeholder="Indique as informações e os setores envolvidos." className="mt-1" /></div>
                  <div><Label>Quem pode solicitar, aprovar, executar e visualizar o resultado?</Label><Textarea value={accessRoles} onChange={(e) => setAccessRoles(e.target.value)} rows={3} placeholder="Informe as pessoas ou funções envolvidas em cada etapa." className="mt-1" /></div>
                  {!isMaintenance && attachmentsField}
                </>}
                {station === 5 && <>
                  <div className={`rounded-xl border ${accent.border} ${accent.bg} p-4 text-sm`}>
                    <p className="font-semibold">Revise sua solicitação</p>
                    <dl className="mt-3 space-y-2 text-xs text-white/70"><div><dt className="inline font-medium text-white">Solicitante: </dt><dd className="inline">{requesterName || "Não informado"} ({requesterEmail || "sem e-mail"})</dd></div><div><dt className="inline font-medium text-white">Rotina: </dt><dd className="inline">{title || "Não informado"}</dd></div><div><dt className="inline font-medium text-white">Setor: </dt><dd className="inline">{resolvedSectors.join(", ") || "Não informado"}</dd></div><div><dt className="inline font-medium text-white">Resultado esperado: </dt><dd className="inline">{expectedResult || "Não informado"}</dd></div><div><dt className="inline font-medium text-white">Prioridade: </dt><dd className="inline">{PRIORITY_LABELS[priority]}{deadline ? ` — prazo ${deadline}` : ""}</dd></div></dl>
                  </div>
                  <div><Label>Se a automação funcionar perfeitamente, o que você conseguirá fazer ou deixar de fazer? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.automationImpact} value={automationImpact} onChange={(e) => setAutomationImpact(e.target.value)} rows={4} placeholder="Descreva o impacto esperado no seu trabalho." className={`mt-1 ${errors.automationImpact ? invalidInput : ""}`} /><FieldError message={errors.automationImpact} /></div>
                  <div><Label>Quais são três exemplos que a TI deve testar antes da entrega? <span className="text-red-400">*</span></Label><Textarea required aria-invalid={!!errors.acceptanceTests} value={acceptanceTests} onChange={(e) => setAcceptanceTests(e.target.value)} rows={4} placeholder="Inclua um caso comum, uma exceção e uma falha recuperável." className={`mt-1 ${errors.acceptanceTests ? invalidInput : ""}`} /><FieldError message={errors.acceptanceTests} /></div>
                  <div><Label>Você pode demonstrar o processo completo com um caso real e validar o resultado em teste? <span className="text-red-400">*</span></Label><Select value={demoAvailability} onValueChange={setDemoAvailability}><SelectTrigger aria-invalid={!!errors.demoAvailability} className={`mt-1 ${errors.demoAvailability ? invalidInput : ""}`}><SelectValue placeholder="Selecione uma opção" /></SelectTrigger><SelectContent>{DEMO_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select><FieldError message={errors.demoAvailability} /></div>
                  {finalConfirmField}
                </>}
                {isMaintenance && station === lastStation && finalConfirmField}
              </section>
            </div>
            <DialogFooter className="mt-4 flex-row justify-between border-t border-white/10 pt-4 sm:justify-between">
              <Button variant="ghost" disabled={uploading} onClick={() => station === 0 ? setOpen(false) : goToStation(visibleStations[visibleStations.indexOf(station) - 1])}>{station === 0 ? "Cancelar" : "Voltar"}</Button>
              {station < lastStation ? (
                <Button className={accent.button} onClick={goNextStation}>Próxima estação</Button>
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
