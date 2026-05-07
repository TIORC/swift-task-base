import { useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Users, Edit2, Trash2 } from "lucide-react";
import { useSmClients, useSocialMutations } from "@/hooks/useSocial";
import type { SmClient } from "@/types/social";
import { toast } from "sonner";

export default function SocialClients() {
  const { data, loading, refresh } = useSmClients();
  const m = useSocialMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmClient | null>(null);
  const [form, setForm] = useState({ name: "", brand_identity: "", general_briefing: "", primary_color: "", active: true });

  const reset = () => { setEditing(null); setForm({ name: "", brand_identity: "", general_briefing: "", primary_color: "", active: true }); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (c: SmClient) => {
    setEditing(c);
    setForm({ name: c.name, brand_identity: c.brand_identity ?? "", general_briefing: c.general_briefing ?? "", primary_color: c.primary_color ?? "", active: c.active });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    const { error } = editing ? await m.updateClient(editing.id, form) : await m.createClient(form);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cliente atualizado" : "Cliente criado");
    setOpen(false); reset(); refresh();
  };

  const del = async (c: SmClient) => {
    if (!confirm(`Excluir cliente ${c.name}?`)) return;
    const { error } = await m.deleteClient(c.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído"); refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes / Marcas"
        description="Gerencie marcas atendidas pela equipe"
        icon={<Users className="h-5 w-5"/>}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-1"/>Novo cliente</Button>}
      />

      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
      : data.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum cliente cadastrado" description="Crie o primeiro cliente para começar a planejar conteúdos." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.map(c => (
            <Card key={c.id}>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate flex items-center gap-2">
                      {c.primary_color && <span className="h-3 w-3 rounded-full inline-block" style={{ background: c.primary_color }} />}
                      {c.name}
                    </h3>
                    {c.brand_identity && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{c.brand_identity}</p>}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-medium ${c.active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                    {c.active ? "Ativo" : "Inativo"}
                  </span>
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
          <DialogHeader><DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
            <div><Label>Identidade da marca</Label><Textarea rows={2} value={form.brand_identity} onChange={e => setForm({...form, brand_identity: e.target.value})} /></div>
            <div><Label>Briefing geral</Label><Textarea rows={4} value={form.general_briefing} onChange={e => setForm({...form, general_briefing: e.target.value})} /></div>
            <div><Label>Cor primária</Label><Input type="color" value={form.primary_color || "#3B82F6"} onChange={e => setForm({...form, primary_color: e.target.value})} className="h-10 w-20" /></div>
            <div className="flex items-center gap-2"><Switch checked={form.active} onCheckedChange={v => setForm({...form, active: v})} /><Label>Ativo</Label></div>
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
