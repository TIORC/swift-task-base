import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ============================================================================
// FONTE ÚNICA DE VERDADE
// ----------------------------------------------------------------------------
// Todo o cálculo de XP, tarefas concluídas e medalhas vem da função
// `public.gamification_stats()` no banco. Nenhum componente recalcula nada:
// ranking, perfil (sidebar), Meu Progresso e Medalhas leem o MESMO cache.
//
// Regras (configuráveis em public.xp_settings):
//  - 1 XP por tarefa/chamado concluído (primeira conclusão apenas)
//  - 50 XP por automação concluída (primeira conclusão apenas)
//  - 1 XP por tarefa interna de automação concluída (via xp_ledger)
//  - Bônus de conclusão por complexidade (via xp_ledger)
//  - XP semente por tempo de casa (public.xp_seeds)
//  - 1 medalha a cada 30 tarefas/chamados no mês + 1 por automação no mês
// ============================================================================

export const LEVELS = [
  { level: 1, name: "Ferro", minXp: 0, icon: "⚙️" },
  { level: 2, name: "Bronze", minXp: 500, icon: "🥉" },
  { level: 3, name: "Prata", minXp: 1500, icon: "🥈" },
  { level: 4, name: "Ouro", minXp: 3000, icon: "🥇" },
  { level: 5, name: "Platina", minXp: 5000, icon: "💠" },
  { level: 6, name: "Diamante", minXp: 8000, icon: "💎" },
  { level: 7, name: "Mestre", minXp: 12000, icon: "🏆" },
  { level: 8, name: "Desafiante", minXp: 15000, icon: "👑" },
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

// Equipe TI exibida no Ranking XP (notas de tempo de casa apenas para exibição —
// o valor do XP semente vive em public.xp_seeds).
export const TI_TEAM: Record<string, { seedXp: number; note?: string }> = {
  "f7c4a624-0f8f-432d-b7c0-047b36817670": { seedXp: 3600, note: "6 anos TI" },
  "242acd59-00fb-478f-8d78-b25219798aa6": { seedXp: 1750, note: "2 anos TI" },
  "5bbd3dc1-985c-4ffd-a0c0-b4223faff98e": { seedXp: 0 },
  "2f71bd5e-c557-486e-aff8-0606cba4ebbb": { seedXp: 0 },
};
export const TI_TEAM_IDS = Object.keys(TI_TEAM);

export const XP_PER_TASK = 1;
export const XP_PER_AUTOMATION = 50;
export const MEDAL_PER_TASKS = 30;
export const MEDAL_PER_AUTOMATION = 1;
export const MEDAL_ICON = "🏅";

// Mantido por compatibilidade com imports antigos.
export const MEDAL_DEFS: Record<string, { name: string; description: string; icon: string }> = {};

export const GAMIFICATION_QUERY_KEY = ["gamification-stats"] as const;

/** Invalida o cache único de gamificação (perfil, ranking, progresso, medalhas). */
export function invalidateGamification(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: GAMIFICATION_QUERY_KEY });
}

