import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { NotificationRealtimeAlert } from "@/hooks/useNotificationRealtimeAlert";
import { ChatRealtimeAlert } from "@/hooks/useChatRealtimeAlert";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { CoffeeButton } from "@/components/CoffeeButton";

export function AppLayout({ children }: { children: ReactNode }) {
  // ?tela=cheia: página aberta em nova aba, em largura total e sem a barra lateral.
  const fullScreen = new URLSearchParams(useLocation().search).get("tela") === "cheia";
  return (
    <SidebarProvider>
      <NotificationRealtimeAlert />
      <ChatRealtimeAlert />
      <div className="min-h-screen flex w-full">
        {!fullScreen && <AppSidebar />}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
            <div className="flex items-center gap-3">
              {!fullScreen && <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />}
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
            </div>
          </header>
          <main className="flex-1 p-6 overflow-auto animate-fade-in">{children}</main>
        </div>
        <ChatWidget context="ti" />
        <CoffeeButton />
      </div>
    </SidebarProvider>
  );
}
