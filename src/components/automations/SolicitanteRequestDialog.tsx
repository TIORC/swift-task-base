import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  solicitanteCall,
  type SolicitanteCreatePayload,
} from "@/lib/solicitacoesApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { PRIORITY_LABELS, PRIORITY_OPTIONS } from "@/types/automation";
import { Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";

/**
 * Diálogo de solicitação do portal do solicitante (/k7f3q9x2/solicitacoes).
 *
 * Versão enxuta do RequestAutomationDialog, APENAS para o fluxo anônimo:
 * grava via Edge Function "solicitacoes" (ação create), SEM tocar as tabelas
 * diretamente. Não tem upload de anexos — no modo anônimo os anexos exigem
 * login (Storage só aceita o dono autenticado).
 */

const REQUEST_SECTORS = ["Societário", "Pessoal", "Sucesso do Cliente", "Tecnologia da Informação", "Fiscal", "Contábil", "Qualidade", "RH", "BPO", "Financeiro", "Marketing", "Outro"];

export function SolicitanteRequestDialog({
  openOnMount = false,
  hideTrigger = false,
  requestType = "Automação",
  senderName = "",
  senderSector = "",
  onClose,
  onSubmitted,
}: {
  openOnMount?: boolean;
  hideTrigger?: boolean;
  requestType?: "Sistema" | "Automação";
  senderName?: string;
  senderSector?: string;
  onClose?: () => void;
  onSubmitted?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(openOnMount);
  const [title, setTitle] = useState("");
  const [selectedSectors, setSelectedSectors] = useState<string[]>(senderSector ? [senderSector] : []);
  const [otherSector, setOtherSector] = useState("");
  const [routineOwners, setRoutineOwners] = useState("");
  const [problem, setProblem] = useState("");
  const [expectedResult, setExpectedResult] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [finalConfirmed, setFinalConfirmed] = useState(false);

  useEffect(() => {
    setOpen(openOnMount);
  }, [openOnMount]);

  const resolvedSectors = [...selectedSectors, ...(otherSector.trim() ? [otherSector.trim()] : [])];
  const resolvedSector = selectedSectors[0] ?? senderSector ?? "";
  const toggleSector = (s: string) =>
    setSelectedSectors((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  const accent = requestType === "Sistema"
    ? { button: "bg-cyan-400 text-slate-950 hover:bg-cyan-300" }
    : { button: "bg-violet-400 text-slate-950 hover:bg-violet-300" };

  const create = useMutation({
    mutationFn: async () => {
      if (!title.trim()) throw new Error("Informe o título da solicitação.");
      if (!expectedResult.trim()) throw new Error("Descreva o resultado esperado.");
      if (!finalConfirmed) throw new Error("Confirme a revisão para enviar.");
      const payload: SolicitanteCreatePayload = {
        title: title.trim(),
        description: [
          problem.trim() && `Problema/necessidade:\n${problem.trim()}`,
          routineOwners.trim() && `Responsáveis pela rotina: ${routineOwners.trim()}`,
          resolvedSectors.length > 0 && `Setores: ${resolvedSectors.join(", ")}`,
        ].filter(Boolean).join("\n\n") || null,
        objective: problem.trim() || null,
        process_impact: expectedResult.trim(),
        sector: resolvedSector,
        request_kind: requestType,
        priority,
        sender_name: senderName || undefined,
      };
      const { id } = await solicitanteCall<{ id: string }>("create", { request: payload });
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["solicitante-requests"] });
      setOpen(false);
      toast.success("Solicitação enviada!");
      onSubmitted?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose?.();
        setOpen(v);
      }}
    >
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button className={accent.button}>Solicitar {requestType === "Sistema" ? "sistema" : "automação"}</Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-white/10 bg-[#0b1626]">
        <DialogHeader>
          <DialogTitle>
            Solicitar {requestType === "Sistema" ? "sistema" : "automação de processo"}
          </DialogTitle>
          <DialogDescription>
            Identificado como <b className="text-white/80">{senderName || "solicitante"}</b>
            {senderSector && <> · setor <b className="text-white/80">{senderSector}</b></>}.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <Label>Nome da rotina *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Conciliação de boletos" className="mt-1" />
          </div>
          <div>
            <Label>Quem executa essa rotina hoje?</Label>
            <Input value={routineOwners} onChange={(e) => setRoutineOwners(e.target.value)} placeholder="Nomes ou funções" className="mt-1" />
          </div>
          <div>
            <Label>Qual problema ou necessidade motiva este pedido?</Label>
            <Textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={4} placeholder="Descreva a dor atual." className="mt-1" />
          </div>
          <div>
            <Label>Setor(es) atendido(s)</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {REQUEST_SECTORS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSector(s)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${selectedSectors.includes(s) ? "border-white/60 bg-white/15 text-white" : "border-white/10 bg-white/5 text-white/60 hover:text-white"}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {selectedSectors.includes("Outro") && (
              <Input value={otherSector} onChange={(e) => setOtherSector(e.target.value)} placeholder="Qual setor?" className="mt-2" />
            )}
          </div>
          <div>
            <Label>Resultado esperado *</Label>
            <Textarea value={expectedResult} onChange={(e) => setExpectedResult(e.target.value)} rows={3} placeholder="O que a TI deve entregar?" className="mt-1" />
          </div>
          <div>
            <Label>Prioridade</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PRIORITY_OPTIONS.map((o) => (
                  <SelectItem key={o} value={o}>{PRIORITY_LABELS[o]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <p className="flex items-start gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-xs leading-relaxed text-white/60">
            <Paperclip className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Anexos (imagem, vídeo ou PDF) exigem login no sistema. Se precisar enviar
            arquivos, mencione no chat da solicitação após o envio.
          </p>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 p-3 text-sm">
            <input type="checkbox" checked={finalConfirmed} onChange={(e) => setFinalConfirmed(e.target.checked)} className="mt-0.5 h-4 w-4 accent-current" />
            <span>Revisei as informações e confirmo que representam minha necessidade.</span>
          </label>
        </div>
        <DialogFooter className="flex-row justify-between border-t border-white/10 pt-4 sm:justify-between">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button className={accent.button} onClick={() => create.mutate()} disabled={create.isPending || !finalConfirmed}>
            {create.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            <Send className="mr-1.5 h-4 w-4" /> Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
