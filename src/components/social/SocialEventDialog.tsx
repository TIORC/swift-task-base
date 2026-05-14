import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useSmClients, useSmCampaigns } from "@/hooks/useSocial";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useSocialRole } from "@/hooks/useSocialRole";
import { toast } from "sonner";

const sb = supabase as any;

export interface SmEvent {
  id: string;
  client_id: string | null;
  campaign_id: string | null;
  kind: "reuniao" | "evento" | string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  color: string | null;
  created_by: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event?: SmEvent | null;
  defaultDate?: Date | null;
  onSaved?: () => void;
}

const KIND_LABEL: Record<string, string> = { reuniao: "Reunião", evento: "Evento" };

export function SocialEventDialog({ open, onOpenChange, event, defaultDate, onSaved }: Props) {
  const { user } = useAuth();
  const { data: clients } = useSmClients();
  const { data: campaigns } = useSmCampaigns();
  const { isLeader } = useSocialRole();
  const [saving, setSaving] = useState(false);
  const isEditing = !!event;
  const canModify = !isEditing || isLeader;

  const [form, setForm] = useState({
    client_id: "", campaign_id: "", kind: "reuniao", title: "",
    description: "", location: "", starts_at: "", ends_at: "", color: "#6366f1",
  });

  useEffect(() => {
    if (event) {
      setForm({
        client_id: event.client_id ?? "", campaign_id: event.campaign_id ?? "",
        kind: event.kind, title: event.title,
        description: event.description ?? "", location: event.location ?? "",
        starts_at: event.starts_at.slice(0, 16),
        ends_at: event.ends_at ? event.ends_at.slice(0, 16) : "",
        color: event.color ?? "#6366f1",
      });
    } else {
      const d = defaultDate ?? new Date();
      const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setForm({ client_id: "", campaign_id: "", kind: "reuniao", title: "", description: "", location: "", starts_at: local, ends_at: "", color: "#6366f1" });
    }
  }, [event, defaultDate, open]);

  const filteredCampaigns = campaigns.filter(c => !form.client_id || c.client_id === form.client_id);

  const save = async () => {
    if (!form.title.trim() || !form.starts_at) { toast.error("Título e início obrigatórios"); return; }
    setSaving(true);
    const payload: any = {
      client_id: form.client_id || null,
      campaign_id: form.campaign_id || null,
      kind: form.kind,
      title: form.title,
      description: form.description || null,
      location: form.location || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      color: form.color || null,
    };
    const { error } = event
      ? await sb.from("sm_calendar_events").update(payload).eq("id", event.id)
      : await sb.from("sm_calendar_events").insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(event ? "Evento atualizado" : "Evento criado");
    onOpenChange(false); onSaved?.();
  };

  const remove = async () => {
    if (!event || !confirm("Excluir este evento?")) return;
    const { error } = await sb.from("sm_calendar_events").delete().eq("id", event.id);
    if (error) return toast.error(error.message);
    toast.success("Evento removido");
    onOpenChange(false); onSaved?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{event ? "Editar evento" : "Novo evento"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.kind} onValueChange={v => setForm({ ...form, kind: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Cor</Label>
              <Input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>
          <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id || "_none"} onValueChange={v => setForm({ ...form, client_id: v === "_none" ? "" : v, campaign_id: "" })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Campanha</Label>
              <Select value={form.campaign_id || "_none"} onValueChange={v => setForm({ ...form, campaign_id: v === "_none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {filteredCampaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Início *</Label><Input type="datetime-local" value={form.starts_at} onChange={e => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><Label>Fim</Label><Input type="datetime-local" value={form.ends_at} onChange={e => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div><Label>Local / Link</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Sala, Google Meet, Zoom..." /></div>
          <div><Label>Descrição</Label><Textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div>
        <DialogFooter className="flex justify-between sm:justify-between">
          <div>{event && <Button variant="destructive" onClick={remove}>Excluir</Button>}</div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : (event ? "Salvar" : "Criar")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
