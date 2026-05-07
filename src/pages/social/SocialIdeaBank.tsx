import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Lightbulb, Plus, Trash2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { toast } from "sonner";

const sb = supabase as any;

interface Idea {
  id: string;
  client_id: string | null;
  title: string;
  description: string | null;
  tags: string[];
  status: string;
  converted_to_post_id: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, string> = { new: "Nova", in_review: "Em análise", approved: "Aprovada", converted: "Convertida", discarded: "Descartada" };

export default function SocialIdeaBank() {
  const { user } = useAuth();
  const { data: clients } = useSmClients();
  const m = useSocialMutations();
  const [items, setItems] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ client_id: "", title: "", description: "", tags: "", status: "new" });
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  const refresh = async () => {
    setLoading(true);
    const { data } = await sb.from("sm_ideas").select("*").order("created_at", { ascending: false });
    setItems((data as Idea[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const save = async () => {
    if (!form.title.trim()) return toast.error("Título obrigatório");
    const { error } = await sb.from("sm_ideas").insert({
      client_id: form.client_id || null,
      title: form.title,
      description: form.description,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      status: form.status,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Ideia adicionada");
    setOpen(false); setForm({ client_id: "", title: "", description: "", tags: "", status: "new" }); refresh();
  };

  const del = async (i: Idea) => {
    if (!confirm("Excluir ideia?")) return;
    const { error } = await sb.from("sm_ideas").delete().eq("id", i.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  const convert = async (i: Idea) => {
    if (!i.client_id) return toast.error("Defina um cliente para a ideia antes de converter");
    const { data, error } = await m.createPost({
      client_id: i.client_id,
      title: i.title,
      caption: i.description ?? "",
      status: "ideia",
      priority: "medium",
    });
    if (error) return toast.error(error.message);
    await sb.from("sm_ideas").update({ status: "converted", converted_to_post_id: (data as any)?.id }).eq("id", i.id);
    toast.success("Ideia convertida em post");
    refresh();
  };

  const updateStatus = async (i: Idea, status: string) => {
    const { error } = await sb.from("sm_ideas").update({ status }).eq("id", i.id);
    if (error) return toast.error(error.message);
    refresh();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banco de Ideias"
        description="Capture ideias e converta em posts"
        icon={<Lightbulb className="h-5 w-5" />}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Nova ideia</Button>}
      />
      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Cliente</Label>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Status</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Buscar</Label>
          <Input placeholder="Título, descrição ou tag..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </CardContent></Card>

      {(() => {
        const visible = items.filter(i => {
          if (filterClient !== "all" && i.client_id !== filterClient) return false;
          if (filterStatus !== "all" && i.status !== filterStatus) return false;
          if (search) {
            const s = search.toLowerCase();
            const hit = i.title.toLowerCase().includes(s)
              || (i.description ?? "").toLowerCase().includes(s)
              || (i.tags ?? []).some(t => t.toLowerCase().includes(s));
            if (!hit) return false;
          }
          return true;
        });
        if (loading) return <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>;
        if (visible.length === 0) return <EmptyState icon={Lightbulb} title="Nenhuma ideia encontrada" description="Ajuste os filtros ou crie uma nova ideia." />;
        return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(i => {
            const client = clients.find(c => c.id === i.client_id);
            return (
              <Card key={i.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold truncate">{i.title}</h3>
                      {client && <p className="text-xs text-muted-foreground">{client.name}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px]">{STATUS_LABEL[i.status] ?? i.status}</Badge>
                  </div>
                  {i.description && <p className="text-sm text-muted-foreground line-clamp-3">{i.description}</p>}
                  {i.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1">{i.tags.map(t => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}</div>
                  )}
                  <div className="flex gap-2 pt-2 border-t border-border flex-wrap">
                    <Select value={i.status} onValueChange={v => updateStatus(i, v)}>
                      <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                    {i.status !== "converted" && (
                      <Button size="sm" variant="ghost" onClick={() => convert(i)}><ArrowRight className="h-3.5 w-3.5 mr-1" />Converter</Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => del(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
        );
      })()}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova ideia</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Cliente</Label>
              <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                <SelectTrigger><SelectValue placeholder="(Opcional)" /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Título *</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Tags (separadas por vírgula)</Label><Input value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="trend, reels, engajamento" /></div>
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
