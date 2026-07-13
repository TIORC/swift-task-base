import { LayoutDashboard, Columns3, ListTodo, LogOut, Zap, Trophy, Target, GitBranch, Gauge, ShieldCheck, BarChart3, Headset, Bot, Loader2, ArrowLeftRight, Brain, Package, Repeat } from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import { useUserSystems } from "@/hooks/useUserSystems";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useMyMenuAccess } from "@/hooks/usePermissions";
import { canAccessMenuRoute } from "@/lib/menu-access";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserXPBadge } from "@/components/UserXPBadge";
import logoOrcomaLight from "@/assets/logo-orcoma-light.png";
import logoOrcomaDark from "@/assets/logo-orcoma-dark.png";
import type { RoleProfile } from "@/hooks/useUserRole";

const allNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, profiles: ["admin", "gestor", "lider", "membro"] as RoleProfile[] },
  { title: "Painel Gestor", url: "/manager", icon: Gauge, profiles: ["admin", "gestor", "lider"] as RoleProfile[] },
  { title: "Kanban", url: "/kanban", icon: Columns3, profiles: ["admin", "gestor", "lider", "membro"] as RoleProfile[] },
  { title: "Tarefas", url: "/tasks", icon: ListTodo, profiles: ["admin", "gestor", "lider", "membro"] as RoleProfile[] },
  { title: "Chamados", url: "/support", icon: Headset, profiles: ["admin", "gestor", "lider"] as RoleProfile[] },
  { title: "Automações", url: "/automacoes", icon: Bot, profiles: ["admin", "gestor", "lider", "membro"] as RoleProfile[] },
  { title: "Hipocampo", url: "/hipocampo", icon: Brain, profiles: ["admin", "gestor", "lider", "membro"] as RoleProfile[] },
  { title: "Almoxarifado", url: "/almoxarifado", icon: Package, profiles: ["admin", "gestor", "lider", "membro"] as RoleProfile[] },
  { title: "Modo Foco", url: "/focus", icon: Target, profiles: ["admin", "lider", "membro"] as RoleProfile[] },
  { title: "Dependências", url: "/dependencies", icon: GitBranch, profiles: ["admin", "lider", "membro"] as RoleProfile[] },
  { title: "Relatórios", url: "/reports", icon: BarChart3, profiles: ["admin", "gestor", "lider", "membro"] as RoleProfile[] },
  { title: "Ranking", url: "/ranking", icon: Trophy, profiles: ["admin", "gestor", "lider"] as RoleProfile[] },
  { title: "Administração", url: "/admin", icon: ShieldCheck, profiles: ["admin"] as RoleProfile[] },
  { title: "Tarefas Recorrentes", url: "/admin/recorrentes", icon: Repeat, profiles: ["admin"] as RoleProfile[] },
];

const groupLabels: Record<string, string> = {
  membro: "Execução",
  lider: "Operação & Gestão",
  gestor: "Acompanhamento",
  admin: "Sistema",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { systems } = useUserSystems();
  const { user, signOut } = useAuth();
  const { profile, canAccess, loading: roleLoading } = useUserRole();
  const { isMenuEnabled, loading: menuLoading } = useMyMenuAccess();
  const { resolvedTheme } = useTheme();
  const currentLogo = resolvedTheme === "dark" ? logoOrcomaDark : logoOrcomaLight;

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "U";

  const visibleItems = roleLoading || menuLoading
    ? []
    : allNavItems.filter((item) =>
        canAccessMenuRoute({
          route: item.url,
          profile,
          canAccess,
          isMenuEnabled,
        }),
      );

  const groupLabel = roleLoading ? "Carregando" : groupLabels[profile] || "Menu";
  const profileLabel = roleLoading ? "Carregando" : profile === "admin" ? "Administrador" : profile === "gestor" ? "Gestor" : profile === "lider" ? "Líder" : "Membro";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <img src={currentLogo} alt="Orcoma" className="h-8 w-8 shrink-0 rounded-lg object-contain" />
          {!collapsed && (
            <span className="text-lg font-bold text-foreground tracking-tight">Orcoma TI</span>
          )}
        </div>
      </SidebarHeader>

      <Separator className="bg-sidebar-border" />

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 mb-1">
            {groupLabel}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            {roleLoading || menuLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <SidebarMenu>
                {visibleItems.map((item) => {
                  const active = isActive(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active}>
                        <NavLink
                          to={item.url}
                          end={item.url === "/"}
                          className="rounded-lg transition-all duration-150 hover:bg-sidebar-accent"
                          activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        >
                          <item.icon className="h-4 w-4" />
                          {!collapsed && <span className="text-sm">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator className="bg-sidebar-border" />
        {systems.length > 1 && (
          <div className="px-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/select-system")}
            >
              <ArrowLeftRight className="h-4 w-4" />
              {!collapsed && <span className="text-xs">Trocar ambiente</span>}
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3 p-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {user?.user_metadata?.full_name || user?.email}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{profileLabel}</p>
              {(profile === "membro" || profile === "lider") && <UserXPBadge />}
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive transition-colors"
            onClick={signOut}
            title="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
