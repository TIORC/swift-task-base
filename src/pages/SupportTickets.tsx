import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Headset, Monitor, FileText, Printer, Phone, Clock, User, Laptop, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useUpdateTask, useProfiles } from "@/hooks/useTasks";
import { TaskDetailDialog } from "@/components/TaskDetailDialog";
import { useUserRole } from "@/hooks/useUserRole";
import type { Task } from "@/hooks/useTasks";

const CATEGORY_ICONS: Record<string, typeof Monitor> = {
  "computador": Monitor,
  "sistema": FileText,
  "impressora": Printer,
  "ramal": Phone,
};

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "destructive" },
  in_progress: { label: "Em Andamento", variant: "default" },
  review: { label: "Em Validação", variant: "secondary" },
  done: { label: "Concluído", variant: "outline" },
  discarded: { label: "Descartado", variant: "secondary" },
};

function extractCategory(title: string): string {
  if (title.includes("Computador")) return "computador";
  if (title.includes("Sistema")) return "sistema";
  if (title.includes("Impressora")) return "impressora";
  if (title.includes("Ramal")) return "ramal";
  return "outro";
}

function extractMachine(description: string | null): string {
  if (!description) return "—";
  const match = description.match(/\*\*Máquina:\*\*\s*(.+)/);
  return match?.[1]?.trim() || "—";
}

function extractRequester(description: string | null): string {
  if (!description) return "—";
  const match = description.match(/\*\*Solicitante:\*\*\s*(.+)/);
  return match?.[1]?.trim() || "—";
}

export default function SupportTickets() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const updateTask = useUpdateTask();
  const queryClient = useQueryClient();

  const { data: tickets, isLoading } = useQuery({
    queryKey: ["support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .like("title", "[Chamado]%")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch profiles for assigned users
      const userIds = [...new Set(data.map((t) => t.assigned_to).filter(Boolean))] as string[];
      let profilesMap: Record<string, { full_name: string | null; avatar_url: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", userIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
        }
      }

      return data.map((t) => ({
        ...t,
        profiles: t.assigned_to ? profilesMap[t.assigned_to] || null : null,
        total_minutes: 0,
      })) as Task[];
    },
  });

  // Realtime: auto-refresh when tasks change
  useEffect(() => {
    const channelName = `support-tickets-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          const title = (payload.new as any)?.title || (payload.old as any)?.title || "";
          if (title.startsWith("[Chamado]")) {
            queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const filtered = tickets?.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    const cat = extractCategory(t.title);
    if (categoryFilter !== "all" && cat !== categoryFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const requester = extractRequester(t.description).toLowerCase();
      const machine = extractMachine(t.description).toLowerCase();
      if (!t.title.toLowerCase().includes(s) && !requester.includes(s) && !machine.includes(s)) return false;
    }
    return true;
  }) ?? [];

  const stats = {
    total: tickets?.length ?? 0,
    pending: tickets?.filter((t) => t.status === "pending").length ?? 0,
    inProgress: tickets?.filter((t) => t.status === "in_progress").length ?? 0,
    done: tickets?.filter((t) => t.status === "done").length ?? 0,
  };

  const handleStatusChange = (taskId: string, newStatus: string) => {
    updateTask.mutate({ id: taskId, status: newStatus as any });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Chamados de Suporte" description="Chamados abertos pelo cliente Windows" />

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Headset className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-destructive/10">
              <Clock className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.pending}</p>
              <p className="text-xs text-muted-foreground">Pendentes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Monitor className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.inProgress}</p>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Headset className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.done}</p>
              <p className="text-xs text-muted-foreground">Concluídos</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por solicitante, máquina..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="in_progress">Em Andamento</SelectItem>
            <SelectItem value="review">Em Validação</SelectItem>
            <SelectItem value="done">Concluído</SelectItem>
            <SelectItem value="discarded">Descartado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="computador">Computador</SelectItem>
            <SelectItem value="sistema">Sistema</SelectItem>
            <SelectItem value="impressora">Impressora</SelectItem>
            <SelectItem value="ramal">Ramal</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
              <Headset className="h-10 w-10 opacity-40" />
              <p>Nenhum chamado encontrado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">Cat.</TableHead>
                  <TableHead>Solicitante</TableHead>
                  <TableHead>Máquina</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[140px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ticket) => {
                  const cat = extractCategory(ticket.title);
                  const CatIcon = CATEGORY_ICONS[cat] || Headset;
                  const requester = extractRequester(ticket.description);
                  const machine = extractMachine(ticket.description);
                  const statusCfg = STATUS_CONFIG[ticket.status] || { label: ticket.status, variant: "outline" as const };
                  const assigneeName = ticket.profiles?.full_name || "—";
                  const initials = assigneeName !== "—" ? assigneeName.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() : "?";

                  return (
                    <TableRow
                      key={ticket.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => setSelectedTask(ticket)}
                    >
                      <TableCell>
                        <div className="p-1.5 rounded-md bg-muted w-fit" title={cat}>
                          <CatIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium">{requester}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Laptop className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">{machine}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{initials}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{assigneeName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(ticket.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={ticket.status}
                          onValueChange={(v) => handleStatusChange(ticket.id, v)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[120px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pendente</SelectItem>
                            <SelectItem value="in_progress">Em Andamento</SelectItem>
                            <SelectItem value="review">Em Validação</SelectItem>
                            <SelectItem value="done">Concluído</SelectItem>
                            <SelectItem value="discarded">Descartado</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selectedTask && (
        <TaskDetailDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}
    </div>
  );
}
