import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { InventoryMovement } from "@/hooks/useInventory";

// Filtros da aba Saídas. Campos vazios não filtram.
// Valor, fornecedor, nota fiscal e local não existem em saídas, então não aparecem aqui.
export interface ExitFilterState {
  dateFrom: string;      // yyyy-mm-dd (input type=date)
  dateTo: string;
  item: string;
  qtd: string;
  patrimony: string;
  responsible: string;
  department: string;
  reason: string;
}

export const EMPTY_EXIT_FILTERS: ExitFilterState = {
  dateFrom: "", dateTo: "", item: "", qtd: "", patrimony: "", responsible: "", department: "", reason: "",
};

const localDay = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const hasText = (value: string | null | undefined, query: string) =>
  !query.trim() || (value ?? "").toLowerCase().includes(query.trim().toLowerCase());

export function filterExits(
  list: InventoryMovement[],
  f: ExitFilterState,
  itemName: (id: string) => string,
  collabName: (id: string | null) => string,
): InventoryMovement[] {
  const qtd = f.qtd.trim() === "" ? null : Number(f.qtd);
  return list.filter((m) => {
    const day = localDay(m.occurred_at ?? m.created_at);
    if (f.dateFrom && day < f.dateFrom) return false;
    if (f.dateTo && day > f.dateTo) return false;
    if (!hasText(itemName(m.item_id), f.item)) return false;
    if (qtd !== null && m.quantity !== qtd) return false;
    if (!hasText(m.patrimony_number, f.patrimony)) return false;
    if (!hasText(collabName(m.collaborator_id), f.responsible)) return false;
    if (!hasText(m.department, f.department)) return false;
    if (!hasText(m.reason, f.reason)) return false;
    return true;
  });
}

export function hasActiveExitFilters(f: ExitFilterState) {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_EXIT_FILTERS);
}

interface Props {
  // draft: o que está sendo digitado. Só vira filtro aplicado ao clicar em "Pesquisar".
  value: ExitFilterState;
  onChange: (next: ExitFilterState) => void;
  onSearch: () => void;
  onClear: () => void;
  canClear: boolean;
  shown: number;
  total: number;
}

export function ExitFilters({ value, onChange, onSearch, onClear, canClear, shown, total }: Props) {
  const set = (patch: Partial<ExitFilterState>) => onChange({ ...value, ...patch });
  const field = (label: string, control: React.ReactNode) => (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      {control}
    </div>
  );

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSearch(); }}
      className="space-y-3 rounded-md border border-gray-300 bg-white p-3 text-black"
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
        {field("Data de", <Input type="date" value={value.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />)}
        {field("Data até", <Input type="date" value={value.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />)}
        {field("Item", <Input placeholder="Nome do item" value={value.item} onChange={(e) => set({ item: e.target.value })} />)}
        {field("Qtd", <Input type="number" min={0} placeholder="Exata" value={value.qtd} onChange={(e) => set({ qtd: e.target.value })} />)}
        {field("Patrimônio", <Input value={value.patrimony} onChange={(e) => set({ patrimony: e.target.value })} />)}
        {field("Responsável", <Input value={value.responsible} onChange={(e) => set({ responsible: e.target.value })} />)}
        {field("Departamento", <Input value={value.department} onChange={(e) => set({ department: e.target.value })} />)}
        {field("Motivo", <Input value={value.reason} onChange={(e) => set({ reason: e.target.value })} />)}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-600">Mostrando {shown} de {total} saídas</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-gray-400 bg-white text-black hover:bg-gray-100 hover:text-black"
            disabled={!canClear}
            onClick={onClear}
          >
            Limpar filtros
          </Button>
          <Button type="submit" size="sm">Pesquisar</Button>
        </div>
      </div>
    </form>
  );
}
