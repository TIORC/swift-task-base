import { useAIInsights } from "@/hooks/useAIInsights";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Brain, AlertTriangle, ArrowUpDown, Lightbulb, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const severityConfig: Record<string, { label: string; className: string }> = {
  low: { label: "Baixo", className: "bg-muted text-muted-foreground" },
  medium: { label: "Médio", className: "bg-warning/10 text-warning border-warning/20" },
  high: { label: "Alto", className: "bg-destructive/10 text-destructive border-destructive/20" },
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
      <Card className="shadow-card">
        <CardContent className="py-8 flex flex-col items-center gap-3">
          <Brain className="h-6 w-6 text-primary animate-pulse" />
          <span className="text-sm font-medium text-foreground">Analisando com IA...</span>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-muted-foreground" />
              <span className="font-semibold text-foreground text-sm">Insights de IA</span>
            </div>
            <Button size="sm" variant="ghost" onClick={handleRefresh}><RefreshCw className="h-4 w-4" /></Button>
          </div>
          <p className="text-sm text-muted-foreground mt-2">Não foi possível carregar.</p>
        </CardContent>
      </Card>
    );
  }

  if (!insights) return null;

  const hasContent = insights.delayed_tasks.length > 0 || insights.priority_suggestions.length > 0 || insights.general_insights.length > 0;

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Insights de IA
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={handleRefresh} disabled={refreshing} className="h-8 w-8 p-0">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasContent && <p className="text-sm text-muted-foreground">Tudo em ordem! Nenhum alerta encontrado.</p>}

        {insights.delayed_tasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" />
              Atrasos ({insights.delayed_tasks.length})
            </h4>
            {insights.delayed_tasks.map((dt, i) => {
              const sev = severityConfig[dt.severity] || severityConfig.low;
              return (
                <div key={i} className="rounded-xl bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">{dt.task_title}</span>
                    <Badge variant="outline" className={`text-[10px] border ${sev.className}`}>{sev.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{dt.reason}</p>
                  <p className="text-xs text-primary">💡 {dt.suggestion}</p>
                </div>
              );
            })}
          </div>
        )}

        {insights.priority_suggestions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
              Prioridade ({insights.priority_suggestions.length})
            </h4>
            {insights.priority_suggestions.map((ps, i) => (
              <div key={i} className="rounded-xl bg-muted/30 p-3 space-y-1.5">
                <span className="text-sm font-medium text-foreground">{ps.task_title}</span>
                <div className="flex items-center gap-2 text-xs">
                  <Badge variant="outline" className="text-[10px]">{ps.current_priority}</Badge>
                  <span className="text-muted-foreground">→</span>
                  <Badge variant="outline" className="text-[10px] bg-primary/5 text-primary border-primary/20">{ps.suggested_priority}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{ps.reason}</p>
              </div>
            ))}
          </div>
        )}

        {insights.general_insights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 uppercase tracking-wider">
              <Lightbulb className="h-3.5 w-3.5 text-warning" />
              Insights
            </h4>
            {insights.general_insights.map((gi, i) => (
              <div key={i} className="rounded-xl bg-muted/30 p-3 space-y-1">
                <p className="text-sm text-foreground">{gi.insight}</p>
                <p className="text-xs text-primary">→ {gi.action}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
