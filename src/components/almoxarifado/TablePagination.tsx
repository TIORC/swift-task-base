import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

interface Props {
  page: number;
  pageSize: number;
  total: number;
  noun?: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}

export function TablePagination({
  page, pageSize, total, noun = "registros", onPageChange, onPageSizeChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <p className="text-sm text-muted-foreground">
        Mostrando {first}–{last} de {total} {noun}
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
          <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAGE_SIZE_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n} por página</SelectItem>)}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          variant="outline"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Anterior
        </Button>

        <span className="text-sm text-muted-foreground">Página {page} de {totalPages}</span>

        <Button
          size="sm"
          variant="outline"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Próxima <ChevronRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}