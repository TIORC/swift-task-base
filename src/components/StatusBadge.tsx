import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  backlog: "bg-muted text-muted-foreground",
  pending: "bg-muted text-muted-foreground",
  todo: "bg-muted text-muted-foreground",
  in_progress: "bg-primary/10 text-primary border-primary/20",
  review: "bg-warning/10 text-warning border-warning/20",
  done: "bg-success/10 text-success border-success/20",
  discarded: "bg-destructive/10 text-destructive border-destructive/20",
};

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  pending: "Pendente",
  todo: "A Fazer",
  in_progress: "Em Andamento",
  review: "Validação",
  done: "Concluído",
  discarded: "Descartado",
};

const priorityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary border-primary/20",
  high: "bg-warning/10 text-warning border-warning/20",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

const priorityLabels: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};

interface StatusBadgeProps {
  type: "status" | "priority";
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const styles = type === "status" ? statusStyles : priorityStyles;
  const labels = type === "status" ? statusLabels : priorityLabels;

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[11px] font-medium border px-2 py-0.5",
        styles[value] || "bg-muted text-muted-foreground",
        className
      )}
    >
      {labels[value] || value}
    </Badge>
  );
}
