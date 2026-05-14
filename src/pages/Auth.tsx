import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import logoLight from "@/assets/logo-orcoma-light.png";
import logoDark from "@/assets/logo-orcoma-dark.png";
import logoM7 from "@/assets/logo-m7-monograma.png";

const Auth = () => {
  const { session, loading } = useAuth();
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (session) {
    const picked = sessionStorage.getItem("orcoma:selected-system");
    if (picked === "social") return <Navigate to="/social" replace />;
    if (picked === "ti") return <Navigate to="/" replace />;
    return <Navigate to="/select-system" replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("E-mail de recuperação enviado!");
        setIsForgot(false);
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Bloqueia acesso web para usuários que só têm papel "suporte"
        if (data.user) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", data.user.id);

          const roleList = (roles ?? []).map((r) => r.role);
          const isSuporteOnly = roleList.length > 0 && roleList.every((r) => r === "suporte");

          if (isSuporteOnly) {
            await supabase.auth.signOut();
            toast.error(
              "Sua conta é exclusiva para abertura de chamados pelo app ORCOMA Suporte (Windows). O acesso ao painel web não está disponível.",
              { duration: 6000 },
            );
            setSubmitting(false);
            return;
          }

          // Auto-seleciona sistema quando o usuário só tem acesso a um
          const { data: systems } = await supabase
            .from("user_systems")
            .select("system, enabled")
            .eq("user_id", data.user.id)
            .eq("enabled", true);
          const sysList = (systems ?? []).map((s: any) => s.system);
          const hasTi = sysList.includes("ti");
          const hasSocial = sysList.includes("social");
          if (hasSocial && !hasTi) {
            sessionStorage.setItem("orcoma:selected-system", "social");
          } else if (hasTi && !hasSocial) {
            sessionStorage.setItem("orcoma:selected-system", "ti");
          }
        }

        toast.success("Login realizado com sucesso!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-scale-in">
        <Card className="shadow-card border-border/50">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex items-center justify-center gap-5">
              <img
                src={isDark ? logoDark : logoLight}
                alt="ORCOMA"
                className="h-14 object-contain"
              />
              <div className="h-12 w-px bg-border" />
              <img
                src={logoM7}
                alt="M7"
                className="h-20 object-contain"
              />
            </div>
            <CardTitle className="text-2xl font-bold text-foreground tracking-tight">Gestão TI : M7</CardTitle>
            <CardDescription className="text-muted-foreground">
              {isForgot ? "Recuperar senha" : "Entre na sua conta"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4">
              <Input
                type="email"
                placeholder="E-mail"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              {!isForgot && (
                <Input
                  type="password"
                  placeholder="Senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              )}
              <Button type="submit" className="w-full h-11 font-medium" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isForgot ? "Enviar link" : "Entrar"}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm">
              <button
                onClick={() => setIsForgot(!isForgot)}
                className="text-muted-foreground hover:text-primary transition-colors"
              >
                {isForgot ? "Voltar ao login" : "Esqueceu a senha?"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
