import { useState } from "react";
import { Send, Trash2, Smartphone, Pencil, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  useSaveEntryBatch, useSaveExitBatch, useUpdateItem, useUpdateMovementText,
  type InventoryCategory, type InventoryCollaborator, type InventoryItem,
} from "@/hooks/useInventory";
import {
  useMobileEntries, useCreateMobileEntry, useDeleteMobileEntry, useUpdateMobileEntry,
  type MobileEntry, type MobileEntryKind,
} from "@/hooks/useMobileEntries";

// Data de hoje (yyyy-mm-dd) no fuso local.
const todayLocal = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const brDate = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};
const norm = (s: string) => s.trim().toLowerCase();

const TIPO_LABELS: Record<MobileEntryKind, string> = { in: "Entrada", out: "Saída", patrimonio: "Patrimônio", ativos: "Ativos" };

interface Props {
  categories: InventoryCategory[];
  items: InventoryItem[];
  collaborators: InventoryCollaborator[];
  canWrite: boolean;
  tiName: string;
}

// Campo de colaborador com busca: mostra os ativos cujo nome contém o texto digitado.
function CollaboratorPicker({ id, collaborators, value, onChange }: {
  id?: string; collaborators: InventoryCollaborator[]; value: string | null; onChange: (id: string | null) => void;
}) {
  const selected = collaborators.find((c) => c.id === value);
  const [text, setText] = useState(selected?.full_name ?? "");
  const [open, setOpen] = useState(false);
  const q = norm(text);
  const matches = q
    ? collaborators.filter((c) => c.active && norm(c.full_name).includes(q)).slice(0, 8)
    : [];

  const pick = (c: InventoryCollaborator) => {
    setText(c.full_name);
    onChange(c.id);
    setOpen(false);
  };

  return (
    <div className="relative space-y-1">
      <Input
        id={id}
        value={text}
        autoComplete="off"
        placeholder="Digite o nome do colaborador"
        className="h-9 text-sm"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onBlur={() => {
          setOpen(false);
          // Sem seleção: aceita o nome exato digitado ou limpa o texto incompleto.
          if (!value) {
            const exact = collaborators.find((c) => c.active && norm(c.full_name) === q);
            if (exact) pick(exact); else setText("");
          }
        }}
      />
      {open && q && (
        <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-md">
          {matches.length === 0 && (
            <li className="px-2 py-1.5 text-muted-foreground">Nenhum colaborador encontrado</li>
          )}
          {matches.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex w-full flex-col rounded px-2 py-1.5 text-left hover:bg-accent"
                onMouseDown={(e) => { e.preventDefault(); pick(c); }}
              >
                <span>{c.full_name}</span>
                {c.department && <span className="text-xs text-muted-foreground">{c.department}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Formulário no tamanho de um celular (366x600), aberto pelo botão Mobile do topo.
export function MobileEntryForm({ categories, collaborators, tiName }: Pick<Props, "categories" | "collaborators" | "tiName">) {
  const create = useCreateMobileEntry();
  const [equip, setEquip] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [collabId, setCollabId] = useState<string | null>(null);
  const [patrimonio, setPatrimonio] = useState("");
  const [tipo, setTipo] = useState<MobileEntryKind>("ativos");
  const [es, setEs] = useState("");

  const submit = async () => {
    if (!equip.trim()) { toast.error("Informe o equipamento"); return; }
    try {
      await create.mutateAsync({
        ti_name: tiName,
        equipamento: equip.trim(),
        collaborator_id: collabId,
        categoria_id: categoriaId || null,
        patrimonio: patrimonio.trim() || null,
        tipo,
        data: todayLocal(),
        es_text: es.trim() || null,
      });
      setEquip(""); setCategoriaId(""); setCollabId(null); setPatrimonio(""); setEs("");
      toast.success("Enviado para conferência");
    } catch {
      // o hook já mostra o erro
    }
  };

  return (
    <div className="mx-auto w-[366px] max-w-full overflow-hidden rounded-[32px] border-[10px] border-slate-900 bg-white shadow-xl max-md:w-full max-md:rounded-none max-md:border-0 max-md:shadow-none">
        <div className="flex h-[100dvh] flex-col md:h-[600px]">
          <div className="flex shrink-0 items-center gap-2 border-b bg-[#002366] px-4 py-3 text-white">
            <Smartphone className="h-4 w-4" />
            <span className="text-sm font-semibold">Lançamento de Ativos</span>
          </div>

          <form
            className="flex-1 space-y-3 overflow-y-auto p-4"
            onSubmit={(e) => { e.preventDefault(); void submit(); }}
          >
            <div className="space-y-1">
              <Label htmlFor="m-colab" className="text-xs">Colaborador</Label>
              <CollaboratorPicker id="m-colab" collaborators={collaborators} value={collabId} onChange={setCollabId} />
            </div>

            <div className="space-y-1">
              <Label htmlFor="m-equip" className="text-xs">Equipamento/Ativo</Label>
              <Input id="m-equip" value={equip} onChange={(e) => setEquip(e.target.value)} placeholder="Ex.: Notebook Dell" className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="m-pat" className="text-xs">Patrimônio</Label>
              <Input id="m-pat" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} placeholder="Opcional" className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tipo de controle</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as MobileEntryKind)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="patrimonio">Patrimônio</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input value={`${brDate(todayLocal())} (hoje)`} readOnly disabled className="h-9 text-sm" />
            </div>

            <div className="space-y-1">
              <Label htmlFor="m-es" className="text-xs">E&amp;S</Label>
              <Input id="m-es" value={es} onChange={(e) => setEs(e.target.value)} placeholder="Digite o E&S" className="h-9 text-sm" />
            </div>

            <Button type="submit" className="mt-2 h-10 w-full gap-2" disabled={create.isPending}>
              <Send className="h-4 w-4" />
              Lançar
            </Button>
          </form>
        </div>
    </div>
  );
}

// Janela de detalhes de um lançamento pendente, com edição opcional.
function EntryDialog({ entry, startEditing, categories, collaborators, canWrite, onClose }: {
  entry: MobileEntry; startEditing: boolean; categories: InventoryCategory[]; collaborators: InventoryCollaborator[];
  canWrite: boolean; onClose: () => void;
}) {
  const update = useUpdateMobileEntry();
  const [editing, setEditing] = useState(startEditing && canWrite);
  const [equip, setEquip] = useState(entry.equipamento);
  const [categoriaId, setCategoriaId] = useState(entry.categoria_id ?? "");
  const [collabId, setCollabId] = useState<string | null>(entry.collaborator_id);
  const [patrimonio, setPatrimonio] = useState(entry.patrimonio ?? "");
  const [tipo, setTipo] = useState<MobileEntryKind>(entry.tipo);
  const [data, setData] = useState(entry.data);
  const [es, setEs] = useState(entry.es_text ?? "");

  const save = async () => {
    if (!equip.trim()) { toast.error("Informe o equipamento"); return; }
    try {
      await update.mutateAsync({
        id: entry.id,
        equipamento: equip.trim(),
        categoria_id: categoriaId || null,
        patrimonio: patrimonio.trim() || null,
        tipo,
        collaborator_id: collabId,
        data,
        es_text: es.trim() || null,
      });
      onClose();
    } catch {
      // o hook já mostra o erro
    }
  };

  const catName = categories.find((c) => c.id === entry.categoria_id)?.name ?? "—";
  const colabName = collaborators.find((c) => c.id === entry.collaborator_id)?.full_name ?? "—";
  const criadoEm = new Date(entry.created_at).toLocaleString("pt-BR");

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar lançamento" : "Detalhes do lançamento"}</DialogTitle>
          <DialogDescription>Lançamento enviado pelo celular, aguardando conferência.</DialogDescription>
        </DialogHeader>

        {editing ? (
          <form
            id="mobile-entry-edit"
            className="space-y-3"
            onSubmit={(e) => { e.preventDefault(); void save(); }}
          >
            <div className="space-y-1">
              <Label className="text-xs">Nome do TI</Label>
              <Input value={entry.ti_name} readOnly disabled className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-colab" className="text-xs">Colaborador</Label>
              <CollaboratorPicker id="e-colab" collaborators={collaborators} value={collabId} onChange={setCollabId} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-equip" className="text-xs">Equipamento/Ativo</Label>
              <Input id="e-equip" value={equip} onChange={(e) => setEquip(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaId} onValueChange={setCategoriaId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecione a categoria" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-pat" className="text-xs">Patrimônio</Label>
              <Input id="e-pat" value={patrimonio} onChange={(e) => setPatrimonio(e.target.value)} placeholder="Opcional" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tipo de controle</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as MobileEntryKind)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Entrada</SelectItem>
                  <SelectItem value="out">Saída</SelectItem>
                  <SelectItem value="patrimonio">Patrimônio</SelectItem>
                  <SelectItem value="ativos">Ativos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-data" className="text-xs">Data</Label>
              <Input id="e-data" type="date" value={data} onChange={(e) => setData(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-es" className="text-xs">E&amp;S</Label>
              <Input id="e-es" value={es} onChange={(e) => setEs(e.target.value)} placeholder="Digite o E&S" className="h-9 text-sm" />
            </div>
          </form>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted-foreground">Nome do TI</dt><dd>{entry.ti_name}</dd>
            <dt className="text-muted-foreground">Colaborador</dt><dd>{colabName}</dd>
            <dt className="text-muted-foreground">Equipamento</dt><dd className="font-medium">{entry.equipamento}</dd>
            <dt className="text-muted-foreground">Categoria</dt><dd>{catName}</dd>
            <dt className="text-muted-foreground">Patrimônio</dt><dd>{entry.patrimonio || "—"}</dd>
            <dt className="text-muted-foreground">Tipo de controle</dt><dd>{TIPO_LABELS[entry.tipo]}</dd>
            <dt className="text-muted-foreground">Data</dt><dd>{brDate(entry.data)}</dd>
            <dt className="text-muted-foreground">E&amp;S</dt><dd>{entry.es_text || "—"}</dd>
            <dt className="text-muted-foreground">Enviado em</dt><dd>{criadoEm}</dd>
          </dl>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          {editing ? (
            <>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} disabled={update.isPending}>Cancelar</Button>
              <Button type="submit" form="mobile-entry-edit" disabled={update.isPending} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Salvar
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
              {canWrite && (
                <Button type="button" className="gap-1.5" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5" />
                  Editar
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lançamentos enviados pelo celular (aba Mobile), aguardando conferência antes de irem para o sistema.
export function PendingList({ items, categories, collaborators, canWrite }: {
  items: InventoryItem[]; categories: InventoryCategory[]; collaborators: InventoryCollaborator[]; canWrite: boolean;
}) {
  const { data: pending = [], isLoading } = useMobileEntries();
  const remove = useDeleteMobileEntry();
  const saveEntry = useSaveEntryBatch();
  const saveExit = useSaveExitBatch();
  const updateItem = useUpdateItem();
  const updateText = useUpdateMovementText();
  const [picks, setPicks] = useState<Record<string, { itemId?: string; collabId?: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ entry: MobileEntry; startEditing: boolean } | null>(null);

  const setPick = (id: string, patch: { itemId?: string; collabId?: string }) =>
    setPicks((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  // Mesma gravação da linha de digitação do Entradas e Saídas: item, categoria e E&S.
  const launch = async (e: MobileEntry) => {
    const pick = picks[e.id] ?? {};
    const defaultItemId = items.find((i) => norm(i.name) === norm(e.equipamento))?.id ?? "";
    const itemId = pick.itemId ?? defaultItemId;
    setBusyId(e.id);
    try {
      const occurredIso = new Date(e.created_at).toISOString();
      // Só "Saída" tira do estoque; os demais tipos seguem o fluxo de entrada.
      if (e.tipo !== "out") {
        const res = await saveEntry.mutateAsync([{
          kind: "new", name: e.equipamento, brand: null, model: null, patrimony_number: e.patrimonio,
          serial_number: null, quantity: 1, unit_price: 0, entry_date: e.data, occurred_at: occurredIso,
          notes: null, purchased: true,
        }]);
        if (!res.ok) return;
        if (e.categoria_id) {
          const { data } = await supabase.from("inventory_items")
            .select("id").eq("name", e.equipamento).order("created_at", { ascending: false }).limit(1);
          const newId = data?.[0]?.id;
          if (newId) await updateItem.mutateAsync({ id: newId, category_id: e.categoria_id } as never);
        }
        if (e.es_text) {
          const { data } = await supabase.from("inventory_movements")
            .select("id").eq("type", "in").order("created_at", { ascending: false }).limit(1);
          const id = data?.[0]?.id;
          if (id) await updateText.mutateAsync({ id, field: "es_text", value: e.es_text });
        }
      } else {
        if (!itemId) { toast.error("Selecione o equipamento do estoque"); return; }
        const collabId = pick.collabId ?? e.collaborator_id ?? "";
        if (!collabId) { toast.error("Toda saída exige um responsável"); return; }
        const collab = collaborators.find((c) => c.id === collabId);
        const res = await saveExit.mutateAsync([{
          kind: "new", item_id: itemId, quantity: 1, occurred_at: occurredIso,
          collaborator_id: collabId, department: collab?.department ?? null,
          reason: null, patrimony_number: e.patrimonio, notes: null,
        }]);
        if (!res.ok) return;
        if (e.categoria_id) {
          const item = items.find((i) => i.id === itemId);
          if (item && item.category_id !== e.categoria_id) {
            await updateItem.mutateAsync({ id: itemId, category_id: e.categoria_id } as never);
          }
        }
        if (e.es_text) {
          const { data } = await supabase.from("inventory_movements")
            .select("id").eq("type", "out").order("created_at", { ascending: false }).limit(1);
          const id = data?.[0]?.id;
          if (id) await updateText.mutateAsync({ id, field: "es_text", value: e.es_text });
        }
      }
      await remove.mutateAsync(e.id);
      toast.success("Lançado no sistema");
    } catch {
      // os hooks já mostram o erro
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Aguardando conferência ({pending.length})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {!isLoading && pending.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">Nenhum lançamento pendente.</p>
        )}
        {pending.map((e) => {
          const pick = picks[e.id] ?? {};
          const defaultItemId = items.find((i) => norm(i.name) === norm(e.equipamento))?.id ?? "";
          return (
            <div key={e.id} className="space-y-2 rounded-lg border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{e.equipamento}</span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{TIPO_LABELS[e.tipo]}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>TI: {e.ti_name}</span>
                <span>Colaborador: {collaborators.find((c) => c.id === e.collaborator_id)?.full_name ?? "—"}</span>
                <span>Data: {brDate(e.data)}</span>
                <span>Patrimônio: {e.patrimonio || "—"}</span>
                <span>E&amp;S: {e.es_text || "—"}</span>
              </div>

              {canWrite && e.tipo === "out" && (
                <div className="grid gap-2 pt-1">
                  <Select value={pick.itemId ?? defaultItemId} onValueChange={(v) => setPick(e.id, { itemId: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Equipamento do estoque" /></SelectTrigger>
                    <SelectContent>
                      {items.filter((i) => i.status === "active").map((i) => (
                        <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={pick.collabId ?? e.collaborator_id ?? ""} onValueChange={(v) => setPick(e.id, { collabId: v })}>
                    <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Responsável" /></SelectTrigger>
                    <SelectContent>
                      {collaborators.filter((c) => c.active).map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {canWrite && (
                <Button size="sm" className="h-8 w-full gap-1.5" disabled={busyId === e.id} onClick={() => void launch(e)}>
                  <Send className="h-3.5 w-3.5" />
                  Lançar
                </Button>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 flex-1 gap-1.5"
                  onClick={() => setDialog({ entry: e, startEditing: false })}
                >
                  <Eye className="h-3.5 w-3.5" />
                  Detalhes
                </Button>
                {canWrite && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 gap-1.5"
                      disabled={busyId === e.id}
                      onClick={() => setDialog({ entry: e, startEditing: true })}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 flex-1 gap-1.5 text-destructive"
                      disabled={busyId === e.id || remove.isPending}
                      onClick={() => remove.mutate(e.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Excluir
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
      {dialog && (
        <EntryDialog
          key={`${dialog.entry.id}-${dialog.startEditing}`}
          entry={dialog.entry}
          startEditing={dialog.startEditing}
          categories={categories}
          collaborators={collaborators}
          canWrite={canWrite}
          onClose={() => setDialog(null)}
        />
      )}
    </Card>
  );
}
