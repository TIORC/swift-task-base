import { useMemo } from "react";
import { Automation } from "@/types/automation";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  automations: Automation[];
  profileMap: Record<string, string>;
  wipLimit?: number;
}

const ACTIVE_STATUSES = ["analysis", "development", "internal_testing", "homologation"];

export function WipControl({ automations, profileMap, wipLimit = 3 }: Props) {
  const wipByUser = useMemo(() => {
    const map: Record<string, number> = {};
    automations.forEach(a => {
      if (a.assigned_to && ACTIVE_STATUSES.includes(a.status)) {
        map[a.assigned_to] = (map[a.assigned_to] || 0) + 1;
      }
    });
    return map;
  }, [automations]);

  const overloaded = Object.entries(wipByUser).filter(([, count]) => count >= wipLimit);

  if (overloaded.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span className="text-xs font-medium text-amber-500">WIP excedido (limite: {wipLimit}):</span>
      {overloaded.map(([userId, count]) => (
        <Tooltip key={userId}>
          <TooltipTrigger>
            <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600">
              {profileMap[userId] || "Usuário"}: {count} ativas
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{profileMap[userId]} tem {count} automações em andamento (limite: {wipLimit})</p>
          </TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
