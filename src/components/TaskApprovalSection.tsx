import { useTaskApprovals, useUserRole, useSubmitApproval } from "@/hooks/useApprovals";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, ShieldX, CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import { useState } from "react";

interface TaskApprovalSectionProps {
  taskId: string;
  taskStatus: string;
}

const statusConfig = {
  pending: { icon: Clock, label: "Pendente", className: "bg-warning/20 text-warning" },
  approved: { icon: CheckCircle2, label: "Aprovado", className: "bg-green-500/20 text-green-400" },
  rejected: { icon: XCircle, label: "Rejeitado", className: "bg-destructive/20 text-destructive" },
};

export function TaskApprovalSection({ taskId, taskStatus }: TaskApprovalSectionProps) {
  const { user } = useAuth();
  const { data: approvals, isLoading } = useTaskApprovals(taskId);
  const { data: userRoles } = useUserRole();
  const submitApproval = useSubmitApproval();
  const [comments, setComments] = useState("");

  const canApprove = userRoles?.some((r) => r === "lider" || r === "gestor" || r === "admin");
  const isLider = userRoles?.some((r) => r === "lider" || r === "admin");
  const isGestor = userRoles?.some((r) => r === "gestor" || r === "admin");

  const liderApproval = approvals?.find((a) => a.level === "lider" && a.status === "approved");
  const gestorApproval = approvals?.find((a) => a.level === "gestor" && a.status === "approved");

  const needsReview = taskStatus === "review";
  const canLiderApprove = isLider && needsReview && !liderApproval;
  const canGestorApprove = isGestor && needsReview && liderApproval && !gestorApproval;

  const handleApproval = (level: "lider" | "gestor", status: "approved" | "rejected") => {
    submitApproval.mutate({ taskId, level, status, comments: comments || undefined });
    setComments("");
  };

  if (isLoading) return null;

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
        <ShieldCheck className="h-4 w-4 text-primary" />
        Fluxo de Aprovação
      </h4>

      {/* Approval steps */}
      <div className="space-y-2">
        {/* Líder step */}
        <div className="flex items-center justify-between rounded-md bg-secondary/30 p-2.5">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${liderApproval ? "bg-green-400" : "bg-muted-foreground/40"}`} />
            <span className="text-sm text-foreground">Líder</span>
          </div>
          {liderApproval ? (
            <Badge className="bg-green-500/20 text-green-400 text-[10px]">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {liderApproval.approver_name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] text-muted-foreground">Pendente</Badge>
          )}
        </div>

        {/* Gestor step */}
        <div className="flex items-center justify-between rounded-md bg-secondary/30 p-2.5">
          <div className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${gestorApproval ? "bg-green-400" : "bg-muted-foreground/40"}`} />
            <span className="text-sm text-foreground">Gestor</span>
          </div>
          {gestorApproval ? (
            <Badge className="bg-green-500/20 text-green-400 text-[10px]">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {gestorApproval.approver_name}
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px] text-muted-foreground">
              {liderApproval ? "Aguardando" : "Bloqueado"}
            </Badge>
          )}
        </div>
      </div>

      {/* Rejection history */}
      {approvals?.filter((a) => a.status === "rejected").map((a) => (
        <div key={a.id} className="rounded-md bg-destructive/10 border border-destructive/20 p-2 text-xs">
          <div className="flex items-center gap-1 text-destructive font-medium">
            <XCircle className="h-3 w-3" />
            Rejeitado por {a.approver_name} ({a.level})
          </div>
          {a.comments && <p className="text-muted-foreground mt-1">{a.comments}</p>}
        </div>
      ))}

      {/* Action buttons */}
      {(canLiderApprove || canGestorApprove) && (
        <div className="space-y-2 pt-1">
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Comentário (opcional)..."
            rows={2}
            className="bg-secondary border-border text-sm"
          />
          <div className="flex gap-2">
            {canLiderApprove && (
              <>
                <Button size="sm" onClick={() => handleApproval("lider", "approved")} disabled={submitApproval.isPending}>
                  {submitApproval.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  Aprovar (Líder)
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleApproval("lider", "rejected")} disabled={submitApproval.isPending}>
                  <ShieldX className="h-3.5 w-3.5 mr-1" />
                  Rejeitar
                </Button>
              </>
            )}
            {canGestorApprove && (
              <>
                <Button size="sm" onClick={() => handleApproval("gestor", "approved")} disabled={submitApproval.isPending}>
                  {submitApproval.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                  Aprovar (Gestor)
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleApproval("gestor", "rejected")} disabled={submitApproval.isPending}>
                  <ShieldX className="h-3.5 w-3.5 mr-1" />
                  Rejeitar
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      {!canApprove && needsReview && (
        <p className="text-xs text-muted-foreground italic">Aguardando aprovação de líder/gestor.</p>
      )}
    </div>
  );
}
