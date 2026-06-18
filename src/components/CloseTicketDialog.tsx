import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, X } from "lucide-react";
import { SUPPORT_REAL_REASONS, SUPPORT_TAGS_BY_REASON, type SupportRealReason } from "@/lib/support-reasons";

interface CloseTicketDialogProps {
  taskId: string | null;
  taskTitle?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onClosed?: () => void;
}

export function CloseTicketDialog({ taskId, taskTitle, open, onOpenChange, onClosed }: CloseTicketDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<SupportRealReason | "">("");
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setTags([]);
      setNotes("");
    }
  }, [open, taskId]);

  const availableTags = useMemo(
    () => (reason ? SUPPORT_TAGS_BY_REASON[reason] : []),
    [reason]
  );

  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const handleConfirm = async () => {
    if (!taskId) return;
    if (!reason) {
      toast.error("Selecione o motivo real do suporte.");
      return;
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("tasks")
        .update({
          status: "done",
          support_real_reason: reason,
          support_tags: tags,
          support_technical_notes: notes.trim() || null,
          closed_by: user?.id ?? null,
          closed_at: now,
        })
        .eq("id", taskId);
      if (error) throw error;

      await supabase.from("task_events").insert({
        task_id: taskId,
        user_id: user?.id ?? null,
        event_type: "support_closed",
        description: `Chamado concluído • Motivo real: ${reason}${tags.length ? ` • Tags: ${tags.join(", ")}` : ""}`,
        metadata: {
          support_real_reason: reason,
          support_tags: tags,
          support_technical_notes: notes.trim() || null,
        },
      });

      toast.success("Chamado concluído com sucesso.");
      queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["support-report"] });
      queryClient.invalidateQueries({ queryKey: ["task-events", taskId] });
      onClosed?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Falha ao concluir chamado.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            Concluir chamado
          </DialogTitle>
          <DialogDescription>
            {taskTitle ? <span className="font-medium">{taskTitle}</span> : "Registre o motivo real identificado pelo TI."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>
              Motivo real do suporte <span className="text-destructive">*</span>
            </Label>
            <Select value={reason} onValueChange={(v) => { setReason(v as SupportRealReason); setTags([]); }}>
              <SelectTrigger><SelectValue placeholder="Selecione o motivo real..." /></SelectTrigger>
              <SelectContent>
                {SUPPORT_REAL_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {reason && (
            <div className="space-y-2">
              <Label>Tags / submotivos (opcional)</Label>
              <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-muted/30 p-2">
                {availableTags.map((t) => {
                  const active = tags.includes(t);
                  return (
                    <Badge
                      key={t}
                      variant={active ? "default" : "outline"}
                      onClick={() => toggleTag(t)}
                      className="cursor-pointer select-none"
                    >
                      {t}
                      {active && <X className="ml-1 h-3 w-3" />}
                    </Badge>
                  );
                })}
              </div>
              {tags.length > 0 && (
                <p className="text-xs text-muted-foreground">{tags.length} tag(s) selecionada(s)</p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Observação técnica do TI (opcional)</Label>
            <Textarea
              rows={4}
              maxLength={2000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Chamado aberto como problema no sistema, mas foi identificado consumo excessivo de memória RAM. Realizada troca de memória."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={saving || !reason}>
            {saving ? "Salvando..." : "Concluir chamado"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
