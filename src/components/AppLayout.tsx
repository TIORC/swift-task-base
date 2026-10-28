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
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { Frown, Smile } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

export function AppLayout({ children }: { children: ReactNode }) {
  // ?tela=cheia: página aberta em nova aba, em largura total e sem a barra lateral.
  const fullScreen = new URLSearchParams(useLocation().search).get("tela") === "cheia";
  const { isRunning } = useGlobalTimer();
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
            <div className="flex-1 flex justify-center px-4 min-w-0">
              <AnimatePresence mode="wait" initial={false}>
                {isRunning ? (
                  <motion.div
                    key="running"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.25 }}
                    className="relative flex items-center gap-2 rounded-full bg-green-900 px-4 py-1 text-sm font-medium text-white shadow-sm"
                  >
                    <motion.span
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-green-500"
                      animate={{ scale: [1, 1.08, 1], opacity: [0.35, 0, 0.35] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                    <motion.span
                      className="inline-flex"
                      animate={{ y: [0, -3, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Smile className="h-4 w-4 shrink-0" />
                    </motion.span>
                    Muito bem! Você está executando suas atividades!
                  </motion.div>
                ) : (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0, y: -8, scale: 0.96 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      scale: [1, 1.03, 1],
                      boxShadow: ["0 0 0 0 rgba(220,38,38,0)", "0 0 0 6px rgba(220,38,38,0.35)", "0 0 0 0 rgba(220,38,38,0)"],
                    }}
                    exit={{ opacity: 0, y: 8, scale: 0.96, boxShadow: "0 0 0 0 rgba(220,38,38,0)", transition: { duration: 0.25 } }}
                    transition={{
                      opacity: { duration: 0.25 },
                      y: { duration: 0.25 },
                      scale: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
                      boxShadow: { duration: 1.6, repeat: Infinity, ease: "easeOut" },
                    }}
                    className="flex items-center gap-2 rounded-full bg-red-900 px-4 py-1 text-sm font-medium text-white shadow-sm"
                  >
                    <motion.span
                      animate={{ x: [0, -2, 2, -2, 0] }}
                      transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2.5 }}
                    >
                      <Frown className="h-4 w-4 shrink-0" />
                    </motion.span>
                    Atenção! Você está sem uma tarefa ativa. Escolha uma tarefa para continuar suas atividades.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <NotificationBell onlyMentions />
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
