import { useAssignableProfiles } from "@/hooks/useTasks";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, User } from "lucide-react";

interface TaskFilterSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function TaskFilterSelect({ value, onChange }: TaskFilterSelectProps) {
  const { data: profiles } = useProfiles();
  const { user } = useAuth();

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px] h-9">
        <div className="flex items-center gap-2">
          {value === "all" ? (
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          )}
          <SelectValue placeholder="Filtrar por usuário" />
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="mine">Minhas tarefas</SelectItem>
        <SelectItem value="all">Todos os usuários</SelectItem>
        {profiles
          ?.filter((p) => p.id !== user?.id)
          .map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.full_name || "Sem nome"}
            </SelectItem>
          ))}
      </SelectContent>
    </Select>
  );
}
