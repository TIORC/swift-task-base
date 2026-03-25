import { useResponsibilityHistory } from "@/hooks/useResponsibilityHistory";
import { ArrowRight, History, Loader2 } from "lucide-react";

interface ResponsibilityHistoryProps {
  taskId: string;
}

export function ResponsibilityHistorySection({ taskId }: ResponsibilityHistoryProps) {
  const { data: history, isLoading } = useResponsibilityHistory(taskId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!history || history.length === 0) return null;

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <History className="h-4 w-4 text-muted-foreground" />
        Histórico de Responsáveis
      </h4>
      <div className="space-y-1.5 max-h-32 overflow-y-auto">
        {history.map((entry) => (
          <div key={entry.id} className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {new Date(entry.created_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <span className="text-foreground">{entry.from_name || "Ninguém"}</span>
            <ArrowRight className="h-3 w-3 shrink-0" />
            <span className="text-foreground">{entry.to_name || "Ninguém"}</span>
            <span className="text-[10px]">por {entry.changed_by_name || "?"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
