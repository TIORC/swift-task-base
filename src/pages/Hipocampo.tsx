import { useState, useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useHippocampus, useAllHippocampusUsers, type HippocampusType, type HippocampusNote } from "@/hooks/useHippocampus";
import { useUserRole } from "@/hooks/useUserRole";
import { Lightbulb, Sparkles, AlertTriangle, Bell, Link2, Lock, StickyNote, Pin, Archive, Trash2, Eye, EyeOff, Copy, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPES: { key: HippocampusType; label: string; icon: any; color: string }[] = [
  { key: "idea", label: "Ideia", icon: Lightbulb, color: "text-yellow-500" },
  { key: "tip", label: "Dica", icon: Sparkles, color: "text-blue-500" },
  { key: "warning", label: "Aviso", icon: AlertTriangle, color: "text-orange-500" },
  { key: "reminder", label: "Lembrete", icon: Bell, color: "text-purple-500" },
  { key: "link", label: "Link", icon: Link2, color: "text-cyan-500" },
  { key: "vault", label: "Cofre", icon: Lock, color: "text-red-500" },
  { key: "note", label: "Nota livre", icon: StickyNote, color: "text-muted-foreground" },
];

function typeMeta(t: HippocampusType) {
  return TYPES.find((x) => x.key === t) ?? TYPES[6];
}

function NoteCard({ note, onUpdate, onDelete, readOnly }: { note: HippocampusNote; onUpdate?: (patch: Partial<HippocampusNote>) => void; onDelete?: () => void; readOnly?: boolean }) {
  const meta = typeMeta(note.type);
  const Icon = meta.icon;
  const [revealed, setRevealed] = useState(false);
  const isVault = note.type === "vault" || note.is_sensitive;
  const showMasked = isVault && !revealed;

  return (
    <Card className={note.is_pinned ? "border-primary/60 shadow-md" : ""}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon className={`h-4 w-4 shrink-0 ${meta.color}`} />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">{meta.label}</span>
            {note.is_pinned && <Pin className="h-3 w-3 text-primary" />}
          </div>
          {!readOnly && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUpdate?.({ is_pinned: !note.is_pinned })} title="Fixar">
                <Pin className={`h-3.5 w-3.5 ${note.is_pinned ? "fill-current" : ""}`} />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onUpdate?.({ is_archived: !note.is_archived })} title="Arquivar">
                <Archive className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete} title="Excluir">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
        {note.title && <h3 className="font-semibold text-sm break-words">{note.title}</h3>}
        <div className="text-sm text-muted-foreground whitespace-pre-wrap break-words">
          {showMasked ? "••••••••••••" : note.content}
        </div>
        {isVault && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => {
              if (!revealed && !confirm("Revelar conteúdo sensível?")) return;
              setRevealed(!revealed);
            }}>
              {revealed ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
              {revealed ? "Ocultar" : "Revelar"}
            </Button>
            {revealed && (
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(note.content); toast.success("Copiado"); }}>
                <Copy className="h-3 w-3 mr-1" /> Copiar
              </Button>
            )}
          </div>
        )}
        {note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {note.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
          </div>
        )}
        {note.reminder_at && (
          <div className="text-xs text-purple-500 flex items-center gap-1">
            <Bell className="h-3 w-3" /> {new Date(note.reminder_at).toLocaleString("pt-BR")}
          </div>
        )}
        <div className="text-[10px] text-muted-foreground">
          {formatDistanceToNow(new Date(note.updated_at), { locale: ptBR, addSuffix: true })}
        </div>
      </CardContent>
    </Card>
  );
}

