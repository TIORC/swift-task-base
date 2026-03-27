import { useState } from "react";
import { useNotifications, useMarkAsRead, useMarkAllAsRead, Notification } from "@/hooks/useNotifications";
import { useTasks, Task } from "@/hooks/useTasks";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, CheckCheck, AtSign, UserPlus, ShieldCheck, Loader2 } from "lucide-react";

const typeConfig: Record<string, { icon: typeof AtSign; label: string; className: string }> = {
  mention: { icon: AtSign, label: "Menção", className: "bg-primary/10 text-primary" },
  assigned: { icon: UserPlus, label: "Atribuição", className: "bg-success/10 text-success" },
  approval: { icon: ShieldCheck, label: "Aprovação", className: "bg-warning/10 text-warning" },
};

const Notifications = () => {
  const { data: notifications, isLoading } = useNotifications();
  const { data: tasks } = useTasks();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsRead.mutate(notification.id);
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
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Notificações"
        description="Fique por dentro das atualizações."
        icon={<Bell className="h-5 w-5" />}
        actions={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={() => markAllAsRead.mutate()} className="h-8">
              <CheckCheck className="mr-2 h-3.5 w-3.5" />
              Marcar todas como lidas
            </Button>
          ) : undefined
        }
      />

      {!notifications || notifications.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="p-0">
            <EmptyState icon={Bell} title="Nenhuma notificação" description="Quando houver atualizações, elas aparecerão aqui." />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const config = typeConfig[n.type] || typeConfig.mention;
            const Icon = config.icon;

            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-3 rounded-xl border p-4 transition-all duration-150 cursor-pointer
                  hover:shadow-card-hover
                  ${n.read
                    ? "border-border bg-card opacity-70"
                    : "border-primary/20 bg-primary/5 shadow-card"
                  }`}
              >
                <div className={`rounded-xl p-2 shrink-0 ${config.className}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.read ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                    {n.message}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(n.created_at).toLocaleString("pt-BR", {
                      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
                <Badge variant="outline" className={`text-[10px] shrink-0 ${config.className} border`}>
                  {config.label}
                </Badge>
                {!n.read && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5 animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <TaskDetailDialog task={selectedTask} open={!!selectedTask} onOpenChange={(o) => !o && setSelectedTask(null)} />
    </div>
  );
};

export default Notifications;
