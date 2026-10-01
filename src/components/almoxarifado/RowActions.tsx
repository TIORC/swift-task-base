import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const iconBtn = "h-7 w-7 rounded-md border-border/70 bg-background shadow-sm hover:bg-accent";
const pencilBtn = "h-7 w-7 rounded-md border-amber-300/40 text-amber-400 shadow-sm hover:bg-amber-400/15 hover:text-amber-300";
const trashBtn = "h-7 w-7 rounded-md border-red-300/40 text-red-300 shadow-sm hover:bg-red-400/15 hover:text-red-200";

interface Props {
  onEdit?: () => void;
  onDelete?: () => unknown;
  editTitle?: string;
  editDescription?: string;
  deleteTitle?: string;
  deleteDescription?: string;
  deleteLabel?: string;
  pending?: boolean;
}

export function RowActions({
  onEdit, onDelete,
  editTitle = "Editar registro",
  editDescription = "Abrir este registro para alteração.",
  deleteTitle = "Confirmar exclusão",
  deleteDescription = "Esta ação não pode ser desfeita.",
  deleteLabel = "Excluir",
  pending,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  if (!onEdit && !onDelete) return null;

  return (
    <div className="flex justify-end gap-1.5">
      {onEdit && (
        <Button size="sm" variant="outline" className={pencilBtn} title={editTitle} onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}

      {onDelete && (
        <AlertDialog open={confirming} onOpenChange={setConfirming}>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className={trashBtn}
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{deleteTitle}</AlertDialogTitle>
              <AlertDialogDescription>{deleteDescription}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={pending}
                onClick={async (e) => {
                  e.preventDefault();
                  await onDelete();
                  setConfirming(false);
                }}
              >
                {deleteLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}