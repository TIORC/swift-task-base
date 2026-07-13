import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EditRecurrenceSection } from "@/components/EditRecurrenceSection";
import { useUpdateTask, useDeleteTask, useAssignableProfiles, type Task } from "@/hooks/useTasks";
import { Repeat, Search, Trash2, Pencil, Clock, Calendar as CalendarIcon, User, History } from "lucide-react";
import { toast } from "sonner";

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  assigned_to: "Responsável",
  recurrence_type: "Frequência",
  recurrence_interval: "Intervalo",
  recurrence_days: "Dias da semana",
  recurrence_start_time: "Horário",
  recurrence_only_business_days: "Somente dias úteis",
  recurrence_until: "Data-limite",
};

function useRecurringHistory(taskId: string | null) {
  return useQuery({
    queryKey: ["recurring-history", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recurring_task_history" as any)
        .select("*")
        .eq("task_id", taskId!)
        .order("changed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const userIds = [...new Set(rows.map((r) => r.changed_by).filter(Boolean))];
      let names: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        names = Object.fromEntries((profiles ?? []).map((p) => [p.id, p.full_name || "Usuário"]));
      }
      return rows.map((r) => ({ ...r, changed_by_name: r.changed_by ? names[r.changed_by] || "Usuário" : "Sistema" }));
    },
  });
}

const FREQ_LABELS: Record<string, string> = {
  daily: "Diária", weekly: "Semanal", decendial: "Decendial", monthly: "Mensal",
  bimonthly: "Bimestral", quarterly: "Trimestral", semiannual: "Semestral",
  annual: "Anual", custom: "Personalizada",
};

function useRecurringTemplates() {
  return useQuery({
    queryKey: ["recurring-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("is_recurring_template", true)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data ?? []).map((t) => t.assigned_to).filter(Boolean))] as string[];
      let profilesMap: Record<string, { full_name: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        profilesMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      }
      return (data ?? []).map((t) => ({
        ...t,
        profiles: t.assigned_to ? profilesMap[t.assigned_to] ?? null : null,
      })) as (Task & { profiles: { full_name: string | null } | null })[];
    },
  });
}

export default function RecurringTasksAdmin() {
  const { data: templates, isLoading, refetch } = useRecurringTemplates();
  const { data: profiles } = useAssignableProfiles();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return templates ?? [];
    return (templates ?? []).filter((t) =>
      t.title?.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s),
    );
  }, [templates, search]);

  const openEdit = (t: Task) => {
    setEditing(t);
    setTitle(t.title);
    setDescription(t.description || "");
    setAssignedTo(t.assigned_to || "none");
  };

  const handleSaveMeta = async () => {
    if (!editing) return;
    await updateTask.mutateAsync({
      id: editing.id,
      title,
      description: description || null,
      assigned_to: assignedTo === "none" ? null : assignedTo,
    });
    toast.success("Recorrência atualizada");
    refetch();
  };

  const handleDelete = async (t: Task) => {
    if (!confirm(`Excluir a recorrência "${t.title}"? Instâncias já criadas serão mantidas.`)) return;
    await deleteTask.mutateAsync(t.id);
    refetch();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Repeat className="h-5 w-5" />}
        title="Tarefas Recorrentes"
        description="Administre os templates de tarefas que se repetem automaticamente."
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar recorrência..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Nenhuma tarefa recorrente cadastrada.
        </Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => {
            const days: string[] = Array.isArray((t as any).recurrence_days) ? (t as any).recurrence_days : [];
            const startTime = (t as any).recurrence_start_time || "00:00";
            const freq = (t as any).recurrence_type as string | null;
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{t.title}</p>
                      {freq && <Badge variant="secondary">{FREQ_LABELS[freq] || freq}</Badge>}
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />{startTime}
                      </Badge>
                      {(t as any).recurrence_only_business_days && (
                        <Badge variant="outline">Dias úteis</Badge>
                      )}
                    </div>
                    {t.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {days.length > 0 && (
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="h-3 w-3" />{days.join(", ")}
                        </span>
                      )}
                      {t.profiles?.full_name && (
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />{t.profiles.full_name}
                        </span>
                      )}
                      {(t as any).last_spawned_at && (
                        <span>Última geração: {new Date((t as any).last_spawned_at).toLocaleString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEdit(t)}>
                      <Pencil className="h-3.5 w-3.5 mr-1" />Editar
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(t)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Repeat className="h-5 w-5 text-primary" />Editar Recorrência
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Título</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Responsável padrão</Label>
                <Select value={assignedTo || "none"} onValueChange={setAssignedTo}>
                  <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {profiles?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={handleSaveMeta} disabled={updateTask.isPending}>
                Salvar dados básicos
              </Button>

              <EditRecurrenceSection task={editing as any} />

              <HistoryPanel taskId={editing.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryPanel({ taskId }: { taskId: string }) {
  const { data, isLoading } = useRecurringHistory(taskId);
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-primary" />Histórico de alterações
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem alterações registradas.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {data.map((h: any) => (
            <div key={h.id} className="rounded-md bg-background/60 border border-border/60 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{h.changed_by_name}</span>
                <span className="text-muted-foreground">
                  {new Date(h.changed_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <div className="mt-1 text-muted-foreground">
                <span className="text-foreground font-medium">{FIELD_LABELS[h.field] || h.field}:</span>{" "}
                <span className="line-through opacity-60">{h.old_value ?? "—"}</span>{" → "}
                <span className="text-foreground">{h.new_value ?? "—"}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
