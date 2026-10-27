import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertTriangle, UserCheck } from "lucide-react";
import { RequestAutomationDialog } from "@/components/automations/RequestAutomationDialog";
import { useSolicitante } from "@/hooks/useSolicitante";
import { useTypewriter } from "@/hooks/useTypewriter";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAutomations } from "@/hooks/useAutomationsData";

type RequestType = "Sistema" | "Automação";

const NO_SECTOR = "__none__";

// Animações dos desenhos: o traço se desenha quando o card aparece,
// os pontos pulsam e as linhas tracejadas "correm" em loop.
const drawIn = (visible: boolean, delay = 0) => ({
  initial: { pathLength: 0, opacity: 0 },
  animate: visible ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 },
  transition: { duration: 1.2, delay, ease: "easeInOut" as const },
});

const pulseDot = (visible: boolean, delay = 0) => ({
  initial: { opacity: 0 },
  animate: visible ? { opacity: [0.2, 1, 0.2] } : { opacity: 0 },
  transition: { duration: 2.4, delay, repeat: Infinity, ease: "easeInOut" as const },
});

const flowDash = {
  initial: { strokeDashoffset: 0 },
  animate: { strokeDashoffset: -18 },
  transition: { duration: 1.5, repeat: Infinity, ease: "linear" as const },
};

function SystemsArtwork({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 360 220" aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 h-52 w-80 opacity-[0.22] transition-transform duration-500 group-hover:scale-105">
      <g fill="none" stroke="currentColor" strokeWidth="1.5">
        <motion.rect x="132" y="54" width="105" height="66" rx="8" {...drawIn(visible, 0)} />
        <motion.path d="M148 72h73M148 84h48M148 96h62M184 120v24m-24 0h48" {...drawIn(visible, 0.4)} />
        <motion.rect x="46" y="104" width="48" height="38" rx="6" {...drawIn(visible, 0.2)} />
        <motion.rect x="264" y="103" width="48" height="38" rx="6" {...drawIn(visible, 0.2)} />
        <motion.path d="M94 123h38m105 0h27M70 104V78h62m130 25V78h-25" {...drawIn(visible, 0.6)} />
        <motion.circle cx="70" cy="78" r="4" fill="currentColor" {...pulseDot(visible, 0)} />
        <motion.circle cx="290" cy="78" r="4" fill="currentColor" {...pulseDot(visible, 0.8)} />
        <motion.circle cx="184" cy="164" r="12" {...drawIn(visible, 0.8)} />
        <motion.path d="M184 152v-8m-8 20-8 5m24-5 8 5" {...drawIn(visible, 1)} />
      </g>
      <g fill="currentColor">
        <motion.circle cx="112" cy="123" r="3" {...pulseDot(visible, 0.4)} />
        <motion.circle cx="248" cy="123" r="3" {...pulseDot(visible, 1.2)} />
        <motion.circle cx="184" cy="40" r="3" {...pulseDot(visible, 1.6)} />
      </g>
    </svg>
  );
}

