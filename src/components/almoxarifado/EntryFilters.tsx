import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { InventoryLocation, InventoryMovement } from "@/hooks/useInventory";

// Filtros da aba Entradas. Campos vazios não filtram.
export interface EntryFilterState {
  dateFrom: string;      // yyyy-mm-dd (input type=date)
  dateTo: string;
  item: string;
  qtd: string;
  unitMin: string;
  unitMax: string;
  totalMin: string;
  totalMax: string;
  patrimony: string;
  supplier: string;
  invoice: string;
  location: string;      // id do local, "" = todos
}

export const EMPTY_ENTRY_FILTERS: EntryFilterState = {
  dateFrom: "", dateTo: "", item: "", qtd: "", unitMin: "", unitMax: "",
  totalMin: "", totalMax: "", patrimony: "", supplier: "", invoice: "", location: "",
};

const localDay = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const hasText = (value: string | null | undefined, query: string) =>
  !query.trim() || (value ?? "").toLowerCase().includes(query.trim().toLowerCase());

const num = (s: string) => (s.trim() === "" ? null : Number(s));

export function filterEntries(
  list: InventoryMovement[],
  f: EntryFilterState,
  itemName: (id: string) => string,
): InventoryMovement[] {
  const unitMin = num(f.unitMin), unitMax = num(f.unitMax);
  const totalMin = num(f.totalMin), totalMax = num(f.totalMax);
  const qtd = num(f.qtd);

  return list.filter((m) => {
    const day = localDay(m.occurred_at ?? m.created_at);
    if (f.dateFrom && day < f.dateFrom) return false;
    if (f.dateTo && day > f.dateTo) return false;
    if (!hasText(itemName(m.item_id), f.item)) return false;
    if (qtd !== null && m.quantity !== qtd) return false;
    const unit = m.unit_price ?? 0;
    if (unitMin !== null && unit < unitMin) return false;
    if (unitMax !== null && unit > unitMax) return false;
    const total = unit * m.quantity;
    if (totalMin !== null && total < totalMin) return false;
    if (totalMax !== null && total > totalMax) return false;
    if (!hasText(m.patrimony_number, f.patrimony)) return false;
    if (!hasText(m.supplier, f.supplier)) return false;
    if (!hasText(m.invoice_number, f.invoice)) return false;
    if (f.location && m.to_location_id !== f.location) return false;
    return true;
  });
}

export function hasActiveEntryFilters(f: EntryFilterState) {
  return JSON.stringify(f) !== JSON.stringify(EMPTY_ENTRY_FILTERS);
}

interface Props {
  // draft: o que está sendo digitado. Só vira filtro aplicado ao clicar em "Pesquisar".
  value: EntryFilterState;
  onChange: (next: EntryFilterState) => void;
  onSearch: () => void;
  onClear: () => void;
  canClear: boolean;
  locations: InventoryLocation[];
  shown: number;
  total: number;
}

export function EntryFilters({ value, onChange, onSearch, onClear, canClear, locations, shown, total }: Props) {
  const set = (patch: Partial<EntryFilterState>) => onChange({ ...value, ...patch });
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
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
        {field("Data de", <Input type="date" value={value.dateFrom} onChange={(e) => set({ dateFrom: e.target.value })} />)}
        {field("Data até", <Input type="date" value={value.dateTo} onChange={(e) => set({ dateTo: e.target.value })} />)}
        {field("Item", <Input placeholder="Nome do item" value={value.item} onChange={(e) => set({ item: e.target.value })} />)}
        {field("Qtd", <Input type="number" min={0} placeholder="Exata" value={value.qtd} onChange={(e) => set({ qtd: e.target.value })} />)}
        {field("Valor unit. mín.", <Input type="number" step="0.01" value={value.unitMin} onChange={(e) => set({ unitMin: e.target.value })} />)}
        {field("Valor unit. máx.", <Input type="number" step="0.01" value={value.unitMax} onChange={(e) => set({ unitMax: e.target.value })} />)}
        {field("Valor total mín.", <Input type="number" step="0.01" value={value.totalMin} onChange={(e) => set({ totalMin: e.target.value })} />)}
        {field("Valor total máx.", <Input type="number" step="0.01" value={value.totalMax} onChange={(e) => set({ totalMax: e.target.value })} />)}
        {field("Patrimônio", <Input value={value.patrimony} onChange={(e) => set({ patrimony: e.target.value })} />)}
        {field("Fornecedor", <Input value={value.supplier} onChange={(e) => set({ supplier: e.target.value })} />)}
        {field("Nota fiscal", <Input value={value.invoice} onChange={(e) => set({ invoice: e.target.value })} />)}
        {field("Local", (
          <Select value={value.location || "all"} onValueChange={(v) => set({ location: v === "all" ? "" : v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os locais</SelectItem>
              {locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
            </SelectContent>
          </Select>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-gray-600">Mostrando {shown} de {total} entradas</p>
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
