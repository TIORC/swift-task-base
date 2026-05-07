import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LineChart, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSmPosts, useSmClients } from "@/hooks/useSocial";
import { toast } from "sonner";

const sb = supabase as any;

interface Metric {
  id: string;
  post_id: string;
  measured_at: string;
  reach: number; impressions: number; likes: number; comments_count: number;
  shares: number; saves: number; clicks: number; conversions: number;
}

const FIELDS: Array<{ key: keyof Metric; label: string }> = [
  { key: "reach", label: "Alcance" },
  { key: "impressions", label: "Impressões" },
  { key: "likes", label: "Curtidas" },
  { key: "comments_count", label: "Comentários" },
  { key: "shares", label: "Compart." },
  { key: "saves", label: "Salvos" },
  { key: "clicks", label: "Cliques" },
  { key: "conversions", label: "Conversões" },
];

export default function SocialMetrics() {
  const { user } = useAuth();
  const { data: posts } = useSmPosts();
  const { data: clients } = useSmClients();
  const [items, setItems] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    post_id: "", measured_at: new Date().toISOString().slice(0, 10),
    reach: 0, impressions: 0, likes: 0, comments_count: 0, shares: 0, saves: 0, clicks: 0, conversions: 0,
  });

  const refresh = async () => {
    setLoading(true);
    const { data } = await sb.from("sm_metrics").select("*").order("measured_at", { ascending: false });
    setItems((data as Metric[]) ?? []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const totals = useMemo(() => {
    const t = { reach: 0, impressions: 0, likes: 0, comments_count: 0, shares: 0, saves: 0, clicks: 0, conversions: 0 };
    items.forEach(i => FIELDS.forEach(f => { (t as any)[f.key] += (i[f.key] as number) || 0; }));
    return t;
  }, [items]);

  const save = async () => {
    if (!form.post_id) return toast.error("Selecione um post");
    const { error } = await sb.from("sm_metrics").insert({ ...form, created_by: user?.id });
    if (error) return toast.error(error.message);
    toast.success("Métrica registrada");
    setOpen(false); refresh();
  };

  const del = async (m: Metric) => {
    if (!confirm("Excluir métrica?")) return;
    await sb.from("sm_metrics").delete().eq("id", m.id);
    refresh();
  };

  const publishedPosts = posts.filter(p => p.status === "publicado" || p.status === "agendado");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Métricas"
        description="Performance manual por post"
        icon={<LineChart className="h-5 w-5" />}
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" />Registrar métrica</Button>}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        {FIELDS.map(f => (
          <Card key={f.key}><CardContent className="p-4">
            <p className="text-[10px] uppercase text-muted-foreground tracking-wider">{f.label}</p>
            <p className="text-xl font-bold mt-1">{(totals as any)[f.key].toLocaleString("pt-BR")}</p>
          </CardContent></Card>
        ))}
      </div>

      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
      : items.length === 0 ? <EmptyState icon={LineChart} title="Sem métricas registradas" description="Adicione métricas dos posts publicados." />
      : (
        <Card><CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr><th className="text-left p-3">Post</th><th className="text-left p-3">Cliente</th><th className="text-left p-3">Data</th>
                {FIELDS.map(f => <th key={f.key} className="text-right p-3">{f.label}</th>)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map(m => {
                const p = posts.find(x => x.id === m.post_id);
                const c = clients.find(x => x.id === p?.client_id);
                return (
                  <tr key={m.id} className="border-t border-border">
                    <td className="p-3 max-w-[200px] truncate">{p?.title ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{c?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{new Date(m.measured_at).toLocaleDateString("pt-BR")}</td>
                    {FIELDS.map(f => <td key={f.key} className="p-3 text-right">{((m as any)[f.key] ?? 0).toLocaleString("pt-BR")}</td>)}
                    <td className="p-3"><Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del(m)}><Trash2 className="h-3.5 w-3.5" /></Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent></Card>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Registrar métrica</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Post *</Label>
              <Select value={form.post_id} onValueChange={v => setForm({ ...form, post_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{publishedPosts.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Data da medição</Label><Input type="date" value={form.measured_at} onChange={e => setForm({ ...form, measured_at: e.target.value })} /></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {FIELDS.map(f => (
                <div key={f.key}><Label className="text-xs">{f.label}</Label>
                  <Input type="number" min={0} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: Number(e.target.value) || 0 })} />
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
