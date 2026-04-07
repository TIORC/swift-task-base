import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { UserRoleProvider, useUserRole, defaultRouteForProfile } from "@/hooks/useUserRole";
import { GlobalTimerProvider } from "@/hooks/useGlobalTimer";
import { useMyMenuAccess } from "@/hooks/usePermissions";
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

const queryClient = new QueryClient();

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

/** Wraps a page and redirects if the user's role cannot access this route */
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

  // Check role-based access
  if (!canAccess(route)) {
    return <Navigate to={defaultRouteForProfile[profile]} replace />;
  }

  // Check per-user menu override (admin bypasses)
  if (profile !== "admin" && isMenuEnabled(route) === false) {
    return <Navigate to={defaultRouteForProfile[profile]} replace />;
  }

  return <>{children}</>;
}

/** Redirects "/" to the correct home page for the user's profile */
function HomeRedirect() {
  const { profile, loading } = useUserRole();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Admin and membro see their respective default pages
  if (profile === "gestor") {
    return <Navigate to="/manager" replace />;
  }

  // Admin and membro see the dashboard
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
