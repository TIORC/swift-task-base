import { Badge } from "@/components/ui/badge";
import type { InventoryItem } from "@/hooks/useInventory";

const base = "border font-normal";

// Os badges ficam sempre sobre o card azul royal (tema do /almoxarifado), então
// usam variantes claras tanto no light quanto no dark.
const green = "bg-emerald-400/20 text-emerald-100 border-emerald-300/50";
const sky = "bg-sky-400/20 text-sky-100 border-sky-300/50";
const red = "bg-red-400/20 text-red-100 border-red-300/50";
const amber = "bg-amber-400/20 text-amber-100 border-amber-300/50";
const neutral = "bg-white/15 text-white border-white/40";

export function StatusTag({ status }: { status: "available" | "in_use" | "damaged" | "discarded" | "maintenance" }) {
  const map: Record<string, { label: string; cls: string }> = {
    available: { label: "Disponível", cls: green },
    in_use: { label: "Em uso", cls: sky },
    damaged: { label: "Danificado", cls: red },
    discarded: { label: "Descartado", cls: neutral },
    maintenance: { label: "Manutenção", cls: amber },
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
  if (tags.length === 0) tags.push(<Badge key="z" variant="outline" className={`${base} ${red}`}>Sem estoque</Badge>);
  return <div className="flex flex-wrap gap-1">{tags}</div>;
}

export function StockBadge({ item }: { item: InventoryItem }) {
  const q = item.quantity;
  if (q <= 0) return <Badge variant="outline" className={`${base} ${red}`}>Sem estoque</Badge>;
  if (q <= item.min_stock) return <Badge variant="outline" className={`${base} ${amber}`}>Estoque baixo ({q})</Badge>;
  return <Badge variant="outline" className={`${base} ${green}`}>Disponível ({q})</Badge>;
}
