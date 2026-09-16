import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSectorVisibility } from "@/hooks/useUserSectors";
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
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export function RequestAutomationDialog() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { canSeeAll, allowedSectors: mySectors } = useSectorVisibility();
  const qc = useQueryClient();

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [priority, setPriority] = useState("medium");
  const [sector, setSector] = useState<string>("");
  const lockedSector = !canSeeAll && mySectors.length === 1 ? mySectors[0] : null;
  const sectorOptions = canSeeAll ? [...SECTORS] : mySectors;
  const effectiveSector = lockedSector ?? sector || sectorOptions[0] || "";

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
          sector,
          created_by: user.id,
          requester_id: user.id,
          requester: profile?.full_name || null,
          requester_department: sector,
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Solicitação enviada para a equipe de TI!");
      setTitle(""); setDescription(""); setObjective(""); setPriority("medium");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Setor</Label>
              <Select value={sector} onValueChange={setSector}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Enviar solicitação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
