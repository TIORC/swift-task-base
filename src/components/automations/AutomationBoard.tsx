import { Automation, BOARD_COLUMNS, STATUS_LABELS, AutomationStatus } from "@/types/automation";
import { AutomationCard } from "./AutomationCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { List, Columns3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, computeHealthScore } from "@/types/automation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  automations: Automation[];
  onSelect: (a: Automation) => void;
  profileMap: Record<string, string>;
}

export function AutomationBoard({ automations, onSelect, profileMap }: Props) {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <button
          onClick={() => setViewMode("board")}
          className={`p-1.5 rounded-md transition-colors ${viewMode === "board" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Columns3 className="h-4 w-4" />
        </button>
        <button
          onClick={() => setViewMode("list")}
          className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
        >
          <List className="h-4 w-4" />
        </button>
      </div>

      {viewMode === "board" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {BOARD_COLUMNS.map(col => {
            const items = automations.filter(a => a.status === col);
            return (
              <div key={col} className="flex-shrink-0 w-[260px]">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {STATUS_LABELS[col]}
                  </span>
                  <Badge variant="secondary" className="text-[10px] h-5">{items.length}</Badge>
                </div>
                <ScrollArea className="h-[calc(100vh-420px)] min-h-[300px]">
                  <div className="space-y-2 pr-2">
                    {items.map(a => (
                      <AutomationCard
                        key={a.id}
                        automation={a}
                        onClick={() => onSelect(a)}
                        profileName={a.assigned_to ? profileMap[a.assigned_to] : undefined}
                      />
                    ))}
                    {items.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma</div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Automação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Saúde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map(a => {
                const health = computeHealthScore(a);
                return (
                  <TableRow key={a.id} className="cursor-pointer hover:bg-muted/50" onClick={() => onSelect(a)}>
                    <TableCell className="font-medium">{a.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[a.status as AutomationStatus]}`}>
                        {STATUS_LABELS[a.status as AutomationStatus]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${PRIORITY_COLORS[a.priority]}`}>
                        {PRIORITY_LABELS[a.priority]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={a.progress_percent} className="h-1.5 w-16" />
                        <span className="text-xs text-muted-foreground">{a.progress_percent}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{a.assigned_to ? profileMap[a.assigned_to] || "—" : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {a.final_deadline ? format(new Date(a.final_deadline), "dd/MM/yy", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${health.color}`}>{health.label}</span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
