import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Check, X } from "lucide-react";
import { useSupportCatalog, type CatalogKind } from "@/hooks/useSupportCatalog";

interface CatalogSelectProps {
  kind: CatalogKind;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}

export function CatalogSelect({ kind, label, placeholder, value, onChange, required }: CatalogSelectProps) {
  const { items, addEntry } = useSupportCatalog(kind);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");

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
          onClick={() => setAdding((a) => !a)}
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
            placeholder={`Nome do novo ${label.toLowerCase()}`}
            maxLength={80}
          />
          <Button type="button" onClick={handleAdd} disabled={!newName.trim() || addEntry.isPending} size="icon">
            <Check className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
          <SelectContent className="max-h-72">
            {items.map((i) => (
              <SelectItem key={i.id} value={i.name}>{i.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
