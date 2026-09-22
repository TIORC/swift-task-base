import { Automation, BOARD_COLUMNS, STATUS_LABELS, AutomationStatus, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS, computeHealthScore, PENDING_REASONS, PENDING_REASON_LABELS, PendingReason } from "@/types/automation";
import { AutomationCard } from "./AutomationCard";
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
  canEditTitle?: boolean;
}

export function AutomationBoard({ automations, onSelect, profileMap, blockerCounts, onStatusChange, isReadOnly, canEditTitle }: Props) {
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
          <div className="relative">
            <div className="scrollbar-thin overflow-x-auto pb-4">
              <div className="flex gap-3 items-start w-max">
                {BOARD_COLUMNS.map(col => {
                  const items = automations.filter(a => a.status === col);
                  return (
                    <Droppable key={col} droppableId={col} isDropDisabled={isReadOnly}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`w-[300px] shrink-0 max-h-[620px] flex flex-col overflow-hidden rounded-lg border transition-colors ${snapshot.isDraggingOver ? "bg-primary/5 border-primary/20" : "border-border/60 bg-card/30"}`}
                        >
                          {/* Cabeçalho fixo da coluna */}
                          <div className="flex items-center justify-between px-1 pb-2 gap-1 flex-shrink-0 sticky top-0 z-10 bg-inherit">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider break-words">
                              {STATUS_LABELS[col]}
                            </span>
                            <Badge variant="secondary" className="text-[10px] h-5 shrink-0">{items.length}</Badge>
                          </div>
                          {/* Cards com scroll vertical independente */}
                          <div className="scrollbar-thin flex-1 overflow-y-auto min-h-[140px] space-y-2 pr-1">
                            {items.map((a, index) => (
                              <Draggable key={a.id} draggableId={a.id} index={index} isDragDisabled={isReadOnly}>
                                {(dragProvided, dragSnapshot) => (
                                  <div
                                    ref={dragProvided.innerRef}
                                    {...dragProvided.draggableProps}
                                    {...dragProvided.dragHandleProps}
                                    className={`mx-0.5 ${dragSnapshot.isDragging ? "opacity-80" : ""}`}
                                  >
                                    <AutomationCard
                                      automation={a}
                                      onClick={() => onSelect(a)}
                                      profileName={a.assigned_to ? profileMap[a.assigned_to] : undefined}
                                      profileMap={profileMap}
                                      pendingCount={blockerCounts?.[a.id] || 0}
                                      canEditTitle={canEditTitle}
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
                        </div>
                      )}
                    </Droppable>
                  );
                })}
              </div>
            </div>
            {/* Indicador sutil de mais colunas à direita */}
            <div className="pointer-events-none absolute right-0 top-0 bottom-4 w-6 bg-gradient-to-l from-background/70 to-transparent z-[5]" />
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
