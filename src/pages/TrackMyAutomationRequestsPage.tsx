import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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

type DeveloperStatus = {
  id: string | null;
  name: string;
  mode: "developing" | "idle" | "unknown";
  minutes: number | null;
  subject: string | null;
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
            supabase.from("automation_time_logs").select("id, user_id, automation_id, subtask_id, started_at, ended_at").in("user_id", ids).order("started_at", { ascending: false }).limit(500),
            supabase.from("time_logs").select("id, user_id, task_id, started_at, ended_at").in("user_id", ids).order("started_at", { ascending: false }).limit(500),
          ])
        : [{ data: [], error: null }, { data: [], error: null }];
      if (automationLogsResult.error) throw automationLogsResult.error;
      if (taskLogsResult.error) throw taskLogsResult.error;
      const automationLogs = automationLogsResult.data || [];
      const taskLogs = taskLogsResult.data || [];

      const activeAutomationIds = [...new Set(automationLogs.filter((log) => !log.ended_at).map((log) => log.automation_id))];
      const { data: automations, error: automationsError } = activeAutomationIds.length
        ? await supabase.from("automations").select("id, title").in("id", activeAutomationIds)
        : { data: [], error: null };
      if (automationsError) throw automationsError;

      const activeTaskIds = [...new Set(taskLogs.filter((log) => !log.ended_at).map((log) => log.task_id))];
      const { data: tasks, error: tasksError } = activeTaskIds.length
        ? await supabase.from("tasks").select("id, title").in("id", activeTaskIds)
        : { data: [], error: null };
      if (tasksError) throw tasksError;

      const activeSubtaskIds = [...new Set(automationLogs.filter((log) => !log.ended_at && log.subtask_id).map((log) => log.subtask_id!))];
      const { data: subtasks, error: subtasksError } = activeSubtaskIds.length
        ? await supabase.from("automation_subtasks").select("id, title").in("id", activeSubtaskIds)
        : { data: [], error: null };
      if (subtasksError) throw subtasksError;

      const automationTitles = new Map((automations || []).map((automation) => [automation.id, automation.title]));
      const taskTitles = new Map((tasks || []).map((task) => [task.id, task.title]));
      const subtaskTitles = new Map((subtasks || []).map((subtask) => [subtask.id, subtask.title]));
      const now = Date.now();
      return developers.map<DeveloperStatus>((developer) => {
        const id = developer.profile?.id ?? null;
        if (!id) return { id, name: developer.name, mode: "unknown", minutes: null, subject: null };
        const userLogs = [
          ...automationLogs.filter((log) => log.user_id === id),
          ...taskLogs.filter((log) => log.user_id === id),
        ].sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
        const activeLog = userLogs.find((log) => !log.ended_at);
        if (activeLog) {
          const subject = "automation_id" in activeLog
            ? activeLog.subtask_id
              ? subtaskTitles.get(activeLog.subtask_id)
                ? subtaskTitles.get(activeLog.subtask_id) + " — " + (automationTitles.get(activeLog.automation_id) || "automação")
                : automationTitles.get(activeLog.automation_id) || "tarefa técnica em andamento"
              : automationTitles.get(activeLog.automation_id) || "automação em andamento"
            : taskTitles.get(activeLog.task_id) || "tarefa em andamento";
          return {
            id,
            name: developer.name,
            mode: "developing",
            minutes: Math.max(0, Math.floor((now - new Date(activeLog.started_at).getTime()) / 60000)),
            subject,
          };
        }
        const lastFinishedLog = userLogs.find((log) => log.ended_at);
        return {
          id,
          name: developer.name,
          mode: "idle",
          minutes: lastFinishedLog?.ended_at ? Math.max(0, Math.floor((now - new Date(lastFinishedLog.ended_at).getTime()) / 60000)) : null,
          subject: null,
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
            <article key={developer.name} className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-card/60 px-4 pb-4 pt-4 text-card-foreground shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-primary/40 hover:shadow-md">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary"><Code2 className="h-4 w-4" /></span>
                <h3 className="text-sm font-semibold">{developer.name}</h3>
              </div>
              {developer.mode === "developing" ? (
                <div className="flex items-start gap-2 text-sm">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-emerald-500" />
                  <p><span className="font-medium">Está desenvolvendo</span> “{developer.subject}” há {developer.minutes} {developer.minutes === 1 ? "minuto" : "minutos"}.</p>
                </div>
              ) : developer.mode === "idle" ? (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>{developer.minutes === null ? "Ocioso; ainda não há tempo anterior registrado." : <>Está ocioso há {developer.minutes} {developer.minutes === 1 ? "minuto" : "minutos"}.</>}</p>
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

type SupportTechnician = {
  name: string;
  tickets: { id: string; title: string; status: string; updated_at: string }[];
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

      return technicians.map((technician) => ({
        name: technician.name,
        tickets: technician.profile
          ? (tickets || [])
              .filter((ticket) => ticket.assigned_to === technician.profile!.id && !["done", "discarded"].includes(ticket.status))
              .map((ticket) => ({ id: ticket.id, title: ticket.title.replace(/^\[Chamado\]\s*/, ""), status: ticket.status, updated_at: ticket.updated_at }))
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
            const modeLabel = !current ? "Ociosa — sem chamado aberto" : current.status === "in_progress" ? "Atendendo chamado" : current.status === "review" ? "Chamado em validação" : "Com chamado pendente";
            return (
              <article key={technician.name} className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-card/60 px-4 pb-4 pt-4 text-card-foreground shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-primary/40 hover:shadow-md">
                <div className="mb-3 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500"><Headset className="h-4 w-4" /></span>
                  <div><h3 className="text-sm font-semibold">{technician.name}</h3><p className="text-xs text-muted-foreground">{modeLabel}</p></div>
                </div>
                {current && <p className="mb-3 text-sm font-medium">{current.title}</p>}
                {technician.tickets.length > 0 ? (
                  <ul className="space-y-2 border-t border-border/70 pt-3">
                    {technician.tickets.map((ticket) => (
                      <li key={ticket.id} className="flex items-start justify-between gap-3 text-xs">
                        <span className="min-w-0 flex-1">{ticket.title}</span>
                        <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-muted-foreground">{statusLabel[ticket.status] || ticket.status} · {Math.max(0, Math.floor((now - new Date(ticket.updated_at).getTime()) / 60000))} min</span>
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
