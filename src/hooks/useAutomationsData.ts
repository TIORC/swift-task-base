import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { invalidateGamification } from "@/hooks/useGamification";
import { STATUS_LABELS } from "@/types/automation";
import type {
  Automation,
  AutomationSubtask,
  AutomationScopeItem,
  AutomationBlocker,
  AutomationEvent,
  AutomationTimeLog,
} from "@/types/automation";

// Helper to notify all gestors about automation changes
async function notifyGestors(automationTitle: string, action: string, actorId: string, automationId: string) {
  try {
    const { data: gestorIds } = await supabase.rpc("get_gestor_user_ids");
    if (!gestorIds || gestorIds.length === 0) return;

    const { data: actorProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", actorId)
      .single();

    const actorName = actorProfile?.full_name || "Usuário";
    const message = `A automação "${automationTitle}" foi ${action} por ${actorName}`;

    const notifications = (gestorIds as string[])
      .filter((id: string) => id !== actorId)
      .map((gestorId: string) => ({
        user_id: gestorId,
        message,
        type: "automation_update",
        created_by: actorId,
      }));

    if (notifications.length > 0) {
      await supabase.from("notifications").insert(notifications);
    }
  } catch (err) {
    console.error("Erro ao notificar gestores:", err);
  }
}

// Notifica o solicitante (requester_id) da automação sobre uma mudança relevante.
async function notifyRequester(automationId: string, message: string, actorId: string) {
  try {
    const { data: auto } = await supabase
      .from("automations")
      .select("requester_id")
      .eq("id", automationId)
      .single();

    if (!auto?.requester_id || auto.requester_id === actorId) return;

    await supabase.from("notifications").insert({
      user_id: auto.requester_id,
      type: "automation_update",
      message,
      created_by: actorId,
    });
  } catch (err) {
    console.error("Erro ao notificar solicitante:", err);
  }
}

// Notifica o desenvolvedor designado quando a automação é atribuída a ele.
async function notifyAssignedDev(automationTitle: string, assigneeId: string, actorId: string) {
  try {
    if (!assigneeId || assigneeId === actorId) return;
    await supabase.from("notifications").insert({
      user_id: assigneeId,
      type: "automation_assigned",
      message: `A automação "${automationTitle}" foi atribuída a você.`,
      created_by: actorId,
    });
  } catch (err) {
    console.error("Erro ao notificar responsável:", err);
  }
}

// ─── Automations CRUD ───

export function useAutomations() {
  return useQuery({
    queryKey: ["automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Automation[];
    },
  });
}

export function useCreateAutomation() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (values: Partial<Automation>) => {
      const { data, error } = await supabase
        .from("automations")
        .insert({ ...values, created_by: user!.id } as any)
        .select()
        .single();
      if (error) throw error;

      await supabase.from("automation_events").insert({
        automation_id: data.id,
        event_type: "created",
        description: "Automação criada",
        user_id: user!.id,
      } as any);

      await notifyGestors(data.title, "criada", user!.id, data.id);

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automação criada com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateAutomation() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<Automation> & { id: string }) => {
      // Fetch current automation for notification context
      const { data: current } = await supabase.from("automations").select("title, status, assigned_to, requester_id").eq("id", id).single();

      const { error } = await supabase.from("automations").update(values as any).eq("id", id);
      if (error) throw error;

      const changes: string[] = [];

      if (values.status && values.status !== current?.status) {
        await supabase.from("automation_events").insert({
          automation_id: id,
          event_type: "status_changed",
          description: `Status alterado para ${values.status}`,
          user_id: user!.id,
          metadata: { new_status: values.status },
        } as any);
        changes.push(`movida para ${values.status}`);

        // Notifica o solicitante sobre a mudança de status.
        if (current?.requester_id && user) {
          await notifyRequester(
            id,
            `A automação "${current.title || "Sua solicitação"}" mudou de status para "${STATUS_LABELS[values.status as keyof typeof STATUS_LABELS] || values.status}".`,
            user.id,
          );
        }
      }

      if (values.assigned_to !== undefined && values.assigned_to !== current?.assigned_to) {
        changes.push("teve o responsável alterado");

        // Notifica o dev designado (se for uma reatribuição feita por terceiros).
        if (user && values.assigned_to) {
          await notifyAssignedDev(current?.title || "Automação", values.assigned_to, user.id);
        }
      }

      const title = current?.title || "Automação";
      const action = changes.length > 0 ? changes.join(" e ") : "atualizada";
      await notifyGestors(title, action, user!.id, id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      invalidateGamification(qc);
      toast.success("Automação atualizada!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      toast.success("Automação removida!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Rename title ───

const AUTOMATION_TITLE_EDITORS = ["timaracas", "gabriel anacleto", "welder"];

export function canRenameAutomationName(fullName: string | null | undefined): boolean {
  if (!fullName) return false;
  const name = fullName.toLowerCase();
  return AUTOMATION_TITLE_EDITORS.some((editor) => name === editor || name.startsWith(editor + " "));
}

export function useCanRenameAutomation(): boolean {
  const { user } = useAuth();
  const { profile } = useUserRole();
  const { profile: userProfile } = useProfile();

  if (!user) return false;
  if (profile === "admin" || profile === "gestor" || profile === "lider") return true;
  return canRenameAutomationName(userProfile?.full_name);
}

export function useRenameAutomation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const { data, error } = await supabase.rpc("rename_automation", {
        _automation_id: id,
        _new_title: title,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automations"] });
      qc.invalidateQueries({ queryKey: ["automation_events"] });
      toast.success("Título atualizado com sucesso!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Subtasks ───

export function useAutomationSubtasks(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_subtasks", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_subtasks")
        .select("*")
        .eq("automation_id", automationId!)
        .order("sort_order");
      if (error) throw error;
      return data as unknown as AutomationSubtask[];
    },
  });
}

export function useCreateSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<AutomationSubtask>) => {
      const title = (values.title ?? "").trim();
      if (values.automation_id && title) {
        const { data: existing, error: qErr } = await supabase
          .from("automation_subtasks")
          .select("id")
          .eq("automation_id", values.automation_id)
          .eq("title", title)
          .limit(1);
        if (qErr) throw qErr;
        if (existing && existing.length > 0) {
          toast.info("Já existe uma tarefa com esse título na automação.");
          return;
        }
      }
      const { error } = await supabase.from("automation_subtasks").insert({ ...values, title } as any);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["automation_subtasks", v.automation_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateSubtask() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<AutomationSubtask> & { id: string }) => {
      const payload: Record<string, unknown> = { ...values };

      let wasNewlyCompleted = false;
      let linkedEscopoId: string | null = null;
      let automationId: string | null = null;
      let taskTitle = "";

      if (values.completed !== undefined) {
        const { data: prev } = await supabase
          .from("automation_subtasks")
          .select("completed, item_escopo_id, automation_id, title")
          .eq("id", id)
          .single();
        linkedEscopoId = (prev?.item_escopo_id as string) ?? null;
        automationId = (prev?.automation_id as string) ?? null;
        taskTitle = (prev?.title as string) ?? "";
        wasNewlyCompleted = values.completed === true && prev?.completed === false;
      }

      // Conclusão registra quem concluiu e quando (o XP é concedido pelo banco,
      // apenas na primeira conclusão).
      if (values.completed === true) {
        payload.completed_at = new Date().toISOString();
        payload.completed_by = user?.id ?? null;
        payload.status = values.status ?? "done";
      } else if (values.completed === false) {
        payload.completed_at = null;
        payload.status = values.status ?? "todo";
      }
      const { error } = await supabase.from("automation_subtasks").update(payload as any).eq("id", id);
      if (error) throw error;

      // Primeira conclusão: conclui o item de escopo vinculado, registra
      // timeline e notifica o solicitante.
      if (wasNewlyCompleted && automationId) {
        if (linkedEscopoId) {
          await (supabase as any)
            .from("automation_scope_items")
            .update({ concluded: true })
            .eq("id", linkedEscopoId);
        }

        await supabase.from("automation_events").insert({
          automation_id: automationId,
          event_type: "subtask_completed",
          description: `Tarefa concluída: ${taskTitle || "etapa"}`,
          user_id: user!.id,
        } as any);

        if (user) {
          await notifyRequester(
            automationId,
            `A tarefa "${taskTitle || "etapa"}" foi concluída na automação.`,
            user.id,
          );
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_subtasks"] });
      qc.invalidateQueries({ queryKey: ["automation_scope_items"] });
      invalidateGamification(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteSubtask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automation_subtasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_subtasks"] });
      invalidateGamification(qc);
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Scope Items (checklist do solicitante) ───

export function useAutomationScopeItems(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_scope_items", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_scope_items")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as AutomationScopeItem[];
    },
  });
}

export function useCreateScopeItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Partial<AutomationScopeItem>) => {
      const { error } = await (supabase as any)
        .from("automation_scope_items")
        .insert({ ...values, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["automation_scope_items", v.automation_id] });
      qc.invalidateQueries({ queryKey: ["automation_scope_items", "all-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateScopeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<AutomationScopeItem> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("automation_scope_items")
        .update(values)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_scope_items"] });
      qc.invalidateQueries({ queryKey: ["automation_scope_items", "all-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteScopeItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("automation_scope_items")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_scope_items"] });
      qc.invalidateQueries({ queryKey: ["automation_scope_items", "all-counts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export interface ScopeCountsInfo {
  total: number;
  done: number;
}

/** Itens de escopo concluídos por automação (Barra de Escopo nos cards). */
export function useAllAutomationScopeCounts() {
  return useQuery({
    queryKey: ["automation_scope_items", "all-counts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_scope_items")
        .select("automation_id, concluded");
      if (error) throw error;
      const map: Record<string, ScopeCountsInfo> = {};
      ((data || []) as { automation_id: string; concluded: boolean }[]).forEach((s) => {
        if (!map[s.automation_id]) map[s.automation_id] = { total: 0, done: 0 };
        map[s.automation_id].total += 1;
        if (s.concluded) map[s.automation_id].done += 1;
      });
      return map;
    },
    staleTime: 30_000,
  });
}

// ─── Blockers ───

export function useAutomationBlockers(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_blockers", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_blockers")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AutomationBlocker[];
    },
  });
}

export function useAllBlockers() {
  return useQuery({
    queryKey: ["all_automation_blockers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_blockers")
        .select("*")
        .is("resolved_at", null);
      if (error) throw error;
      return data as unknown as AutomationBlocker[];
    },
  });
}

export function useCreateBlocker() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Partial<AutomationBlocker>) => {
      const { error } = await supabase.from("automation_blockers").insert({
        ...values,
        created_by: user!.id,
      } as any);
      if (error) throw error;

      if (values.automation_id) {
        const { data: auto } = await supabase.from("automations").select("title").eq("id", values.automation_id).single();
        await notifyGestors(auto?.title || "Automação", "bloqueada", user!.id, values.automation_id);
      }
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["automation_blockers", v.automation_id] });
      qc.invalidateQueries({ queryKey: ["all_automation_blockers"] });
      toast.success("Bloqueio registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveBlocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automation_blockers")
        .update({ resolved_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_blockers"] });
      qc.invalidateQueries({ queryKey: ["all_automation_blockers"] });
      toast.success("Bloqueio resolvido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Events / Timeline ───

export function useAutomationEvents(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_events", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_events")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AutomationEvent[];
    },
  });
}