function QuickCapture({ onCreate }: { onCreate: (content: string, type: HippocampusType) => Promise<void> }) {
  const [content, setContent] = useState("");
  const [type, setType] = useState<HippocampusType>("note");
  const [advanced, setAdvanced] = useState(false);
  const [title, setTitle] = useState("");
  const [tags, setTags] = useState("");
  const [pinned, setPinned] = useState(false);
  const [reminderAt, setReminderAt] = useState("");

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await onCreate(content, type);
    setContent(""); setType("note"); setAdvanced(false); setTitle(""); setTags(""); setPinned(false); setReminderAt("");
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="O que você quer guardar agora?"
          rows={3}
          className="resize-none"
        />
        <div className="flex flex-wrap gap-1.5">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.key;
            return (
              <Button key={t.key} size="sm" variant={active ? "default" : "outline"} onClick={() => setType(t.key)} className="h-7 text-xs">
                <Icon className={`h-3 w-3 mr-1 ${active ? "" : t.color}`} /> {t.label}
              </Button>
            );
          })}
        </div>
        <div className="flex justify-between items-center">
          <Button size="sm" variant="ghost" onClick={() => setAdvanced(!advanced)} className="text-xs">
            {advanced ? "Ocultar opções" : "Mais opções"}
          </Button>
          <Button onClick={handleSubmit} disabled={!content.trim()}>Guardar no Hipocampo</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HippocampusView({ targetUserId, readOnly, userLabel }: { targetUserId?: string; readOnly?: boolean; userLabel?: string }) {
  const { notes, loading, create, update, remove } = useHippocampus(targetUserId);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = notes;
    if (filter === "pinned") list = list.filter((n) => n.is_pinned && !n.is_archived);
    else if (filter === "archived") list = list.filter((n) => n.is_archived);
    else if (filter === "all") list = list.filter((n) => !n.is_archived);
    else list = list.filter((n) => n.type === filter && !n.is_archived);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => (n.title ?? "").toLowerCase().includes(q) || n.content.toLowerCase().includes(q) || n.tags.join(" ").toLowerCase().includes(q));
    }
    return list;
  }, [notes, filter, search]);

  return (
    <div className="space-y-4">
      {userLabel && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
          Visualizando Hipocampo de: <strong>{userLabel}</strong>
        </div>
      )}
      {!readOnly && (
        <QuickCapture onCreate={async (content, type) => {
          try { await create({ content, type }); toast.success("Guardado no Hipocampo"); }
          catch (e: any) { toast.error(e.message); }
        }} />
      )}

      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar no Hipocampo..." className="pl-9" />
        </div>
      </div>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Tudo</TabsTrigger>
          <TabsTrigger value="pinned">Fixados</TabsTrigger>
          {TYPES.map((t) => <TabsTrigger key={t.key} value={t.key}>{t.label}</TabsTrigger>)}
          <TabsTrigger value="archived">Arquivados</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="text-center text-muted-foreground py-12">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border border-dashed rounded-lg">
          {search ? "Nada encontrado no seu Hipocampo. Tente buscar por outra palavra." : "Seu Hipocampo ainda está vazio. Guarde uma ideia, aviso, dica ou lembrete para encontrar depois com facilidade."}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              readOnly={readOnly}
              onUpdate={(patch) => update(n.id, patch).catch((e) => toast.error(e.message))}
              onDelete={() => { if (confirm("Excluir esta anotação?")) remove(n.id).catch((e) => toast.error(e.message)); }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AdminView() {
  const { users, loading } = useAllHippocampusUsers();
  const [selected, setSelected] = useState<string | null>(null);

  if (loading) return <div className="text-muted-foreground text-center py-8">Carregando...</div>;
  if (selected) {
    const u = users.find((x) => x.user_id === selected);
    return (
      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={() => setSelected(null)}>← Voltar</Button>
        <HippocampusView targetUserId={selected} readOnly userLabel={u?.full_name ?? selected} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Visualize e acompanhe os Hipocampos dos usuários do sistema.</p>
      {users.length === 0 ? (
        <div className="text-center text-muted-foreground py-12 border border-dashed rounded-lg">Nenhum usuário possui anotações ainda.</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <Card key={u.user_id} className="cursor-pointer hover:border-primary/60" onClick={() => setSelected(u.user_id)}>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">{u.full_name ?? u.user_id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">{u.count} anotações</div>
                </div>
                <Users className="h-5 w-5 text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Hipocampo() {
  const { isAdmin } = useUserRole();
  const [tab, setTab] = useState<"mine" | "admin">("mine");

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto">
      <PageHeader
        title="Hipocampo"
        description="Seu segundo cérebro para guardar ideias, lembretes, avisos e informações importantes."
      />
      {isAdmin ? (
        <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
          <TabsList>
            <TabsTrigger value="mine">Meu Hipocampo</TabsTrigger>
            <TabsTrigger value="admin">Hipocampos dos Usuários</TabsTrigger>
          </TabsList>
          <div className="mt-4">
            {tab === "mine" ? <HippocampusView /> : <AdminView />}
          </div>
        </Tabs>
      ) : (
        <HippocampusView />
      )}
    </div>
  );
}
