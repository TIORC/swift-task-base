import { Automation, BOARD_COLUMNS, STATUS_LABELS, AutomationStatus, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, computeHealthScore, PENDING_REASONS, PENDING_REASON_LABELS, PendingReason } from "@/types/automation";
import { AutomationCard } from "./AutomationCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { List, Columns3 } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useCreateBlocker } from "@/hooks/useAutomationsData";

interface Props {
  automations: Automation[];
  onSelect: (a: Automation) => void;
  profileMap: Record<string, string>;
  blockerCounts?: Record<string, number>;
  onStatusChange?: (id: string, newStatus: AutomationStatus) => void;
  isReadOnly?: boolean;
}

export function AutomationBoard({ automations, onSelect, profileMap, blockerCounts, onStatusChange, isReadOnly }: Props) {
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [pendingMove, setPendingMove] = useState<{ id: string; status: AutomationStatus } | null>(null);
  const [reason, setReason] = useState<PendingReason>("approval");
  const [reasonDesc, setReasonDesc] = useState("");
  const createBlocker = useCreateBlocker();

  const handleDragEnd = (result: DropResult) => {
    if (isReadOnly || !result.destination || !onStatusChange) return;
    const newStatus = result.destination.droppableId as AutomationStatus;
    const automationId = result.draggableId;
    const automation = automations.find(a => a.id === automationId);
    if (!automation || automation.status === newStatus) return;
    // Mover para "Pendente" exige escolher motivo
    if (newStatus === "homologation") {
      setPendingMove({ id: automationId, status: newStatus });
      setReason("approval");
      setReasonDesc("");
      return;
    }
    onStatusChange(automationId, newStatus);
  };

  const confirmPending = () => {
    if (!pendingMove || !onStatusChange) return;
    createBlocker.mutate({
      automation_id: pendingMove.id,
      blocker_type: reason,
      description: reasonDesc.trim() || PENDING_REASON_LABELS[reason],
    });
    onStatusChange(pendingMove.id, pendingMove.status);
    setPendingMove(null);
  };


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
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-3" style={{ minWidth: `${BOARD_COLUMNS.length * 260}px` }}>
              {BOARD_COLUMNS.map(col => {
                const items = automations.filter(a => a.status === col);
                return (
                  <Droppable key={col} droppableId={col} isDropDisabled={isReadOnly}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 min-w-[260px] rounded-lg transition-colors ${snapshot.isDraggingOver ? "bg-primary/5" : ""}`}
                      >
                        <div className="flex items-center justify-between mb-2 px-1 gap-1">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                            {STATUS_LABELS[col]}
                          </span>
                          <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{items.length}</Badge>
                        </div>
                        <ScrollArea className="h-[calc(100vh-420px)] min-h-[300px]">
                          <div className="space-y-2 pr-2">
                            {items.map((a, index) => (
                              <Draggable key={a.id} draggableId={a.id} index={index} isDragDisabled={isReadOnly}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={dragSnapshot.isDragging ? "opacity-80" : ""}
                                  >
                                    <AutomationCard
                                      automation={a}
                                      onClick={() => onSelect(a)}
                                      profileName={a.assigned_to ? profileMap[a.assigned_to] : undefined}
                                      profileMap={profileMap}
                                      pendingCount={blockerCounts?.[a.id] || 0}
                                    />
                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                            {items.length === 0 && (
                              <div className="text-center py-8 text-xs text-muted-foreground">Nenhuma</div>
                            )}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </Droppable>
                );
              })}
            </div>
          </div>
        </DragDropContext>
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

      <Dialog open={!!pendingMove} onOpenChange={(v) => !v && setPendingMove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mover para Pendente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Motivo da pendência</label>
              <Select value={reason} onValueChange={(v) => setReason(v as PendingReason)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PENDING_REASONS.map((r) => (
                    <SelectItem key={r} value={r}>{PENDING_REASON_LABELS[r]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Descrição (opcional)</label>
              <Textarea
                value={reasonDesc}
                onChange={(e) => setReasonDesc(e.target.value)}
                placeholder="Detalhe o motivo..."
                rows={3}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPendingMove(null)}>Cancelar</Button>
            <Button onClick={confirmPending} disabled={createBlocker.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
