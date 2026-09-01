import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserRoleProvider, useUserRole, defaultRouteForProfile } from "@/hooks/useUserRole";
import { UserSystemsProvider, useUserSystems, type SystemKey } from "@/hooks/useUserSystems";
import { GlobalTimerProvider } from "@/hooks/useGlobalTimer";
import { useMyMenuAccess } from "@/hooks/usePermissions";
import { canAccessMenuRoute, getAccessibleFallbackRoute } from "@/lib/menu-access";
import { AppLayout } from "@/components/AppLayout";
import { SocialLayout } from "@/components/social/SocialLayout";
import { SocialClientPortalLayout } from "@/components/social/SocialClientPortalLayout";
import { Loader2 } from "lucide-react";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import SelectSystem from "./pages/SelectSystem";
import Dashboard from "./pages/Index";
import Kanban from "./pages/Kanban";
import Tasks from "./pages/Tasks";
import Notifications from "./pages/Notifications";
import Automations from "./pages/Automations";
import Ranking from "./pages/Ranking";
import FocusMode from "./pages/FocusMode";
import DependencyMap from "./pages/DependencyMap";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminPanel from "./pages/AdminPanel";
import RecurringTasksAdmin from "./pages/RecurringTasksAdmin";
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import SupportTickets from "./pages/SupportTickets";
import AutomacoesPage from "./pages/AutomacoesPage";
import Hipocampo from "./pages/Hipocampo";
import Almoxarifado from "./pages/Almoxarifado";
import SocialDashboard from "./pages/social/SocialDashboard";
import SocialClients from "./pages/social/SocialClients";
import SocialCampaigns from "./pages/social/SocialCampaigns";
import SocialKanban from "./pages/social/SocialKanban";
import SocialCommercial from "./pages/social/SocialCommercial";
import SocialWorkflows from "./pages/social/SocialWorkflows";
import SocialEditorialCalendar from "./pages/social/SocialEditorialCalendar";
import SocialApprovals from "./pages/social/SocialApprovals";
import SocialTasks from "./pages/social/SocialTasks";
import SocialAdmin from "./pages/social/SocialAdmin";
import SocialAccount from "./pages/social/SocialAccount";
import SocialPlaceholder from "./pages/social/SocialPlaceholder";
import SocialIdeaBank from "./pages/social/SocialIdeaBank";
import SocialPublishingSchedule from "./pages/social/SocialPublishingSchedule";
import SocialMetrics from "./pages/social/SocialMetrics";
import SocialFocusMode from "./pages/social/SocialFocusMode";
import SocialReports from "./pages/social/SocialReports";
import SocialRanking from "./pages/social/SocialRanking";
import SocialManagerDashboard from "./pages/social/SocialManagerDashboard";
import SocialClientApprovals from "./pages/social/SocialClientApprovals";
import SocialClientCalendar from "./pages/social/SocialClientCalendar";

const queryClient = new QueryClient();

function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function NoAccessibleMenuState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-foreground">Nenhum menu liberado</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Peça para um administrador liberar ao menos um item do menu para a sua conta.
        </p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function SystemGate({ system, children }: { system: SystemKey; children: React.ReactNode }) {
  const { systems, loading } = useUserSystems();
  if (loading) return <FullScreenLoader />;
  if (!systems.includes(system)) return <Navigate to="/select-system" replace />;
  return <>{children}</>;
}

function ProtectedTI({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SystemGate system="ti">
        <AppLayout>{children}</AppLayout>
      </SystemGate>
    </RequireAuth>
  );
}

function ProtectedSocial({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SystemGate system="social">
        <SocialLayout>{children}</SocialLayout>
      </SystemGate>
    </RequireAuth>
  );
}

function ProtectedSocialPortal({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <SystemGate system="social">
        <SocialClientPortalLayout>{children}</SocialClientPortalLayout>
      </SystemGate>
    </RequireAuth>
  );
}

function RoleGate({ route, children }: { route: string; children: React.ReactNode }) {
  const { canAccess, loading, profile } = useUserRole();
  const { isMenuEnabled, loading: menuLoading } = useMyMenuAccess();

  if (loading || menuLoading) return <FullScreenLoader />;

  const hasAccess = canAccessMenuRoute({ route, profile, canAccess, isMenuEnabled });
  if (!hasAccess) {
    const fallback = getAccessibleFallbackRoute({
      profile,
      canAccess,
      isMenuEnabled,
      defaultRoute: defaultRouteForProfile[profile],
    });
    return fallback ? <Navigate to={fallback} replace /> : <NoAccessibleMenuState />;
  }
  return <>{children}</>;
}

