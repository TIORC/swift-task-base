import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useSolicitante } from "@/hooks/useSolicitante";
import {
  solicitanteCall,
  type SolicitanteCommentSummary,
  type SolicitanteRequest,
} from "@/lib/solicitacoesApi";
import { Badge } from "@/components/ui/badge";
import { SolicitanteChat } from "@/components/automations/SolicitanteChat";
import { Loader2, ClipboardList, CircleDot, Code2, Headset, MessageSquare, User, MonitorSmartphone, Workflow } from "lucide-react";
import {
  PRIORITY_LABELS,
  STATUS_LABELS,
  MANUAL_PROGRESS_STEPS,
  REQUEST_KIND_BADGE,
  REQUEST_KIND_LABELS,
  computeExecutionPercent,
  progressBand,
  requestKind,
  PROGRESS_BAND_BAR,
  PROGRESS_BAND_TEXT,
  PROGRESS_BAND_TRACK,
} from "@/types/automation";
import type { AutomationStatus } from "@/types/automation";

/** Como o solicitante lê cada um dos marcos que a equipe de TI pode informar. */
const PROGRESS_NOTES: Record<number, string> = {
  0: "A equipe de TI ainda não informou avanço.",
  25: "Execução iniciada pela equipe de TI.",
  50: "Metade da automação concluída.",
  75: "Etapas finais em andamento.",
  100: "Execução concluída.",
};

/** Texto de apoio da barra: o marco correspondente ao percentual informado. */
const progressNote = (percent: number, status: string) => {
  if (status === "completed") return "Solicitação concluída.";
  if (status === "cancelled") return "Solicitação cancelada.";
  return PROGRESS_NOTES[percent] ?? `Andamento informado pela equipe de TI: ${percent}%.`;
};

const STATUS_FILL: Record<string, string> = {
  backlog: "bg-slate-500", analysis: "bg-blue-500", requested: "bg-sky-500",
  waiting_info: "bg-yellow-500", approved: "bg-teal-500", change_requested: "bg-rose-500",
  development: "bg-indigo-500", internal_testing: "bg-amber-500", homologation: "bg-purple-500",
  waiting_user: "bg-orange-500", completed: "bg-emerald-500", blocked: "bg-red-500",
  cancelled: "bg-slate-400",
};

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

const SEE_ALL_ROLES = new Set(["dev", "admin", "gestor"]);

interface StatusEntry {
  id: string;
  name: string;
  working: boolean;
  lastStart: string | null;
  /** Marcado pela Edge Function quando o usuário tem o papel `dev`. */
  dev?: boolean;
}

/**
 * Status dos desenvolvedores via Edge Function (o visitante não tem sessão e
 * a RLS barra anon). A função devolve {id, name, working, lastStart, dev} já
 * calculado no servidor; aqui só formatamos a exibição. `dev: true` identifica
 * quem tem o papel `dev` — só esses entram na aba de desenvolvedores.
 */
function useDeveloperStatuses() {
  return useQuery({
    queryKey: ["solicitante-developer-status"],
    refetchInterval: 15000,
    queryFn: async (): Promise<StatusEntry[]> => {
      const { developers } = await solicitanteCall<{ developers: StatusEntry[] }>("developer-status");
      return developers;
    },
  });
}

