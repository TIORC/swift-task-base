import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Check, X, Pencil, Trash2 } from "lucide-react";
import { useSupportCatalog, canEditSupportCatalog, type CatalogKind } from "@/hooks/useSupportCatalog";
import { useAuth } from "@/hooks/useAuth";

interface CatalogSelectProps {
  kind: CatalogKind;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  newPlaceholder?: string;
}

export function CatalogSelect({ kind, label, placeholder, value, onChange, required, newPlaceholder }: CatalogSelectProps) {
  const { user } = useAuth();
  const { items, addEntry, updateEntry, deleteEntry } = useSupportCatalog(kind);
  const canEdit = canEditSupportCatalog(user?.email);
  const selected = items.find((i) => i.name === value);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");

  const handleAdd = async () => {
    const clean = newName.trim();
    if (!clean) return;
    try {
      const created = await addEntry.mutateAsync({ kind, name: clean });
      onChange(created.name);
      setNewName("");
      setAdding(false);
    } catch {
      /* toast já exibido no hook */
    }
  };

  const startEdit = () => {
    if (!selected) return;
    setEditName(selected.name);
    setAdding(false);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    const clean = editName.trim();
    if (!clean) return;
    if (clean === selected.name) {
      setEditing(false);
      return;
    }
    try {
      const updated = await updateEntry.mutateAsync({ id: selected.id, name: clean });
      onChange(updated.name);
      setEditing(false);
    } catch {
      /* toast já exibido no hook */
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      await deleteEntry.mutateAsync(selected.id);
      onChange("");
    } catch {
      /* toast já exibido no hook */
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => {
            setAdding((a) => !a);
            setEditing(false);
          }}
        >
          {adding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          {adding ? "Cancelar" : "Cadastrar novo"}
        </Button>
      </div>

      {adding ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
            placeholder={newPlaceholder ?? `Nome do novo ${label.toLowerCase()}`}
            maxLength={80}
          />
          <Button type="button" onClick={handleAdd} disabled={!newName.trim() || addEntry.isPending} size="icon">
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : editing ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleSaveEdit();
              }
              if (e.key === "Escape") setEditing(false);
            }}
            maxLength={80}
          />
          <Button type="button" onClick={handleSaveEdit} disabled={!editName.trim() || updateEntry.isPending} size="icon" title="Salvar">
            <Check className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" onClick={() => setEditing(false)} size="icon" title="Cancelar">
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Select value={value} onValueChange={onChange}>
              <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
              <SelectContent className="max-h-72">
                {items.map((i) => (
                  <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {canEdit && (
            <>
              <Button type="button" variant="outline" size="icon" title="Editar" disabled={!selected} onClick={startEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" variant="outline" size="icon" title="Excluir" disabled={!selected} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir "{selected?.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Ele deixa de aparecer na lista de opções. Chamados já concluídos mantêm o texto salvo.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      )}
    </div>
  );
}
