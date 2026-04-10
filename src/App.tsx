import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserRoleProvider, useUserRole, defaultRouteForProfile } from "@/hooks/useUserRole";
import { GlobalTimerProvider } from "@/hooks/useGlobalTimer";
import { useMyMenuAccess } from "@/hooks/usePermissions";
import { canAccessMenuRoute, getAccessibleFallbackRoute } from "@/lib/menu-access";
import { AppLayout } from "@/components/AppLayout";
import { Loader2 } from "lucide-react";

import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
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
import NotFound from "./pages/NotFound";
import Reports from "./pages/Reports";
import SupportTickets from "./pages/SupportTickets";
import AutomacoesPage from "./pages/AutomacoesPage";

const queryClient = new QueryClient();

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

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function RoleGate({ route, children }: { route: string; children: React.ReactNode }) {
  const { canAccess, loading, profile } = useUserRole();
  const { isMenuEnabled, loading: menuLoading } = useMyMenuAccess();

  if (loading || menuLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasAccess = canAccessMenuRoute({ route, profile, canAccess, isMenuEnabled });

  if (!hasAccess) {
    const fallbackRoute = getAccessibleFallbackRoute({
      profile,
      canAccess,
      isMenuEnabled,
      defaultRoute: defaultRouteForProfile[profile],
    });

    return fallbackRoute ? <Navigate to={fallbackRoute} replace /> : <NoAccessibleMenuState />;
  }

  return <>{children}</>;
}

function HomeRedirect() {
  const { profile, loading, canAccess } = useUserRole();
  const { isMenuEnabled, loading: menuLoading } = useMyMenuAccess();

  if (loading || menuLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const homeRoute = getAccessibleFallbackRoute({
    profile,
    canAccess,
    isMenuEnabled,
    defaultRoute: defaultRouteForProfile[profile],
  });

  if (!homeRoute) return <NoAccessibleMenuState />;
  if (homeRoute !== "/") return <Navigate to={homeRoute} replace />;

  return <Dashboard />;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/auth" element={<Auth />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/" element={<ProtectedRoute><RoleGate route="/"><HomeRedirect /></RoleGate></ProtectedRoute>} />
    <Route path="/kanban" element={<ProtectedRoute><RoleGate route="/kanban"><Kanban /></RoleGate></ProtectedRoute>} />
    <Route path="/tasks" element={<ProtectedRoute><RoleGate route="/tasks"><Tasks /></RoleGate></ProtectedRoute>} />
    <Route path="/notifications" element={<ProtectedRoute><RoleGate route="/notifications"><Notifications /></RoleGate></ProtectedRoute>} />
    <Route path="/automations" element={<ProtectedRoute><RoleGate route="/automations"><Automations /></RoleGate></ProtectedRoute>} />
    <Route path="/ranking" element={<ProtectedRoute><RoleGate route="/ranking"><Ranking /></RoleGate></ProtectedRoute>} />
    <Route path="/focus" element={<ProtectedRoute><RoleGate route="/focus"><FocusMode /></RoleGate></ProtectedRoute>} />
    <Route path="/dependencies" element={<ProtectedRoute><RoleGate route="/dependencies"><DependencyMap /></RoleGate></ProtectedRoute>} />
    <Route path="/manager" element={<ProtectedRoute><RoleGate route="/manager"><ManagerDashboard /></RoleGate></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><RoleGate route="/admin"><AdminPanel /></RoleGate></ProtectedRoute>} />
    <Route path="/reports" element={<ProtectedRoute><RoleGate route="/reports"><Reports /></RoleGate></ProtectedRoute>} />
    <Route path="/support" element={<ProtectedRoute><RoleGate route="/support"><SupportTickets /></RoleGate></ProtectedRoute>} />
    <Route path="/automacoes" element={<ProtectedRoute><RoleGate route="/automacoes"><AutomacoesPage /></RoleGate></ProtectedRoute>} />
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
              <GlobalTimerProvider>
                <AppRoutes />
              </GlobalTimerProvider>
            </UserRoleProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