function DeveloperStatusPanel() {
  const { data: developers = [], isLoading, error } = useDeveloperStatuses();
  // Só quem tem o papel `dev` (Angel/Sofia/Danicarla ficam de fora). Entradas
  // sem o campo — função ainda não reimplantada — continuam visíveis para a
  // aba não ficar vazia durante o deploy.
  const visibleDevelopers = developers.filter((developer) => developer.dev !== false);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Status dos Desenvolvedores</h2>
        <p className="text-xs text-muted-foreground">Atualização automática.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar o status dos desenvolvedores.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleDevelopers.map((developer) => (
            <article key={developer.id} className={`${STATUS_CARD_BASE} ${
              developer.working ? STATUS_CARD_BORDER.working : STATUS_CARD_BORDER.stopped
            }`}>
              <div className="mb-4 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary"><Code2 className="h-4 w-4" /></span>
                <h3 className="text-sm font-semibold">{developer.name}</h3>
              </div>
              {developer.working ? (
                <div className="flex items-start gap-2 text-sm">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-emerald-500" />
                  <div>
                    <p><span className="font-medium">Em desenvolvimento</span>.</p>
                    {developer.lastStart && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        desde {sinceLabel(developer.lastStart)}, sem pausa
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p>Parado no momento.</p>
                    {developer.lastStart && (
                      <p className="mt-1 text-xs text-muted-foreground/80">
                        Última atividade em {sinceLabel(developer.lastStart)}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

type SupportTechnician = {
  id: string;
  name: string;
  working: boolean;
  lastStart: string | null;
};

function useSupportTechnicianStatuses() {
  return useQuery({
    queryKey: ["solicitante-support-status"],
    refetchInterval: 15000,
    queryFn: async (): Promise<SupportTechnician[]> => {
      const { technicians } = await solicitanteCall<{ technicians: SupportTechnician[] }>("support-status");
      return technicians;
    },
  });
}

function SupportTechnicianStatusPanel() {
  const { data: technicians = [], isLoading, error } = useSupportTechnicianStatuses();

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Status dos Suportes/Infra</h2>
        <p className="text-xs text-muted-foreground">Disponibilidade da equipe, atualizada automaticamente.</p>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : error ? (
        <p className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">Não foi possível carregar os chamados dos técnicos.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {technicians.map((technician) => (
            <article key={technician.id} className={`${STATUS_CARD_BASE} ${technician.working ? STATUS_CARD_BORDER.working : STATUS_CARD_BORDER.stopped}`}>
              <div className="mb-3 flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-500"><Headset className="h-4 w-4" /></span>
                <div>
                  <h3 className="text-sm font-semibold">{technician.name}</h3>
                  <p className="text-xs text-muted-foreground">{technician.working ? "Atendendo chamado" : "Sem atendimento no momento"}</p>
                </div>
              </div>
              <div className="flex items-start gap-2 text-sm">
                {technician.working
                  ? <CircleDot className="mt-0.5 h-4 w-4 shrink-0 animate-pulse text-emerald-500" />
                  : <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
                <div>
                  <p className="text-muted-foreground">
                    {technician.working ? "com o cronômetro ligado" : "cronômetro desligado"}
                    {technician.lastStart && <> · desde {sinceLabel(technician.lastStart)}</>}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Barra de andamento da solicitação. O valor vem de `progress_percent`, o mesmo
 * campo que a equipe de TI ajusta em /automacoes — o solicitante vê exatamente
 * o percentual informado por ela, sem nenhum cálculo paralelo.
 */
function RequestProgress({ percent, status }: { percent: number; status: string }) {
  const band = progressBand(percent);
  return (
    <div className="mb-3 rounded-lg border border-white/10 bg-white/5 p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] text-white/60">
        <span className="flex min-w-0 items-center gap-1">
          <Code2 className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">Andamento da automação</span>
        </span>
        <b className={`shrink-0 text-sm font-bold tabular-nums ${PROGRESS_BAND_TEXT[band]}`}>{percent}%</b>
      </div>
      <div className={`relative h-2.5 overflow-hidden rounded-full m-progress-track ${PROGRESS_BAND_TRACK[band]}`}>
        <div className={`m-progress-fill h-full rounded-full ${PROGRESS_BAND_BAR[band]}`} style={{ width: `${percent}%` }} />
        {MANUAL_PROGRESS_STEPS.filter((step) => step > 0 && step < 100).map((step) => (
          <span key={step} aria-hidden className="absolute top-0 h-full w-px bg-white/25" style={{ left: `${step}%` }} />
        ))}
      </div>
      <p className="mt-1.5 text-[10px] text-white/50">{progressNote(percent, status)}</p>
    </div>
  );
}

export default function TrackMyAutomationRequestsPage() {
  // Sem useAuth: a identidade aqui é o token do solicitante (sessionStorage).
  // Sem token válido, a tela pede a identificação — nunca /auth.
  const { solicitante, isLoadingSolicitante } = useSolicitante();
  const isTeamMember = !!solicitante && solicitante.role != null && SEE_ALL_ROLES.has(solicitante.role);
  const [activeView, setActiveView] = useState<"tracking" | "developers" | "support">("tracking");
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["solicitante-requests", solicitante?.id],
    enabled: !!solicitante?.id,
    // A equipe de TI atualiza o percentual em /automacoes; a cada 30s esta tela
    // busca o valor atual para que o solicitante veja a mudança sem recarregar.
    refetchInterval: 30000,
    queryFn: async (): Promise<SolicitanteRequest[]> => {
      const { requests } = await solicitanteCall<{ requests: SolicitanteRequest[] }>("list");
      return requests;
    },
  });

  // Último comentário de cada solicitação: alimenta o aviso de mensagem nova no
  // botão do chat sem abrir uma conversa por card. Via função, filtrado pelo
  // solicitante — nunca vaza conversa de outra pessoa.
  const { data: commentSummaries } = useQuery({
    queryKey: ["solicitante-comments", "summaries", requests.map((r) => r.id).sort().join(",")],
    enabled: requests.length > 0,
    refetchInterval: 20000,
    queryFn: async (): Promise<Record<string, SolicitanteCommentSummary>> => {
      const { summaries } = await solicitanteCall<{ summaries: Record<string, SolicitanteCommentSummary> }>(
        "comments:list",
        { automation_ids: requests.map((r) => r.id) },
      );
      return summaries;
    },
  });

  // Nome do responsável, para o cabeçalho da conversa.
  // Vem junto dos status (a função devolve os nomes) — sem consulta direta.
  const { data: teamNames = {} } = useQuery({
    queryKey: ["solicitante-team-names"],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const [{ developers }, { technicians }] = await Promise.all([
        solicitanteCall<{ developers: StatusEntry[] }>("developer-status"),
        solicitanteCall<{ technicians: StatusEntry[] }>("support-status"),
      ]);
      return Object.fromEntries([...developers, ...technicians].map((d) => [d.id, d.name]));
    },
  });
  const assigneeName: Record<string, string> = teamNames;

  return (
    <main className="min-h-screen bg-[#07111f] px-5 py-10 text-white">
      <section className="mx-auto w-full max-w-3xl space-y-6">
          <header className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl border border-sky-300/20 bg-sky-400/10 text-sky-200"><ClipboardList className="h-5 w-5" /></span>
          <div><h1 className="text-xl font-semibold">{activeView === "tracking" ? (isTeamMember ? "Acompanhar todas as solicitações" : "Acompanhar minhas solicitações") : activeView === "developers" ? "Status dos Desenvolvedores" : "Status dos Suportes/Infra"}</h1><p className="text-sm text-white/60">{activeView === "tracking" ? (isTeamMember ? "Veja o status de todas as solicitações e o percentual de andamento informado à equipe de TI." : "Veja o status, o percentual de andamento e as informações enviadas à equipe de TI.") : activeView === "developers" ? "Veja quem está desenvolvendo e há quanto tempo." : "Acompanhe os chamados atribuídos a Angel e Sofia."}</p></div>
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
          <p className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm text-white/65">{isTeamMember ? "Nenhuma solicitação no momento." : "Você ainda não enviou solicitações."}</p>
        ) : (
          <div className="space-y-4">
            {requests.map((request) => {
              const status = request.status as AutomationStatus;
              const percent = computeExecutionPercent(request);
              const latest = commentSummaries?.[request.id];
              const assignee = request.assigned_to ? assigneeName[request.assigned_to] : null;
              const kind = requestKind(request.request_kind);
              return (
                <article key={request.id} className="group relative overflow-hidden rounded-lg border border-border bg-gradient-to-b from-card to-card/60 px-4 pb-3.5 pt-4 text-card-foreground shadow-[0_8px_24px_-16px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.03)] transition-all duration-200 hover:border-primary/40 hover:shadow-md">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 pr-2">
                    <span className={"inline-flex items-center rounded-full px-[7px] py-1 text-[10px] font-bold leading-none text-white " + (STATUS_FILL[status] || "bg-primary")}>{STATUS_LABELS[status] || status}</span>
                    {kind && (
                      <span className={"inline-flex items-center gap-1 rounded-full border px-[7px] py-1 text-[10px] font-semibold leading-none " + REQUEST_KIND_BADGE[kind]}>
                        {kind === "Sistema" ? <MonitorSmartphone className="h-2.5 w-2.5" /> : <Workflow className="h-2.5 w-2.5" />}
                        {REQUEST_KIND_LABELS[kind]}
                      </span>
                    )}
                    <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{PRIORITY_LABELS[request.priority] || request.priority}</Badge>
                    {request.sector && <Badge variant="outline" className="px-1.5 py-0 text-[10px]">{request.sector}</Badge>}
                  </div>
                  <h2 className="mb-2 text-sm font-semibold leading-snug">{request.title}</h2>
                  <p className="mb-1 text-[11px] text-muted-foreground">
                    Enviada em {new Date(request.created_at).toLocaleDateString("pt-BR")}
                    {request.updated_at && request.updated_at !== request.created_at && (
                      <> · atualizada {formatDistanceToNow(new Date(request.updated_at), { locale: ptBR, addSuffix: true })}</>
                    )}
                  </p>
                  {/* Quem pegou a solicitação: a pessoa que responde no chat de /automacoes. */}
                  <p className="mb-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <User className="h-3 w-3 shrink-0" />
                    <span>Responsável:</span>
                    {assignee ? (
                      <b className="font-semibold text-white/85">{assignee}</b>
                    ) : (
                      <span className="text-white/50">ainda não atribuído</span>
                    )}
                  </p>
                  <RequestProgress percent={percent} status={status} />
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setOpenChatId(openChatId === request.id ? null : request.id)}
                      aria-expanded={openChatId === request.id}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-white/80 transition-colors hover:border-sky-300/40 hover:text-white"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Conversar com os Desenvolvedores
                      {latest && <span className="tabular-nums text-white/45">({latest.total})</span>}
                      {/* Mensagem da última mensagem é da equipe: alguém respondeu. */}
                      {latest && latest.lastAuthor !== solicitante?.id && (
                        <span className="ml-0.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                      )}
                    </button>
                    {latest && (
                      <span className="truncate text-[10px] text-white/40">
                        {latest.lastAuthor === solicitante?.id ? "Você: " : `${latest.lastAuthorName ?? "Equipe de TI"}: `}
                        {latest.lastContent}
                      </span>
                    )}
                  </div>
                  {openChatId === request.id && (
                    <div className="mb-3">
                      <SolicitanteChat
                        automationId={request.id}
                        counterpartName={request.assigned_to ? assigneeName[request.assigned_to] ?? null : null}
                      />
                    </div>
                  )}
                  <details>
                    <summary className="cursor-pointer text-xs font-medium text-primary underline-offset-4 hover:underline">Ver informações da solicitação</summary>
                    <p className="mt-3 whitespace-pre-wrap border-l-2 border-primary/40 pl-3 text-xs leading-relaxed text-muted-foreground">{request.description}</p>
                  </details>
                </article>
              );
            })}
          </div>
        )}

        {/* Sem identificação válida, a tela volta para a "Identifique-se". */}
        {!isLoadingSolicitante && !solicitante && (
          <section className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]">
            <p className="text-sm font-medium text-white">Identifique-se para acompanhar suas solicitações</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Informe o e-mail cadastrado como solicitante do seu setor.
            </p>
            <a
              href="/k7f3q9x2/solicitacoes"
              className="mt-4 inline-block rounded-lg bg-amber-300 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-200"
            >
              Ir para Identifique-se
            </a>
          </section>
        )}
      </section>
    </main>
  );
}

