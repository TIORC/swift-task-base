import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { invalidateGamification } from "@/hooks/useGamification";
import type {
  Automation,
  AutomationSubtask,
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
      const { data: current } = await supabase.from("automations").select("title, status, assigned_to").eq("id", id).single();

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
      }

      if (values.assigned_to !== undefined && values.assigned_to !== current?.assigned_to) {
        changes.push("teve o responsável alterado");
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
      const { error } = await supabase.from("automation_subtasks").insert(values as any);
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
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["automation_subtasks"] });
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

