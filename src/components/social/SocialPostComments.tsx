import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const sb = supabase as any;

interface Comment {
  id: string; post_id: string; user_id: string; content: string; created_at: string;
  profiles?: { full_name: string | null; avatar_url: string | null } | null;
}

export function SocialPostComments({ postId }: { postId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Comment[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  const refresh = async () => {
    if (!postId) { setItems([]); return; }
    const { data } = await sb.from("sm_post_comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    const list = (data ?? []) as Comment[];
    const ids = Array.from(new Set(list.map(c => c.user_id)));
    if (ids.length) {
      const { data: profs } = await sb.from("profiles").select("id, full_name, avatar_url").in("id", ids);
      const map = new Map<string, any>((profs ?? []).map((p: any) => [p.id, p]));
      list.forEach(c => { c.profiles = (map.get(c.user_id) as any) ?? null; });
    }
    setItems(list);
  };

  useEffect(() => { refresh(); }, [postId]);

  useEffect(() => {
    const ch = supabase.channel(`sm-comments-${postId}-${Math.random()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_post_comments", filter: `post_id=eq.${postId}` }, () => refresh())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [postId]);

  const send = async () => {
    if (!text.trim() || !user) return;
    setSending(true);
    const { error } = await sb.from("sm_post_comments").insert({ post_id: postId, user_id: user.id, content: text.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  const remove = async (id: string) => {
    await sb.from("sm_post_comments").delete().eq("id", id);
  };

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4"/>Comentários ({items.length})</span>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {items.map(c => (
          <div key={c.id} className="rounded-md border border-border p-2 text-sm">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span className="font-medium text-foreground">{c.profiles?.full_name || "Usuário"}</span>
              <div className="flex items-center gap-2">
                <span>{formatDistanceToNow(new Date(c.created_at), { locale: ptBR, addSuffix: true })}</span>
                {user?.id === c.user_id && <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => remove(c.id)}><Trash2 className="h-3 w-3"/></Button>}
              </div>
            </div>
            <div className="whitespace-pre-wrap">{c.content}</div>
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-muted-foreground">Sem comentários</p>}
      </div>
      <div className="flex gap-2">
        <Textarea rows={2} value={text} onChange={e => setText(e.target.value)} placeholder="Escreva um comentário..." />
        <Button onClick={send} disabled={sending || !text.trim()}>Enviar</Button>
      </div>
    </div>
  );
}
