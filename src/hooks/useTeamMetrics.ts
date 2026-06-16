import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface UserMetric {
  user_id: string;
  full_name: string;
  tasks_done: number;
  tasks_total: number;
  automations_done: number;
  automations_total: number;
  minutes: number;
  comments: number;
  completion_rate: number;
}

export interface SectorMetric {
  sector: string;
  total: number;
  done: number;
  in_progress: number;
  pending: number;
  blocked: number;
  minutes: number;
  completion_rate: number;
}

export function useTeamMetrics() {
  return useQuery({
    queryKey: ["team-metrics"],
    queryFn: async () => {
      const [tasksRes, autosRes, timeRes, autoTimeRes, profilesRes, commentsRes] = await Promise.all([
        supabase.from("tasks").select("id, assignee_id, status"),
        supabase.from("automations").select("id, owner_id, sector, status"),
        supabase.from("time_logs").select("user_id, duration_minutes"),
        supabase.from("automation_time_logs").select("user_id, duration_minutes"),
        supabase.from("profiles").select("id, full_name"),
        supabase.from("comments").select("user_id"),
      ]);

      const profiles = profilesRes.data || [];
      const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p.full_name || "Sem nome"]));

      const userMap = new Map<string, UserMetric>();
      const ensureUser = (uid: string) => {
        if (!uid) return null;
        if (!userMap.has(uid)) {
          userMap.set(uid, {
            user_id: uid,
            full_name: profileMap[uid] || "Sem nome",
            tasks_done: 0,
            tasks_total: 0,
            automations_done: 0,
            automations_total: 0,
            minutes: 0,
            comments: 0,
            completion_rate: 0,
          });
        }
        return userMap.get(uid)!;
      };

      (tasksRes.data || []).forEach((t: any) => {
        const u = ensureUser(t.assignee_id);
        if (!u) return;
        u.tasks_total += 1;
        if (t.status === "done") u.tasks_done += 1;
      });

      (autosRes.data || []).forEach((a: any) => {
        const u = ensureUser(a.owner_id);
        if (!u) return;
        u.automations_total += 1;
        if (a.status === "completed") u.automations_done += 1;
      });

      (timeRes.data || []).forEach((l: any) => {
        const u = ensureUser(l.user_id);
        if (u) u.minutes += l.duration_minutes || 0;
      });
      (autoTimeRes.data || []).forEach((l: any) => {
        const u = ensureUser(l.user_id);
        if (u) u.minutes += l.duration_minutes || 0;
      });
      (commentsRes.data || []).forEach((c: any) => {
        const u = ensureUser(c.user_id);
        if (u) u.comments += 1;
      });

      const users = Array.from(userMap.values()).map((u) => {
        const total = u.tasks_total + u.automations_total;
        const done = u.tasks_done + u.automations_done;
        u.completion_rate = total > 0 ? Math.round((done / total) * 100) : 0;
        return u;
      });

      // Sector metrics from automations
      const sectorMap = new Map<string, SectorMetric>();
      (autosRes.data || []).forEach((a: any) => {
        const sec = a.sector || "Sem setor";
        if (!sectorMap.has(sec)) {
          sectorMap.set(sec, {
            sector: sec, total: 0, done: 0, in_progress: 0, pending: 0, blocked: 0, minutes: 0, completion_rate: 0,
          });
        }
        const s = sectorMap.get(sec)!;
        s.total += 1;
        if (a.status === "completed") s.done += 1;
        else if (["analysis", "development", "internal_testing"].includes(a.status)) s.in_progress += 1;
        else if (["homologation", "waiting_user"].includes(a.status)) s.pending += 1;
        else if (a.status === "blocked") s.blocked += 1;
      });

      // Aggregate sector minutes by joining automation time logs by automation->sector
      const autoSectorMap = Object.fromEntries((autosRes.data || []).map((a: any) => [a.id, a.sector || "Sem setor"]));
      const { data: autoTimeWithIds } = await supabase.from("automation_time_logs").select("automation_id, duration_minutes");
      (autoTimeWithIds || []).forEach((l: any) => {
        const sec = autoSectorMap[l.automation_id];
        if (!sec) return;
        const s = sectorMap.get(sec);
        if (s) s.minutes += l.duration_minutes || 0;
      });

      sectorMap.forEach((s) => {
        s.completion_rate = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0;
      });

      return {
        users: users.sort((a, b) => (b.tasks_done + b.automations_done) - (a.tasks_done + a.automations_done)),
        sectors: Array.from(sectorMap.values()).sort((a, b) => b.total - a.total),
        totals: {
          tasks: (tasksRes.data || []).length,
          tasks_done: (tasksRes.data || []).filter((t: any) => t.status === "done").length,
          automations: (autosRes.data || []).length,
          automations_done: (autosRes.data || []).filter((a: any) => a.status === "completed").length,
          minutes: users.reduce((s, u) => s + u.minutes, 0),
        },
      };
    },
  });
}
