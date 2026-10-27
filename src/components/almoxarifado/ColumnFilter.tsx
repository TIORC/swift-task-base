import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TableHead } from "@/components/ui/table";

// Cabeçalho de coluna com filtro estilo Excel: lista de valores com marcação.
// Nenhum valor marcado = coluna sem filtro.
interface Props {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function ColumnFilter({ label, options, selected, onChange }: Props) {
  const active = selected.length > 0;
  const toggle = (value: string, checked: boolean) =>
    onChange(checked ? [...selected, value] : selected.filter((v) => v !== value));

  return (
    <TableHead>
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" className={`inline-flex items-center gap-1 ${active ? "font-semibold text-blue-700" : ""}`}>
            {label}
            <ChevronDown className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-2">
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {options.length === 0 && <p className="px-2 py-1 text-sm text-muted-foreground">Sem valores</p>}
            {options.map((opt) => (
              <label key={opt} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                <Checkbox
                  checked={selected.includes(opt)}
                  onCheckedChange={(checked) => toggle(opt, checked === true)}
                />
                <span className="truncate">{opt}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 flex justify-end border-t pt-2">
            <Button type="button" variant="ghost" size="sm" disabled={!active} onClick={() => onChange([])}>
              Limpar
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </TableHead>
  );
}
