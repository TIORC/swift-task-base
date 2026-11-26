import { useState, type KeyboardEvent } from "react";
import { ChevronDown, FileSpreadsheet, Plus, Save, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAdmTiRows, useSaveAdmTi, type AdmTiRow } from "@/hooks/useAdmTi";
import { useInventoryDepartments } from "@/hooks/useInventory";

type Field = Exclude<keyof AdmTiRow, "id">;

const COLUMNS: { key: Field; label: string }[] = [
  { key: "ativo", label: "Ativo" },
  { key: "categoria", label: "Categoria" },
  { key: "patrimonio", label: "Patrimônio" },
  { key: "status", label: "Status" },
  { key: "descricao", label: "Descrição" },
  { key: "departamento", label: "Departamento" },
  { key: "colaborador", label: "Colaborador Responsável" },
  { key: "historico", label: "Histórico" },
  { key: "observacao", label: "Observação" },
];

const ADM_PAGE_SIZE = 25;

// A aba é do TI; os outros setores podem ser escolhidos na lista de departamentos.
const DEFAULT_DEPARTAMENTO = "TI";

// Status em lista suspensa, com cor de preenchimento: azul para "Em Uso", verde para "Disponível".
const STATUS_OPTIONS = ["Em Uso", "Disponível"];
const STATUS_CLASS: Record<string, string> = {
  "Em Uso": "bg-blue-600 text-white",
  "Disponível": "bg-green-600 text-white",
};

const emptyRow = (): AdmTiRow => ({
  id: crypto.randomUUID(),
  ativo: "", categoria: "", patrimonio: "", status: "", descricao: "",
  departamento: DEFAULT_DEPARTAMENTO, colaborador: "", historico: "", observacao: "",
});

// Filtro estilo Excel: para cada coluna filtrada, o conjunto de valores marcados. Coluna sem chave = sem filtro.
type Filters = Partial<Record<Field, Set<string>>>;

// Sem acento e sem diferença de maiúsculas, para a pesquisa dentro da lista de valores funcionar com português.
const normalizeText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Texto mostrado para uma célula; célula vazia aparece como "(Vazio)" na lista de valores.
const labelOf = (value: string) => (value === "" ? "(Vazio)" : value);

const passesFilter = (row: AdmTiRow, key: Field, filters: Filters) => {
  const selected = filters[key];
  return !selected || selected.has(row[key]);
};

// Valores distintos de uma coluna, em ordem alfabética, com as células vazias por último.
const distinctValues = (rows: AdmTiRow[], key: Field) =>
  Array.from(new Set(rows.map((r) => r[key]))).sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" });
  });

type ColumnFilterProps = {
  label: string;
  // Valores distintos da coluna nas linhas que ainda aparecem com os outros filtros.
  options: string[];
  // Valores marcados; undefined quando a coluna não tem filtro (todos aparecem marcados).
  selected: Set<string> | undefined;
  onChange: (selected: Set<string> | null) => void;
};

