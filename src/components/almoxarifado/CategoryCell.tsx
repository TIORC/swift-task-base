import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUpdateItem, type InventoryCategory } from "@/hooks/useInventory";

// Categoria do item, alterável na linha da tabela. A categoria pertence ao item:
// trocar aqui vale para todas as movimentações desse item.
export function CategoryCell({
  itemId, categoryId, categories, disabled,
}: { itemId: string; categoryId: string | null; categories: InventoryCategory[]; disabled?: boolean }) {
  const updateItem = useUpdateItem();
  return (
    <Select
      value={categoryId ?? ""}
      disabled={disabled || updateItem.isPending}
      onValueChange={(v) => {
        if ((v || null) === categoryId) return;
        updateItem.mutate({ id: itemId, category_id: v || null } as never);
      }}
    >
      <SelectTrigger className="h-8 min-w-[130px] border-transparent bg-transparent text-xs hover:border-slate-300">
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
