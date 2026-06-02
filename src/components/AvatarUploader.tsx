import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

export function AvatarUploader() {
  const { user } = useAuth();
  const { profile, avatarUrl, refresh } = useProfile();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const initials = (profile?.full_name || user?.email || "U")
    .split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  const upload = async (file: File) => {
    if (!user) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("Arquivo maior que 5MB.");
    setBusy(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;
    const { error: upErr } = await (supabase as any).storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) { setBusy(false); return toast.error(upErr.message); }
    const { error: profErr } = await (supabase as any)
      .from("profiles")
      .update({ avatar_url: path })
      .eq("id", user.id);
    setBusy(false);
    if (profErr) return toast.error(profErr.message);
    toast.success("Foto atualizada");
    refresh();
  };

  const remove = async () => {
    if (!user || !profile?.avatar_url) return;
    setBusy(true);
    await (supabase as any).storage.from("avatars").remove([profile.avatar_url]);
    await (supabase as any).from("profiles").update({ avatar_url: null }).eq("id", user.id);
    setBusy(false);
    toast.success("Foto removida");
    refresh();
  };

  return (
    <div className="flex items-center gap-4">
      <Avatar className="h-20 w-20">
        {avatarUrl && <AvatarImage src={avatarUrl} alt="Avatar" />}
        <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-col gap-2">
        <input
          ref={inputRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
        />
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin"/> : <Camera className="h-4 w-4 mr-1"/>}
          Alterar foto
        </Button>
        {profile?.avatar_url && (
          <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={remove} disabled={busy}>
            <Trash2 className="h-4 w-4 mr-1"/>Remover
          </Button>
        )}
      </div>
    </div>
  );
}
