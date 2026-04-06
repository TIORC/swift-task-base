import { LayoutDashboard, Columns3, ListTodo, Bell, LogOut, Zap, Trophy, Target, GitBranch, Gauge, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUnreadCount } from "@/hooks/useNotifications";
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
import { CheckSquare } from "lucide-react";
import { UserXPBadge } from "@/components/UserXPBadge";
import type { RoleProfile } from "@/hooks/useUserRole";

const allNavItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, profiles: ["admin", "membro"] as RoleProfile[] },
  { title: "Kanban", url: "/kanban", icon: Columns3, profiles: ["admin", "membro"] as RoleProfile[] },
  { title: "Tarefas", url: "/tasks", icon: ListTodo, profiles: ["admin", "membro"] as RoleProfile[] },
  { title: "Modo Foco", url: "/focus", icon: Target, profiles: ["admin", "membro"] as RoleProfile[] },
  { title: "Dependências", url: "/dependencies", icon: GitBranch, profiles: ["admin", "membro"] as RoleProfile[] },
  { title: "Automações", url: "/automations", icon: Zap, profiles: ["admin"] as RoleProfile[] },
  { title: "Ranking", url: "/ranking", icon: Trophy, profiles: ["admin"] as RoleProfile[] },
  { title: "Notificações", url: "/notifications", icon: Bell, profiles: ["admin", "gestor", "membro"] as RoleProfile[] },
  { title: "Painel Gestor", url: "/manager", icon: Gauge, profiles: ["admin", "gestor"] as RoleProfile[] },
  { title: "Administração", url: "/admin", icon: ShieldCheck, profiles: ["admin"] as RoleProfile[] },
];

// Labels per profile for the sidebar group
const groupLabels: Record<string, string> = {
  membro: "Execução",
  gestor: "Gestão",
  admin: "Sistema",
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { profile } = useUserRole();
  const unreadCount = useUnreadCount();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const initials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "U";

  // Filter nav items based on user profile
  const visibleItems = allNavItems.filter((item) => item.profiles.includes(profile));

  const profileLabel = profile === "admin" ? "Administrador" : profile === "gestor" ? "Gestor" : "Membro";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
            <CheckSquare className="h-4 w-4 text-primary-foreground" />
          </div>
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
                        <div className="relative">
                          <item.icon className="h-4 w-4" />
                          {item.url === "/notifications" && unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-destructive text-[7px] font-bold text-destructive-foreground">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </span>
                          )}
                        </div>
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
              {profile === "membro" && <UserXPBadge />}
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
