import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Repeat, Search, Trash2, Pencil, Clock, Calendar as CalendarIcon, User, History, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSmClients } from "@/hooks/useSocial";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import {
  SmRecurrenceFields,
  SM_FREQ_LABELS,
  smRecurrenceFromTask,
  smRecurrencePayload,
  type SmRecurrenceState,
} from "@/components/social/SmRecurrenceFields";

const sb = supabase as any;

const FIELD_LABELS: Record<string, string> = {
  title: "Título",
  description: "Descrição",
  assigned_to: "Responsável",
  client_id: "Cliente",
  recurrence_type: "Frequência",
  recurrence_interval: "Intervalo",
  recurrence_days: "Dias da semana",
  recurrence_start_time: "Horário",
  recurrence_only_business_days: "Somente dias úteis",
  recurrence_until: "Data-limite",
  recurrence_day_of_month: "Dia do mês",
  recurrence_months: "Meses da ocorrência",
  recurrence_business_day_direction: "Ajuste de dia útil",
  recurrence_deadline_days: "Prazo (dias)",
};

export default function SocialRecurringTasks() {
  const { data: clients } = useSmClients();
  const { data: profiles } = useSocialAssignableProfiles();
  const [templates, setTemplates] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("none");
  const [clientId, setClientId] = useState("none");
  const [rec, setRec] = useState<SmRecurrenceState>(smRecurrenceFromTask(null));

  const load = async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("sm_tasks").select("*")
      .eq("is_recurring_template", true)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const rows = data ?? [];
    setTemplates(rows);
    const ids = [...new Set(rows.map((t: any) => t.assigned_to).filter(Boolean))] as string[];
    if (ids.length > 0) {
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setNames(Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || "Usuário"])));
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return templates;
    return templates.filter((t) =>
      t.title?.toLowerCase().includes(s) || t.description?.toLowerCase().includes(s));
  }, [templates, search]);

  const openEdit = (t: any) => {
    setEditing(t);
    setTitle(t.title || "");
    setDescription(t.description || "");
    setAssignedTo(t.assigned_to || "none");
    setClientId(t.client_id || "none");
    setRec(smRecurrenceFromTask(t));
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!title.trim()) return toast.error("Título obrigatório");
    setSaving(true);
    const { error } = await sb.from("sm_tasks").update({
      title: title.trim(),
      description: description || null,
      assigned_to: assignedTo === "none" ? null : assignedTo,
      client_id: clientId === "none" ? null : clientId,
      ...smRecurrencePayload(rec),
    }).eq("id", editing.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Recorrência atualizada");
    setEditing(null);
    load();
  };

  const handleDelete = async (t: any) => {
    if (!confirm(`Excluir a recorrência "${t.title}"? As tarefas já geradas serão mantidas.`)) return;
    const { error } = await sb.from("sm_tasks").delete().eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon={<Repeat className="h-5 w-5" />}
        title="Tarefas Recorrentes"
        description="Administre os modelos de tarefas que se repetem automaticamente."
      />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar recorrência..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Nenhuma tarefa recorrente cadastrada.</Card>
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => {
            const days: string[] = Array.isArray(t.recurrence_days) ? t.recurrence_days : [];
            const client = clients?.find((c: any) => c.id === t.client_id);
            return (
              <Card key={t.id} className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-foreground truncate">{t.title}</p>
                      {t.recurrence_type && <Badge variant="secondary">{SM_FREQ_LABELS[t.recurrence_type] || t.recurrence_type}</Badge>}
                      <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />{t.recurrence_start_time || "09:00"}</Badge>
                      {t.recurrence_only_business_days && <Badge variant="outline">Dias úteis</Badge>}
                      {client && <Badge variant="outline">{client.name}</Badge>}
                    </div>
                    {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      {days.length > 0 && (
                        <span className="flex items-center gap-1"><CalendarIcon className="h-3 w-3" />{days.join(", ")}</span>
                      )}
                      {t.assigned_to && names[t.assigned_to] && (
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{names[t.assigned_to]}</span>
                      )}
                      {t.last_spawned_at && <span>Última geração: {new Date(t.last_spawned_at).toLocaleString("pt-BR")}</span>}
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select value={clientId} onValueChange={setClientId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem cliente</SelectItem>
                      {clients?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Responsável padrão</Label>
                  <Select value={assignedTo} onValueChange={setAssignedTo}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {profiles?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Editar recorrência</span>
                </div>
                <SmRecurrenceFields value={rec} onChange={setRec} />
              </div>

              <div className="flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}Salvar alterações
                </Button>
              </div>

              <HistoryPanel taskId={editing.id} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryPanel({ taskId }: { taskId: string }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data } = await sb
        .from("sm_recurring_task_history").select("*")
        .eq("task_id", taskId).order("changed_at", { ascending: false }).limit(100);
      const list = data ?? [];
      const ids = [...new Set(list.map((r: any) => r.changed_by).filter(Boolean))] as string[];
      let names: Record<string, string> = {};
      if (ids.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
        names = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name || "Usuário"]));
      }
      if (!active) return;
      setRows(list.map((r: any) => ({ ...r, changed_by_name: r.changed_by ? names[r.changed_by] || "Usuário" : "Sistema" })));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [taskId]);

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-primary" />Histórico de alterações
      </div>
      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sem alterações registradas.</p>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {rows.map((h) => (
            <div key={h.id} className="rounded-md bg-background/60 border border-border/60 px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{h.changed_by_name}</span>
                <span className="text-muted-foreground">{new Date(h.changed_at).toLocaleString("pt-BR")}</span>
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