export function useCreateEvent() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Partial<AutomationEvent>) => {
      const { error } = await supabase.from("automation_events").insert({
        ...values,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["automation_events", v.automation_id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// ─── Time Logs ───

export function useAutomationTimeLogs(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_time_logs", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_time_logs")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as AutomationTimeLog[];
    },
  });
}

export function useCreateTimeLog() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (values: Partial<AutomationTimeLog>) => {
      const { error } = await supabase.from("automation_time_logs").insert({
        ...values,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["automation_time_logs", v.automation_id] });
      toast.success("Tempo registrado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Aggregated minutes per automation (for cards / lists)
export function useAutomationTotalMinutes() {
  return useQuery({
    queryKey: ["automation_time_logs", "all-totals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_time_logs")
        .select("automation_id, duration_minutes");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((l: any) => {
        map[l.automation_id] = (map[l.automation_id] || 0) + (l.duration_minutes || 0);
      });
      return map;
    },
    staleTime: 30_000,
  });
}

// ─── Profiles for display ───

export function useAllProfiles() {
  return useQuery({
    queryKey: ["all_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, avatar_url");
      if (error) throw error;
      return data as { id: string; full_name: string | null; avatar_url: string | null }[];
    },
  });
}

// ─── Aggregators for card preview ───

export interface LatestEventInfo {
  automation_id: string;
  event_type: string;
  description: string | null;
  user_id: string;
  created_at: string;
}

