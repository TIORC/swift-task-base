import { useUserXP } from "@/hooks/useApprovals";
import { useAuth } from "@/hooks/useAuth";
import { Zap } from "lucide-react";

export function UserXPBadge() {
  const { user } = useAuth();
  const { data: xp } = useUserXP(user?.id);

  if (!xp && xp !== 0) return null;

  return (
    <div className="flex items-center gap-1 text-xs text-primary font-medium">
      <Zap className="h-3.5 w-3.5" />
      <span>{xp} XP</span>
    </div>
  );
}
