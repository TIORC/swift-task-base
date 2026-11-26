import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Lock, Eye, EyeOff, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";

// Quem pode ver o cofre. A verificação de verdade é feita no banco (migration
// 20261112150000_hipocampo_cofre_compartilhado.sql); esta lista só esconde o botão.
export const VAULT_MEMBER_EMAILS = [
  "angel.kauan@orcoma.com.br",
  "gabriel.anacleto@orcoma.com.br",
  "sofia.nardes@orcoma.com.br",
  "welder@orcoma.com.br",
  "timaracas@orcoma.com.br",
];

// Única conta que pode alterar a palavra-chave. A verificação de verdade é feita
// na função hippocampus_vault_change_keyword; aqui só esconde o botão.
export const VAULT_OWNER_EMAIL = "timaracas@orcoma.com.br";

interface VaultItem {
  id: string;
  title: string | null;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface VaultCredential {
  login: string;
  senha: string;
  caminho: string;
}

// Login, senha e caminho são guardados como JSON dentro do campo de conteúdo.
// Itens antigos (texto livre) continuam aparecendo como antes.
const encodeCredential = (c: VaultCredential) => JSON.stringify({ tipo: "credencial", ...c });

const decodeCredential = (raw: string): VaultCredential | null => {
  try {
    const d = JSON.parse(raw);
    if (d && d.tipo === "credencial") {
      return { login: String(d.login ?? ""), senha: String(d.senha ?? ""), caminho: String(d.caminho ?? "") };
    }
  } catch {
    // texto livre: não é credencial
  }
  return null;
};

// As funções do cofre ainda não estão nos tipos gerados do Supabase.
const db = supabase as any;

// Campo de palavra-chave com botão para mostrar/ocultar o texto.
function PasswordInput({ id, value, onChange, onKeyDown, autoFocus }: {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        autoFocus={autoFocus}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        className="pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
        aria-label={visible ? "Ocultar palavra-chave" : "Mostrar palavra-chave"}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

// Uma linha de credencial (Login, Senha ou Caminho) com botão de copiar quando visível.
function CredentialRow({ label, value, show }: { label: string; value: string; show: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 font-medium">{label}:</span>
      <span className="min-w-0 flex-1 break-all">{show ? (value || "—") : "••••••••"}</span>
      {show && value && (
        <button
          type="button"
          onClick={() => { navigator.clipboard.writeText(value); toast.success(`${label} copiado`); }}
          className="text-red-200 hover:text-white"
          aria-label={`Copiar ${label}`}
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

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
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [caminho, setCaminho] = useState("");
  const [changing, setChanging] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [confirmNewKey, setConfirmNewKey] = useState("");
  const { user } = useAuth();
  const isOwner = (user?.email ?? "").trim().toLowerCase() === VAULT_OWNER_EMAIL;

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
      setLogin("");
      setSenha("");
      setCaminho("");
      setChanging(false);
      setNewKey("");
      setConfirmNewKey("");
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

  // Fecha o cofre 5 minutos depois de aberto: apaga a palavra-chave e os itens da memória.
  useEffect(() => {
    if (phase !== "unlocked") return;
    const timer = setTimeout(() => {
      setKeyword("");
      setItems([]);
      setRevealed({});
      setTitle("");
      setLogin("");
      setSenha("");
      setCaminho("");
      setInput("");
      setChanging(false);
      setNewKey("");
      setConfirmNewKey("");
      setPhase("unlock");
      setError("O cofre fechou automaticamente após 5 minutos. Abra novamente.");
    }, 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [phase]);

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
    if (!title.trim()) return;
    const payload = encodeCredential({ login: login.trim(), senha, caminho: caminho.trim() });
    try {
      const { error } = await db.rpc("hippocampus_vault_add", { p_keyword: keyword, p_title: title, p_content: payload });
      if (error) throw error;
      setTitle("");
      setLogin("");
      setSenha("");
      setCaminho("");
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

  const handleChangeKeyword = async () => {
    setError(null);
    if (newKey.trim().length < 4) return setError("Use pelo menos 4 caracteres.");
    if (newKey !== confirmNewKey) return setError("As palavras-chave não conferem.");
    setBusy(true);
    try {
      const { error } = await db.rpc("hippocampus_vault_change_keyword", { p_old: keyword, p_new: newKey });
      if (error) throw error;
      setKeyword(newKey);
      setChanging(false);
      setNewKey("");
      setConfirmNewKey("");
      toast.success("Palavra-chave alterada");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
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
              <PasswordInput id="vault-new-key" value={input} onChange={(e) => setInput(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vault-confirm-key">Confirmar palavra-chave</Label>
              <PasswordInput id="vault-confirm-key" value={confirmInput} onChange={(e) => setConfirmInput(e.target.value)} />
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
              <PasswordInput
                id="vault-key"
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
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-2">
                <Label htmlFor="vault-item-title">Título</Label>
                <Input id="vault-item-title" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vault-item-login">Login</Label>
                <Input id="vault-item-login" value={login} onChange={(e) => setLogin(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vault-item-senha">Senha</Label>
                <PasswordInput id="vault-item-senha" value={senha} onChange={(e) => setSenha(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vault-item-caminho">Caminho</Label>
                <Input id="vault-item-caminho" value={caminho} onChange={(e) => setCaminho(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleAdd} disabled={!title.trim()}>Guardar no cofre</Button>
              </div>
            </div>

            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-6">O cofre está vazio.</p>
            ) : (
              <div className="space-y-3">
                {items.map((it) => {
                  const show = !!revealed[it.id];
                  const cred = decodeCredential(it.content);
                  return (
                    <div key={it.id} className="rounded-lg border border-red-800 bg-red-900 text-white p-3 space-y-2">
                      {it.title && <h3 className="font-semibold text-sm break-words">{it.title}</h3>}
                      {cred ? (
                        <div className="space-y-1 text-sm text-red-100">
                          <CredentialRow label="Login" value={cred.login} show={show} />
                          <CredentialRow label="Senha" value={cred.senha} show={show} />
                          <CredentialRow label="Caminho" value={cred.caminho} show={show} />
                        </div>
                      ) : (
                        <div className="text-sm text-red-100 whitespace-pre-wrap break-words">
                          {show ? it.content : "••••••••••••"}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setRevealed((r) => ({ ...r, [it.id]: !show }))}>
                          {show ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                          {show ? "Ocultar" : "Revelar"}
                        </Button>
                        {show && !cred && (
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
            {isOwner && (
              <div className="border-t pt-4">
                {!changing ? (
                  <div className="flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => { setChanging(true); setError(null); }}>
                      Alterar palavra-chave
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-lg border p-3">
                    <div className="space-y-2">
                      <Label htmlFor="vault-new-key-change">Nova palavra-chave</Label>
                      <PasswordInput id="vault-new-key-change" value={newKey} onChange={(e) => setNewKey(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="vault-confirm-new-key">Confirmar nova palavra-chave</Label>
                      <PasswordInput id="vault-confirm-new-key" value={confirmNewKey} onChange={(e) => setConfirmNewKey(e.target.value)} />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => { setChanging(false); setNewKey(""); setConfirmNewKey(""); setError(null); }}>
                        Cancelar
                      </Button>
                      <Button size="sm" onClick={handleChangeKeyword} disabled={busy}>Salvar nova palavra-chave</Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
