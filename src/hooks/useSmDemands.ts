import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SM_DEFAULT_SLA_HOURS, SM_ONBOARDING_CHECKLIST } from "@/lib/sm-demands";

const sb = supabase as any;

export interface SmWorkflow {
  id: string;
  name: string;
  description: string | null;
  service: string | null;
  is_default_operation: boolean;
  active: boolean;
  created_by: string;
  created_at: string;
}

export interface SmWorkflowStep {
  id: string;
  workflow_id: string;
  title: string;
  description: string | null;
  sort_order: number;
  days_offset: number;
  assigned_to: string | null;
  is_approval: boolean;
}

export interface SmDemand {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  nature: string;
  stage: string | null;
  billable: string | null;
  discard_reason: string | null;
  assigned_to: string | null;
  due_date: string | null;
  workflow_id: string | null;
  workflow_step_id: string | null;
  is_approval_step: boolean;
  created_by: string;
  created_at: string;
}

export function useSmWorkflows() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<SmWorkflow[]>([]);
  const [steps, setSteps] = useState<SmWorkflowStep[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [w, s] = await Promise.all([
      sb.from("sm_workflows").select("*").order("created_at"),
      sb.from("sm_workflow_steps").select("*").order("sort_order"),
    ]);
    setWorkflows((w.data as SmWorkflow[]) ?? []);
    setSteps((s.data as SmWorkflowStep[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const uid = user?.id ?? "";

  return {
    workflows,
    steps,
    loading,
    refresh,
    createWorkflow: (payload: Partial<SmWorkflow>) =>
      sb.from("sm_workflows").insert({ ...payload, created_by: uid }).select().single(),
    updateWorkflow: (id: string, payload: Partial<SmWorkflow>) =>
      sb.from("sm_workflows").update(payload).eq("id", id),
    deleteWorkflow: (id: string) => sb.from("sm_workflows").delete().eq("id", id),
    createStep: (payload: Partial<SmWorkflowStep>) =>
      sb.from("sm_workflow_steps").insert({ ...payload, created_by: uid }).select().single(),
    updateStep: (id: string, payload: Partial<SmWorkflowStep>) =>
      sb.from("sm_workflow_steps").update(payload).eq("id", id),
    deleteStep: (id: string) => sb.from("sm_workflow_steps").delete().eq("id", id),
  };
}

export function useSmSlaConfig() {
  const [config, setConfig] = useState<Record<string, number>>(SM_DEFAULT_SLA_HOURS);

  const refresh = useCallback(async () => {
    const { data } = await sb.from("sm_sla_config").select("*");
    if (data?.length) {
      setConfig(Object.fromEntries(data.map((r: any) => [r.priority, r.hours])));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    config,
    refresh,
    save: async (priority: string, hours: number) => {
      const res = await sb.from("sm_sla_config").upsert({ priority, hours });
      await refresh();
      return res;
    },
  };
}

export function useSmDemands(nature?: string) {
  const [data, setData] = useState<SmDemand[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    let q = sb.from("sm_tasks").select("*").order("created_at", { ascending: false });
    if (nature) q = q.eq("nature", nature);
    const { data } = await q;
    setData((data as SmDemand[]) ?? []);
    setLoading(false);
  }, [nature]);

  useEffect(() => { refresh(); }, [refresh]);

  return { data, loading, refresh };
}

/** Cria as sub-tarefas (checklist) padrão de onboarding em um card */
export async function seedOnboardingChecklist(taskId: string, uid: string) {
  const rows = SM_ONBOARDING_CHECKLIST.map((title, i) => ({
    task_id: taskId, title, created_by: uid, sort_order: i,
  }));
  return sb.from("sm_task_checklist_items").insert(rows);
}

/**
 * Handoff: ao concluir o onboarding, gera as tarefas da operação a partir
 * de um fluxo de demanda. A última etapa marcada como aprovação cai para o
 * gestor informado.
 */
export async function generateTasksFromWorkflow(opts: {
  workflowId: string;
  clientId: string | null;
  campaignId?: string | null;
  uid: string;
  approverId?: string | null;
  titlePrefix?: string;
  startAt?: Date;
}) {
  const { data: steps } = await sb
    .from("sm_workflow_steps").select("*").eq("workflow_id", opts.workflowId).order("sort_order");
  const list = (steps as SmWorkflowStep[]) ?? [];
  if (!list.length) return { error: { message: "O fluxo selecionado não possui etapas." } };

  const { data: stepItems } = await sb
    .from("sm_workflow_step_items")
    .select("*")
    .in("step_id", list.map((s) => s.id))
    .order("sort_order");

  const start = opts.startAt ?? new Date();
  const rows = list.map((s) => {
    const due = new Date(start.getTime() + (s.days_offset || 0) * 86400_000);
    return {
      client_id: opts.clientId,
      campaign_id: opts.campaignId ?? null,
      title: `${opts.titlePrefix ? opts.titlePrefix + " — " : ""}${s.title}`,
      description: s.description,
      status: "backlog",
      priority: "medium",
      nature: "recorrente",
      stage: s.is_approval ? "aprovacao" : "roteiro",
      assigned_to: s.is_approval ? (opts.approverId ?? s.assigned_to) : s.assigned_to,
      due_date: due.toISOString(),
      workflow_id: opts.workflowId,
      workflow_step_id: s.id,
      is_approval_step: s.is_approval,
      requires_approval: s.is_approval,
      approval_status: s.is_approval ? "pendente" : "nao_requer",
      approver_id: s.is_approval ? (opts.approverId ?? null) : null,
      created_by: opts.uid,
    };
  });

  const res = await sb.from("sm_tasks").insert(rows).select();
  if (res.error) return res;

  // replica o checklist configurado em cada etapa do fluxo
  const created = (res.data as any[]) ?? [];
  const checklistRows: any[] = [];
  created.forEach((task) => {
    (stepItems ?? [])
      .filter((i: any) => i.step_id === task.workflow_step_id)
      .forEach((i: any, idx: number) => {
        checklistRows.push({ task_id: task.id, title: i.title, sort_order: idx, created_by: opts.uid });
      });
  });
  if (checklistRows.length) await sb.from("sm_task_checklist_items").insert(checklistRows);

  return res;
}
