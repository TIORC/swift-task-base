import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Lock, Eye, EyeOff, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Quem pode ver o cofre. A verificação de verdade é feita no banco (migration
// 20261112150000_hipocampo_cofre_compartilhado.sql); esta lista só esconde o botão.
export const VAULT_MEMBER_EMAILS = [
  "angel.kauan@orcoma.com.br",
  "gabriel.anacleto@orcoma.com.br",
  "sofia.nardes@orcoma.com.br",
  "welder@orcoma.com.br",
];

interface VaultItem {
  id: string;
  title: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// As funções do cofre ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

type Phase = "loading" | "setup" | "unlock" | "unlocked";

export function HippocampusVaultDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [keyword, setKeyword] = useState(""); // validada, fica só em memória
  const [input, setInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<VaultItem[]>([]);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!open) {
      setPhase("loading");
      setKeyword("");
      setInput("");
      setConfirmInput("");
      setItems([]);
      setRevealed({});
      setError(null);
      setTitle("");
      setContent("");
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await db.rpc("hippocampus_vault_status");
      if (cancelled) return;
      if (error) {
        setError(error.message);
        setPhase("unlock");
        return;
      }
      setPhase(data ? "unlock" : "setup");
    })();
    return () => { cancelled = true; };
  }, [open]);

  const loadItems = async (kw: string) => {
    const { data, error } = await db.rpc("hippocampus_vault_list", { p_keyword: kw });
    if (error) throw error;
    setItems((data ?? []) as VaultItem[]);
  };

  const unlock = async (kw: string) => {
    await loadItems(kw);
    setKeyword(kw);
    setInput("");
    setConfirmInput("");
    setPhase("unlocked");
  };

  const handleSetup = async () => {
    setError(null);
    if (input.trim().length < 4) return setError("Use pelo menos 4 caracteres.");
    if (input !== confirmInput) return setError("As palavras-chave não conferem.");
    setBusy(true);
    try {
      const { error } = await db.rpc("hippocampus_vault_set_keyword", { p_keyword: input });
      if (error) throw error;
      await unlock(input);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUnlock = async () => {
    setError(null);
    if (!input) return;
    setBusy(true);
    try {
      await unlock(input);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = async () => {
    if (!content.trim()) return;
    try {
      const { error } = await db.rpc("hippocampus_vault_add", { p_keyword: keyword, p_title: title, p_content: content });
      if (error) throw error;
      setTitle("");
      setContent("");
      await loadItems(keyword);
      toast.success("Guardado no cofre");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este item do cofre? Ele some para os quatro.")) return;
    try {
      const { error } = await db.rpc("hippocampus_vault_delete", { p_keyword: keyword, p_id: id });
      if (error) throw error;
      await loadItems(keyword);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Lock className="h-5 w-5" /> Cofre do Hipocampo
          </DialogTitle>
        </DialogHeader>

        {phase === "loading" && <p className="text-sm text-muted-foreground">Carregando...</p>}

        {phase === "setup" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              O cofre ainda não tem palavra-chave. Defina uma agora: ela fica guardada no banco (como hash) e será pedida sempre que o cofre for aberto.
            </p>
            <div className="space-y-2">
              <Label htmlFor="vault-new-key">Palavra-chave</Label>
              <Input id="vault-new-key" type="password" value={input} onChange={(e) => setInput(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vault-confirm-key">Confirmar palavra-chave</Label>
              <Input id="vault-confirm-key" type="password" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button onClick={handleSetup} disabled={busy}>Definir palavra-chave</Button>
            </DialogFooter>
          </div>
        )}

        {phase === "unlock" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vault-key">Palavra-chave</Label>
              <Input
                id="vault-key"
                type="password"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleUnlock(); }}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button onClick={handleUnlock} disabled={busy || !input}>Abrir cofre</Button>
            </DialogFooter>
          </div>
        )}

        {phase === "unlocked" && (
          <div className="space-y-5">
            <div className="space-y-2 rounded-lg border p-3">
              <Input placeholder="Título (opcional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="Conteúdo sensível" rows={3} value={content} onChange={(e) => setContent(e.target.value)} className="resize-none" />
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAdd} disabled={!content.trim()}>Guardar no cofre</Button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">O cofre está vazio.</p>
            ) : (
              <div className="space-y-3">
                {items.map((it) => {
                  const show = !!revealed[it.id];
                  return (
                    <div key={it.id} className="rounded-lg border p-3 space-y-2">
                      {it.title && <h3 className="font-semibold text-sm break-words">{it.title}</h3>}
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
                        {show ? it.content : "••••••••••••"}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRevealed((r) => ({ ...r, [it.id]: !show }))}>
                          {show ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {show ? "Ocultar" : "Revelar"}
                        </Button>
                        {show && (
                          <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(it.content); toast.success("Copiado"); }}>
                            <Copy className="h-3 w-3 mr-1" /> Copiar
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => handleDelete(it.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
