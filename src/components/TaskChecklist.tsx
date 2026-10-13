import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckSquare, Trash2, Plus, AlertTriangle } from "lucide-react";
import {
  useAddTaskChecklistItem,
  useDeleteTaskChecklistItem,
  useTaskChecklist,
  useToggleTaskChecklistItem,
} from "@/hooks/useTaskChecklist";

interface TaskChecklistProps {
  taskId: string;
  readOnly?: boolean;
}

// Checklist obrigatório: a tarefa só pode ser concluída com pelo menos um item e todos marcados.
export function TaskChecklist({ taskId, readOnly }: TaskChecklistProps) {
  const { data: items = [], isLoading } = useTaskChecklist(taskId);
  const add = useAddTaskChecklistItem();
  const toggle = useToggleTaskChecklistItem();
  const remove = useDeleteTaskChecklistItem();
  const [newItem, setNewItem] = useState("");

  const doneCount = items.filter((i) => i.done).length;
  const percent = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const complete = items.length > 0 && doneCount === items.length;

  const addItem = () => {
    const content = newItem.trim();
    if (!content || readOnly) return;
    add.mutate({ taskId, content, position: items.length });
    setNewItem("");
  };

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <CheckSquare className="h-4 w-4 text-muted-foreground" />
          Checklist
          {items.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({doneCount}/{items.length})</span>
          )}
        </h4>
        {items.length > 0 && <span className="text-[11px] text-muted-foreground">{percent}%</span>}
      </div>

      {!isLoading && !complete && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          Obrigatório para concluir: adicione os itens e marque todos.
        </p>
      )}

      {items.length > 0 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-300 ${percent === 100 ? "bg-green-500" : "bg-primary"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}

      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-muted/50">
            <input
              type="checkbox"
              checked={item.done}
              disabled={readOnly}
              onChange={() => toggle.mutate({ id: item.id, taskId, done: !item.done })}
              className="h-4 w-4 shrink-0 cursor-pointer accent-green-600 disabled:cursor-not-allowed"
            />
            <span className={`flex-1 min-w-0 break-words text-sm ${item.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
              {item.content}
            </span>
            {!readOnly && (
              <button
                type="button"
                title="Remover item"
                onClick={() => remove.mutate({ id: item.id, taskId })}
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