function MaintenanceArtwork({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 360 220" aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 h-52 w-80 opacity-[0.22] transition-transform duration-500 group-hover:scale-105">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <motion.rect x="200" y="40" width="120" height="78" rx="8" {...drawIn(visible, 0)} />
        <motion.path d="M200 66h120" {...drawIn(visible, 0.3)} />
        <motion.path d="M216 52h.1M226 52h.1" {...drawIn(visible, 0.5)} />
        <motion.path d="M240 118v16m40-16v16M226 134h68" {...drawIn(visible, 0.4)} />
        {/* Engrenagem girando em torno do próprio centro (102, 150) */}
        <motion.g
          style={{ transformBox: "view-box", transformOrigin: "102px 150px" }}
          animate={visible ? { rotate: 360 } : { rotate: 0 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        >
          <motion.circle cx="102" cy="150" r="22" {...drawIn(visible, 0.6)} />
          <motion.circle cx="102" cy="150" r="8" {...drawIn(visible, 0.8)} />
          <motion.path d="M102 120v-10m0 70v-10m-30-30h-10m70 0h10m-49-21-7-7m63 63 7 7m0-63-7 7m-63 63-7 7" {...drawIn(visible, 0.8)} />
        </motion.g>
        <motion.path
          d="M46 52h44m-44 14h30m-30 14h18"
          strokeDasharray="3 6"
          {...flowDash}
        />
      </g>
    </svg>
  );
}

function AutomationArtwork({ visible }: { visible: boolean }) {
  return (
    <svg viewBox="0 0 360 220" aria-hidden="true" className="pointer-events-none absolute -right-5 -top-6 h-52 w-80 opacity-[0.22] transition-transform duration-500 group-hover:scale-105">
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <motion.rect x="46" y="52" width="70" height="38" rx="9" {...drawIn(visible, 0)} />
        <motion.rect x="244" y="52" width="70" height="38" rx="9" {...drawIn(visible, 0.2)} />
        <motion.rect x="145" y="145" width="70" height="38" rx="9" {...drawIn(visible, 0.8)} />
        <motion.path d="M116 71h46a18 18 0 0 1 18 18v56m66-74h-46a18 18 0 0 0-18 18v56M180 109v16" {...drawIn(visible, 0.4)} />
        <motion.path d="m173 119 7 7 7-7" {...drawIn(visible, 1)} />
        <motion.circle cx="81" cy="71" r="7" {...drawIn(visible, 0.1)} />
        <motion.circle cx="279" cy="71" r="7" {...drawIn(visible, 0.3)} />
        <motion.path d="M81 71h.1M279 71h.1M166 164h28m-14-8v16" {...drawIn(visible, 1)} />
        <motion.path d="M48 120h48m-40 10h32m176-10h48m-40 10h32" strokeDasharray="3 6" {...flowDash} />
      </g>
      <g fill="currentColor">
        <motion.circle cx="180" cy="108" r="4" {...pulseDot(visible, 0.5)} />
        <motion.circle cx="127" cy="71" r="3" {...pulseDot(visible, 1)} />
        <motion.circle cx="233" cy="71" r="3" {...pulseDot(visible, 1.5)} />
      </g>
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
}: {
  email: string;
  sector: string;
  onEmailChange: (v: string) => void;
  onSectorChange: (v: string) => void;
  onSubmit: () => void;
  error: string | null;
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
            className="h-10 bg-cyan-300 px-5 font-semibold text-slate-950 hover:bg-cyan-200"
          >
            Confirmar
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-slate-400">
          Informe o e-mail cadastrado como solicitante do seu setor.
        </p>
      </form>
    </section>
  );
}

/**
 * Etapas do fluxo: identificar (tela "Identifique-se") -> checking (validação
 * no SERVIDOR) -> unlocked. "denied" ficou sem uso: e-mail não cadastrado
 * volta para "identify" com a mensagem "E-mail não cadastrado como
 * solicitante" — nada é liberado.
 */

function WelcomeBanner({ message }: { message: string }) {
  const { typed, done } = useTypewriter(message);

  return (
    <div className="flex items-center gap-2.5 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2">
      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
      <p className="text-sm font-medium text-emerald-200">
        <span>{typed}</span>
        {done ? null : (
          <span
            aria-hidden="true"
            className="ml-0.5 inline-block h-[1.05em] w-px translate-y-[0.18em] animate-pulse bg-emerald-300/80 motion-reduce:hidden"
          />
        )}
      </p>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex w-full max-w-2xl flex-col items-center gap-4 rounded-2xl border border-amber-300/25 bg-amber-400/[0.07] px-6 py-10 text-center">
      <AlertTriangle className="h-8 w-8 text-amber-300" aria-hidden="true" />
      <p className="text-base font-medium leading-relaxed text-amber-100">
        Você <span className="font-bold uppercase">não</span> está cadastrado como Solicitante do seu setor! Acione um
        Administrador/Desenvolvedor do sistema para te ajudar!
      </p>
    </div>
  );
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  lider: "Líder",
  dev: "Desenvolvedor",
  member: "Membro (Gestão)",
  suporte: "Suporte TI",
};

/** Etapas do fluxo: identificar -> conferir cadastro -> liberado/bloqueado. */
type Stage = "identify" | "checking" | "unlocked" | "denied";

export default function PublicAutomationRequestPage() {
  const navigate = useNavigate();
  // Identificação do solicitante via SERVIDOR (Edge Function "solicitacoes").
  // Aqui não existe sessão do Supabase Auth: quem confere o e-mail contra a
  // tabela de solicitantes é a função, que devolve o token curto.
  const { solicitante, isLoadingSolicitante, identify } = useSolicitante();
  const [requestType, setRequestType] = useState<RequestType | null>(null);
  const [cardsVisible, setCardsVisible] = useState(false);
  // Manutenção: escolhe o sistema existente antes de abrir o formulário.
  const [systemPickerOpen, setSystemPickerOpen] = useState(false);
  const [manualSystemName, setManualSystemName] = useState("");
  const [maintenanceSystem, setMaintenanceSystem] = useState<string | null>(null);
  // Sistemas = automações cadastradas em /automacoes (qualquer status) do setor do solicitante, sem repetir o título.
  // Equipe (dev/admin/gestor) vê os sistemas de todos os setores, igual à função "solicitacoes".
  const { data: automationsList = [], isLoading: isLoadingSystems } = useAutomations();
  const seesAllSystems = !!solicitante?.role && ["dev", "admin", "gestor"].includes(solicitante.role);
  const existingSystems = [...new Set(automationsList.filter((a) => seesAllSystems || (!!solicitante?.sector && a.sector === solicitante.sector)).map((a) => a.title))]
    .sort((x, y) => x.localeCompare(y, "pt-BR"))
    .map((name) => ({ id: name, name }));

  const [email, setEmail] = useState("");
  const [sector, setSector] = useState<string>(NO_SECTOR);
  const [stage, setStage] = useState<Stage>("identify");
  const [error, setError] = useState<string | null>(null);

  // Se já existe identificação válida em sessionStorage, pula a tela.
  useEffect(() => {
    if (!isLoadingSolicitante && solicitante) setStage("unlocked");
  }, [isLoadingSolicitante, solicitante]);

  const handleIdentify = async () => {
    const typed = email.trim();
    if (!typed) {
      setError("Informe o seu e-mail para continuar.");
      return;
    }
    setError(null);
    setStage("checking");
    try {
      const identity = await identify.mutateAsync(typed);
      if (sector !== NO_SECTOR && sector !== identity.sector) {
        // O setor escolhido é só conferência visual; o que vale é a whitelist.
      }
      setStage("unlocked");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível validar o e-mail.";
      // Mensagem de "não cadastrado" vem do servidor (403); o resto é erro técnico.
      setError(/não cadastrado como solicitante/i.test(message) ? message : message);
      setStage("identify");
    }
  };

  // Anima a entrada dos cards só no momento em que eles aparecem.
  useEffect(() => {
    if (stage !== "unlocked") return;
    const frame = requestAnimationFrame(() => setCardsVisible(true));
    return () => cancelAnimationFrame(frame);
  }, [stage]);

  return (
    <main className="flex min-h-screen flex-col items-center overflow-hidden bg-[#07111f] px-5 py-12 text-white">
      <section className="flex w-full max-w-5xl flex-col items-center gap-10">
        {stage === "identify" ? (
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
          />
        ) : stage === "checking" ? (
          <div className="flex min-h-[40vh] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-200" aria-hidden="true" />
          </div>
        ) : stage === "denied" ? (
          <AccessDenied />
        ) : (
          <>
            <div className="flex flex-col items-center gap-4">
              <WelcomeBanner
                message={
                  solicitante?.role && ROLE_LABELS[solicitante.role]
                    ? `Você está cadastrado como ${ROLE_LABELS[solicitante.role]}! Bem-vindo(a)!`
                    : "Você está cadastrado como Solicitante! Bem-vindo(a)!"
                }
              />

              <h1 className="text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                Qual tipo de desenvolvimento você deseja?
              </h1>
            </div>

            {requestType ? (
              <RequestAutomationDialog
                key={maintenanceSystem ?? requestType}
                openOnMount
                hideTrigger
                requestType={requestType}
                maintenanceSystem={maintenanceSystem ?? undefined}
                solicitanteEmail={solicitante?.email ?? email}
                solicitanteSector={solicitante?.sector ?? (sector === NO_SECTOR ? "" : sector)}
                onClose={() => {
                  setRequestType(null);
                  setMaintenanceSystem(null);
                }}
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
                  <SystemsArtwork visible={cardsVisible} />
                  <span className="absolute inset-0 bg-gradient-to-t from-[#07111f]/70 via-transparent to-transparent" />
                  <span className="relative z-10 text-xl font-bold tracking-[0.16em] sm:text-2xl">SISTEMAS</span>
                </button>

                <button
                  type="button"
                  onClick={() => setRequestType("Automação")}
                  className={`group relative flex min-h-64 items-end overflow-hidden rounded-2xl border border-violet-300/20 bg-gradient-to-br from-[#29234d] via-[#201e40] to-[#111a32] p-7 text-left shadow-[0_24px_70px_-35px_rgba(167,139,250,0.4)] transition-[opacity,transform,border-color,box-shadow] duration-700 ease-out delay-150 hover:-translate-y-1 hover:border-violet-200/50 hover:shadow-[0_30px_80px_-35px_rgba(167,139,250,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${cardsVisible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"}`}
                >
                  <span role="note" tabIndex={0} onClick={(e) => e.stopPropagation()} title="Automação é uma tarefa específica que passa a ser feita sozinha, sem a pessoa precisar fazer na mão. Normalmente roda em segundo plano, disparada por um evento ou por um horário, e faz um trabalho repetitivo. Exemplos: Robô do DTE, Demonstrativo de Tributos e Alíquota ISS." className="absolute right-4 top-4 z-20 grid h-8 w-8 cursor-help place-items-center rounded-full border border-violet-200/50 bg-[#17142c]/90 text-sm font-bold text-violet-200 shadow-lg transition after:absolute after:-inset-1 after:rounded-full after:border after:border-dashed after:border-violet-200/70 after:content-[''] after:motion-safe:animate-[spin_5s_linear_infinite] hover:bg-violet-400 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-200">!</span>
                  <AutomationArtwork visible={cardsVisible} />
                  <span className="absolute inset-0 bg-gradient-to-t from-[#0b1020]/75 via-transparent to-transparent" />
                  <span className="relative z-10 max-w-xs text-xl font-bold leading-tight tracking-[0.12em] sm:text-2xl">AUTOMAÇÃO DE PROCESSOS</span>
                </button>
              </div>
              <div className="flex w-full justify-center">
                <button
                  type="button"
                  onClick={() => setSystemPickerOpen(true)}
                  className={`group relative flex min-h-64 w-full cursor-pointer items-end overflow-hidden rounded-2xl border border-red-400/20 bg-gradient-to-br from-[#4a1a22] via-[#3a1419] to-[#2a0d12] p-7 text-left shadow-[0_24px_70px_-35px_rgba(220,38,38,0.45)] transition-[opacity,transform,border-color,box-shadow] duration-700 ease-out delay-300 hover:-translate-y-1 hover:border-red-300/50 hover:shadow-[0_30px_80px_-35px_rgba(220,38,38,0.6)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 sm:w-[calc(50%-0.625rem)] ${cardsVisible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"}`}
                >
                  <MaintenanceArtwork visible={cardsVisible} />
                  <span className="absolute inset-0 bg-gradient-to-t from-[#07111f]/70 via-transparent to-transparent" />
                  <span className="relative z-10 max-w-xs text-xl font-bold uppercase leading-tight tracking-[0.12em] text-slate-300 sm:text-2xl">Modificação de Sistema</span>
                </button>

                <Dialog open={systemPickerOpen} onOpenChange={setSystemPickerOpen}>
                  <DialogContent className="max-w-2xl border-red-400/40 bg-[#2a0d12] text-white">
                    <DialogHeader>
                      <DialogTitle className="text-red-300">Qual sistema você deseja alterar?</DialogTitle>
                      <DialogDescription className="text-slate-300">Escolha o sistema que precisa de manutenção.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] space-y-2 overflow-y-auto [scrollbar-color:#7f1d1d_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-red-800 [&::-webkit-scrollbar-thumb:hover]:bg-red-700">
                      {isLoadingSystems ? (
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-red-300" aria-hidden="true" />
                      ) : existingSystems.length === 0 ? (
                        <p className="py-4 text-center text-sm text-slate-400">Nenhum sistema cadastrado.</p>
                      ) : (
                        existingSystems.map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setMaintenanceSystem(s.name);
                              setRequestType("Sistema");
                              setSystemPickerOpen(false);
                            }}
                            className="w-full rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-left text-sm font-medium text-white transition-colors hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                          >
                            {s.name}
                          </button>
                        ))
                      )}
                    </div>
                    <form
                      className="space-y-2 border-t border-red-400/30 pt-4"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const name = manualSystemName.trim();
                        if (!name) return;
                        setMaintenanceSystem(name);
                        setRequestType("Sistema");
                        setManualSystemName("");
                        setSystemPickerOpen(false);
                      }}
                    >
                      <label htmlFor="manual-system-name" className="text-sm font-medium text-slate-300">
                        Não achou seu sistema? Digite ele aqui
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="manual-system-name"
                          type="text"
                          value={manualSystemName}
                          onChange={(e) => setManualSystemName(e.target.value)}
                          placeholder="Nome do sistema"
                          className="min-w-0 flex-1 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-2.5 text-sm text-white placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        />
                        <button
                          type="submit"
                          disabled={!manualSystemName.trim()}
                          className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                        >
                          Continuar
                        </button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="flex justify-center">
                <button type="button" onClick={() => navigate("/k7f3q9x2/solicitacoes/acompanhar-minha-solicitacao")} className="cursor-pointer text-sm font-medium text-amber-300 underline-offset-4 transition-colors hover:text-amber-200 hover:underline focus-visible:outline-none focus-visible:underline">
                  Já fez sua solicitação? Clique aqui!
                </button>
              </div>
              </>
            )}
          </>
        )}
      </section>
    </main>
  );
}
