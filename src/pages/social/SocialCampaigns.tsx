import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Megaphone, Trash2, Edit2 } from "lucide-react";
import { useSmCampaigns, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import type { SmCampaign } from "@/types/social";
import { toast } from "sonner";

const STATUS = [
  { v: "planning", l: "Planejamento" },
  { v: "active", l: "Em execução" },
  { v: "paused", l: "Pausada" },
  { v: "completed", l: "Concluída" },
  { v: "cancelled", l: "Cancelada" },
];

export default function SocialCampaigns() {
  const { data, loading, refresh } = useSmCampaigns();
  const { data: clients } = useSmClients();
  const m = useSocialMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmCampaign | null>(null);
  const [form, setForm] = useState({ client_id: "", name: "", objective: "", start_date: "", end_date: "", status: "planning", budget: "" });

  const reset = () => { setEditing(null); setForm({ client_id: "", name: "", objective: "", start_date: "", end_date: "", status: "planning", budget: "" }); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (c: SmCampaign) => {
    setEditing(c);
    setForm({
      client_id: c.client_id, name: c.name, objective: c.objective ?? "",
      start_date: c.start_date ?? "", end_date: c.end_date ?? "",
      status: c.status, budget: c.budget?.toString() ?? "",
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.client_id || !form.name.trim()) return toast.error("Cliente e nome obrigatórios");
    const payload: any = {
      client_id: form.client_id, name: form.name, objective: form.objective || null,
      start_date: form.start_date || null, end_date: form.end_date || null,
      status: form.status, budget: form.budget ? Number(form.budget) : null,
    };
    const { error } = editing ? await m.updateCampaign(editing.id, payload) : await m.createCampaign(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Campanha atualizada" : "Campanha criada");
    setOpen(false); reset(); refresh();
  };

  const del = async (c: SmCampaign) => {
    if (!confirm(`Excluir campanha ${c.name}?`)) return;
    const { error } = await m.deleteCampaign(c.id);
    if (error) return toast.error(error.message);
    toast.success("Excluída"); refresh();
  };

  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campanhas"
        description="Organize campanhas de conteúdo por cliente"
        icon={<Megaphone className="h-5 w-5"/>}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1"/>Nova campanha</Button>}
      />

      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
      : data.length === 0 ? (
        <EmptyState icon={<Megaphone className="h-10 w-10"/>} title="Nenhuma campanha" description="Cadastre clientes e crie campanhas para organizar entregas." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(c => (
            <Card key={c.id}>
              <CardContent className="p-5 space-y-3">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{clientName(c.client_id)}</p>
                  <h3 className="font-semibold mt-0.5">{c.name}</h3>
                  {c.objective && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.objective}</p>}
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  {c.start_date && <span>Início: {new Date(c.start_date).toLocaleDateString("pt-BR")}</span>}
                  {c.end_date && <span>Fim: {new Date(c.end_date).toLocaleDateString("pt-BR")}</span>}
                  <span className="capitalize">• {STATUS.find(s => s.v === c.status)?.l ?? c.status}</span>
                </div>
                <div className="flex gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(c)}><Edit2 className="h-3.5 w-3.5 mr-1"/>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(c)}><Trash2 className="h-3.5 w-3.5 mr-1"/>Excluir</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar campanha" : "Nova campanha"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v})}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><Label>Objetivo</Label><Textarea rows={3} value={form.objective} onChange={e => setForm({...form, objective: e.target.value})} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Início</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} /></div>
              <div><Label>Fim</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>{STATUS.map(s => <SelectItem key={s.v} value={s.v}>{s.l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Orçamento</Label><Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? "Salvar" : "Criar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
