import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Workflow, Plus, Trash2, ArrowRight, CheckCircle2, Play } from "lucide-react";
import { useSmWorkflows, generateTasksFromWorkflow } from "@/hooks/useSmDemands";
import { useSmClients } from "@/hooks/useSocial";
import { useSocialAssignableProfiles, useProfiles } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

export default function SocialWorkflows() {
  const { user } = useAuth();
  const wf = useSmWorkflows();
  const { data: clients } = useSmClients();
  const { data: assignables } = useSocialAssignableProfiles();
  const { data: profiles } = useProfiles();

  const [openWf, setOpenWf] = useState(false);
  const [wfForm, setWfForm] = useState({ name: "", service: "", description: "", is_default_operation: false });

  const [stepFor, setStepFor] = useState<string | null>(null);
  const [stepForm, setStepForm] = useState({ title: "", description: "", days_offset: 0, assigned_to: "", is_approval: false });
  const [stepItems, setStepItems] = useState<string[]>([]);
  const [newStepItem, setNewStepItem] = useState("");
  const [itemsByStep, setItemsByStep] = useState<Record<string, number>>({});

  const [runFor, setRunFor] = useState<string | null>(null);
  const [runClient, setRunClient] = useState("");
  const [runApprover, setRunApprover] = useState("");

  const stepsOf = useMemo(() => {
    const m: Record<string, typeof wf.steps> = {};
    wf.steps.forEach((s) => { (m[s.workflow_id] ||= []).push(s); });
    return m;
  }, [wf.steps]);

  const personName = (id: string | null) => profiles?.find((p: any) => p.id === id)?.full_name ?? "equipe";

  // quantidade de itens de checklist por etapa
  const loadStepItems = async () => {
    const { data } = await (supabase as any).from("sm_workflow_step_items").select("step_id");
    const m: Record<string, number> = {};
    (data ?? []).forEach((r: any) => { m[r.step_id] = (m[r.step_id] ?? 0) + 1; });
    setItemsByStep(m);
  };
  useEffect(() => { loadStepItems(); }, [wf.steps.length]);

  const createWorkflow = async () => {
    if (!wfForm.name.trim()) return toast.error("Informe o nome do fluxo");
    const res: any = await wf.createWorkflow({
      name: wfForm.name.trim(),
      service: wfForm.service.trim() || null,
      description: wfForm.description.trim() || null,
      is_default_operation: wfForm.is_default_operation,
    });
    if (res?.error) return toast.error(res.error.message);
    setOpenWf(false);
    setWfForm({ name: "", service: "", description: "", is_default_operation: false });
    wf.refresh();
    toast.success("Fluxo criado");
  };

  const addStep = async () => {
    if (!stepFor || !stepForm.title.trim()) return toast.error("Informe o título da etapa");
    const order = (stepsOf[stepFor] ?? []).length;
    const res: any = await wf.createStep({
      workflow_id: stepFor,
      title: stepForm.title.trim(),
      description: stepForm.description.trim() || null,
      days_offset: Number(stepForm.days_offset) || 0,
      assigned_to: stepForm.assigned_to || null,
      is_approval: stepForm.is_approval,
      sort_order: order,
    });
    if (res?.error) return toast.error(res.error.message);
    const stepId = res?.data?.id;
    if (stepId && stepItems.length && user) {
      await (supabase as any).from("sm_workflow_step_items").insert(
        stepItems.map((title, i) => ({ step_id: stepId, title, sort_order: i, created_by: user.id }))
      );
    }
    setStepForm({ title: "", description: "", days_offset: 0, assigned_to: "", is_approval: false });
    setStepItems([]); setNewStepItem("");
    wf.refresh();
    loadStepItems();
  };

  const runNow = async () => {
    if (!runFor || !user) return;
    const res: any = await generateTasksFromWorkflow({
      workflowId: runFor,
      clientId: runClient || null,
      uid: user.id,
      approverId: runApprover || user.id,
      titlePrefix: clients.find((c) => c.id === runClient)?.name,
    });
    if (res?.error) return toast.error(res.error.message);
    toast.success("Tarefas geradas para a equipe");
    setRunFor(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fluxos de Demanda"
        description="Modelos de etapas por serviço. Ao concluir o onboarding, as tarefas caem automaticamente para a equipe e a etapa de aprovação vai para o gestor."
        icon={<Workflow className="h-5 w-5" />}
        actions={<Button onClick={() => setOpenWf(true)}><Plus className="h-4 w-4 mr-1" />Novo fluxo</Button>}
      />

      {wf.workflows.length === 0 && !wf.loading && (
        <EmptyState
          icon={Workflow}
          title="Nenhum fluxo cadastrado"
          description="Crie um fluxo por serviço (ex.: Social Media mensal, Tráfego pago, Gravação) com as etapas que a operação executa."
        />
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {wf.workflows.map((w) => {
          const steps = stepsOf[w.id] ?? [];
          return (
            <Card key={w.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{w.name}</h3>
                      {w.service && <Badge variant="outline" className="text-[10px]">{w.service}</Badge>}
                      {w.is_default_operation && <Badge className="text-[10px]">Padrão da operação</Badge>}
                      {!w.active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                    </div>
                    {w.description && <p className="text-xs text-muted-foreground mt-1">{w.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Gerar tarefas agora"
                      onClick={() => { setRunFor(w.id); setRunApprover(user?.id ?? ""); }}>
                      <Play className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={async () => { await wf.deleteWorkflow(w.id); wf.refresh(); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {steps.length === 0 && <p className="text-xs italic text-muted-foreground">Sem etapas ainda.</p>}
                  {steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5">
                      <span className="text-[10px] text-muted-foreground w-4">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{s.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          D+{s.days_offset} · {s.is_approval ? "aprovação do gestor" : personName(s.assigned_to)}
                          {itemsByStep[s.id] ? ` · ${itemsByStep[s.id]} item(ns) de checklist` : ""}
                        </p>
                      </div>
                      {s.is_approval
                        ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        : <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={async () => { await wf.deleteStep(s.id); wf.refresh(); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button variant="outline" size="sm" className="w-full" onClick={() => setStepFor(w.id)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar etapa
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Novo fluxo */}
      <Dialog open={openWf} onOpenChange={setOpenWf}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo fluxo de demanda</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={wfForm.name} onChange={(e) => setWfForm({ ...wfForm, name: e.target.value })} placeholder="Ex.: Social Media mensal" /></div>
            <div><Label>Serviço</Label><Input value={wfForm.service} onChange={(e) => setWfForm({ ...wfForm, service: e.target.value })} placeholder="Ex.: Gestão de redes" /></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={wfForm.description} onChange={(e) => setWfForm({ ...wfForm, description: e.target.value })} /></div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Fluxo padrão da operação</p>
                <p className="text-xs text-muted-foreground">Usado automaticamente ao concluir um onboarding.</p>
              </div>
              <Switch checked={wfForm.is_default_operation} onCheckedChange={(v) => setWfForm({ ...wfForm, is_default_operation: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenWf(false)}>Cancelar</Button>
            <Button onClick={createWorkflow}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova etapa */}
      <Dialog open={!!stepFor} onOpenChange={(o) => !o && setStepFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova etapa do fluxo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={stepForm.title} onChange={(e) => setStepForm({ ...stepForm, title: e.target.value })} placeholder="Ex.: Roteiro do mês" /></div>
            <div><Label>Descrição</Label><Textarea rows={2} value={stepForm.description} onChange={(e) => setStepForm({ ...stepForm, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prazo (dias após início)</Label>
                <Input type="number" min={0} value={stepForm.days_offset} onChange={(e) => setStepForm({ ...stepForm, days_offset: Number(e.target.value) })} />
              </div>
              <div>
                <Label>Responsável</Label>
                <Select value={stepForm.assigned_to} onValueChange={(v) => setStepForm({ ...stepForm, assigned_to: v })}>
                  <SelectTrigger><SelectValue placeholder="Equipe" /></SelectTrigger>
                  <SelectContent>
                    {(assignables ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Etapa de aprovação</p>
                <p className="text-xs text-muted-foreground">Cai para o gestor aprovar no fim do fluxo.</p>
              </div>
              <Switch checked={stepForm.is_approval} onCheckedChange={(v) => setStepForm({ ...stepForm, is_approval: v })} />
            </div>

            <div className="rounded-lg border border-border p-3 space-y-2">
              <p className="text-sm font-medium">Checklist da etapa</p>
              <p className="text-xs text-muted-foreground">
                Estes itens são criados automaticamente dentro da tarefa quando o fluxo roda.
              </p>
              {stepItems.length > 0 && (
                <ul className="space-y-1">
                  {stepItems.map((it, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm bg-muted/40 rounded px-2 py-1">
                      <span className="flex-1">{it}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive"
                        onClick={() => setStepItems((p) => p.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <Input placeholder="Novo item..." value={newStepItem}
                  onChange={(e) => setNewStepItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const t = newStepItem.trim();
                      if (t) { setStepItems((p) => [...p, t]); setNewStepItem(""); }
                    }
                  }} />
                <Button type="button" size="sm" onClick={() => {
                  const t = newStepItem.trim();
                  if (t) { setStepItems((p) => [...p, t]); setNewStepItem(""); }
                }}><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStepFor(null)}>Fechar</Button>
            <Button onClick={addStep}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rodar fluxo manualmente */}
      <Dialog open={!!runFor} onOpenChange={(o) => !o && setRunFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Gerar tarefas deste fluxo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Select value={runClient} onValueChange={setRunClient}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Aprovador final</Label>
              <Select value={runApprover} onValueChange={setRunApprover}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{(profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.id}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunFor(null)}>Cancelar</Button>
            <Button onClick={runNow}>Gerar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
