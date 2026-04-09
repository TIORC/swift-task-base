import { LayoutDashboard, Columns3, ListTodo, LogOut, Zap, Trophy, Target, GitBranch, Gauge, ShieldCheck, BarChart3, Headset } from "lucide-react";
import { useTheme } from "next-themes";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

import { useMyMenuAccess } from "@/hooks/usePermissions";
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard, profiles: ["admin", "gestor", "membro"] as RoleProfile[] },
  { title: "Painel Gestor", url: "/manager", icon: Gauge, profiles: ["admin", "gestor"] as RoleProfile[] },
  { title: "Tarefas", url: "/tasks", icon: ListTodo, profiles: ["admin", "gestor", "membro"] as RoleProfile[] },
  { title: "Chamados", url: "/support", icon: Headset, profiles: ["admin", "gestor"] as RoleProfile[] },
  { title: "Modo Foco", url: "/focus", icon: Target, profiles: ["admin", "gestor", "membro"] as RoleProfile[] },
  { title: "Dependências", url: "/dependencies", icon: GitBranch, profiles: ["admin", "gestor", "membro"] as RoleProfile[] },
  { title: "Relatórios", url: "/reports", icon: BarChart3, profiles: ["admin", "gestor"] as RoleProfile[] },
  { title: "Ranking", url: "/ranking", icon: Trophy, profiles: ["admin", "gestor"] as RoleProfile[] },
  { title: "Administração", url: "/admin", icon: ShieldCheck, profiles: ["admin"] as RoleProfile[] },
];

// Labels per profile for the sidebar group
const groupLabels: Record<string, string> = {
  membro: "Execução",
  gestor: "Operação & Gestão",
  admin: "Sistema",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useUserRole();
  const { isMenuEnabled } = useMyMenuAccess();
  const { resolvedTheme } = useTheme();
  const currentLogo = resolvedTheme === "dark" ? logoOrcomaDark : logoOrcomaLight;
  

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "U";

  // Filter nav items based on user profile + per-user menu overrides
  const visibleItems = allNavItems.filter((item) => {
    // First check role-based access
    if (!item.profiles.includes(profile)) return false;
    // Then check per-user menu override (admin always sees everything)
    if (profile === "admin") return true;
    const override = isMenuEnabled(item.url);
    if (override === false) return false; // explicitly blocked
    return true;
  });

  const profileLabel = profile === "admin" ? "Administrador" : profile === "gestor" ? "Líder" : "Membro";

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
            {groupLabels[profile] || "Menu"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator className="bg-sidebar-border" />
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
              {(profile === "membro" || profile === "gestor") && <UserXPBadge />}
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
