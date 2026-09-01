import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Briefcase, Plus, Search, Trash2, ArrowRight, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSmClients } from "@/hooks/useSocial";
import { useProfiles, useSocialAssignableProfiles } from "@/hooks/useTasks";
import {
  SM_COMMERCIAL_STAGES, SM_ONBOARDING_CHECKLIST, SM_PRIORITY_CLS_FALLBACK,
} from "@/lib/sm-demands";
import { generateTasksFromWorkflow, seedOnboardingChecklist, useSmWorkflows, useSmDemands } from "@/hooks/useSmDemands";
import { SM_PRIORITY_LABEL } from "@/types/social";
import { toast } from "sonner";
import { format } from "date-fns";

const sb = supabase as any;

export default function SocialCommercial() {
  const { user } = useAuth();
  const { data: demands, refresh } = useSmDemands("comercial");
  const { data: clients } = useSmClients();
  const { data: profiles } = useProfiles();
  const { data: assignables } = useSocialAssignableProfiles();
  const { workflows } = useSmWorkflows();

  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, { done: number; total: number }>>({});
  const [handoff, setHandoff] = useState<{ id: string; title: string; clientId: string | null } | null>(null);
  const [workflowId, setWorkflowId] = useState("");
  const [approverId, setApproverId] = useState("");

  const [form, setForm] = useState({
    title: "", client_id: "", description: "", priority: "medium", assigned_to: "", due_date: "",
  });

  // progresso do checklist dos cards
  useEffect(() => {
    (async () => {
      const ids = demands.map((d) => d.id);
      if (!ids.length) return setChecklist({});
      const { data } = await sb.from("sm_task_checklist_items").select("task_id, done").in("task_id", ids);
      const map: Record<string, { done: number; total: number }> = {};
      (data ?? []).forEach((r: any) => {
        const e = map[r.task_id] || { done: 0, total: 0 };
        e.total++; if (r.done) e.done++;
        map[r.task_id] = e;
      });
      setChecklist(map);
    })();
  }, [demands]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return demands;
    return demands.filter((d) =>
      d.title.toLowerCase().includes(q) ||
      (clients.find((c) => c.id === d.client_id)?.name ?? "").toLowerCase().includes(q));
  }, [demands, search, clients]);

  const byStage = useMemo(() => {
    const g: Record<string, typeof filtered> = {};
    SM_COMMERCIAL_STAGES.forEach((s) => (g[s.key] = []));
    filtered.forEach((d) => {
      const key = d.stage && g[d.stage] ? d.stage : "diagnostico";
      g[key].push(d);
    });
    return g;
  }, [filtered]);

  const clientName = (id: string | null) => clients.find((c) => c.id === id)?.name ?? "";
  const personName = (id: string | null) =>
    profiles?.find((p: any) => p.id === id)?.full_name ?? "";
  const initials = (name: string) =>
    name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();

  const create = async () => {
    if (!form.title.trim() || !user) return toast.error("Informe o título da demanda");
    const { data, error } = await sb.from("sm_tasks").insert({
      title: form.title.trim(),
      client_id: form.client_id || null,
      description: form.description || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date ? new Date(form.due_date + "T12:00:00").toISOString() : null,
      status: "backlog",
      nature: "comercial",
      stage: "diagnostico",
      created_by: user.id,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success("Demanda criada");
    setOpenNew(false);
    setForm({ title: "", client_id: "", description: "", priority: "medium", assigned_to: "", due_date: "" });
    refresh();
    return data;
  };

  const advance = async (d: any, next: string) => {
    const { error } = await sb.from("sm_tasks").update({
      stage: next,
      nature: next === "onboarding" || next === "onboarding_concluido" ? "onboarding" : "comercial",
      status: next === "onboarding_concluido" ? "concluido" : d.status,
    }).eq("id", d.id);
    if (error) return toast.error(error.message);

    if (next === "onboarding") {
      // cria checklist padrão de onboarding uma única vez
      const { count } = await sb.from("sm_task_checklist_items")
        .select("id", { count: "exact", head: true }).eq("task_id", d.id);
      if (!count && user) {
        await seedOnboardingChecklist(d.id, user.id);
        await sb.from("sm_tasks").update({
          due_date: new Date(Date.now() + 30 * 86400_000).toISOString(),
        }).eq("id", d.id);
      }
      if (d.client_id) {
        await sb.from("sm_clients").update({ onboarding_started_at: new Date().toISOString() }).eq("id", d.client_id);
      }
      toast.success(`Onboarding iniciado — checklist de ${SM_ONBOARDING_CHECKLIST.length} itens criado`);
    }

    if (next === "onboarding_concluido") {
      if (d.client_id) {
        await sb.from("sm_clients").update({ onboarding_completed_at: new Date().toISOString() }).eq("id", d.client_id);
      }
      const def = workflows.find((w) => w.is_default_operation && w.active) ?? workflows.find((w) => w.active);
      setWorkflowId(def?.id ?? "");
      setApproverId(user?.id ?? "");
      setHandoff({ id: d.id, title: d.title, clientId: d.client_id });
    }
    refresh();
  };

  const runHandoff = async () => {
    if (!handoff || !workflowId || !user) return;
    const res: any = await generateTasksFromWorkflow({
      workflowId,
      clientId: handoff.clientId,
      uid: user.id,
      approverId: approverId || user.id,
      titlePrefix: clientName(handoff.clientId) || undefined,
    });
    if (res?.error) return toast.error(res.error.message);
    toast.success("Tarefas da operação geradas automaticamente");
    setHandoff(null);
  };

  const remove = async (id: string) => {
    const { error } = await sb.from("sm_tasks").delete().eq("id", id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Comercial & Onboarding"
        description="Diagnóstico, proposta, contrato e onboarding dos primeiros 30 dias."
        icon={<Briefcase className="h-5 w-5" />}
        actions={
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar demanda ou cliente"
                className="pl-8 w-56 h-9"
              />
            </div>
            <Button onClick={() => setOpenNew(true)} className="h-9">
              <Plus className="h-4 w-4 mr-1" /> Nova demanda
            </Button>
          </div>
        }
      />

      <div className="overflow-x-auto pb-2">
        <div className="flex gap-4 min-w-max">
          {SM_COMMERCIAL_STAGES.map((stage) => {
            const items = byStage[stage.key] ?? [];
            return (
              <div key={stage.key} className="w-[300px] flex flex-col">
                <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stage.label}</h3>
                  <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-3">
                  {items.length === 0 && (
                    <p className="text-xs italic text-muted-foreground">sem demandas aqui</p>
                  )}
                  {items.map((d: any) => {
                    const cl = checklist[d.id];
                    return (
                      <Card key={d.id} className="p-3 space-y-2">
                        <Badge variant="outline" className={`text-[10px] ${SM_PRIORITY_CLS_FALLBACK[d.priority] ?? ""}`}>
                          {SM_PRIORITY_LABEL[d.priority as keyof typeof SM_PRIORITY_LABEL] ?? d.priority}
                        </Badge>
                        <p className="text-sm font-semibold leading-snug break-words">{d.title}</p>
                        {d.client_id && (
                          <p className="text-xs text-muted-foreground">{clientName(d.client_id)}</p>
                        )}
                        {cl && cl.total > 0 && (
                          <div className="space-y-1">
                            <Progress value={(cl.done / cl.total) * 100} className="h-1.5" />
                            <p className="text-[10px] text-muted-foreground">checklist onboarding {cl.done}/{cl.total}</p>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" />
                            {d.due_date ? format(new Date(d.due_date), "dd/MM/yyyy") : "sem prazo"}
                          </span>
                          {d.assigned_to && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
                              {initials(personName(d.assigned_to) || "?")}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          {stage.next && (
                            <Button size="sm" className="h-8 flex-1 text-xs" onClick={() => advance(d, stage.next!)}>
                              {stage.nextLabel} <ArrowRight className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => remove(d.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Nova demanda comercial */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova demanda comercial</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Título</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex.: Enviar proposta comercial" />
            </div>
            <div>
              <Label>Cliente / prospect</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SM_PRIORITY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(assignables ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>Cancelar</Button>
            <Button onClick={create}>Criar demanda</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Handoff para a operação */}
      <Dialog open={!!handoff} onOpenChange={(o) => !o && setHandoff(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Onboarding concluído — gerar tarefas da operação</DialogTitle>
            <DialogDescription>
              Escolha o fluxo de demandas do serviço contratado. As tarefas caem automaticamente
              para a equipe e a etapa de aprovação vai para o gestor selecionado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Fluxo de demandas</Label>
              <Select value={workflowId} onValueChange={setWorkflowId}>
                <SelectTrigger><SelectValue placeholder="Selecione um fluxo" /></SelectTrigger>
                <SelectContent>
                  {workflows.filter((w) => w.active).map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.name}{w.service ? ` · ${w.service}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {workflows.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Nenhum fluxo cadastrado. Crie um em "Fluxos de Demanda".
                </p>
              )}
            </div>
            <div>
              <Label>Aprovador final</Label>
              <Select value={approverId} onValueChange={setApproverId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(profiles ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || p.id}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHandoff(null)}>Agora não</Button>
            <Button onClick={runHandoff} disabled={!workflowId}>Gerar tarefas</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
