import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/hooks/useInventory";

const base = "border font-normal";

export function StatusTag({ status }: { status: "available" | "in_use" | "damaged" | "discarded" | "maintenance" }) {
  const map: Record<string, { label: string; cls: string }> = {
    available: { label: "Disponível", cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
    in_use: { label: "Em uso", cls: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30" },
    damaged: { label: "Danificado", cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30" },
    discarded: { label: "Descartado", cls: "bg-muted text-muted-foreground border-border" },
    maintenance: { label: "Manutenção", cls: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  };
  const s = map[status] ?? map.available;
  return <Badge variant="outline" className={`${base} ${s.cls}`}>{s.label}</Badge>;
}

export function ItemStatusTags({ item }: { item: InventoryItem }) {
  const tags = [] as JSX.Element[];
  if (item.quantity > 0) tags.push(<StatusTag key="a" status="available" />);
  if (item.in_use_quantity > 0) tags.push(<StatusTag key="u" status="in_use" />);
  if (item.damaged_quantity > 0) tags.push(<StatusTag key="d" status="damaged" />);
  if (item.discarded_quantity > 0 && item.quantity === 0 && item.in_use_quantity === 0 && item.damaged_quantity === 0)
    tags.push(<StatusTag key="x" status="discarded" />);
  if (tags.length === 0) tags.push(<Badge key="z" variant="outline" className={`${base} bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30`}>Sem estoque</Badge>);
  return <div className="flex flex-wrap gap-1">{tags}</div>;
}

export function StockBadge({ item }: { item: InventoryItem }) {
  const q = item.quantity;
  if (q <= 0) return <Badge variant="outline" className={`${base} bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30`}>Sem estoque</Badge>;
  if (q <= item.min_stock) return <Badge variant="outline" className={`${base} bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30`}>Estoque baixo ({q})</Badge>;
  return <Badge variant="outline" className={`${base} bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30`}>Disponível ({q})</Badge>;
}
