import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ============================================================================
// LEVELS  (XP-based)
// ============================================================================
// XP rules:
//  - Each completed task (incluindo chamados) = 1 XP
//  - Each completed automation = 50 XP
//  - Some founding members receive a seed XP for time of service
//
// Thresholds were tuned so the founding members land on the levels defined by
// the team manager (Welder=Especialista @ 3600 XP, Angel=Praticante @ 1750 XP).
export const LEVELS = [
  { level: 1, name: "Ferro",       minXp: 0,     icon: "⚙️" },
  { level: 2, name: "Bronze",      minXp: 500,   icon: "🥉" },
  { level: 3, name: "Prata",       minXp: 1500,  icon: "🥈" },
  { level: 4, name: "Ouro",        minXp: 3000,  icon: "🥇" },
  { level: 5, name: "Platina",     minXp: 5000,  icon: "💠" },
  { level: 6, name: "Diamante",    minXp: 8000,  icon: "💎" },
  { level: 7, name: "Mestre",      minXp: 12000, icon: "🏆" },
  { level: 8, name: "Desafiante",  minXp: 15000, icon: "👑" },
];

export function getLevel(xp: number) {
  let current = LEVELS[0];
  for (const l of LEVELS) {
    if (xp >= l.minXp) current = l;
    else break;
  }
  const nextLevel = LEVELS.find((l) => l.minXp > xp);
  const progressToNext = nextLevel
    ? ((xp - current.minXp) / (nextLevel.minXp - current.minXp)) * 100
    : 100;
  return { ...current, xp, nextLevel, progressToNext };
}

// ============================================================================
// TI TEAM  (only these users appear in Ranking XP)
// ============================================================================
export const TI_TEAM: Record<string, { seedXp: number; note?: string }> = {
  // Welder Silva Santos - 6 anos TI (seed: Especialista)
  "f7c4a624-0f8f-432d-b7c0-047b36817670": { seedXp: 3600, note: "6 anos TI" },
  // Angel Kauan - 2 anos (seed: Praticante)
  "242acd59-00fb-478f-8d78-b25219798aa6": { seedXp: 1750, note: "2 anos TI" },
  // Gabriel Anacleto - calculado por tarefas/chamados
  "5bbd3dc1-985c-4ffd-a0c0-b4223faff98e": { seedXp: 0 },
  // Sofia Nardes - calculado por tarefas concluídas
  "2f71bd5e-c557-486e-aff8-0606cba4ebbb": { seedXp: 0 },
};
export const TI_TEAM_IDS = Object.keys(TI_TEAM);

// XP values
export const XP_PER_TASK = 1;
export const XP_PER_AUTOMATION = 50;

// ============================================================================
// MEDALS  (monthly milestones)
// ============================================================================
// Rules:
//  - 1 medal for every 30 completed tasks/chamados in the month
//  - 1 medal for every completed automation in the month
//  - Year total = sum of monthly medals in the current year
export const MEDAL_PER_TASKS = 30;
export const MEDAL_PER_AUTOMATION = 1;

export const MEDAL_ICON = "🏅";

// Kept for backward compatibility with existing imports (no longer used in UI).
export const MEDAL_DEFS: Record<string, { name: string; description: string; icon: string }> = {};

// ============================================================================
// Shared data loaders
// ============================================================================

async function fetchFirstCompletionMap(taskIds: string[]) {
  const map = new Map<string, string>();
  if (taskIds.length === 0) return map;
  const { data } = await supabase
    .from("task_events")
    .select("task_id, created_at")
    .in("task_id", taskIds)
    .eq("event_type", "completed")
    .order("created_at", { ascending: true });
  (data || []).forEach((e: any) => {
    if (!map.has(e.task_id)) map.set(e.task_id, e.created_at);
  });
  return map;
}

async function fetchFirstAutomationCompletionMap(autoIds: string[]) {
  const map = new Map<string, string>();
  if (autoIds.length === 0) return map;
  const { data } = await supabase
    .from("automation_events")
    .select("automation_id, created_at, metadata")
    .in("automation_id", autoIds)
    .eq("event_type", "status_changed")
    .order("created_at", { ascending: true });
  (data || []).forEach((e: any) => {
    const newStatus = e?.metadata?.new_status;
    if (newStatus !== "completed") return;
    if (!map.has(e.automation_id)) map.set(e.automation_id, e.created_at);
  });
  return map;
}

