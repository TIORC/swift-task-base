import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { MOVEMENT_TEXT_LIMITS, useUpdateMovementText, type MovementTextField } from "@/hooks/useInventory";

// Campo de texto livre de uma movimentação ("Entrega", "E&S"). Grava ao sair do campo (blur), só se mudou.
export function MovementTextCell({
  movementId, field, value, placeholder, disabled, className,
}: {
  movementId: string; field: MovementTextField; value: string; placeholder?: string; disabled?: boolean; className?: string;
}) {
  const [text, setText] = useState(value);
  const save = useUpdateMovementText();
  const max = MOVEMENT_TEXT_LIMITS[field];

  // Acompanha o valor vindo do banco (ex.: após recarregar a lista).
  useEffect(() => setText(value), [value]);

  const commit = () => {
    if (disabled || text === value) return;
    save.mutate({ id: movementId, field, value: text });
  };

  return (
    <div className={className ?? "min-w-[220px]"}>
      <Textarea
        value={text}
        maxLength={max}
        disabled={disabled}
        rows={2}
        placeholder={placeholder}
        aria-label={field === "es_text" ? "E&S" : "Entrega"}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        className="min-h-[56px] resize-y text-xs"
      />
      <p className="mt-0.5 text-right text-[10px] text-muted-foreground">{text.length}/{max}</p>
    </div>
  );
}
