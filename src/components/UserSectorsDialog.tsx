import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Loader2, Building2, Globe } from "lucide-react";
import { SECTORS } from "@/types/sectors";
import {
  useUserSectors,
  useSetUserSectors,
  useUserGlobalSectorAccess,
} from "@/hooks/useUserSectors";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

export function UserSectorsDialog({ open, onOpenChange, userId, userEmail }: Props) {
  const { data: current = [], isLoading } = useUserSectors(open ? userId : null);
  const { data: currentGlobal = false, isLoading: loadingGlobal } =
    useUserGlobalSectorAccess(open ? userId : null);
  const setSectors = useSetUserSectors();
  const [selected, setSelected] = useState<string[]>([]);
  const [globalAccess, setGlobalAccess] = useState(false);

  useEffect(() => {
    if (open) setSelected(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, current.join("|")]);

  useEffect(() => {
    if (open) setGlobalAccess(currentGlobal);
  }, [open, currentGlobal]);

  const toggle = (s: string) => {
    setSelected((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));
  };

  const invalid = !globalAccess && selected.length === 0;

  const handleSave = () => {
    setSectors.mutate(
      { userId, sectors: selected, globalAccess, previousSectors: current },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Setor do usuário
          </DialogTitle>
          <DialogDescription>{userEmail}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
          <Globe className="h-4 w-4 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium">Ver automações de todos os setores</p>
            <p className="text-[11px] text-muted-foreground">
              Permissão global explícita (Diretoria, Qualidade/QA, TI).
            </p>
          </div>
          <Switch checked={globalAccess} onCheckedChange={setGlobalAccess} />
        </div>

        {isLoading || loadingGlobal ? (
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

        {invalid && (
          <p className="text-[11px] text-amber-500">
            Selecione ao menos um setor ou habilite o acesso global.
          </p>
        )}

        <p className="text-[11px] text-muted-foreground">
          O usuário visualizará apenas automações dos setores marcados acima.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={setSectors.isPending || invalid}>
            {setSectors.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
