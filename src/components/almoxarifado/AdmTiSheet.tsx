import { useState, type KeyboardEvent } from "react";
import { FileSpreadsheet, Plus, Save, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

type Filters = Record<Field, string>;

// Valor especial do filtro de Status/Departamento para mostrar só as linhas sem valor.
const EMPTY_VALUE = "__vazio__";

const emptyFilters = (): Filters => Object.fromEntries(COLUMNS.map((c) => [c.key, ""])) as Filters;

// Sem acento e sem diferença de maiúsculas, para o filtro "contém" funcionar com digitação em português.
const normalizeText = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const matchesFilter = (row: AdmTiRow, key: Field, filter: string) => {
  if (!filter) return true;
  if (key === "status" || key === "departamento") {
    return filter === EMPTY_VALUE ? !row[key] : row[key] === filter;
  }
  return normalizeText(row[key]).includes(normalizeText(filter.trim()));
};

const FILTER_INPUT = "h-7 w-full min-w-[90px] rounded border border-input bg-background px-1.5 text-xs font-normal text-foreground outline-none focus:border-primary";

// Aba ADM TI: tabela de consulta, e o "Modo Excel" para digitar e gravar tudo de uma vez.
export function AdmTiSheet({ canWrite }: { canWrite: boolean }) {
  const { data: saved = [], isLoading } = useAdmTiRows();
  const save = useSaveAdmTi();
  const { data: departments = [] } = useInventoryDepartments();
  // TI sempre disponível; demais setores vêm do cadastro de departamentos.
  const deptOptions = Array.from(new Set([DEFAULT_DEPARTAMENTO, ...departments.filter((d) => d.active).map((d) => d.name)]));
  const [excel, setExcel] = useState(false);
  const [draft, setDraft] = useState<AdmTiRow[]>([]);
  const [filters, setFilters] = useState<Filters>(emptyFilters);

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

  const setFilter = (key: Field, value: string) => setFilters((prev) => ({ ...prev, [key]: value }));
  const hasFilter = COLUMNS.some((c) => filters[c.key] !== "");

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
  const visibleRows = rows.filter((r) => COLUMNS.every((c) => matchesFilter(r, c.key, filters[c.key])));

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
            <Button size="sm" variant="ghost" onClick={() => setFilters(emptyFilters())}>
              <X className="mr-2 h-4 w-4" /> Limpar filtros
            </Button>
          )}
        </div>
        {canWrite && (excel ? (
          <div className="flex flex-wrap gap-2">
            {/* Novas linhas aparecem sempre: ao adicionar, os filtros são limpos. */}
            <Button size="sm" variant="outline" onClick={() => { setFilters(emptyFilters()); setDraft((prev) => [...prev, emptyRow()]); }} disabled={save.isPending}>
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
                {COLUMNS.map((c) => <TableHead key={c.key} className="whitespace-nowrap">{c.label}</TableHead>)}
                {excel && <TableHead className="w-10" />}
              </TableRow>
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead key={c.key} className="p-1">
                    {c.key === "status" || c.key === "departamento" ? (
                      <select
                        aria-label={`Filtrar ${c.label}`}
                        value={filters[c.key]}
                        onChange={(e) => setFilter(c.key, e.target.value)}
                        className={FILTER_INPUT}
                      >
                        <option value="">Todos</option>
                        <option value={EMPTY_VALUE}>(vazio)</option>
                        {(c.key === "status" ? STATUS_OPTIONS : deptOptions).map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : (
                      <input
                        aria-label={`Filtrar ${c.label}`}
                        placeholder="Filtrar…"
                        value={filters[c.key]}
                        onChange={(e) => setFilter(c.key, e.target.value)}
                        className={FILTER_INPUT}
                      />
                    )}
                  </TableHead>
                ))}
                {excel && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((r, ri) => (
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
    </div>
  );
}
