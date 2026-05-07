import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSmClients, useSmCampaigns, useSmRefData, useSocialMutations } from "@/hooks/useSocial";
import type { SmPost, SmPostStatus, SmPriority } from "@/types/social";
import { SM_POST_STATUS_LABEL, SM_POST_STATUS_ORDER, SM_PRIORITY_LABEL } from "@/types/social";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  post?: SmPost | null;
  onSaved?: () => void;
}

export function SocialPostDialog({ open, onOpenChange, post, onSaved }: Props) {
  const { data: clients } = useSmClients();
  const { data: campaigns } = useSmCampaigns();
  const { networks, contentTypes } = useSmRefData();
  const m = useSocialMutations();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    client_id: "", campaign_id: "", network_id: "", content_type_id: "",
    title: "", caption: "", hashtags: "", scheduled_at: "",
    status: "ideia" as SmPostStatus, priority: "medium" as SmPriority, notes: "",
  });

  useEffect(() => {
    if (post) {
      setForm({
        client_id: post.client_id, campaign_id: post.campaign_id ?? "",
        network_id: post.network_id ?? "", content_type_id: post.content_type_id ?? "",
        title: post.title, caption: post.caption ?? "", hashtags: post.hashtags ?? "",
        scheduled_at: post.scheduled_at ? post.scheduled_at.slice(0, 16) : "",
        status: post.status, priority: post.priority, notes: post.notes ?? "",
      });
    } else {
      setForm({ client_id: "", campaign_id: "", network_id: "", content_type_id: "", title: "", caption: "", hashtags: "", scheduled_at: "", status: "ideia", priority: "medium", notes: "" });
    }
  }, [post, open]);

  const save = async () => {
    if (!form.client_id || !form.title.trim()) { toast.error("Cliente e título obrigatórios"); return; }
    setSaving(true);
    const payload: any = {
      client_id: form.client_id,
      campaign_id: form.campaign_id || null,
      network_id: form.network_id || null,
      content_type_id: form.content_type_id || null,
      title: form.title, caption: form.caption || null, hashtags: form.hashtags || null,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
      status: form.status, priority: form.priority, notes: form.notes || null,
    };
    const { error } = post ? await m.updatePost(post.id, payload) : await m.createPost(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(post ? "Post atualizado" : "Post criado");
    onOpenChange(false); onSaved?.();
  };

  const filteredCampaigns = campaigns.filter(c => !form.client_id || c.client_id === form.client_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{post ? "Editar post" : "Novo post"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente *</Label>
              <Select value={form.client_id} onValueChange={v => setForm({...form, client_id: v, campaign_id: ""})}>
                <SelectTrigger><SelectValue placeholder="Selecione"/></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campanha</Label>
              <Select value={form.campaign_id || "_none"} onValueChange={v => setForm({...form, campaign_id: v === "_none" ? "" : v})}>
                <SelectTrigger><SelectValue placeholder="Sem campanha"/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sem campanha</SelectItem>
                  {filteredCampaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rede social</Label>
              <Select value={form.network_id || "_none"} onValueChange={v => setForm({...form, network_id: v === "_none" ? "" : v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {networks.map(n => <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.content_type_id || "_none"} onValueChange={v => setForm({...form, content_type_id: v === "_none" ? "" : v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {contentTypes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({...form, status: v as SmPostStatus})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>{SM_POST_STATUS_ORDER.map(s => <SelectItem key={s} value={s}>{SM_POST_STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.priority} onValueChange={v => setForm({...form, priority: v as SmPriority})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  {(["low","medium","high","urgent"] as SmPriority[]).map(p => (
                    <SelectItem key={p} value={p}>{SM_PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Agendamento</Label><Input type="datetime-local" value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} /></div>
          <div><Label>Legenda</Label><Textarea rows={4} value={form.caption} onChange={e => setForm({...form, caption: e.target.value})} /></div>
          <div><Label>Hashtags</Label><Input value={form.hashtags} onChange={e => setForm({...form, hashtags: e.target.value})} /></div>
          <div><Label>Notas internas</Label><Textarea rows={2} value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : (post ? "Salvar" : "Criar")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
