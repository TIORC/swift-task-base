import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserSystems, type SystemKey } from "@/hooks/useUserSystems";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Monitor, Sparkles, LogOut } from "lucide-react";
import logoLight from "@/assets/logo-orcoma-light.png";
import logoDark from "@/assets/logo-orcoma-dark.png";
import logoM7 from "@/assets/logo-m7-mono.png";

export const SELECTED_SYSTEM_KEY = "orcoma:selected-system";

export default function SelectSystem() {
  const { session, loading: authLoading, signOut } = useAuth();
  const { systems, loading } = useUserSystems();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains("dark"));

  useEffect(() => {
    const obs = new MutationObserver(() =>
      setIsDark(document.documentElement.classList.contains("dark")),
    );
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);

  const handlePick = (sys: SystemKey) => {
    sessionStorage.setItem(SELECTED_SYSTEM_KEY, sys);
    if (!session) {
      navigate("/auth");
      return;
    }
    if (!systems.includes(sys)) return;
    navigate(sys === "ti" ? "/" : "/social");
  };

  if (authLoading || (session && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const loggedIn = !!session;
  const hasTI = !loggedIn || systems.includes("ti");
  const hasSocial = !loggedIn || systems.includes("social");

  if (loggedIn && systems.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 gap-4">
        <Card className="max-w-md p-6 text-center space-y-3">
          <h1 className="text-xl font-semibold">Sem acesso a ambientes</h1>
          <p className="text-sm text-muted-foreground">
            Sua conta ainda não tem acesso a nenhum ambiente. Peça a um administrador para liberar
            o acesso ao ambiente de TI ou Social Media.
          </p>
          <Button variant="outline" onClick={signOut} className="w-full">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl animate-fade-in">
        <div className="text-center mb-10">
          <img src={isDark ? logoDark : logoLight} alt="ORCOMA" className="h-12 mx-auto mb-6 object-contain" />
          <h1 className="text-3xl font-bold tracking-tight">Escolha seu ambiente</h1>
          <p className="text-muted-foreground mt-2">
            {loggedIn ? "Selecione qual sistema você quer usar agora" : "Selecione o sistema que deseja acessar para continuar"}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5">
          <button
            disabled={loggedIn && !hasTI}
            onClick={() => handlePick("ti")}
            className="text-left disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <Card className="p-7 h-full border-2 transition-all group-hover:border-primary group-hover:shadow-lg group-hover:-translate-y-0.5">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <Monitor className="h-6 w-6" />
              </div>
              <h2 className="text-xl font-semibold mb-1">Gestão de TI</h2>
              <p className="text-sm text-muted-foreground">
                Tarefas, chamados, automações, kanban e gestão da equipe de tecnologia.
              </p>
              {loggedIn && !hasTI && <p className="text-xs text-destructive mt-3">Sem permissão</p>}
            </Card>
          </button>

          <button
            disabled={loggedIn && !hasSocial}
            onClick={() => handlePick("social")}
            className="text-left disabled:opacity-40 disabled:cursor-not-allowed group"
          >
            <Card className="theme-social p-7 h-full border-2 transition-all group-hover:border-primary group-hover:shadow-lg group-hover:-translate-y-0.5">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 overflow-hidden">
                <img src={logoM7} alt="M7" className="h-9 w-9 object-contain" />
              </div>
              <h2 className="text-xl font-semibold mb-1">M7</h2>
              <p className="text-sm text-muted-foreground">
                Calendário editorial, aprovações, clientes, campanhas e conteúdo das redes sociais.
              </p>
              {loggedIn && !hasSocial && <p className="text-xs text-destructive mt-3">Sem permissão</p>}
            </Card>
          </button>
        </div>

        {loggedIn && (
          <div className="text-center mt-8">
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" /> Sair
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