async function fetchUserActivity(userId: string) {
  const [tasksRes, autosRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, status, updated_at, title")
      .eq("assigned_to", userId)
      .eq("status", "done"),
    supabase
      .from("automations")
      .select("id, status, updated_at, completed_at, title")
      .eq("assigned_to", userId)
      .eq("status", "completed"),
  ]);
  const tasks = tasksRes.data || [];
  const autos = autosRes.data || [];
  const [taskFirst, autoFirst] = await Promise.all([
    fetchFirstCompletionMap(tasks.map((t: any) => t.id)),
    fetchFirstAutomationCompletionMap(autos.map((a: any) => a.id)),
  ]);
  // Override timestamps with first-completion when available
  tasks.forEach((t: any) => {
    const first = taskFirst.get(t.id);
    if (first) t.updated_at = first;
  });
  autos.forEach((a: any) => {
    const first = autoFirst.get(a.id);
    if (first) {
      a.completed_at = first;
      a.updated_at = first;
    }
  });
  return { tasks, autos };
}

function computeXp(tasksDone: number, autosDone: number, seedXp: number) {
  return tasksDone * XP_PER_TASK + autosDone * XP_PER_AUTOMATION + seedXp;
}

interface MonthlyMedal {
  key: string; // 'YYYY-MM'
  label: string;
  year: number;
  month: number;
  tasksDone: number;
  autosDone: number;
  taskMedals: number;
  autoMedals: number;
  total: number;
  xp: number;
}

function buildMonthlyMedals(
  tasks: { updated_at: string }[],
  autos: { completed_at: string | null; updated_at: string }[],
): MonthlyMedal[] {
  const map = new Map<string, MonthlyMedal>();

  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const monthLabel = (d: Date) =>
    d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const ensure = (d: Date) => {
    const k = monthKey(d);
    if (!map.has(k)) {
      map.set(k, {
        key: k,
        label: monthLabel(d),
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        tasksDone: 0,
        autosDone: 0,
        taskMedals: 0,
        autoMedals: 0,
        total: 0,
        xp: 0,
      });
    }
    return map.get(k)!;
  };

  tasks.forEach((t) => {
    const d = new Date(t.updated_at);
    if (Number.isNaN(d.getTime())) return;
    const m = ensure(d);
    m.tasksDone += 1;
    m.xp += XP_PER_TASK;
  });
  autos.forEach((a) => {
    const ts = a.completed_at || a.updated_at;
    const d = new Date(ts);
    if (Number.isNaN(d.getTime())) return;
    const m = ensure(d);
    m.autosDone += 1;
    m.xp += XP_PER_AUTOMATION;
  });

  map.forEach((m) => {
    m.taskMedals = Math.floor(m.tasksDone / MEDAL_PER_TASKS);
    m.autoMedals = m.autosDone * MEDAL_PER_AUTOMATION;
    m.total = m.taskMedals + m.autoMedals;
  });

  return Array.from(map.values()).sort((a, b) => (a.key < b.key ? 1 : -1));
}


// ============================================================================
// HOOKS
// ============================================================================

export interface RankingEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_xp: number;
  tasks_done: number;
  automations_done: number;
  seed_xp: number;
  level: ReturnType<typeof getLevel>;
  medals_year: number;
  medals_month: number;
}

