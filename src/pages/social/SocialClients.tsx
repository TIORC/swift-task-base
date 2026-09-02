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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSocialAssignableProfiles } from "@/hooks/useTasks";
import { Plus, Users, Edit2, Trash2, Rocket } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { seedOnboardingChecklist } from "@/hooks/useSmDemands";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

const sb = supabase as any;
import { useSmClients, useSocialMutations } from "@/hooks/useSocial";
import type { SmClient } from "@/types/social";
import { toast } from "sonner";

export default function SocialClients() {
  const { data, loading, refresh } = useSmClients();
  const m = useSocialMutations();
  const { user } = useAuth();
  const { data: assignables } = useSocialAssignableProfiles();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmClient | null>(null);
  const emptyForm = { name: "", brand_identity: "", general_briefing: "", primary_color: "", active: true, plan_posts_per_month: "", plan_formats: "", plan_notes: "", account_owner_id: "" };
  const [form, setForm] = useState(emptyForm);

  const reset = () => { setEditing(null); setForm(emptyForm); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (c: SmClient) => {
    setEditing(c);
    setForm({ name: c.name, brand_identity: c.brand_identity ?? "", general_briefing: c.general_briefing ?? "", primary_color: c.primary_color ?? "", active: c.active, plan_posts_per_month: (c as any).plan_posts_per_month?.toString() ?? "", plan_formats: (c as any).plan_formats ?? "", plan_notes: (c as any).plan_notes ?? "", account_owner_id: (c as any).account_owner_id ?? "" });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error("Nome obrigatório");
    const payload: any = {
      ...form,
      plan_posts_per_month: form.plan_posts_per_month ? Number(form.plan_posts_per_month) : null,
      plan_formats: form.plan_formats || null,
      plan_notes: form.plan_notes || null,
      account_owner_id: form.account_owner_id || null,
    };
    const { error } = editing ? await m.updateClient(editing.id, payload) : await m.createClient(payload);
    if (error) return toast.error(error.message);
    toast.success(editing ? "Cliente atualizado" : "Cliente criado");
    setOpen(false); reset(); refresh();
  };

  const startOnboarding = async (c: SmClient) => {
    if (!user) return;
    const { data: created, error } = await sb.from("sm_tasks").insert({
      title: `Onboarding — ${c.name}`,
      client_id: c.id,
      status: "backlog",
      priority: "high",
      nature: "onboarding",
      stage: "onboarding",
      due_date: new Date(Date.now() + 30 * 86400_000).toISOString(),
      created_by: user.id,
    }).select().single();
    if (error) return toast.error(error.message);
    await seedOnboardingChecklist(created.id, user.id);
    await sb.from("sm_clients").update({ onboarding_started_at: new Date().toISOString() }).eq("id", c.id);
    toast.success("Onboarding criado com checklist padrão de 30 dias");
    navigate("/social/comercial");
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
                  <Button variant="ghost" size="sm" onClick={() => startOnboarding(c)}><Rocket className="h-3.5 w-3.5 mr-1"/>Onboarding</Button>
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
            <div>
              <Label>Responsável pela conta</Label>
              <Select value={form.account_owner_id || "none"} onValueChange={v => setForm({...form, account_owner_id: v === "none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {assignables?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border p-3 space-y-3">
              <p className="text-sm font-medium">Plano contratado</p>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Posts por mês</Label><Input type="number" min={0} value={form.plan_posts_per_month} onChange={e => setForm({...form, plan_posts_per_month: e.target.value})} /></div>
                <div><Label>Formatos</Label><Input value={form.plan_formats} onChange={e => setForm({...form, plan_formats: e.target.value})} placeholder="Reels, carrossel, stories" /></div>
              </div>
              <div><Label>Observações do plano</Label><Textarea rows={2} value={form.plan_notes} onChange={e => setForm({...form, plan_notes: e.target.value})} /></div>
            </div>
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
