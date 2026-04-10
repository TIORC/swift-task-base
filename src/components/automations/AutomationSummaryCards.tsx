import { Card, CardContent } from "@/components/ui/card";
import { Automation, STATUS_LABELS, AutomationStatus } from "@/types/automation";
import { Activity, AlertTriangle, CheckCircle2, Clock, Code2, Loader2, Pause, XCircle } from "lucide-react";

interface Props {
  automations: Automation[];
}

const summaryItems: { key: string; label: string; icon: React.ElementType; filter: (a: Automation) => boolean; accent: string }[] = [
  { key: "total", label: "Total", icon: Activity, filter: () => true, accent: "text-primary" },
  { key: "dev", label: "Em Desenvolvimento", icon: Code2, filter: a => a.status === "development", accent: "text-indigo-500" },
  { key: "homol", label: "Homologação", icon: Loader2, filter: a => a.status === "homologation", accent: "text-purple-500" },
  { key: "blocked", label: "Bloqueadas", icon: Pause, filter: a => a.status === "blocked", accent: "text-red-500" },
  { key: "done", label: "Concluídas", icon: CheckCircle2, filter: a => a.status === "completed", accent: "text-emerald-500" },
  { key: "late", label: "Atrasadas", icon: AlertTriangle, filter: a => !!a.final_deadline && new Date(a.final_deadline) < new Date() && a.status !== "completed" && a.status !== "cancelled", accent: "text-amber-500" },
  { key: "waiting", label: "Aguardando", icon: Clock, filter: a => a.status === "waiting_user", accent: "text-orange-500" },
];

export function AutomationSummaryCards({ automations }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
      {summaryItems.map(item => {
        const count = automations.filter(item.filter).length;
        return (
          <Card key={item.key} className="border-border/50">
            <CardContent className="p-4 flex flex-col items-center gap-1.5">
              <item.icon className={`h-5 w-5 ${item.accent}`} />
              <span className="text-2xl font-bold text-foreground">{count}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider text-center leading-tight">{item.label}</span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
