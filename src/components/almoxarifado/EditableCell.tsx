import { useRef, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";

interface Props {
  value: string;              // texto editável
  display: ReactNode;         // como a célula aparece fora da edição
  disabled?: boolean;
  className?: string;
  onSave: (next: string) => Promise<void> | void;
}

// A célula mostra o texto de sempre. Ao clicar, vira campo de edição no mesmo lugar.
// Enter ou sair do campo grava; Esc cancela.
export function EditableCell({ value, display, disabled, className, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);

  if (disabled) return <span className={className}>{display}</span>;

  const startEditing = () => {
    cancelled.current = false;
    setDraft(value);
    setEditing(true);
  };

  if (!editing) {
    return (
      <span
        role="button"
        tabIndex={0}
        className={`block min-h-[1.5rem] cursor-text rounded px-1 hover:bg-muted/60 ${className ?? ""}`}
        onClick={startEditing}
        onKeyDown={(e) => { if (e.key === "Enter") startEditing(); }}
      >
        {display}
      </span>
    );
  }

  const commit = async () => {
    setEditing(false);
    if (cancelled.current || draft.trim() === value.trim()) return;
    await onSave(draft);
  };

  return (
    <Input
      autoFocus
      className="h-8 px-2 text-sm"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
