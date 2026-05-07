import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Plus, Trash2, Edit2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSmClients, useSmCampaigns } from "@/hooks/useSocial";
import { toast } from "sonner";

const sb = supabase as any;

interface Briefing {
  id: string;
  client_id: string;
  campaign_id: string | null;
  title: string;
  content: string | null;
  created_at: string;
}

export default function SocialBriefings() {
  const { user } = useAuth();
  const { data: clients } = useSmClients();
  const { data: campaigns } = useSmCampaigns();
  const [items, setItems] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Briefing | null>(null);
  const [form, setForm] = useState({ client_id: "", campaign_id: "", title: "", content: "" });

  const refresh = async () => {
    setLoading(true);
    const { data } = await sb.from("sm_briefings").select("*").order("created_at", { ascending: false });
    setItems((data as Briefing[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const reset = () => { setEditing(null); setForm({ client_id: "", campaign_id: "", title: "", content: "" }); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (b: Briefing) => {
    setEditing(b);
    setForm({ client_id: b.client_id, campaign_id: b.campaign_id ?? "", title: b.title, content: b.content ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.client_id || !form.title.trim()) return toast.error("Cliente e título obrigatórios");
    const payload = {
      client_id: form.client_id,
      campaign_id: form.campaign_id || null,
      title: form.title,
      content: form.content,
    };
    const { error } = editing
      ? await sb.from("sm_briefings").update(payload).eq("id", editing.id)
      : await sb.from("sm_briefings").insert({ ...payload, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success(editing ? "Briefing atualizado" : "Briefing criado");
    setOpen(false); reset(); refresh();
  };

  const del = async (b: Briefing) => {
    if (!confirm(`Excluir briefing "${b.title}"?`)) return;
    const { error } = await sb.from("sm_briefings").delete().eq("id", b.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído"); refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Briefings"
        description="Briefings por cliente e campanha"
        icon={<FileText className="h-5 w-5" />}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1" />Novo briefing</Button>}
      />
      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
      : items.length === 0 ? <EmptyState icon={FileText} title="Nenhum briefing" description="Crie o primeiro briefing." />
      : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map(b => {
            const client = clients.find(c => c.id === b.client_id);
            const camp = campaigns.find(c => c.id === b.campaign_id);
            return (
              <Card key={b.id}>
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{b.title}</h3>
                      <p className="text-xs text-muted-foreground">{client?.name}{camp ? ` • ${camp.name}` : ""}</p>
                    </div>
                  </div>
                  {b.content && <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{b.content}</p>}
                  <div className="flex gap-2 pt-2 border-t border-border">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(b)}><Edit2 className="h-3.5 w-3.5 mr-1" />Editar</Button>
                    <Button variant="ghost" size="sm" className="text-destructive" onClick={() => del(b)}><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar briefing" : "Novo briefing"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campanha</Label>
              <Select value={form.campaign_id} onValueChange={v => setForm({ ...form, campaign_id: v })}>
                <SelectTrigger><SelectValue placeholder="(Opcional)" /></SelectTrigger>
                <SelectContent>{campaigns.filter(c => !form.client_id || c.client_id === form.client_id).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Conteúdo</Label><Textarea rows={8} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
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
