import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const sb = supabase as any;

type Item = { id: string; task_id: string; title: string; done: boolean; sort_order: number };

export function SocialTaskChecklist({ taskId }: { taskId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await sb
      .from("sm_task_checklist_items").select("*").eq("task_id", taskId)
      .order("sort_order").order("created_at");
    if (!error) setItems((data as Item[]) ?? []);
    setLoading(false);
  }, [taskId]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const t = newTitle.trim();
    if (!t || !user) return;
    const { error } = await sb.from("sm_task_checklist_items").insert({
      task_id: taskId, title: t, created_by: user.id, sort_order: items.length,
    });
    if (error) return toast.error(error.message);
    setNewTitle(""); load();
  };

  const toggle = async (item: Item) => {
    const { error } = await sb.from("sm_task_checklist_items").update({ done: !item.done }).eq("id", item.id);
    if (error) return toast.error(error.message);
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, done: !i.done } : i));
  };

  const del = async (id: string) => {
    const { error } = await sb.from("sm_task_checklist_items").delete().eq("id", id);
    if (error) return toast.error(error.message);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const total = items.length;
  const done = items.filter(i => i.done).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="space-y-3">
      {total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progresso</span><span>{done}/{total} ({pct}%)</span>
          </div>
          <Progress value={pct} />
        </div>
      )}
      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando...</p>
      ) : (
        <ul className="space-y-1">
          {items.map(i => (
            <li key={i.id} className="flex items-center gap-2 group">
              <Checkbox checked={i.done} onCheckedChange={() => toggle(i)} />
              <span className={`flex-1 text-sm ${i.done ? "line-through text-muted-foreground" : ""}`}>{i.title}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 text-destructive" onClick={() => del(i.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum item ainda.</p>}
        </ul>
      )}
      <div className="flex gap-2">
        <Input
          placeholder="Nova etapa..."
          value={newTitle}
          onChange={e => setNewTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
        />
        <Button onClick={add} size="sm"><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}
