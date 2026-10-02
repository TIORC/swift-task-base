import { useState, useEffect, ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Construction, MessageSquare, AtSign, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AlertItem, AlertKind } from "@/lib/alertStore";
import { showAlert, dismissAlert, dismissAllAlerts, subscribeAlerts } from "@/lib/alertStore";

export type { AlertKind, AlertItem } from "@/lib/alertStore";

const KIND_CONFIG: Record<AlertKind, { icon: typeof Bell; iconBg: string; iconColor: string; iconRing: string }> = {
  request: {
    icon: Construction,
    iconBg: "bg-violet-500/15",
    iconColor: "text-violet-400",
    iconRing: "ring-violet-500/30",
  },
  message: {
    icon: MessageSquare,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    iconRing: "ring-primary/30",
  },
  mention: {
    icon: AtSign,
    iconBg: "bg-sky-500/15",
    iconColor: "text-sky-400",
    iconRing: "ring-sky-500/30",
  },
  default: {
    icon: Bell,
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    iconRing: "ring-primary/30",
  },
};

function AlertCard({ alert, onDismiss }: { alert: AlertItem; onDismiss: (id: string) => void }) {
  const cfg = KIND_CONFIG[alert.kind] || KIND_CONFIG.default;
  const Icon = cfg.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 w-[340px] max-w-[90vw] rounded-xl border border-border bg-card shadow-2xl",
        "animate-[slideIn_0.3s_ease-out] ring-1 ring-white/5"
      )}
      role="alert"
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", cfg.iconBg, cfg.iconRing, "ring-1")}>
        <Icon className={cn("h-5 w-5", cfg.iconColor)} />
      </div>
      <div className="flex-1 min-w-0 py-3 pr-3">
        <p className="text-sm font-semibold text-foreground leading-snug">{alert.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{alert.description}</p>
        <div className="mt-2.5 flex items-center gap-2">
          <Button size="sm" className="h-7 text-xs px-3" onClick={() => onDismiss(alert.id)}>
            OK
          </Button>
          <span className="text-[10px] text-muted-foreground">
            {new Date(alert.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      </div>
      <button
        onClick={() => onDismiss(alert.id)}
        className="flex h-8 w-8 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function NotificationAlertProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const apply = useCallback((next: AlertItem[]) => setAlerts(next), []);

  useEffect(() => {
    const unsubscribe = subscribeAlerts(apply);
    return unsubscribe;
  }, [apply]);

  return (
    <>
      {children}
      {typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
            <div className="flex flex-col gap-3 items-end pointer-events-auto">
              {alerts.map((a) => (
                <AlertCard key={a.id} alert={a} onDismiss={dismissAlert} />
              ))}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

export { showAlert, dismissAlert, dismissAllAlerts };