import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { useCreateAutomation } from "@/hooks/useAutomationsData";
import { PRIORITY_OPTIONS, PRIORITY_LABELS, COMPLEXITY_OPTIONS, COMPLEXITY_LABELS } from "@/types/automation";
import { SECTORS } from "@/types/sectors";
import { useSectorVisibility } from "@/hooks/useUserSectors";

interface Props {
  profiles: { id: string; full_name: string | null }[];
}

export function CreateAutomationDialog({ profiles }: Props) {
  const [open, setOpen] = useState(false);
  const createAutomation = useCreateAutomation();
  const { canSeeAll, allowedSectors } = useSectorVisibility();
  const lockedSector = !canSeeAll && allowedSectors.length === 1 ? allowedSectors[0] : null;
  const sectorOptions = canSeeAll ? [...SECTORS] : allowedSectors;

  const [form, setForm] = useState({
    title: "",
    description: "",
    objective: "",
    system_process: "",
    requester: "",
    requester_department: "",
    assigned_to: "",
    priority: "medium",
    complexity: "medium",
    automation_type: "",
    estimated_hours: "",
    final_deadline: "",
    sector: "",
  });

  const set = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!form.title.trim() || !form.sector) return;
    createAutomation.mutate({
      title: form.title,
      description: form.description || null,
      objective: form.objective || null,
      system_process: form.system_process || null,
      requester: form.requester || null,
      requester_department: form.requester_department || null,
      assigned_to: form.assigned_to || null,
      priority: form.priority,
      complexity: form.complexity,
      automation_type: form.automation_type || null,
      estimated_hours: parseFloat(form.estimated_hours) || 0,
      final_deadline: form.final_deadline ? new Date(form.final_deadline).toISOString() : null,
      sector: form.sector,
    } as any, {
      onSuccess: () => {
        setOpen(false);
        setForm({ title: "", description: "", objective: "", system_process: "", requester: "", requester_department: "", assigned_to: "", priority: "medium", complexity: "medium", automation_type: "", estimated_hours: "", final_deadline: "", sector: "" });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Automação</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Automação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Título *</Label>
            <Input value={form.title} onChange={e => set("title", e.target.value)} className="h-9 mt-1" placeholder="Nome da automação" />
          </div>
          <div>
            <Label className="text-xs">Descrição</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} className="mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-xs">Objetivo</Label>
            <Input value={form.objective} onChange={e => set("objective", e.target.value)} className="h-9 mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sistema/Processo</Label>
              <Input value={form.system_process} onChange={e => set("system_process", e.target.value)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Tipo de Automação</Label>
              <Input value={form.automation_type} onChange={e => set("automation_type", e.target.value)} className="h-9 mt-1" placeholder="Ex: RPA, Script..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Solicitante</Label>
              <Input value={form.requester} onChange={e => set("requester", e.target.value)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">Setor</Label>
              <Input value={form.requester_department} onChange={e => set("requester_department", e.target.value)} className="h-9 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.priority} onValueChange={v => set("priority", v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Complexidade</Label>
              <Select value={form.complexity} onValueChange={v => set("complexity", v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPLEXITY_OPTIONS.map(c => <SelectItem key={c} value={c}>{COMPLEXITY_LABELS[c]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Horas Estimadas</Label>
              <Input type="number" value={form.estimated_hours} onChange={e => set("estimated_hours", e.target.value)} className="h-9 mt-1" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={form.assigned_to} onValueChange={v => set("assigned_to", v)}>
                <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prazo Final</Label>
              <Input type="date" value={form.final_deadline} onChange={e => set("final_deadline", e.target.value)} className="h-9 mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Setor Vinculado *</Label>
            <Select value={form.sector} onValueChange={v => set("sector", v)}>
              <SelectTrigger className="h-9 mt-1"><SelectValue placeholder="Selecionar setor" /></SelectTrigger>
              <SelectContent>
                {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground mt-1">Define quais usuários podem visualizar esta automação.</p>
          </div>
          <Button onClick={handleSubmit} className="w-full" disabled={!form.title.trim() || !form.sector || createAutomation.isPending}>
            Criar Automação
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