// Nome da coluna com seta no cabeçalho, igual ao filtro da aba Ativos: a lista aplica na hora.
function ColumnFilter({ label, options, selected, onChange }: ColumnFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const active = selected !== undefined;
  const isChecked = (value: string) => !selected || selected.has(value);
  const visibleOptions = options.filter((v) => normalizeText(labelOf(v)).includes(normalizeText(search.trim())));
  const shownChecked = visibleOptions.filter(isChecked).length;
  const allShownChecked = visibleOptions.length > 0 && shownChecked === visibleOptions.length;

  // Com todos os valores marcados a coluna volta a não ter filtro.
  const commit = (next: Set<string>) => onChange(options.every((v) => next.has(v)) ? null : next);
  const current = () => new Set(selected ?? options);

  const toggleOne = (value: string, checked: boolean) => {
    const next = current();
    if (checked) next.add(value);
    else next.delete(value);
    commit(next);
  };

  // "Selecionar tudo" atua só sobre os valores que a pesquisa está mostrando.
  const toggleAll = (checked: boolean) => {
    const next = current();
    visibleOptions.forEach((v) => (checked ? next.add(v) : next.delete(v)));
    commit(next);
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setSearch(""); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtrar ${label}`}
          className={`inline-flex items-center gap-1 whitespace-nowrap ${active ? "font-semibold text-blue-700" : ""}`}
        >
          {label}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-2">
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Pesquisar…"
            aria-label={`Pesquisar em ${label}`}
            className="h-8 pl-7 text-sm"
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm font-medium hover:bg-muted">
          <Checkbox
            checked={allShownChecked ? true : shownChecked > 0 ? "indeterminate" : false}
            onCheckedChange={(c) => toggleAll(c === true)}
            disabled={visibleOptions.length === 0}
          />
          Selecionar tudo
        </label>
        <div className="max-h-64 space-y-1 overflow-y-auto border-b py-1 pb-2">
          {visibleOptions.map((v) => (
            <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
              <Checkbox checked={isChecked(v)} onCheckedChange={(c) => toggleOne(v, c === true)} />
              <span className="truncate">{labelOf(v)}</span>
            </label>
          ))}
          {visibleOptions.length === 0 && (
            <p className="px-2 py-1 text-sm text-muted-foreground">
              {options.length === 0 ? "Sem valores" : "Nenhum valor encontrado."}
            </p>
          )}
        </div>
        <div className="mt-2 flex justify-end">
          <Button type="button" variant="ghost" size="sm" disabled={!active} onClick={() => onChange(null)}>
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Aba ADM TI: tabela de consulta, e o "Modo Excel" para digitar e gravar tudo de uma vez.
export function AdmTiSheet({ canWrite }: { canWrite: boolean }) {
  const { data: saved = [], isLoading } = useAdmTiRows();
  const save = useSaveAdmTi();
  const { data: departments = [] } = useInventoryDepartments();
  // TI sempre disponível; demais setores vêm do cadastro de departamentos.
  const deptOptions = Array.from(new Set([DEFAULT_DEPARTAMENTO, ...departments.filter((d) => d.active).map((d) => d.name)]));
  const [excel, setExcel] = useState(false);
  const [draft, setDraft] = useState<AdmTiRow[]>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({});

  const startExcel = () => {
    setDraft(saved.length ? saved.map((r) => ({ ...r })) : [emptyRow()]);
    setExcel(true);
  };

  const cancel = () => {
    setDraft([]);
    setExcel(false);
  };

  const setCell = (id: string, key: Field, value: string) =>
    setDraft((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: value } : r)));

  const removeRow = (id: string) => setDraft((prev) => prev.filter((r) => r.id !== id));

  const setColumnFilter = (key: Field, selected: Set<string> | null) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (selected) next[key] = selected;
      else delete next[key];
      return next;
    });
    setPage(1);
  };
  const hasFilter = Object.keys(filters).length > 0;

  const onSave = async () => {
    // Linhas totalmente em branco não são gravadas; os textos são limpos de espaços nas pontas.
    const rows = draft
      .map((r) => {
        const clean = { ...r };
        COLUMNS.forEach((c) => { clean[c.key] = r[c.key].trim(); });
        return clean;
      })
      .filter((r) => COLUMNS.some((c) => r[c.key] !== ""));
    try {
      await save.mutateAsync(rows);
      setDraft([]);
      setExcel(false);
    } catch {
      // o hook já mostra o erro
    }
  };

  // Tab já vai para a próxima célula pelo próprio navegador; Enter desce para a mesma coluna.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>, row: number, col: number) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    document.querySelector<HTMLInputElement>(`[data-adm="${row + 1}-${col}"]`)?.focus();
  };

  const rows = excel ? draft : saved;
  // Uma linha aparece se passa em todos os filtros de coluna.
  const passesAll = (r: AdmTiRow, skip?: Field) =>
    COLUMNS.every((c) => c.key === skip || passesFilter(r, c.key, filters));
  const visibleRows = rows.filter((r) => passesAll(r));
  // Cada lista de valores só mostra o que sobra nas linhas filtradas pelas outras colunas.
  const optionsByColumn = Object.fromEntries(
    COLUMNS.map((c) => [c.key, distinctValues(rows.filter((r) => passesAll(r, c.key)), c.key)]),
  ) as Record<Field, string[]>;
  // Consulta com 25 por página, sobre as linhas filtradas; no Modo Excel todas ficam na tela para digitar.
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / ADM_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = excel ? visibleRows : visibleRows.slice((currentPage - 1) * ADM_PAGE_SIZE, currentPage * ADM_PAGE_SIZE);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {excel
              ? "Modo Excel: Tab vai para a próxima célula e Enter desce uma linha. Ao terminar, clique em Gravar."
              : hasFilter ? `${visibleRows.length} de ${saved.length} registro(s)` : `${saved.length} registro(s)`}
          </p>
          {hasFilter && (
            <Button size="sm" variant="ghost" onClick={() => { setFilters({}); setPage(1); }}>
              <X className="mr-2 h-4 w-4" /> Limpar filtros
            </Button>
          )}
        </div>
        {canWrite && (excel ? (
          <div className="flex flex-wrap gap-2">
            {/* Novas linhas aparecem sempre: ao adicionar, os filtros são limpos. */}
            <Button size="sm" variant="outline" onClick={() => { setFilters({}); setDraft((prev) => [...prev, emptyRow()]); }} disabled={save.isPending}>
              <Plus className="mr-2 h-4 w-4" /> Adicionar linha
            </Button>
            <Button size="sm" variant="outline" onClick={cancel} disabled={save.isPending}>
              <X className="mr-2 h-4 w-4" /> Cancelar
            </Button>
            <Button size="sm" onClick={onSave} disabled={save.isPending}>
              <Save className="mr-2 h-4 w-4" /> {save.isPending ? "Gravando…" : "Gravar"}
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={startExcel} disabled={isLoading}>
            <FileSpreadsheet className="mr-2 h-4 w-4" /> Modo Excel
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead key={c.key} className="whitespace-nowrap">
                    <ColumnFilter
                      label={c.label}
                      options={optionsByColumn[c.key]}
                      selected={filters[c.key]}
                      onChange={(selected) => setColumnFilter(c.key, selected)}
                    />
                  </TableHead>
                ))}
                {excel && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedRows.map((r, ri) => (
                <TableRow key={r.id}>
                  {COLUMNS.map((c, ci) => (
                    <TableCell key={c.key} className="p-0">
                      {excel && c.key === "status" ? (
                        <select
                          data-adm={`${ri}-${ci}`}
                          value={r.status}
                          onChange={(e) => setCell(r.id, "status", e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, ri, ci)}
                          className={`h-9 w-full min-w-[120px] border border-transparent px-2 text-xs outline-none focus:border-primary ${STATUS_CLASS[r.status] ?? "bg-transparent"}`}
                        >
                          <option value="">—</option>
                          {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="bg-background text-foreground">{s}</option>)}
                        </select>
                      ) : excel && c.key === "departamento" ? (
                        <select
                          data-adm={`${ri}-${ci}`}
                          value={r.departamento}
                          onChange={(e) => setCell(r.id, "departamento", e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, ri, ci)}
                          className="h-9 w-full min-w-[120px] border border-transparent bg-transparent px-2 text-xs outline-none focus:border-primary focus:bg-background"
                        >
                          {/* Mantém um valor antigo mesmo que o setor não esteja mais ativo no cadastro. */}
                          {!r.departamento && <option value="">—</option>}
                          {!deptOptions.includes(r.departamento) && r.departamento && <option value={r.departamento}>{r.departamento}</option>}
                          {deptOptions.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      ) : excel ? (
                        <input
                          data-adm={`${ri}-${ci}`}
                          value={r[c.key]}
                          onChange={(e) => setCell(r.id, c.key, e.target.value)}
                          onKeyDown={(e) => onKeyDown(e, ri, ci)}
                          className="h-9 w-full min-w-[120px] border border-transparent bg-transparent px-2 text-xs outline-none focus:border-primary focus:bg-background"
                        />
                      ) : c.key === "status" && r.status ? (
                        <span className={`block px-2 py-2 text-xs ${STATUS_CLASS[r.status] ?? ""}`}>{r.status}</span>
                      ) : (
                        <span className="block px-2 py-2 text-xs">{r[c.key] || "—"}</span>
                      )}
                    </TableCell>
                  ))}
                  {excel && (
                    <TableCell className="p-0 text-center">
                      <button type="button" className="px-2 text-destructive" title="Remover linha" onClick={() => removeRow(r.id)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {visibleRows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="py-6 text-center text-muted-foreground">
                    {isLoading
                      ? "Carregando…"
                      : rows.length > 0
                        ? "Nenhum registro encontrado com esses filtros."
                        : "Nenhum registro. Clique em Modo Excel para começar."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {!excel && visibleRows.length > ADM_PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted-foreground">
            Mostrando {(currentPage - 1) * ADM_PAGE_SIZE + 1}–{Math.min(currentPage * ADM_PAGE_SIZE, visibleRows.length)} de {visibleRows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>Anterior</Button>
            <span>Página {currentPage} de {totalPages}</span>
            <Button size="sm" variant="outline" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages}>Próxima</Button>
          </div>
        </div>
      )}
    </div>
  );
}
