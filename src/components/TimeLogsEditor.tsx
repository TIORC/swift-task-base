import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Clock, Pencil, Trash2, Check, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatMinutes } from "@/hooks/useTimeTracker";

type Scope = "task" | "automation";

interface Props {
  scope: Scope;
  targetId: string;
}

interface Row {
  id: string;
  user_id: string;
  duration_minutes: number;
  description: string | null;
  started_at?: string | null;
  created_at?: string | null;
}

function tableFor(scope: Scope) {
  return scope === "task" ? "time_logs" : "automation_time_logs";
}
function fkFor(scope: Scope) {
  return scope === "task" ? "task_id" : "automation_id";
}

export function TimeLogsEditor({ scope, targetId }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const table = tableFor(scope);
  const fk = fkFor(scope);
  const key = ["time-logs-editor", scope, targetId];

  const { data: logs = [] } = useQuery({
    queryKey: key,
    enabled: !!targetId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(table as any)
        .select("*")
        .eq(fk, targetId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const { data: names = {} } = useQuery({
    queryKey: [...key, "names", logs.map((l) => l.user_id).join(",")],
    enabled: logs.length > 0,
    queryFn: async () => {
      const ids = [...new Set(logs.map((l) => l.user_id))];
      const { data } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.full_name || "Usuário"])) as Record<string, string>;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["tasks"] });
    qc.invalidateQueries({ queryKey: ["automation_time_logs"] });
  };

  const saveMutation = useMutation({
    mutationFn: async ({ id, minutes }: { id: string; minutes: number }) => {
      const { error } = await supabase.from(table as any).update({ duration_minutes: minutes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tempo atualizado"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Registro removido"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao remover"),
  });

  const addMutation = useMutation({
    mutationFn: async (minutes: number) => {
      if (!user) throw new Error("Não autenticado");
      const now = new Date().toISOString();
      const payload: any = { [fk]: targetId, user_id: user.id, duration_minutes: minutes };
      if (scope === "task") { payload.started_at = now; payload.ended_at = now; }
      const { error } = await supabase.from(table as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success("Tempo adicionado"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao adicionar"),
  });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  const [newH, setNewH] = useState(0);
  const [newM, setNewM] = useState(0);

  const startEdit = (l: Row) => {
    setEditingId(l.id);
    setH(Math.floor(l.duration_minutes / 60));
    setM(l.duration_minutes % 60);
  };

  const total = logs.reduce((s, l) => s + l.duration_minutes, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-muted-foreground" />Horas trabalhadas
        </h4>
        <span className="text-xs text-muted-foreground">Total: <b className="text-foreground">{formatMinutes(total)}</b></span>
      </div>

      <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/20 p-2">
        <div className="space-y-1">
          <Label className="text-[10px]">Horas</Label>
          <Input type="number" min={0} value={newH} onChange={(e) => setNewH(Math.max(0, parseInt(e.target.value) || 0))} className="h-8 w-20" />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px]">Minutos</Label>
          <Input type="number" min={0} max={59} value={newM} onChange={(e) => setNewM(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} className="h-8 w-20" />
        </div>
        <Button
          size="sm"
          className="h-8"
          disabled={newH * 60 + newM <= 0 || addMutation.isPending}
          onClick={() => { addMutation.mutate(newH * 60 + newM); setNewH(0); setNewM(0); }}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />Adicionar
        </Button>
      </div>

      <div className="space-y-1 max-h-56 overflow-y-auto">
        {logs.length === 0 && <p className="text-xs text-muted-foreground px-1">Nenhum tempo registrado.</p>}
        {logs.map((l) => {
          const mine = l.user_id === user?.id;
          const when = l.started_at || l.created_at;
          return (
            <div key={l.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/30 px-3 py-1.5 text-xs">
              <div className="min-w-0">
                <span className="text-foreground font-medium">{names[l.user_id] || "Usuário"}</span>
                {when && (
                  <span className="text-muted-foreground ml-2">
                    {new Date(when).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>
              {editingId === l.id ? (
                <div className="flex items-center gap-1">
                  <Input type="number" min={0} value={h} onChange={(e) => setH(Math.max(0, parseInt(e.target.value) || 0))} className="h-7 w-14" />
                  <span className="text-muted-foreground">h</span>
                  <Input type="number" min={0} max={59} value={m} onChange={(e) => setM(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))} className="h-7 w-14" />
                  <span className="text-muted-foreground">m</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => { saveMutation.mutate({ id: l.id, minutes: h * 60 + m }); setEditingId(null); }}>
                    <Check className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{formatMinutes(l.duration_minutes)}</span>
                  {mine && (
                    <>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(l)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                        onClick={() => confirm("Remover este tempo trabalhado?") && deleteMutation.mutate(l.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground">Somente o próprio usuário pode editar ou remover seus registros.</p>
    </div>
  );
}
