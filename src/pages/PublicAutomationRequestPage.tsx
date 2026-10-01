import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, CheckCircle2, AlertTriangle, UserCheck } from "lucide-react";
import { RequestAutomationDialog } from "@/components/automations/RequestAutomationDialog";
import { useIsAutomationRequester } from "@/hooks/useAutomationRequesters";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SECTORS, SECTOR_LABELS } from "@/types/sectors";

type RequestType = "Sistema" | "Automação";

const NO_SECTOR = "__none__";

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

function IdentificationCard({
  email,
  sector,
  onEmailChange,
  onSectorChange,
  onSubmit,
  error,
  loading,
  identified,
  onReset,
}: {
  email: string;
  sector: string;
  onEmailChange: (v: string) => void;
  onSectorChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
  loading: boolean;
  identified: boolean;
  onReset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]">
      <div className="mb-5 flex items-center gap-2.5">
        <UserCheck className="h-5 w-5 text-cyan-200" aria-hidden="true" />
        <h2 className="text-base font-semibold tracking-tight text-white">Identifique-se</h2>
      </div>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="solicitacao-email" className="text-sm text-slate-300">
            e-mail
          </Label>
          <Input
            id="solicitacao-email"
            type="email"
            autoComplete="email"
            placeholder="seu.email@orcoma.com.br"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            aria-invalid={!!error}
            className="border-white/15 bg-[#0b1c30] text-white placeholder:text-slate-500 focus-visible:ring-cyan-300/60"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="solicitacao-setor" className="text-sm text-slate-300">
            Setor:
          </Label>
          <Select value={sector} onValueChange={onSectorChange}>
            <SelectTrigger
              id="solicitacao-setor"
              className="border-white/15 bg-[#0b1c30] text-white focus:ring-cyan-300/60"
            >
              <SelectValue placeholder="Selecione o seu setor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_SECTOR}>Não informado</SelectItem>
              {SECTORS.map((s) => (
                <SelectItem key={s} value={s}>
                  {SECTOR_LABELS[s] ?? s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {error && (
          <p role="alert" className="flex items-start gap-2 text-sm text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <Button
            type="submit"
            disabled={loading}
            className="h-10 bg-cyan-300 px-5 font-semibold text-slate-950 hover:bg-cyan-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Confirmar
          </Button>
          {identified && (
            <Button
              type="button"
              variant="ghost"
              onClick={onReset}
              className="h-10 text-slate-300 hover:bg-white/10 hover:text-white"
            >
              Alterar identificação
            </Button>
          )}
        </div>

        <p className="text-xs leading-relaxed text-slate-400">
          Informe o e-mail com que você acessou o sistema.
        </p>
      </form>
    </section>
  );
}

export default function PublicAutomationRequestPage() {
  const { canRequest, isLoadingRequester } = useIsAutomationRequester();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [cardsVisible, setCardsVisible] = useState(false);

  const [email, setEmail] = useState("");
  const [sector, setSector] = useState<string>(NO_SECTOR);
  const [identified, setIdentified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setCardsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const sessionEmail = (user?.email ?? "").trim().toLowerCase();

  const handleIdentify = () => {
    const typed = email.trim().toLowerCase();
    if (!typed) {
      setError("Informe o seu e-mail para continuar.");
      return;
    }
    if (typed !== sessionEmail) {
      setError("O e-mail informado não é o e-mail da sua conta. Use o e-mail com que você entrou no sistema.");
      return;
    }
    setError(null);
    setIdentified(true);
  };

  const handleReset = () => {
    setIdentified(false);
    setError(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center overflow-hidden bg-[#07111f] px-5 py-12 text-white">
      <section className="flex w-full max-w-5xl flex-col items-center gap-10">
        <IdentificationCard
          email={email}
          sector={sector}
          onEmailChange={(v) => {
            setEmail(v);
            if (error) setError(null);
          }}
          onSectorChange={setSector}
          onSubmit={handleIdentify}
          error={error}
          loading={isLoadingRequester}
          identified={identified}
          onReset={handleReset}
        />

        {!identified ? null : isLoadingRequester ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-200" aria-hidden="true" />
          </div>
        ) : canRequest ? (
          <>
            <h1 className="mb-2 text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Qual tipo de desenvolvimento você deseja?
            </h1>

            <div className="flex items-center gap-2.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              <p className="text-sm font-medium text-emerald-200">
                Você está cadastrado como Solicitante! Bem-vindo(a)!
              </p>
            </div>

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
              <div className="grid w-full gap-5 sm:grid-cols-2">
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
              <div className="flex justify-center">
                <button type="button" onClick={() => navigate("/k7f3q9x2/solicitacoes/acompanhar-minha-solicitacao")} className="cursor-pointer text-sm font-medium text-amber-300 underline-offset-4 transition-colors hover:text-amber-200 hover:underline focus-visible:outline-none focus-visible:underline">
                  Já fez sua solicitação? Clique aqui!
                </button>
              </div>
              </>
            )}
          </>
        ) : (
          <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-amber-300/25 bg-amber-400/[0.07] px-6 py-10 text-center">
            <AlertTriangle className="h-8 w-8 text-amber-300" aria-hidden="true" />
            <p className="text-base font-medium leading-relaxed text-amber-100">
              Você <span className="font-bold uppercase">não</span> está cadastrado como Solicitante do seu setor! Acione um
              Administrador/Desenvolvedor do sistema para te ajudar!
            </p>
          </div>
        )}
      </section>
    </main>
  );
}