import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Building2 } from "lucide-react";
import { SECTORS } from "@/types/sectors";
import { useUserSectors, useSetUserSectors } from "@/hooks/useUserSectors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

export function UserSectorsDialog({ open, onOpenChange, userId, userEmail }: Props) {
  const { data: current = [], isLoading } = useUserSectors(open ? userId : null);
  const setSectors = useSetUserSectors();
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (open) setSelected(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current.join("|")]);

  const toggle = (s: string) => {
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const handleSave = () => {
    setSectors.mutate(
      { userId, sectors: selected },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Setores Permitidos
          </DialogTitle>
          <DialogDescription>{userEmail}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 py-2">
            {SECTORS.map((s) => (
              <label
                key={s}
                className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 cursor-pointer hover:bg-muted/50"
              >
                <Checkbox
                  checked={selected.includes(s)}
                  onCheckedChange={() => toggle(s)}
                />
                <span className="text-sm">{s}</span>
              </label>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          O usuário visualizará apenas automações dos setores marcados acima.
          <strong> Admin</strong> e <strong>Gestor</strong> visualizam todas.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={setSectors.isPending}>
            {setSectors.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
