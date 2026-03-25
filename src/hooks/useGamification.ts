import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// --- LEVELS ---
export const LEVELS = [
  { level: 1, name: "Iniciante", minXp: 0, icon: "🌱" },
  { level: 2, name: "Aprendiz", minXp: 30, icon: "📘" },
  { level: 3, name: "Praticante", minXp: 80, icon: "⚡" },
  { level: 4, name: "Profissional", minXp: 180, icon: "🔥" },
  { level: 5, name: "Especialista", minXp: 350, icon: "💎" },
  { level: 6, name: "Mestre", minXp: 600, icon: "🏆" },
  { level: 7, name: "Lenda", minXp: 1000, icon: "👑" },
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

// --- MEDALS ---
export const MEDAL_DEFS: Record<string, { name: string; description: string; icon: string }> = {
  first_task: { name: "Primeira Tarefa", description: "Concluiu a primeira tarefa", icon: "🎯" },
  five_tasks: { name: "Cinco Estrelas", description: "Concluiu 5 tarefas", icon: "⭐" },
  ten_tasks: { name: "Veterano", description: "Concluiu 10 tarefas", icon: "🎖️" },
  twenty_five_tasks: { name: "Máquina", description: "Concluiu 25 tarefas", icon: "🤖" },
  first_approval: { name: "Primeiro Selo", description: "Primeira aprovação como líder/gestor", icon: "✅" },
  ten_approvals: { name: "Guardião", description: "10 aprovações realizadas", icon: "🛡️" },
  time_warrior: { name: "Guerreiro do Tempo", description: "Registrou mais de 10 horas", icon: "⏱️" },
  speed_demon: { name: "Veloz", description: "Concluiu 3 tarefas em um dia", icon: "🚀" },
  team_player: { name: "Jogador de Equipe", description: "Comentou em 10 tarefas diferentes", icon: "🤝" },
};

// --- HOOKS ---

export interface RankingEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_xp: number;
  level: ReturnType<typeof getLevel>;
  medals: string[];
}

export function useRanking() {
  return useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      // Fetch all XP logs
      const { data: xpLogs, error } = await supabase
        .from("xp_logs")
        .select("user_id, xp_earned");
      if (error) throw error;

      // Aggregate XP per user
      const xpMap: Record<string, number> = {};
      xpLogs.forEach((log: any) => {
        xpMap[log.user_id] = (xpMap[log.user_id] || 0) + log.xp_earned;
      });

      const userIds = Object.keys(xpMap);
      if (userIds.length === 0) return [];

      // Fetch profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      // Fetch medals
      const { data: medals } = await supabase
        .from("user_medals")
        .select("user_id, medal_key")
        .in("user_id", userIds);

      const medalsMap: Record<string, string[]> = {};
      medals?.forEach((m: any) => {
        if (!medalsMap[m.user_id]) medalsMap[m.user_id] = [];
        medalsMap[m.user_id].push(m.medal_key);
      });

      const profilesMap = Object.fromEntries(
        (profiles || []).map((p) => [p.id, p])
      );

      return userIds
        .map((uid) => ({
          user_id: uid,
          full_name: profilesMap[uid]?.full_name || "Sem nome",
          avatar_url: profilesMap[uid]?.avatar_url || null,
          total_xp: xpMap[uid],
          level: getLevel(xpMap[uid]),
          medals: medalsMap[uid] || [],
        }))
        .sort((a, b) => b.total_xp - a.total_xp) as RankingEntry[];
    },
  });
}

export function useMyGamification() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-gamification", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: xpLogs } = await supabase
        .from("xp_logs")
        .select("xp_earned, action, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      const totalXp = xpLogs?.reduce((s: number, l: any) => s + l.xp_earned, 0) || 0;

      const { data: medals } = await supabase
        .from("user_medals")
        .select("medal_key, awarded_at")
        .eq("user_id", user!.id);

      return {
        totalXp,
        level: getLevel(totalXp),
        medals: medals?.map((m: any) => m.medal_key) || [],
        recentXp: xpLogs?.slice(0, 10) || [],
      };
    },
  });
}

/**
 * Check and award medals for a user based on their current stats.
 * Call after XP-earning actions.
 */
export async function checkAndAwardMedals(userId: string) {
  try {
    // Fetch user stats
    const [tasksRes, approvalsRes, timeRes, commentsRes] = await Promise.all([
      supabase.from("xp_logs").select("id").eq("user_id", userId).eq("action", "executed"),
      supabase.from("xp_logs").select("id").eq("user_id", userId).in("action", ["approved_lider", "approved_gestor"]),
      supabase.from("time_logs").select("duration_minutes").eq("user_id", userId),
      supabase.from("comments").select("task_id").eq("user_id", userId),
    ]);

    const tasksDone = tasksRes.data?.length || 0;
    const approvals = approvalsRes.data?.length || 0;
    const totalMinutes = timeRes.data?.reduce((s: number, l: any) => s + l.duration_minutes, 0) || 0;
    const uniqueCommentTasks = new Set(commentsRes.data?.map((c: any) => c.task_id)).size;

    const earned: string[] = [];
    if (tasksDone >= 1) earned.push("first_task");
    if (tasksDone >= 5) earned.push("five_tasks");
    if (tasksDone >= 10) earned.push("ten_tasks");
    if (tasksDone >= 25) earned.push("twenty_five_tasks");
    if (approvals >= 1) earned.push("first_approval");
    if (approvals >= 10) earned.push("ten_approvals");
    if (totalMinutes >= 600) earned.push("time_warrior");
    if (uniqueCommentTasks >= 10) earned.push("team_player");

    // Fetch existing medals
    const { data: existing } = await supabase
      .from("user_medals")
      .select("medal_key")
      .eq("user_id", userId);
    const existingKeys = new Set(existing?.map((m: any) => m.medal_key));

    const newMedals = earned.filter((k) => !existingKeys.has(k));
    if (newMedals.length > 0) {
      await supabase.from("user_medals").insert(
        newMedals.map((key) => ({ user_id: userId, medal_key: key }))
      );
    }

    return newMedals;
  } catch (err) {
    console.error("Medal check error:", err);
    return [];
  }
}