/** Último evento por automação (timeline mais recente). */
export function useLatestAutomationEvents() {
  return useQuery({
    queryKey: ["automation_events", "latest-by-id"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_events")
        .select("automation_id, event_type, description, user_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const map: Record<string, LatestEventInfo> = {};
      (data || []).forEach((ev: any) => {
        if (!map[ev.automation_id]) map[ev.automation_id] = ev as LatestEventInfo;
      });
      return map;
    },
    staleTime: 30_000,
  });
}

export interface LatestCommentInfo {
  automation_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

/** Último comentário por automação. */
export function useLatestAutomationComments() {
  return useQuery({
    queryKey: ["automation_comments", "latest-by-id"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_comments")
        .select("automation_id, user_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const map: Record<string, LatestCommentInfo> = {};
      (data || []).forEach((c: any) => {
        if (!map[c.automation_id]) map[c.automation_id] = c as LatestCommentInfo;
      });
      return map;
    },
    staleTime: 30_000,
  });
}

export interface CurrentStepInfo {
  title: string;
  total: number;
  done: number;
}

/** Etapa atual de cada automação = primeira subtask não concluída (ordenada por sort_order). */
export function useAllAutomationSteps() {
  return useQuery({
    queryKey: ["automation_subtasks", "all-current"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_subtasks")
        .select("automation_id, title, completed, sort_order")
        .order("sort_order");
      if (error) throw error;
      const grouped: Record<string, { open: string[]; total: number; done: number }> = {};
      (data || []).forEach((s: any) => {
        const id = s.automation_id;
        if (!grouped[id]) grouped[id] = { open: [], total: 0, done: 0 };
        grouped[id].total += 1;
        if (s.completed) grouped[id].done += 1;
        else grouped[id].open.push(s.title);
      });
      const map: Record<string, CurrentStepInfo> = {};
      Object.entries(grouped).forEach(([id, v]) => {
        map[id] = { title: v.open[0] || "—", total: v.total, done: v.done };
      });
      return map;
    },
    staleTime: 30_000,
  });
}

