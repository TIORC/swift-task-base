import { useState } from "react";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, Notification } from "@/hooks/useNotifications";
import { useTasks, Task } from "@/hooks/useTasks";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, AtSign, UserPlus, ShieldCheck, Loader2 } from "lucide-react";

const typeConfig: Record<string, { icon: typeof AtSign; label: string; className: string }> = {
  mention: { icon: AtSign, label: "Menção", className: "bg-primary/20 text-primary" },
  assigned: { icon: UserPlus, label: "Atribuição", className: "bg-success/20 text-success" },
  approval: { icon: ShieldCheck, label: "Aprovação", className: "bg-warning/20 text-warning" },
};

const Notifications = () => {
  const { data: notifications, isLoading } = useNotifications();
  const { data: tasks } = useTasks();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }
    if (notification.task_id && tasks) {
      const task = tasks.find((t) => t.id === notification.task_id);
      if (task) setSelectedTask(task);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="text-muted-foreground">Fique por dentro das atualizações.</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={() => markAllAsRead.mutate()}>
            <CheckCheck className="mr-2 h-4 w-4" />
            Marcar todas como lidas
          </Button>
        )}
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Bell className="h-5 w-5" />
            Suas Notificações
            {unreadCount > 0 && (
              <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5">
                {unreadCount}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!notifications || notifications.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhuma notificação no momento.</p>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => {
                const config = typeConfig[n.type] || typeConfig.mention;
                const Icon = config.icon;

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-all cursor-pointer hover:ring-1 hover:ring-primary/30 ${
                      n.read
                        ? "border-border bg-secondary/20 opacity-70"
                        : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <div className={`rounded-full p-1.5 shrink-0 ${config.className}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${n.read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                        {n.message}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <Badge variant="secondary" className={`text-[10px] shrink-0 ${config.className}`}>
                      {config.label}
                    </Badge>
                    {!n.read && (
                      <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)} />
    </div>
  );
};

export default Notifications;
