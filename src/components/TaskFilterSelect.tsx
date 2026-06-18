import { useAssignableProfiles } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, User, UserX, UserCheck } from "lucide-react";

interface TaskFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function TaskFilterSelect({ value, onChange }: TaskFilterSelectProps) {
  const { data: profiles } = useAssignableProfiles();
  const { user } = useAuth();

  const Icon =
    value === "all"
      ? Users
      : value === "unassigned"
      ? UserX
      : value === "mine_or_unassigned"
      ? UserCheck
      : User;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[230px] h-9">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          <SelectValue placeholder="Filtrar por usuário" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel className="text-[10px]">Padrão</SelectLabel>
          <SelectItem value="mine_or_unassigned">Minhas + sem responsável</SelectItem>
          <SelectItem value="mine">Minhas tarefas</SelectItem>
          <SelectItem value="unassigned">Sem responsável</SelectItem>
          <SelectItem value="all">Todas as tarefas</SelectItem>
        </SelectGroup>
        {profiles && profiles.filter((p) => p.id !== user?.id).length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel className="text-[10px]">Por responsável</SelectLabel>
              {profiles
                ?.filter((p) => p.id !== user?.id)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || "Sem nome"}
                  </SelectItem>
                ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
