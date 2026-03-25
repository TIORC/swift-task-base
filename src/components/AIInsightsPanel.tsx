import { useAIInsights } from "@/hooks/useAIInsights";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Brain, AlertTriangle, ArrowUpDown, Lightbulb, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const severityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Baixo", className: "bg-muted text-muted-foreground" },
  medium: { label: "Médio", className: "bg-warning/20 text-warning" },
  high: { label: "Alto", className: "bg-destructive/20 text-destructive" },
};

export function AIInsightsPanel() {
  const { data: insights, isLoading, error } = useAIInsights();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["ai-insights"] });
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary animate-pulse" />
          <span className="font-semibold text-foreground">Analisando com IA...</span>
        </div>
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-foreground">Insights de IA</span>
          </div>
          <Button size="sm" variant="ghost" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground mt-2">Não foi possível carregar os insights.</p>
      </div>
    );
  }

  if (!insights) return null;

  const hasContent =
    insights.delayed_tasks.length > 0 ||
    insights.priority_suggestions.length > 0 ||
    insights.general_insights.length > 0;

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">Insights de IA</span>
        </div>
        <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {!hasContent && (
        <p className="text-sm text-muted-foreground">Tudo parece em ordem! Nenhum alerta encontrado.</p>
      )}

      {/* Delayed Tasks */}
      {insights.delayed_tasks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-warning" />
            Tarefas com Atraso ({insights.delayed_tasks.length})
          </h4>
          <div className="space-y-2">
            {insights.delayed_tasks.map((dt, i) => {
              const sev = severityConfig[dt.severity] || severityConfig.low;
              return (
                <div key={i} className="rounded-md bg-secondary/50 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{dt.task_title}</span>
                    <Badge variant="secondary" className={`text-[10px] ${sev.className}`}>{sev.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{dt.reason}</p>
                  <p className="text-xs text-primary">💡 {dt.suggestion}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Priority Suggestions */}
      {insights.priority_suggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <ArrowUpDown className="h-4 w-4 text-primary" />
            Sugestões de Prioridade ({insights.priority_suggestions.length})
          </h4>
          <div className="space-y-2">
            {insights.priority_suggestions.map((ps, i) => (
              <div key={i} className="rounded-md bg-secondary/50 p-3 space-y-1">
                <span className="text-sm font-medium text-foreground">{ps.task_title}</span>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="secondary" className="text-[10px]">{ps.current_priority}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary">{ps.suggested_priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{ps.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General Insights */}
      {insights.general_insights.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-foreground flex items-center gap-1.5">
            <Lightbulb className="h-4 w-4 text-warning" />
            Insights Gerais
          </h4>
          <div className="space-y-2">
            {insights.general_insights.map((gi, i) => (
              <div key={i} className="rounded-md bg-secondary/50 p-3 space-y-1">
                <p className="text-sm text-foreground">{gi.insight}</p>
                <p className="text-xs text-primary">→ {gi.action}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