export function useRanking() {
  return useQuery({
    queryKey: ["ranking-ti", TI_TEAM_IDS.join(",")],
    queryFn: async () => {
      const [profilesRes, tasksRes, autosRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, avatar_url").in("id", TI_TEAM_IDS),
        supabase
          .from("tasks")
          .select("id, assigned_to, status, updated_at")
          .in("assigned_to", TI_TEAM_IDS)
          .eq("status", "done"),
        supabase
          .from("automations")
          .select("id, assigned_to, status, updated_at, completed_at")
          .in("assigned_to", TI_TEAM_IDS)
          .eq("status", "completed"),
      ]);

      const allTasks = tasksRes.data || [];
      const allAutos = autosRes.data || [];
      const [taskFirst, autoFirst] = await Promise.all([
        fetchFirstCompletionMap(allTasks.map((t: any) => t.id)),
        fetchFirstAutomationCompletionMap(allAutos.map((a: any) => a.id)),
      ]);
      allTasks.forEach((t: any) => {
        const f = taskFirst.get(t.id);
        if (f) t.updated_at = f;
      });
      allAutos.forEach((a: any) => {
        const f = autoFirst.get(a.id);
        if (f) { a.completed_at = f; a.updated_at = f; }
      });

      const profileMap = Object.fromEntries((profilesRes.data || []).map((p: any) => [p.id, p]));
      const now = new Date();
      const curY = now.getFullYear();
      const curM = now.getMonth() + 1;

      const entries: RankingEntry[] = TI_TEAM_IDS.map((uid) => {
        const tasks = allTasks.filter((t: any) => t.assigned_to === uid);
        const autos = allAutos.filter((a: any) => a.assigned_to === uid);
        const seed = TI_TEAM[uid].seedXp;
        const xp = computeXp(tasks.length, autos.length, seed);

        const monthly = buildMonthlyMedals(tasks as any, autos as any);
        const medalsYear = monthly
          .filter((m) => m.year === curY)
          .reduce((s, m) => s + m.total, 0);
        const medalsMonth = monthly
          .find((m) => m.year === curY && m.month === curM)?.total || 0;

        const p = profileMap[uid];
        return {
          user_id: uid,
          full_name: p?.full_name || "Sem nome",
          avatar_url: p?.avatar_url || null,
          total_xp: xp,
          tasks_done: tasks.length,
          automations_done: autos.length,
          seed_xp: seed,
          level: getLevel(xp),
          medals_year: medalsYear,
          medals_month: medalsMonth,
        };
      });

      return entries.sort((a, b) => b.total_xp - a.total_xp);
    },
  });
}


export function useMyGamification() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-gamification-v2", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const uid = user!.id;
      const { tasks, autos } = await fetchUserActivity(uid);
      const seed = TI_TEAM[uid]?.seedXp || 0;
      const totalXp = computeXp(tasks.length, autos.length, seed);

      const isChamado = (title: string | null | undefined) =>
        !!title && /^\s*\[Chamado\]/i.test(title);
      const chamadosDone = tasks.filter((t: any) => isChamado(t.title)).length;
      const tasksOnlyDone = tasks.length - chamadosDone;

      const monthly = buildMonthlyMedals(tasks as any, autos as any);
      const now = new Date();
      const curY = now.getFullYear();
      const curM = now.getMonth() + 1;
      const medalsYear = monthly.filter((m) => m.year === curY).reduce((s, m) => s + m.total, 0);
      const currentMonth = monthly.find((m) => m.year === curY && m.month === curM);

      // Recent activity for the "XP recente" panel
      const recent = [
        ...tasks.map((t: any) => ({
          ts: t.updated_at,
          label: `${isChamado(t.title) ? "Chamado" : "Tarefa"} concluído: ${t.title || ""}`.trim(),
          xp: XP_PER_TASK,
        })),
        ...autos.map((a: any) => ({
          ts: a.completed_at || a.updated_at,
          label: `Automação concluída: ${a.title || ""}`.trim(),
          xp: XP_PER_AUTOMATION,
        })),
      ]
        .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
        .slice(0, 10);

      return {
        totalXp,
        seedXp: seed,
        tasksDone: tasks.length,
        tasksOnlyDone,
        chamadosDone,
        autosDone: autos.length,
        level: getLevel(totalXp),
        monthly,
        medalsYear,
        medalsMonth: currentMonth?.total || 0,
        currentMonth,
        recent,
      };
    },
  });
}

/**
 * Backwards-compatible stub. The new medal system computes medals on the fly
 * from completed tasks/automations, so there is nothing to write here.
 */
export async function checkAndAwardMedals(_userId: string) {
  return [];
}
