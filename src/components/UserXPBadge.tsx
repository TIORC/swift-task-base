import { useMyGamification } from "@/hooks/useGamification";
import { Zap } from "lucide-react";

export function UserXPBadge() {
  const { data } = useMyGamification();

  if (!data) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
      <span>{data.level.icon}</span>
      <Zap className="h-3 w-3" />
      <span>{data.totalXp} XP</span>
    </div>
  );
}
