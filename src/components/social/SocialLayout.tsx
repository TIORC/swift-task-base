import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Columns3, ListTodo, Calendar, Users, Megaphone, CheckCircle2, Lightbulb, FileText, BarChart3, Trophy, Target, ShieldCheck, LogOut, ArrowLeftRight, Sparkles, Library, ImageIcon, LineChart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import logoM7 from "@/assets/logo-m7.png";

const navItems = [
  { title: "Dashboard", url: "/social", icon: LayoutDashboard, end: true },
  { title: "Painel Gestor", url: "/social/painel-gestor", icon: BarChart3 },
  { title: "Kanban", url: "/social/kanban", icon: Columns3 },
  { title: "Tarefas", url: "/social/tarefas", icon: ListTodo },
  { title: "Calendário Editorial", url: "/social/calendario-editorial", icon: Calendar },
  { title: "Aprovações", url: "/social/aprovacoes", icon: CheckCircle2 },
  { title: "Clientes/Marcas", url: "/social/clientes", icon: Users },
  { title: "Campanhas", url: "/social/campanhas", icon: Megaphone },
  { title: "Banco de Ideias", url: "/social/banco-de-ideias", icon: Lightbulb },
  { title: "Agenda de Publicações", url: "/social/agenda-publicacoes", icon: ImageIcon },
  { title: "Métricas", url: "/social/metricas", icon: LineChart },
  { title: "Modo Foco", url: "/social/foco", icon: Target },
  { title: "Relatórios", url: "/social/relatorios", icon: BarChart3 },
  { title: "Ranking", url: "/social/ranking", icon: Trophy },
  { title: "Administração", url: "/social/admin", icon: ShieldCheck },
];

function SocialSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const isActive = (path: string, end?: boolean) =>
    end ? location.pathname === path : location.pathname === path || location.pathname.startsWith(path + "/");

  const initials = user?.email?.slice(0, 2).toUpperCase() ?? "U";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className={collapsed ? "p-2" : "px-3 py-4"}>
        <img
          src={logoM7}
          alt="M7"
          className={
            collapsed
              ? "h-10 w-10 object-contain mx-auto"
              : "w-full h-auto max-h-28 object-contain"
          }
        />
      </SidebarHeader>
      <Separator className="bg-sidebar-border" />
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-3 mb-1">
            Conteúdo
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url, item.end)}>
                    <Link to={item.url} className="rounded-lg hover:bg-sidebar-accent">
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span className="text-sm">{item.title}</span>}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Separator className="bg-sidebar-border" />
        <div className="p-2 space-y-1">
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
        <div className="flex items-center gap-3 p-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{user?.email}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Social Media</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
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

export function SocialLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="theme-social min-h-screen flex w-full bg-background text-foreground">
        <SocialSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto animate-fade-in">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
