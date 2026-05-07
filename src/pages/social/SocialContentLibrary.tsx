import { useEffect, useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Library, Download, FileText as FileIcon, ImageIcon, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSmPosts, useSmClients } from "@/hooks/useSocial";

const sb = supabase as any;

interface Att {
  id: string; post_id: string; file_name: string; file_path: string; mime_type: string; file_size: number; created_at: string;
}

function iconFor(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("video/")) return Video;
  return FileIcon;
}

export default function SocialContentLibrary() {
  const { data: posts } = useSmPosts();
  const { data: clients } = useSmClients();
  const [items, setItems] = useState<Att[]>([]);
  const [loading, setLoading] = useState(true);
  const [client, setClient] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await sb.from("sm_post_attachments").select("*").order("created_at", { ascending: false });
      setItems((data as Att[]) ?? []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => items.filter(i => {
    const post = posts.find(p => p.id === i.post_id);
    if (client !== "all" && post?.client_id !== client) return false;
    if (search && !i.file_name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [items, client, search, posts]);

  const download = async (a: Att) => {
    const { data } = await sb.storage.from("task-attachments").createSignedUrl(a.file_path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Biblioteca de Conteúdo" description="Criativos e materiais anexados aos posts" icon={<Library className="h-5 w-5" />} />

      <Card><CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Cliente</Label>
          <Select value={client} onValueChange={setClient}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Buscar</Label>
          <Input placeholder="Nome do arquivo..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </CardContent></Card>

      {loading ? <Card className="p-6 text-sm text-muted-foreground">Carregando...</Card>
      : filtered.length === 0 ? <EmptyState icon={Library} title="Biblioteca vazia" description="Anexe arquivos aos posts para vê-los aqui." />
      : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map(a => {
            const Icon = iconFor(a.mime_type);
            const post = posts.find(p => p.id === a.post_id);
            const c = clients.find(x => x.id === post?.client_id);
            return (
              <Card key={a.id} className="cursor-pointer hover:shadow-md transition" onClick={() => download(a)}>
                <CardContent className="p-4 space-y-2">
                  <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                    <Icon className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" title={a.file_name}>{a.file_name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{c?.name} • {(a.file_size / 1024).toFixed(0)} KB</p>
                  </div>
                  <button className="text-xs text-primary inline-flex items-center gap-1"><Download className="h-3 w-3" />Baixar</button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
