import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/hooks/useInventory";

export function StockBadge({ item }: { item: InventoryItem }) {
  if (item.tracked_individually) return <Badge variant="outline">Patrimoniado</Badge>;
  const q = item.quantity;
  if (q <= 0) return <Badge variant="destructive">Sem estoque</Badge>;
  if (q <= item.min_stock) return <Badge variant="destructive">Crítico ({q})</Badge>;
  if (item.ideal_stock > 0 && q < item.ideal_stock)
    return <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">Baixo ({q})</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">OK ({q})</Badge>;
}