function HomeRedirect() {
  const { profile, loading, canAccess } = useUserRole();
  const { isMenuEnabled, loading: menuLoading } = useMyMenuAccess();
  if (loading || menuLoading) return <FullScreenLoader />;

  const dashboardAccessible = canAccessMenuRoute({ route: "/", profile, canAccess, isMenuEnabled });
  if (dashboardAccessible) return <Dashboard />;

  const home = getAccessibleFallbackRoute({
    profile,
    canAccess,
    isMenuEnabled,
    defaultRoute: defaultRouteForProfile[profile],
  });
  if (!home) return <NoAccessibleMenuState />;
  if (home !== "/") return <Navigate to={home} replace />;
  return <Dashboard />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/select-system" element={<SelectSystem />} />
    <Route path="/start" element={<Navigate to="/select-system" replace />} />

    {/* Sistema TI — mantém rotas originais */}
    <Route path="/" element={<ProtectedTI><RoleGate route="/"><HomeRedirect /></RoleGate></ProtectedTI>} />
    <Route path="/home-ti" element={<Navigate to="/" replace />} />
    <Route path="/kanban" element={<ProtectedTI><RoleGate route="/kanban"><Kanban /></RoleGate></ProtectedTI>} />
    <Route path="/tasks" element={<ProtectedTI><RoleGate route="/tasks"><Tasks /></RoleGate></ProtectedTI>} />
    <Route path="/notifications" element={<ProtectedTI><RoleGate route="/notifications"><Notifications /></RoleGate></ProtectedTI>} />
    <Route path="/automations" element={<ProtectedTI><RoleGate route="/automations"><Automations /></RoleGate></ProtectedTI>} />
    <Route path="/ranking" element={<ProtectedTI><RoleGate route="/ranking"><Ranking /></RoleGate></ProtectedTI>} />
    <Route path="/focus" element={<ProtectedTI><RoleGate route="/focus"><FocusMode /></RoleGate></ProtectedTI>} />
    <Route path="/dependencies" element={<ProtectedTI><RoleGate route="/dependencies"><DependencyMap /></RoleGate></ProtectedTI>} />
    <Route path="/manager" element={<ProtectedTI><RoleGate route="/manager"><ManagerDashboard /></RoleGate></ProtectedTI>} />
    <Route path="/admin" element={<ProtectedTI><RoleGate route="/admin"><AdminPanel /></RoleGate></ProtectedTI>} />
    <Route path="/admin/recorrentes" element={<ProtectedTI><RoleGate route="/admin"><RecurringTasksAdmin /></RoleGate></ProtectedTI>} />
    <Route path="/reports" element={<ProtectedTI><RoleGate route="/reports"><Reports /></RoleGate></ProtectedTI>} />
    <Route path="/support" element={<ProtectedTI><RoleGate route="/support"><SupportTickets /></RoleGate></ProtectedTI>} />
    <Route path="/automacoes" element={<ProtectedTI><RoleGate route="/automacoes"><AutomacoesPage /></RoleGate></ProtectedTI>} />
    <Route path="/hipocampo" element={<ProtectedTI><RoleGate route="/hipocampo"><Hipocampo /></RoleGate></ProtectedTI>} />
    <Route path="/almoxarifado" element={<ProtectedTI><RoleGate route="/almoxarifado"><Almoxarifado /></RoleGate></ProtectedTI>} />

    {/* Sistema Social Media */}
    <Route path="/social" element={<ProtectedSocial><SocialDashboard /></ProtectedSocial>} />
    <Route path="/social/painel-gestor" element={<ProtectedSocial><SocialManagerDashboard /></ProtectedSocial>} />
    <Route path="/social/comercial" element={<ProtectedSocial><SocialCommercial /></ProtectedSocial>} />
    <Route path="/social/fluxos" element={<ProtectedSocial><SocialWorkflows /></ProtectedSocial>} />
    <Route path="/social/kanban" element={<ProtectedSocial><SocialKanban /></ProtectedSocial>} />
    <Route path="/social/tarefas" element={<ProtectedSocial><SocialTasks /></ProtectedSocial>} />
    <Route path="/social/calendario-editorial" element={<ProtectedSocial><SocialEditorialCalendar /></ProtectedSocial>} />
    <Route path="/social/aprovacoes" element={<ProtectedSocial><SocialApprovals /></ProtectedSocial>} />
    <Route path="/social/clientes" element={<ProtectedSocial><SocialClients /></ProtectedSocial>} />
    <Route path="/social/campanhas" element={<ProtectedSocial><SocialCampaigns /></ProtectedSocial>} />
    <Route path="/social/banco-de-ideias" element={<ProtectedSocial><SocialIdeaBank /></ProtectedSocial>} />
    <Route path="/social/agenda-publicacoes" element={<ProtectedSocial><SocialPublishingSchedule /></ProtectedSocial>} />
    <Route path="/social/metricas" element={<ProtectedSocial><SocialMetrics /></ProtectedSocial>} />
    <Route path="/social/foco" element={<ProtectedSocial><SocialFocusMode /></ProtectedSocial>} />
    <Route path="/social/relatorios" element={<ProtectedSocial><SocialReports /></ProtectedSocial>} />
    <Route path="/social/ranking" element={<ProtectedSocial><SocialRanking /></ProtectedSocial>} />
    <Route path="/social/admin" element={<ProtectedSocial><SocialAdmin /></ProtectedSocial>} />
    <Route path="/social/conta" element={<ProtectedSocial><SocialAccount /></ProtectedSocial>} />

    {/* Portal do Cliente */}
    <Route path="/social/portal" element={<Navigate to="/social/portal/aprovacoes" replace />} />
    <Route path="/social/portal/aprovacoes" element={<ProtectedSocialPortal><SocialClientApprovals /></ProtectedSocialPortal>} />
    <Route path="/social/portal/calendario" element={<ProtectedSocialPortal><SocialClientCalendar /></ProtectedSocialPortal>} />

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <UserRoleProvider>
              <UserSystemsProvider>
                <GlobalTimerProvider>
                  <AppRoutes />
                </GlobalTimerProvider>
              </UserSystemsProvider>
            </UserRoleProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