export interface MonthlyMedal {
  key: string;
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

export interface GamificationStat {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  tasks_done: number;
  chamados_done: number;
  automations_done: number;
  seed_xp: number;
  ledger_xp: number;
  total_xp: number;
  medals_month: number;
  medals_year: number;
  monthly: MonthlyMedal[];
}

function buildMonthly(raw: any): MonthlyMedal[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((m: any) => {
      const [y, mo] = String(m.key).split("-").map(Number);
      const date = new Date(y, (mo || 1) - 1, 1);
      const tasksDone = Number(m.tasks) || 0;
      const autosDone = Number(m.autos) || 0;
      const taskMedals = Math.floor(tasksDone / MEDAL_PER_TASKS);
      const autoMedals = autosDone * MEDAL_PER_AUTOMATION;
      return {
        key: String(m.key),
        label: date.toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        year: y,
        month: mo,
        tasksDone,
        autosDone,
        taskMedals,
        autoMedals,
        total: Number(m.medals) ?? taskMedals + autoMedals,
        xp: tasksDone * XP_PER_TASK + autosDone * XP_PER_AUTOMATION,
      };
    })
    .sort((a, b) => (a.key < b.key ? 1 : -1));
}

/** Consulta única — todos os componentes de gamificação usam este cache. */
export function useGamificationStats() {
  return useQuery({
    queryKey: GAMIFICATION_QUERY_KEY,
    staleTime: 30_000,
    queryFn: async (): Promise<GamificationStat[]> => {
      const { data, error } = await (supabase as any).rpc("gamification_stats");
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        user_id: r.user_id,
        full_name: r.full_name || "Sem nome",
        avatar_url: r.avatar_url || null,
        tasks_done: Number(r.tasks_done) || 0,
        chamados_done: Number(r.chamados_done) || 0,
        automations_done: Number(r.automations_done) || 0,
        seed_xp: Number(r.seed_xp) || 0,
        ledger_xp: Number(r.ledger_xp) || 0,
        total_xp: Number(r.total_xp) || 0,
        medals_month: Number(r.medals_month) || 0,
        medals_year: Number(r.medals_year) || 0,
        monthly: buildMonthly(r.medal_months),
      }));
    },
  });
}

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
  const stats = useGamificationStats();
  const entries: RankingEntry[] = (stats.data || [])
    .filter((s) => TI_TEAM_IDS.includes(s.user_id))
    .map((s) => ({
      user_id: s.user_id,
      full_name: s.full_name,
      avatar_url: s.avatar_url,
      total_xp: s.total_xp,
      tasks_done: s.tasks_done,
      automations_done: s.automations_done,
      seed_xp: s.seed_xp,
      level: getLevel(s.total_xp),
      medals_year: s.medals_year,
      medals_month: s.medals_month,
    }))
    .sort((a, b) => b.total_xp - a.total_xp);

  return { ...stats, data: stats.data ? entries : undefined };
}

/** XP recente do usuário (apenas exibição da linha do tempo de pontuação). */
function useRecentXp(userId: string | undefined) {
  return useQuery({
    queryKey: ["gamification-recent", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const [tasksRes, autosRes, ledgerRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("title, updated_at")
          .eq("assigned_to", userId!)
          .eq("status", "done")
          .order("updated_at", { ascending: false })
          .limit(10),
        supabase
          .from("automations")
          .select("title, completed_at, updated_at")
          .eq("assigned_to", userId!)
          .eq("status", "completed")
          .order("updated_at", { ascending: false })
          .limit(10),
        (supabase as any)
          .from("xp_ledger")
          .select("reason, amount, created_at")
          .eq("user_id", userId!)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const isChamado = (t: string | null) => !!t && /^\s*\[Chamado\]/i.test(t);

      return [
        ...((tasksRes.data as any[]) || []).map((t) => ({
          ts: t.updated_at,
          label: `${isChamado(t.title) ? "Chamado" : "Tarefa"} concluído: ${t.title || ""}`.trim(),
          xp: XP_PER_TASK,
        })),
        ...((autosRes.data as any[]) || []).map((a) => ({
          ts: a.completed_at || a.updated_at,
          label: `Automação concluída: ${a.title || ""}`.trim(),
          xp: XP_PER_AUTOMATION,
        })),
        ...((ledgerRes.data as any[]) || []).map((l) => ({
          ts: l.created_at,
          label: l.reason || "Ajuste de XP",
          xp: l.amount,
        })),
      ]
        .sort((a, b) => +new Date(b.ts) - +new Date(a.ts))
        .slice(0, 10);
    },
  });
}

export function useMyGamification() {
  const { user } = useAuth();
  const stats = useGamificationStats();
  const { data: recent = [] } = useRecentXp(user?.id);

  const mine = (stats.data || []).find((s) => s.user_id === user?.id);
  if (!mine) return { ...stats, data: undefined };

  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const currentMonth = mine.monthly.find((m) => m.year === curY && m.month === curM);

  return {
    ...stats,
    data: {
      totalXp: mine.total_xp,
      seedXp: mine.seed_xp,
      ledgerXp: mine.ledger_xp,
      tasksDone: mine.tasks_done,
      tasksOnlyDone: mine.tasks_done - mine.chamados_done,
      chamadosDone: mine.chamados_done,
      autosDone: mine.automations_done,
      level: getLevel(mine.total_xp),
      monthly: mine.monthly,
      medalsYear: mine.medals_year,
      medalsMonth: mine.medals_month,
      currentMonth,
      recent,
    },
  };
}

/** Compatibilidade: as medalhas são derivadas do banco, nada a gravar. */
export async function checkAndAwardMedals(_userId: string) {
  return [];
}

/** Hook utilitário para invalidar a gamificação após concluir algo. */
export function useInvalidateGamification() {
  const qc = useQueryClient();
  return () => invalidateGamification(qc);
}
