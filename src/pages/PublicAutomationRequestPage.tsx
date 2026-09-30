import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RequestAutomationDialog } from "@/components/automations/RequestAutomationDialog";
import { useIsAutomationRequester } from "@/hooks/useAutomationRequesters";

type RequestType = "Sistema" | "Automação";

function SystemsArtwork() {
  return (
    <svg viewBox="0 0 360 220" aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 h-52 w-80 opacity-[0.22] transition-transform duration-500 group-hover:scale-105">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="132" y="54" width="105" height="66" rx="8" />
        <path d="M148 72h73M148 84h48M148 96h62M184 120v24m-24 0h48" />
        <rect x="46" y="104" width="48" height="38" rx="6" />
        <rect x="264" y="103" width="48" height="38" rx="6" />
        <path d="M94 123h38m105 0h27M70 104V78h62m130 25V78h-25" />
        <circle cx="70" cy="78" r="4" fill="currentColor" />
        <circle cx="290" cy="78" r="4" fill="currentColor" />
        <circle cx="184" cy="164" r="12" />
        <path d="M184 152v-8m-8 20-8 5m24-5 8 5" />
      </g>
      <g fill="currentColor"><circle cx="112" cy="123" r="3"/><circle cx="248" cy="123" r="3"/><circle cx="184" cy="40" r="3"/></g>
    </svg>
  );
}

function AutomationArtwork() {
  return (
    <svg viewBox="0 0 360 220" aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 h-52 w-80 opacity-[0.22] transition-transform duration-500 group-hover:scale-105">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="46" y="52" width="70" height="38" rx="9" />
        <rect x="244" y="52" width="70" height="38" rx="9" />
        <rect x="145" y="145" width="70" height="38" rx="9" />
        <path d="M116 71h46a18 18 0 0 1 18 18v56m66-74h-46a18 18 0 0 0-18 18v56M180 109v16" />
        <path d="m173 119 7 7 7-7" />
        <circle cx="81" cy="71" r="7" /><circle cx="279" cy="71" r="7" />
        <path d="M81 71h.1M279 71h.1M166 164h28m-14-8v16" />
        <path d="M48 120h48m-40 10h32m176-10h48m-40 10h32" strokeDasharray="3 6" />
      </g>
      <g fill="currentColor"><circle cx="180" cy="108" r="4"/><circle cx="127" cy="71" r="3"/><circle cx="233" cy="71" r="3"/></g>
    </svg>
  );
}

export default function PublicAutomationRequestPage() {
  const { canRequest, isLoadingRequester } = useIsAutomationRequester();
  const navigate = useNavigate();
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [cardsVisible, setCardsVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setCardsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  if (isLoadingRequester || !canRequest) return null;

  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-[#07111f] px-5 py-12 text-white">
      <section className="w-full max-w-5xl">
        <h1 className="mb-10 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          Qual tipo de desenvolvimento você deseja?
        </h1>

        {requestType ? (
          <RequestAutomationDialog
            key={requestType}
            openOnMount
            hideTrigger
            requestType={requestType}
            onClose={() => setRequestType(null)}
            onSubmitted={() => navigate("/k7f3q9x2/solicitacoes/acompanhar-minha-solicitacao", { replace: true })}
          />
        ) : (
          <>
          <div className="grid gap-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setRequestType("Sistema")}
              className={`group relative flex min-h-64 items-end overflow-hidden rounded-2xl border border-cyan-300/20 bg-gradient-to-br from-[#122d48] via-[#10263d] to-[#101b30] p-7 text-left shadow-[0_24px_70px_-35px_rgba(34,211,238,0.4)] transition-[opacity,transform,border-color,box-shadow] duration-700 ease-out hover:-translate-y-1 hover:border-cyan-200/50 hover:shadow-[0_30px_80px_-35px_rgba(34,211,238,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 ${cardsVisible ? "translate-y-0 opacity-100" : "-translate-y-8 opacity-0"}`}
            >
              <span role="note" tabIndex={0} onClick={(e) => e.stopPropagation()} title="Sistema é uma ferramenta completa, com telas, menus e funções, que as pessoas abrem e usam. Tem vida própria e alguém interage com ele o tempo todo. Exemplos: Feedz, Excel, WhatsApp e aplicativos de bancos." className="absolute right-4 top-4 z-20 grid h-8 w-8 cursor-help place-items-center rounded-full border border-cyan-200/50 bg-[#0b1c30]/90 text-sm font-bold text-cyan-200 shadow-lg transition after:absolute after:-inset-1 after:rounded-full after:border after:border-dashed after:border-cyan-200/70 after:content-[''] after:motion-safe:animate-[spin_5s_linear_infinite] hover:bg-cyan-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200">!</span>
              <SystemsArtwork />
              <span className="absolute inset-0 bg-gradient-to-t from-[#07111f]/70 via-transparent to-transparent" />
              <span className="relative z-10 text-xl font-bold tracking-[0.16em] sm:text-2xl">SISTEMAS</span>
            </button>

            <button
              type="button"
              onClick={() => setRequestType("Automação")}
              className={`group relative flex min-h-64 items-end overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-br from-[#29234d] via-[#201e40] to-[#111a32] p-7 text-left shadow-[0_24px_70px_-35px_rgba(167,139,250,0.4)] transition-[opacity,transform,border-color,box-shadow] duration-700 ease-out delay-150 hover:-translate-y-1 hover:border-violet-200/50 hover:shadow-[0_30px_80px_-35px_rgba(167,139,250,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${cardsVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
            >
              <span role="note" tabIndex={0} onClick={(e) => e.stopPropagation()} title="Automação é uma tarefa específica que passa a ser feita sozinha, sem a pessoa precisar fazer na mão. Normalmente roda em segundo plano, disparada por um evento ou por um horário, e faz um trabalho repetitivo. Exemplos: Robô do DTE, Demonstrativo de Tributos e Alíquota ISS." className="absolute right-4 top-4 z-20 grid h-8 w-8 cursor-help place-items-center rounded-full border border-violet-200/50 bg-[#17142c]/90 text-sm font-bold text-violet-200 shadow-lg transition after:absolute after:-inset-1 after:rounded-full after:border after:border-dashed after:border-violet-200/70 after:content-[''] after:motion-safe:animate-[spin_5s_linear_infinite] hover:bg-violet-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">!</span>
              <AutomationArtwork />
              <span className="absolute inset-0 bg-gradient-to-t from-[#0b1020]/75 via-transparent to-transparent" />
              <span className="relative z-10 max-w-xs text-xl font-bold leading-tight tracking-[0.12em] sm:text-2xl">AUTOMAÇÃO DE PROCESSOS</span>
            </button>
          </div>
          <div className="mt-8 flex justify-center">
            <button type="button" onClick={() => navigate("/k7f3q9x2/solicitacoes/acompanhar-minha-solicitacao")} className="cursor-pointer text-sm font-medium text-amber-300 underline-offset-4 transition-colors hover:text-amber-200 hover:underline focus-visible:outline-none focus-visible:underline">
              Já fez sua solicitação? Clique aqui!
            </button>
          </div>
          </>
        )}
      </section>
    </main>
  );
}
