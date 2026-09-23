import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const sb = supabase as any;

export interface SmTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  mentions: string[] | null;
  created_at: string;
}

export interface SmTaskTimeLog {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  description: string | null;
}

export function useSmTaskComments(taskId: string | null) {
  const { user } = useAuth();
  const [data, setData] = useState<SmTaskComment[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!taskId) { setData([]); return; }
    setLoading(true);
    const { data } = await sb
      .from("sm_task_comments").select("*").eq("task_id", taskId).order("created_at");
    setData((data as SmTaskComment[]) ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = useCallback(async (content: string, mentions: string[]) => {
    if (!taskId || !user) return { error: { message: "Sessão inválida" } };
    const res = await sb.from("sm_task_comments").insert({
      task_id: taskId, user_id: user.id, content, mentions,
    });
    if (!res.error && mentions.length) {
      await sb.from("notifications").insert(
        mentions.map((uid) => ({
          user_id: uid,
          type: "mention",
          message: `Você foi mencionado em um comentário de tarefa (M7)`,
          created_by: user.id,
        }))
      );
    }
    await refresh();
    return res;
  }, [taskId, user, refresh]);

  const remove = useCallback(async (id: string) => {
    const res = await sb.from("sm_task_comments").delete().eq("id", id);
    await refresh();
    return res;
  }, [refresh]);

  return { data, loading, refresh, add, remove };
}

export function useSmTaskTime(taskId: string | null) {
  const { user } = useAuth();
  const [logs, setLogs] = useState<SmTaskTimeLog[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!taskId) { setLogs([]); return; }
    setLoading(true);
    const { data } = await sb
      .from("sm_task_time_logs").select("*").eq("task_id", taskId).order("started_at", { ascending: false });
    setLogs((data as SmTaskTimeLog[]) ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { refresh(); }, [refresh]);

  const running = logs.find((l) => !l.ended_at && l.user_id === user?.id) ?? null;

  const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes ?? 0), 0);

  const start = useCallback(async (description?: string) => {
    if (!taskId || !user) return;
    await sb.from("sm_task_time_logs").insert({
      task_id: taskId, user_id: user.id, started_at: new Date().toISOString(),
      description: description || null,
    });
    await refresh();
  }, [taskId, user, refresh]);

  const stop = useCallback(async () => {
    if (!running) return;
    const ended = new Date();
    const minutes = Math.round(((ended.getTime() - new Date(running.started_at).getTime()) / 60000) * 100) / 100;
    await sb.from("sm_task_time_logs")
      .update({ ended_at: ended.toISOString(), duration_minutes: minutes })
      .eq("id", running.id);
    await refresh();
  }, [running, refresh]);

  const addManual = useCallback(async (minutes: number, description?: string) => {
    if (!taskId || !user) return;
    const now = new Date();
    await sb.from("sm_task_time_logs").insert({
      task_id: taskId, user_id: user.id,
      started_at: new Date(now.getTime() - minutes * 60000).toISOString(),
      ended_at: now.toISOString(),
      duration_minutes: minutes,
      description: description || null,
    });
    await refresh();
  }, [taskId, user, refresh]);

  const removeLog = useCallback(async (id: string) => {
    await sb.from("sm_task_time_logs").delete().eq("id", id);
    await refresh();
  }, [refresh]);

  return { logs, loading, refresh, running, totalMinutes, start, stop, addManual, removeLog };
}

/** Progresso de checklist por tarefa, para relatórios */
export function useSmChecklistProgress() {
  const [byTask, setByTask] = useState<Record<string, { total: number; done: number }>>({});

  const refresh = useCallback(async () => {
    const { data } = await sb.from("sm_task_checklist_items").select("task_id, done");
    const m: Record<string, { total: number; done: number }> = {};
    (data ?? []).forEach((r: any) => {
      const e = m[r.task_id] ?? { total: 0, done: 0 };
      e.total++;
      if (r.done) e.done++;
      m[r.task_id] = e;
    });
    setByTask(m);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { byTask, refresh };
}

/** Horas por tarefa, para relatórios */
export function useSmTimeTotals() {
  const [byTask, setByTask] = useState<Record<string, number>>({});
  const [byUser, setByUser] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    const { data } = await sb.from("sm_task_time_logs").select("task_id, user_id, duration_minutes");
    const t: Record<string, number> = {};
    const u: Record<string, number> = {};
    (data ?? []).forEach((r: any) => {
      const m = r.duration_minutes ?? 0;
      t[r.task_id] = (t[r.task_id] ?? 0) + m;
      u[r.user_id] = (u[r.user_id] ?? 0) + m;
    });
    setByTask(t); setByUser(u);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { byTask, byUser, refresh };
}

export function formatMinutes(min: number) {
  const total = Math.round(min);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? `${h}h${m ? ` ${m}min` : ""}` : `${m}min`;
}
