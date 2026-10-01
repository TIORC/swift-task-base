import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatMinutes } from "@/hooks/useTimeTracker";
import { Badge } from "@/components/ui/badge";
import { Loader2, ClipboardList, CircleDot, Code2, Headset } from "lucide-react";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/types/automation";
import type { AutomationStatus } from "@/types/automation";

const STATUS_FILL: Record<string, string> = {
  backlog: "bg-slate-500", analysis: "bg-blue-500", requested: "bg-sky-500",
  waiting_info: "bg-yellow-500", approved: "bg-teal-500", change_requested: "bg-rose-500",
  development: "bg-indigo-500", internal_testing: "bg-amber-500", homologation: "bg-purple-500",
  waiting_user: "bg-orange-500", completed: "bg-emerald-500", blocked: "bg-red-500",
  cancelled: "bg-slate-400",
};

/** "1005 minutos" vira "16h 45m". */
const elapsedLabel = (minutes: number | null) => (minutes === null ? null : formatMinutes(minutes));

/** "desde 25/09/2026 às 14:32" — dia e hora em que o trabalho começou. */
const sinceLabel = (startedAt: string) => format(new Date(startedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

/** Base do card de status. A cor da borda vem de baixo, conforme o status. */
const STATUS_CARD_BASE =
  "group relative overflow-hidden rounded-lg border bg-gradient-to-b from-card to-card/60 px-4 pb-4 pt-4 text-card-foreground shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:shadow-md";

/** Só o contorno muda: verde em andamento, vermelho parado. */
const STATUS_CARD_BORDER = {
  working: "border-success/50 hover:border-success/80",
  stopped: "border-destructive/50 hover:border-destructive/80",
  neutral: "border-border hover:border-primary/40",
} as const;

type TimeLogLike = {
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
};

/** Log de automação ou de tarefa, normalizado num só formato. */
type DevLog = TimeLogLike & {
  user_id: string;
  automation_id?: string;
  subtask_id?: string | null;
  task_id?: string;
};

/** Margem do batimento: o tempo persistido roda a cada 60s (useGlobalTimer). */
const HEARTBEAT_TOLERANCE_MINUTES = 2.5;

/** Minutos de relógio desde o início do trecho. */
const wallClockMinutes = (log: TimeLogLike, now: number) =>
  Math.max(0, (now - new Date(log.started_at).getTime()) / 60000);

/**
 * O cronômetro é estado em memória do navegador. Se a aba fechar com força
 * (crash, F5, fechar a janela) o auto-stop não roda e o log fica com
 * ended_at = NULL para sempre — o que faria a pessoa parecer trabalhar há
 * horas a partir de um timer que ninguém está olhando.
 *
 * Enquanto o cronômetro roda, duration_minutes é reescrito a cada 60s e
 * acompanha o relógio desde started_at. Se o valor parou de acompanhar, o
 * dono do cronômetro não está mais ali: o trecho encerrou.
 */
function isLiveLog(log: TimeLogLike, now: number) {
  if (log.ended_at) return false;
  return (log.duration_minutes ?? 0) >= wallClockMinutes(log, now) - HEARTBEAT_TOLERANCE_MINUTES;
}

/**
 * Tempo realmente trabalhado no trecho — nunca o tempo de relógio.
 * Trecho em aberto anda junto com o relógio; trecho encerrado (ou órfão, deixado
 * aberto por um crash) vale o que foi gravado.
 */
function workedMinutes(log: TimeLogLike, now: number) {
  if (isLiveLog(log, now)) return wallClockMinutes(log, now);
  return log.duration_minutes ?? wallClockMinutes(log, now);
}

type DeveloperStatus = {
  id: string | null;
  name: string;
  mode: "developing" | "idle" | "unknown";
  /** Em desenvolvimento: duração da sessão. Parado: tempo ocioso. */
  minutes: number | null;
  /** Início da sessão atual, ou o instante em que o último trecho parou. */
  startedAt: string | null;
  subject: string | null;
  /** Total acumulado no assunto do último trecho (só quando parado). */
  subjectMinutes: number | null;
};

function useDeveloperStatuses() {
  return useQuery({
    queryKey: ["developer-live-status"],
    refetchInterval: 5000,
    queryFn: async (): Promise<DeveloperStatus[]> => {
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name");
      if (profilesError) throw profilesError;
      const { data: assignableIdsData, error: assignableIdsError } = await supabase.rpc("get_ti_assignable_user_ids");
      if (assignableIdsError) throw assignableIdsError;
      const assignableIds = new Set((assignableIdsData as string[] | null) ?? []);

      const targets = [
        { name: "Welder", match: "welder" },
        { name: "Gabriel", match: "gabriel" },
      ];
      const developers = targets.map((target) => ({
        ...target,
        profile: profiles?.find((profile) => assignableIds.has(profile.id) && (profile.full_name || "").toLowerCase().includes(target.match))
          ?? profiles?.find((profile) => (profile.full_name || "").toLowerCase().includes(target.match))
          ?? null,
      }));
      const ids = developers.flatMap((developer) => developer.profile ? [developer.profile.id] : []);

      const [automationLogsResult, taskLogsResult] = ids.length
        ? await Promise.all([
            supabase.from("automation_time_logs").select("id, user_id, automation_id, subtask_id, started_at, ended_at, duration_minutes").in("user_id", ids).order("started_at", { ascending: false }).limit(500),
            supabase.from("time_logs").select("id, user_id, task_id, started_at, ended_at, duration_minutes").in("user_id", ids).order("started_at", { ascending: false }).limit(500),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
      if (automationLogsResult.error) throw automationLogsResult.error;
      if (taskLogsResult.error) throw taskLogsResult.error;
      const automationLogs = (automationLogsResult.data || []) as DevLog[];
      const taskLogs = (taskLogsResult.data || []) as DevLog[];

      const now = Date.now();
      const logsByUser = new Map<string, DevLog[]>();
      for (const log of [...automationLogs, ...taskLogs]) {
        const bucket = logsByUser.get(log.user_id) ?? [];
        bucket.push(log);
        logsByUser.set(log.user_id, bucket);
      }

      // Primeiro decide o trecho que representa cada pessoa (sessão viva ou
      // último encerrado). Só depois busca os títulos necessários — no máximo
      // um por pessoa, em vez de hundreds de logs antigos.
      const focusLogs = developers
        .map((developer) => {
          if (!developer.profile) return null;
          const logs = (logsByUser.get(developer.profile.id) ?? [])
            .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
          return logs.find((log) => isLiveLog(log, now)) ?? logs[0] ?? null;
        })
        .filter((log) => log !== null);

      const automationIds = [...new Set(focusLogs.flatMap((log) => (log.automation_id ? [log.automation_id] : [])))];
      const taskIds = [...new Set(focusLogs.flatMap((log) => (log.task_id ? [log.task_id] : [])))];
      const subtaskIds = [...new Set(focusLogs.flatMap((log) => (log.subtask_id ? [log.subtask_id] : [])))];

      const [automationsResult, tasksResult, subtasksResult] = await Promise.all([
        automationIds.length ? supabase.from("automations").select("id, title").in("id", automationIds) : Promise.resolve({ data: [], error: null }),
        taskIds.length ? supabase.from("tasks").select("id, title").in("id", taskIds) : Promise.resolve({ data: [], error: null }),
        subtaskIds.length ? supabase.from("automation_subtasks").select("id, title").in("id", subtaskIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (automationsResult.error) throw automationsResult.error;
      if (tasksResult.error) throw tasksResult.error;
      if (subtasksResult.error) throw subtasksResult.error;

      const automationTitles = new Map((automationsResult.data || []).map((automation) => [automation.id, automation.title]));
      const taskTitles = new Map((tasksResult.data || []).map((task) => [task.id, task.title]));
      const subtaskTitles = new Map((subtasksResult.data || []).map((subtask) => [subtask.id, subtask.title]));

      const describe = (log: { automation_id?: string; task_id?: string; subtask_id?: string | null }) => {
        if (!log.automation_id) return taskTitles.get(log.task_id!) || "tarefa em andamento";
        const automation = automationTitles.get(log.automation_id) || "automação";
        if (!log.subtask_id) return automation;
        const subtask = subtaskTitles.get(log.subtask_id);
        return subtask ? `${subtask} — ${automation}` : automation;
      };

      return developers.map<DeveloperStatus>((developer) => {
        const id = developer.profile?.id ?? null;
        if (!id) return { id, name: developer.name, mode: "unknown", minutes: null, startedAt: null, subject: null, subjectMinutes: null };

        const allLogs = logsByUser.get(id) ?? [];
        const liveLog = allLogs.find((log) => isLiveLog(log, now));

        if (liveLog) {
          return {
            id,
            name: developer.name,
            mode: "developing",
            minutes: workedMinutes(liveLog, now),
            startedAt: liveLog.started_at,
            subject: describe(liveLog),
            subjectMinutes: null,
          };
        }

        const lastLog = allLogs[0] ?? null;
        if (!lastLog) {
          return { id, name: developer.name, mode: "idle", minutes: null, startedAt: null, subject: null, subjectMinutes: null };
        }

        // Trecho encerrado (ou órfão de um crash): o relógio parou nele.
        const stoppedAt = lastLog.ended_at ?? lastLog.started_at;
        const key = lastLog.automation_id ?? lastLog.task_id;
        const subjectMinutes = allLogs
          .filter((log) => (log.automation_id ?? log.task_id) === key)
          .reduce((sum, log) => sum + (log.duration_minutes ?? 0), 0);
        return {
          id,
          name: developer.name,
          mode: "idle",
          minutes: Math.max(0, Math.floor((now - new Date(stoppedAt).getTime()) / 60000)),
          startedAt: stoppedAt,
          subject: describe(lastLog),
          subjectMinutes,
        };
      });
    },
  });
}

function DeveloperStatusPanel() {
  const { data: developers = [], isLoading, error } = useDeveloperStatuses();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Status dos Desenvolvedores</h2>
        <p className="text-xs text-muted-foreground">Atualização automática a cada 5 segundos.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar o status dos desenvolvedores.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {developers.map((developer) => (
            <article key={developer.name} className={`${STATUS_CARD_BASE} ${
              developer.mode === "developing"
                ? STATUS_CARD_BORDER.working
                : developer.mode === "idle"
                  ? STATUS_CARD_BORDER.stopped
                  : STATUS_CARD_BORDER.neutral
            }`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary"><Code2 className="h-4 w-4" /></span>
                <h3 className="text-sm font-semibold">{developer.name}</h3>
              </div>
              {developer.mode === "developing" ? (
                <div className="flex items-start gap-2 text-sm">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-emerald-500" />
                  <div>
                    <p>
                      <span className="font-medium">Está desenvolvendo</span> “{developer.subject}” há{" "}
                      <span className="font-medium tabular-nums">{elapsedLabel(developer.minutes)}</span>.
                    </p>
                    {developer.startedAt && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        desde {sinceLabel(developer.startedAt)}, sem pausa
                      </p>
                    )}
                  </div>
                </div>
              ) : developer.mode === "idle" ? (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p>
                      {developer.minutes === null ? (
                        "Ocioso; ainda não há tempo anterior registrado."
                      ) : (
                        <>
                          Parado há <span className="tabular-nums">{elapsedLabel(developer.minutes)}</span>
                          {developer.startedAt && <> — encerrou em {sinceLabel(developer.startedAt)}</>}
                        </>
                      )}
                    </p>
                    {developer.subject && (
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        Último: “{developer.subject}”
                        {developer.subjectMinutes !== null && (
                          <> · <span className="tabular-nums">{formatMinutes(developer.subjectMinutes)}</span> trabalhados</>
                        )}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Perfil não localizado.</p>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

type SupportTicket = {
  id: string;
  title: string;
  status: string;
  updated_at: string;
  /** Sessão em andamento neste chamado; null se o timer não está rodando. */
  activeLog: TimeLogLike | null;
};

type SupportTechnician = {
  name: string;
  tickets: SupportTicket[];
};

function useSupportTechnicianStatuses() {
  return useQuery({
    queryKey: ["support-technician-live-status"],
    refetchInterval: 5000,
    queryFn: async (): Promise<SupportTechnician[]> => {
      const { data: profiles, error: profilesError } = await supabase.from("profiles").select("id, full_name");
      if (profilesError) throw profilesError;
      const { data: assignableIdsData, error: assignableIdsError } = await supabase.rpc("get_ti_assignable_user_ids");
      if (assignableIdsError) throw assignableIdsError;
      const assignableIds = new Set((assignableIdsData as string[] | null) ?? []);
      const targets = [
        { name: "Angel", match: "angel" },
        { name: "Sofia", match: "sofia" },
      ];
      const technicians = targets.map((target) => ({
        ...target,
        profile: profiles?.find((profile) => assignableIds.has(profile.id) && (profile.full_name || "").toLowerCase().includes(target.match))
          ?? profiles?.find((profile) => (profile.full_name || "").toLowerCase().includes(target.match))
          ?? null,
      }));
      const ids = technicians.flatMap((technician) => technician.profile ? [technician.profile.id] : []);
      const { data: tickets, error: ticketsError } = ids.length
        ? await supabase.from("tasks").select("id, title, status, assigned_to, updated_at").like("title", "[Chamado]%").in("assigned_to", ids).order("updated_at", { ascending: false })
        : { data: [], error: null };
      if (ticketsError) throw ticketsError;

      const openTickets = (tickets || []).filter((ticket) => !["done", "discarded"].includes(ticket.status));
      const openTicketIds = openTickets.map((ticket) => ticket.id);
      const { data: logs, error: logsError } = openTicketIds.length
        ? await supabase.from("time_logs").select("task_id, started_at, ended_at, duration_minutes").in("task_id", openTicketIds).order("started_at", { ascending: false })
        : { data: [], error: null };
      if (logsError) throw logsError;

      const now = Date.now();
      // Só conta como sessão em andamento se o cronômetro ainda estiver de pé
      // (mesmo teste de batimento usado nos desenvolvedores).
      const activeLogByTicket = new Map<string, TimeLogLike>();
      for (const log of logs || []) {
        if (isLiveLog(log, now) && !activeLogByTicket.has(log.task_id)) {
          activeLogByTicket.set(log.task_id, log);
        }
      }

      return technicians.map((technician) => ({
        name: technician.name,
        tickets: technician.profile
          ? openTickets
              .filter((ticket) => ticket.assigned_to === technician.profile!.id)
              .map((ticket) => ({
                id: ticket.id,
                title: ticket.title.replace(/^\[Chamado\]\s*/, ""),
                status: ticket.status,
                updated_at: ticket.updated_at,
                activeLog: activeLogByTicket.get(ticket.id) ?? null,
              }))
          : [],
      }));
    },
  });
}

function SupportTechnicianStatusPanel() {
  const { data: technicians = [], isLoading, error } = useSupportTechnicianStatuses();
  const statusLabel: Record<string, string> = { pending: "Pendente", in_progress: "Em andamento", review: "Em validação" };
  const now = Date.now();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Status dos Suportes/Infra</h2>
        <p className="text-xs text-muted-foreground">Status dos chamados atribuídos, sincronizado com /support a cada 5 segundos.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar os chamados dos técnicos.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {technicians.map((technician) => {
            const current = technician.tickets.find((ticket) => ticket.status === "in_progress")
              ?? technician.tickets.find((ticket) => ticket.status === "review")
              ?? technician.tickets[0];
            const working = Boolean(current?.activeLog);
            const modeLabel = !current
              ? "Ociosa — sem chamado aberto"
              : working || current.status === "in_progress"
                ? "Atendendo chamado"
                : current.status === "review"
                  ? "Chamado em validação"
                  : "Com chamado pendente";
            // Com o timer rodando mede a sessão real; senão, a última atualização.
            const currentMinutes = current
              ? Math.max(0, Math.floor((now - new Date(current.activeLog?.started_at ?? current.updated_at).getTime()) / 60000))
              : null;
            return (
              <article key={technician.name} className={`${STATUS_CARD_BASE} ${working ? STATUS_CARD_BORDER.working : STATUS_CARD_BORDER.stopped}`}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500"><Headset className="h-4 w-4" /></span>
                  <div><h3 className="text-sm font-semibold">{technician.name}</h3><p className="text-xs text-muted-foreground">{modeLabel}</p></div>
                </div>
                {current && (
                  <div className="mb-3 flex items-start gap-2 text-sm">
                    {working
                      ? <CircleDot className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-emerald-500" />
                      : <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                    <div>
                      <p className="font-medium">{current.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {working ? "atende há" : "parado há"}{" "}
                        <span className="tabular-nums">{elapsedLabel(currentMinutes)}</span>
                      </p>
                      {current.activeLog && (
                        <p className="text-xs text-muted-foreground">
                          desde {sinceLabel(current.activeLog.started_at)}, sem pausa
                        </p>
                      )}
                    </div>
                  </div>
                )}
                {technician.tickets.length > 0 ? (
                  <ul className="space-y-2 border-t border-border/70 pt-3">
                    {technician.tickets.map((ticket) => (
                      <li key={ticket.id} className="flex items-start justify-between gap-3 text-xs">
                        <span className="min-w-0 flex-1">{ticket.title}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-muted-foreground">
                          {statusLabel[ticket.status] || ticket.status} ·{" "}
                          <span className="tabular-nums">
                            {formatMinutes(Math.max(0, Math.floor((now - new Date(ticket.activeLog?.started_at ?? ticket.updated_at).getTime()) / 60000)))}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t border-border/70 pt-3 text-xs text-muted-foreground">Nenhum chamado aberto atribuído.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function TrackMyAutomationRequestsPage() {
  const { user } = useAuth();
  const [activeView, setActiveView] = useState<"tracking" | "developers" | "support">("tracking");
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["my-automation-requests", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("id, title, description, status, priority, sector, created_at")
        .eq("created_by", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-10 text-white">
      <section className="mx-auto w-full max-w-3xl space-y-6">
        <header className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-300/20 bg-sky-400/10 text-sky-200"><ClipboardList className="h-5 w-5" /></span>
          <div><h1 className="text-xl font-semibold">{activeView === "tracking" ? "Acompanhar minhas solicitações" : activeView === "developers" ? "Status dos Desenvolvedores" : "Status dos Suportes/Infra"}</h1><p className="text-sm text-white/60">{activeView === "tracking" ? "Veja o status e as informações enviadas à equipe de TI." : activeView === "developers" ? "Veja quem está desenvolvendo e há quanto tempo." : "Acompanhe os chamados atribuídos a Angel e Sofia."}</p></div>
        </header>

        <nav aria-label="Menu de solicitações" className="flex gap-1 border-b border-border">
          <button type="button" role="tab" aria-selected={activeView === "tracking"} onClick={() => setActiveView("tracking")} className={"border-b-2 px-4 py-3 text-sm transition-colors " + (activeView === "tracking" ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>Acompanhamento</button>
          <button type="button" role="tab" aria-selected={activeView === "developers"} onClick={() => setActiveView("developers")} className={"border-b-2 px-4 py-3 text-sm transition-colors " + (activeView === "developers" ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>Status dos Desenvolvedores</button>
          <button type="button" role="tab" aria-selected={activeView === "support"} onClick={() => setActiveView("support")} className={"border-b-2 px-4 py-3 text-sm transition-colors " + (activeView === "support" ? "border-primary font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>Status dos Suportes/Infra</button>
        </nav>

        {activeView === "support" ? <SupportTechnicianStatusPanel /> : activeView === "developers" ? <DeveloperStatusPanel /> : isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-7 w-7 animate-spin text-sky-300" /></div>
        ) : error ? (
          <p className="rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-200">Não foi possível carregar suas solicitações.</p>
        ) : requests.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/65">Você ainda não enviou solicitações.</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const status = request.status as AutomationStatus;
              return (
                <article key={request.id} className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-card/60 px-4 pb-3.5 pt-4 text-card-foreground shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-primary/40 hover:shadow-md">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-2">
                    <span className={"inline-flex items-center rounded-full px-[7px] py-1 text-[10px] font-bold leading-none text-white " + (STATUS_FILL[status] || "bg-primary")}>{STATUS_LABELS[status] || status}</span>
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{PRIORITY_LABELS[request.priority] || request.priority}</Badge>
                    {request.sector && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{request.sector}</Badge>}
                  </div>
                  <h2 className="mb-2 text-sm font-semibold leading-snug">{request.title}</h2>
                  <p className="mb-3 text-[11px] text-muted-foreground">Enviada em {new Date(request.created_at).toLocaleDateString("pt-BR")}</p>
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline">Ver informações da solicitação</summary>
                    <p className="mt-3 whitespace-pre-wrap border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-muted-foreground">{request.description}</p>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
