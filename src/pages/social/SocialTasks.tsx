import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, ListTodo, Trash2 } from "lucide-react";
import { useSmTasks, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { SM_PRIORITY_LABEL } from "@/types/social";
import type { SmPriority } from "@/types/social";
import { EmptyState } from "@/components/EmptyState";
import { toast } from "sonner";

const STATUS = ["backlog","pendente","em_andamento","concluido","descartado"] as const;
const STATUS_LABEL: Record<string, string> = { backlog:"Backlog", pendente:"Pendente", em_andamento:"Em andamento", concluido:"Concluído", descartado:"Descartado" };

export default function SocialTasks() {
  const { data, loading, refresh } = useSmTasks();
  const { data: clients } = useSmClients();
  const m = useSocialMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", client_id: "", priority: "medium" as SmPriority, due_date: "", status: "backlog" });

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    const payload: any = {
      title: form.title, description: form.description || null,
      client_id: form.client_id || null, priority: form.priority,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      status: form.status,
    };
    const { error } = await m.createTask(payload);
    if (error) return toast.error(error.message);
    toast.success("Tarefa criada");
    setOpen(false); setForm({ title: "", description: "", client_id: "", priority: "medium", due_date: "", status: "backlog" });
    refresh();
  };

  const setStatus = async (id: string, status: string) => {
    const { error } = await m.updateTask(id, { status });
    if (error) toast.error(error.message); else refresh();
  };
  const del = async (id: string) => {
    if (!confirm("Excluir tarefa?")) return;
    const { error } = await m.deleteTask(id);
    if (error) toast.error(error.message); else refresh();
  };

  const clientName = (id: string | null) => clients.find(c => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader title="Tarefas" description="Tarefas operacionais da equipe Social Media" icon={<ListTodo className="h-5 w-5"/>}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1"/>Nova tarefa</Button>}
      />
      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
       : data.length === 0 ? <EmptyState icon={ListTodo} title="Nenhuma tarefa" description="Crie uma tarefa operacional para começar."/>
       : (
        <div className="space-y-2">
          {data.map(t => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{t.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{SM_PRIORITY_LABEL[t.priority]}</Badge>
                    <span>{clientName(t.client_id)}</span>
                    {t.due_date && <span>• {new Date(t.due_date).toLocaleDateString("pt-BR")}</span>}
                  </div>
                </div>
                <Select value={t.status} onValueChange={(v) => setStatus(t.id, v)}>
                  <SelectTrigger className="w-[160px] h-8"><SelectValue/></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
                </Select>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => del(t.id)}><Trash2 className="h-4 w-4"/></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nova tarefa</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})}/></div>
            <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={e => setForm({...form, description: e.target.value})}/></div>
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id || "_none"} onValueChange={v => setForm({...form, client_id: v === "_none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Sem cliente"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm({...form, priority: v as SmPriority})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{(["low","medium","high","urgent"] as SmPriority[]).map(p => <SelectItem key={p} value={p}>{SM_PRIORITY_LABEL[p]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Prazo</Label><Input type="date" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})}/></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
