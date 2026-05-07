import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Paperclip, Trash2, Download } from "lucide-react";
import { toast } from "sonner";
import { formatFileSize, getPublicUrl } from "@/hooks/useAttachments";

const sb = supabase as any;
const MAX_SIZE = 80 * 1024 * 1024;

interface Att {
  id: string; post_id: string; user_id: string;
  file_name: string; file_path: string; file_size: number; mime_type: string; created_at: string;
}

export function SocialPostAttachments({ postId, clientId }: { postId: string; clientId: string }) {
  const { user } = useAuth();
  const [items, setItems] = useState<Att[]>([]);
  const [uploading, setUploading] = useState(false);

  const refresh = async () => {
    const { data } = await sb.from("sm_post_attachments").select("*").eq("post_id", postId).order("created_at", { ascending: false });
    setItems((data ?? []) as Att[]);
  };

  useEffect(() => { refresh(); }, [postId]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f || !user) return;
    if (f.size > MAX_SIZE) return toast.error("Arquivo > 80MB");
    setUploading(true);
    const path = `sm/${clientId}/${postId}/${Date.now()}_${f.name}`;
    const { error: upErr } = await supabase.storage.from("task-attachments").upload(path, f, { upsert: false });
    if (upErr) { setUploading(false); return toast.error(upErr.message); }
    const { error } = await sb.from("sm_post_attachments").insert({
      post_id: postId, user_id: user.id, file_name: f.name, file_path: path, file_size: f.size, mime_type: f.type,
    });
    setUploading(false); e.target.value = "";
    if (error) return toast.error(error.message);
    toast.success("Arquivo enviado"); refresh();
  };

  const remove = async (a: Att) => {
    await supabase.storage.from("task-attachments").remove([a.file_path]);
    await sb.from("sm_post_attachments").delete().eq("id", a.id);
    toast.success("Removido"); refresh();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium flex items-center gap-2"><Paperclip className="h-4 w-4"/>Anexos ({items.length})</span>
        <label className="cursor-pointer">
          <input type="file" className="hidden" onChange={onFile} disabled={uploading}/>
          <span className="text-xs px-3 py-1 rounded-md bg-primary text-primary-foreground inline-block">{uploading ? "Enviando..." : "Adicionar"}</span>
        </label>
      </div>
      <div className="space-y-1">
        {items.map(a => {
          const url = getPublicUrl(a.file_path);
          const isImg = a.mime_type?.startsWith("image/");
          return (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded-md border border-border">
              {isImg ? <img src={url} alt={a.file_name} className="h-10 w-10 rounded object-cover"/> : <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-xs">{a.file_name.split(".").pop()?.toUpperCase()}</div>}
              <div className="flex-1 min-w-0">
                <div className="text-sm truncate">{a.file_name}</div>
                <div className="text-xs text-muted-foreground">{formatFileSize(a.file_size)}</div>
              </div>
              <Button size="icon" variant="ghost" asChild><a href={url} target="_blank" rel="noreferrer"><Download className="h-4 w-4"/></a></Button>
              {user?.id === a.user_id && <Button size="icon" variant="ghost" onClick={() => remove(a)}><Trash2 className="h-4 w-4"/></Button>}
            </div>
          );
        })}
        {items.length === 0 && <p className="text-xs text-muted-foreground">Nenhum anexo</p>}
      </div>
    </div>
  );
}
