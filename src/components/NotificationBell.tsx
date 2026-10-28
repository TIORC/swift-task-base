import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, Notification } from "@/hooks/useNotifications";
import type { Task } from "@/hooks/useTasks";
import { supabase } from "@/integrations/supabase/client";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Bell, CheckCheck, AtSign, UserPlus, ShieldCheck } from "lucide-react";

const typeConfig: Record<string, { icon: typeof AtSign; label: string; className: string }> = {
  mention: { icon: AtSign, label: "Menção", className: "bg-primary/10 text-primary" },
  assigned: { icon: UserPlus, label: "Atribuição", className: "bg-success/10 text-success" },
  approval: { icon: ShieldCheck, label: "Aprovação", className: "bg-warning/10 text-warning" },
};

// onlyMentions: sino separado só com as menções; o sino geral continua com tudo.
export function NotificationBell({ onlyMentions = false }: { onlyMentions?: boolean }) {
  const { data: allNotifications } = useNotifications();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const notifications = onlyMentions
    ? allNotifications?.filter((n) => n.type === "mention")
    : allNotifications;
  const unreadCount = notifications?.filter((n) => !n.read).length ?? 0;
  const BellIcon = onlyMentions ? AtSign : Bell;
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const handleClick = async (n: Notification) => {
    if (!n.read) markAsRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      navigate(n.link);
      return;
    }
    if (n.task_id) {
      // Busca só a tarefa desta notificação, em vez da lista inteira.
      const { data: task } = await supabase.from("tasks").select("*").eq("id", n.task_id).maybeSingle();
      if (task) {
        let profiles: Task["profiles"] = null;
        if (task.assigned_to) {
          const { data: p } = await supabase
            .from("profiles").select("full_name, avatar_url").eq("id", task.assigned_to).maybeSingle();
          profiles = p ?? null;
        }
        setOpen(false);
        setSelectedTask({ ...task, profiles } as Task);
        return;
      }
    }
    toast.info("Não encontramos a tela desta menção.");
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground transition-colors">
            <BellIcon className="h-4.5 w-4.5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold leading-none text-destructive-foreground shadow-md ring-2 ring-background animate-pulse">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">{onlyMentions ? "Menções" : "Notificações"}</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="mr-1.5 h-3 w-3" />
                Marcar todas
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[400px]">
            {!notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-sm">Nenhuma notificação</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {notifications.slice(0, 20).map((n) => {
                  const config = typeConfig[n.type] || typeConfig.mention;
                  const Icon = config.icon;

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleClick(n)}
                      className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors duration-150
                        hover:bg-muted/50
                        ${!n.read ? "bg-primary/5" : ""}`}
                    >
                      <div className={`rounded-lg p-1.5 shrink-0 mt-0.5 ${config.className}`}>
                        <Icon className="h-3 w-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${n.read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(n.created_at).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {!n.read && (
                        <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5 animate-pulse" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>

      <TaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)} />
    </>
  );
}
