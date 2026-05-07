import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Columns3 } from "lucide-react";
import { useSmPosts, useSmClients, useSocialMutations } from "@/hooks/useSocial";
import { SM_POST_STATUS_LABEL, SM_POST_STATUS_ORDER } from "@/types/social";
import type { SmPost, SmPostStatus } from "@/types/social";
import { SocialPostDialog } from "@/components/social/SocialPostDialog";
import { toast } from "sonner";

const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-primary/10 text-primary",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export default function SocialKanban() {
  const { data: posts, refresh } = useSmPosts();
  const { data: clients } = useSmClients();
  const m = useSocialMutations();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmPost | null>(null);

  const grouped = useMemo(() => {
    const g: Record<SmPostStatus, SmPost[]> = {
      ideia: [], roteiro: [], design: [], revisao_interna: [], aprovacao_cliente: [], agendado: [], publicado: [], reprovado: [],
    };
    posts.forEach(p => g[p.status]?.push(p));
    return g;
  }, [posts]);

  const onDrop = async (e: React.DragEvent, status: SmPostStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const post = posts.find(p => p.id === id);
    if (!post || post.status === status) return;
    const { error } = await m.updatePost(id, { status });
    if (error) toast.error(error.message);
    else refresh();
  };

  const clientName = (id: string) => clients.find(c => c.id === id)?.name ?? "—";

  return (
    <div className="space-y-4 h-full flex flex-col">
      <PageHeader
        title="Kanban de Conteúdo"
        description="Arraste posts entre etapas do fluxo"
        icon={<Columns3 className="h-5 w-5"/>}
        actions={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1"/>Novo post</Button>}
      />
      <div className="flex-1 overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max h-full">
          {SM_POST_STATUS_ORDER.map(status => (
            <div
              key={status}
              className="w-72 flex flex-col bg-muted/30 rounded-xl p-2 max-h-[calc(100vh-240px)]"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDrop(e, status)}
            >
              <div className="flex items-center justify-between px-2 py-1.5 sticky top-0">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{SM_POST_STATUS_LABEL[status]}</h3>
                <span className="text-[10px] bg-background rounded-full px-2 py-0.5">{grouped[status].length}</span>
              </div>
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {grouped[status].map(p => (
                  <Card
                    key={p.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", p.id)}
                    onClick={() => { setEditing(p); setOpen(true); }}
                    className="p-3 cursor-pointer hover:border-primary transition-colors"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{clientName(p.client_id)}</p>
                    <p className="text-sm font-medium mt-1 line-clamp-2">{p.title}</p>
                    <div className="flex items-center justify-between mt-2 gap-2">
                      <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLOR[p.priority]}`}>{p.priority}</Badge>
                      {p.scheduled_at && <span className="text-[10px] text-muted-foreground">{new Date(p.scheduled_at).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SocialPostDialog open={open} onOpenChange={setOpen} post={editing} onSaved={refresh} />
    </div>
  );
}
