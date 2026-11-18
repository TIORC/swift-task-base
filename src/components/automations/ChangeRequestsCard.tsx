import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RequestDescription } from "@/components/automations/RequestDescription";

export interface ChangeRequestItem {
  id: string;
  requester: string;
  /** Data/hora já formatada para exibição. */
  when: string;
  description: string;
}

interface Props {
  items: ChangeRequestItem[];
  pending: boolean;
}

/**
 * Pedidos de alteração de uma automação. Vem recolhido para não poluir a aba Dados;
 * o dev abre o card para ler o texto.
 */
export function ChangeRequestsCard({ items, pending }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-rose-500/30 bg-rose-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-semibold text-rose-600 dark:text-rose-400">
            Alterações solicitadas ({items.length})
          </span>
          {pending && (
            <Badge variant="outline" className="shrink-0 border-rose-500/40 text-[10px] text-rose-600 dark:text-rose-400">
              Pendente
            </Badge>
          )}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-rose-600 transition-transform dark:text-rose-400 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="min-w-0 space-y-4 border-t border-rose-500/20 px-3 py-3">
          {items.map((item) => (
            <div key={item.id} className="min-w-0 space-y-1">
              <p className="break-words text-[11px] text-muted-foreground">
                {item.requester} em {item.when}
              </p>
              <RequestDescription text={item.description} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
