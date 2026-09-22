import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSectorVisibility } from "@/hooks/useUserSectors";
import { useUploadAutomationAttachment, isAllowedAttachment, MAX_ATTACHMENT_MB } from "@/hooks/useAutomationAttachments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { SECTORS } from "@/types/sectors";
import { PRIORITY_LABELS, PRIORITY_OPTIONS } from "@/types/automation";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { toast } from "sonner";

export function RequestAutomationDialog() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { canSeeAll, allowedSectors: mySectors } = useSectorVisibility();
  const qc = useQueryClient();
  const upload = useUploadAutomationAttachment();
  const inputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [priority, setPriority] = useState("medium");
  const [sector, setSector] = useState<string>("");
  const [files, setFiles] = useState<File[]>([]);
  const lockedSector = !canSeeAll && mySectors.length === 1 ? mySectors[0] : null;
  const sectorOptions = canSeeAll ? [...SECTORS] : mySectors;
  const effectiveSector = lockedSector ?? (sector || sectorOptions[0] || "");

  const reset = () => {
    setTitle(""); setDescription(""); setObjective(""); setPriority("medium");
    setFiles([]);
  };

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
      if (title.trim().length < 5) throw new Error("Descreva um título com pelo menos 5 caracteres.");
      if (description.trim().length < 10) throw new Error("Descreva a solicitação com mais detalhes.");

      const { data, error } = await supabase
        .from("automations")
        .insert({
          title: title.trim(),
          description: description.trim(),
          objective: objective.trim() || null,
          priority,
          status: "requested",
          sector: effectiveSector,
          created_by: user.id,
          requester_id: user.id,
          requester: profile?.full_name || null,
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
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploading = create.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Send className="h-4 w-4 mr-1.5" /> Solicitar automação
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[95vw] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Solicitar automação</DialogTitle>
          <DialogDescription>
            A equipe de TI vai analisar, definir prioridade, responsável e prazo. Você acompanha tudo por aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Automatizar envio de relatório mensal" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Descrição detalhada</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} placeholder="Explique o processo atual, sistemas envolvidos e o resultado esperado." className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Objetivo (opcional)</Label>
            <Input value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Ex: Reduzir 4 horas de trabalho manual por semana" className="mt-1" />
          </div>

          {/* Anexos (documentos, imagens, vídeos) */}
          <div>
            <Label className="text-xs">Anexos (opcional)</Label>
            <div
              className="mt-1 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            >
              <Paperclip className="h-5 w-5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Anexe documentos, imagens ou vídeos para facilitar o entendimento do desenvolvimento.
              </p>
              <Button
                size="sm"
                variant="outline"
                type="button"
                className="h-7 text-xs pointer-events-none"
              >
                Escolher arquivos
              </Button>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                hidden
                onChange={(e) => addFiles(e.target.files)}
              />
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 rounded-md border border-border bg-card px-2.5 py-1.5">
                    <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs flex-1 min-w-0 truncate">{f.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {(f.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Setor</Label>
              <Select value={effectiveSector} onValueChange={setSector} disabled={!!lockedSector}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sectorOptions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade sugerida</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" disabled={uploading} onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={uploading}>
            {uploading && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}