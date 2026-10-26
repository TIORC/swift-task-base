import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckSquare, Trash2, Plus } from "lucide-react";
import {
  useAddChecklistItems,
  useDeleteChecklistItem,
  useKanbanChecklist,
  useToggleChecklistItem,
} from "@/hooks/useKanbanChecklist";

export interface PendingChecklistItem {
  content: string;
  done: boolean;
}

interface Props {
  taskId: string | null;
  readOnly?: boolean;
  // Só usado ao criar a tarefa: os itens ficam aqui e são gravados ao "Salvar".
  pendingItems: PendingChecklistItem[];
  onPendingChange: (items: PendingChecklistItem[]) => void;
}

export function KanbanChecklist({ taskId, readOnly, pendingItems, onPendingChange }: Props) {
  const { data: saved = [] } = useKanbanChecklist(taskId);
  const add = useAddChecklistItems();
  const toggle = useToggleChecklistItem();
  const remove = useDeleteChecklistItem();
  const [newItem, setNewItem] = useState("");

  // Uma única forma de exibir: na criação vêm dos pendentes, na edição vêm do banco.
  const rows = taskId
    ? saved.map((i) => ({ key: i.id, content: i.content, done: i.done }))
    : pendingItems.map((i, idx) => ({ key: String(idx), content: i.content, done: i.done }));
  const doneCount = rows.filter((r) => r.done).length;
  const percent = rows.length ? Math.round((doneCount / rows.length) * 100) : 0;

  const addItem = () => {
    const content = newItem.trim();
    if (!content || readOnly) return;
    if (taskId) add.mutate({ taskId, items: [{ content, done: false }], startPosition: saved.length });
    else onPendingChange([...pendingItems, { content, done: false }]);
    setNewItem("");
  };

  const toggleItem = (idx: number) => {
    if (readOnly) return;
    if (taskId) {
      const item = saved[idx];
      toggle.mutate({ id: item.id, taskId, done: !item.done });
    } else {
      onPendingChange(pendingItems.map((i, j) => (j === idx ? { ...i, done: !i.done } : i)));
    }
  };

  const removeItem = (idx: number) => {
    if (taskId) remove.mutate({ id: saved[idx].id, taskId });
    else onPendingChange(pendingItems.filter((_, j) => j !== idx));
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          Checklist
          {rows.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground">({doneCount}/{rows.length})</span>
          )}
        </h4>
        {rows.length > 0 && <span className="text-[11px] text-muted-foreground">{percent}%</span>}
      </div>

      {rows.length > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-300 ${percent === 100 ? "bg-green-500" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {rows.map((row, idx) => (
          <div key={row.key} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={row.done}
              disabled={readOnly}
              onChange={() => toggleItem(idx)}
              className="h-4 w-4 shrink-0 cursor-pointer accent-green-600 disabled:cursor-not-allowed"
            />
            <span
              className={`flex-1 min-w-0 break-words text-sm ${row.done ? "text-muted-foreground line-through" : "text-foreground"}`}
            >
              {row.content}
            </span>
            {!readOnly && (
              <button
                type="button"
                title="Remover item"
                onClick={() => removeItem(idx)}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="flex gap-2">
          <Input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Adicionar item..."
            className="h-8 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addItem();
              }
            }}
          />
          <Button size="sm" variant="outline" className="h-8" onClick={addItem} disabled={!newItem.trim()}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Adicionar
          </Button>
        </div>
      )}
    </div>
  );
}
