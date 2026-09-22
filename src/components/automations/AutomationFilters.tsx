import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { PRIORITY_OPTIONS, PRIORITY_LABELS } from "@/types/automation";
import { SECTORS } from "@/types/sectors";

interface Props {
  search: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  priorityFilter: string;
  onPriorityFilterChange: (v: string) => void;
  assigneeFilter: string;
  onAssigneeFilterChange: (v: string) => void;
  sectorFilter?: string;
  onSectorFilterChange?: (v: string) => void;
  availableSectors?: string[];
  lockSector?: boolean;
  profiles: { id: string; full_name: string | null }[];
}

export function AutomationFilters({
  search, onSearchChange,
  statusFilter, onStatusFilterChange,
  priorityFilter, onPriorityFilterChange,
  assigneeFilter, onAssigneeFilterChange,
  sectorFilter, onSectorFilterChange, availableSectors, lockSector,
  profiles,
}: Props) {
  const sectorOptions = availableSectors && availableSectors.length > 0 ? availableSectors : SECTORS;
  return (
    <div className="space-y-3">

      {/* Search + dropdowns */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar automação..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select value={priorityFilter} onValueChange={onPriorityFilterChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {PRIORITY_OPTIONS.map(p => (
              <SelectItem key={p} value={p}>{PRIORITY_LABELS[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={assigneeFilter} onValueChange={onAssigneeFilterChange}>
          <SelectTrigger className="w-[180px] h-9">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="none">Sem responsável</SelectItem>
            {profiles.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onSectorFilterChange && (
          <Select
            value={sectorFilter || "all"}
            onValueChange={onSectorFilterChange}
            disabled={lockSector && sectorOptions.length <= 1}
          >
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Setor" />
            </SelectTrigger>
            <SelectContent>
              {!lockSector && <SelectItem value="all">Todos setores</SelectItem>}
              {!lockSector && <SelectItem value="none">Sem setor</SelectItem>}
              {sectorOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </div>
  );
}
