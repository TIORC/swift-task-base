import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { invalidateGamification } from "@/hooks/useGamification";

export interface KanbanAssignee {
  id: string;
  full_name: string | null;
}

// Tarefas do Kanban são independentes de /tarefas (tabela própria).
export type KanbanTask = Tables<"kanban_tasks"> & {
  assignees: KanbanAssignee[];
  assignee_ids: string[];
  total_minutes?: number;
  attachments_count: number;
  comments_count: number;
  checklist_total: number;
  checklist_done: number;
  cover_path: string | null;
};

export type KanbanStatus = "backlog" | "pending" | "todo" | "in_progress" | "review" | "done" | "discarded";

// Colunas no estilo Trello. "review" (Em Validação) saiu do quadro:
// tarefas que ainda estão nesse status aparecem em "Em Andamento".
export const KANBAN_COLUMNS: { status: KanbanStatus; title: string }[] = [
  { status: "backlog", title: "A Fazer" },
  { status: "todo", title: "Prioridade" },
  { status: "in_progress", title: "Em Andamento" },
  { status: "pending", title: "Pendente" },
  { status: "done", title: "Concluído" },
  { status: "discarded", title: "Arquivado" },
];

export const toColumnStatus = (status: KanbanStatus): KanbanStatus => (status === "review" ? "in_progress" : status);

// Únicas pessoas que podem ser responsáveis por tarefas do Kanban (pelo primeiro nome).
const KANBAN_RESPONSIBLE_FIRST_NAMES = ["welder", "angel", "sofia", "gabriel", "icaro"];

// Primeiro nome, sem acento e em minúsculas: "Ícaro Silva" -> "icaro".
export const firstNameKey = (fullName: string) =>
  fullName
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export const isKanbanResponsible = (fullName: string | null) =>
  !!fullName && KANBAN_RESPONSIBLE_FIRST_NAMES.includes(firstNameKey(fullName));

// Corporativos que podem excluir qualquer tarefa do Kanban (além do criador). Espelha kanban_can_delete no banco.
const KANBAN_DELETER_NAMES = ["gabriel anacleto", "sofia nardes", "angel kauan", "welder"];

export const canDeleteKanbanTaskName = (fullName: string | null | undefined) => {
  if (!fullName) return false;
  const name = fullName.trim().toLowerCase();
  return KANBAN_DELETER_NAMES.some((n) => name === n || name.startsWith(n + " "));
};

export function useKanbanTasks() {
  return useQuery({
    queryKey: ["kanban-tasks"],
    queryFn: async () => {
      const { data: tasks, error } = await supabase
        .from("kanban_tasks")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: links, error: linksError } = await supabase
        .from("kanban_task_assignees")
        .select("task_id, user_id");
      if (linksError) throw linksError;

      const userIds = [...new Set((links ?? []).map((l) => l.user_id))];
      let profilesMap: Record<string, KanbanAssignee> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        if (profiles) profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
      }

      const assigneesByTask: Record<string, string[]> = {};
      for (const l of links ?? []) {
        (assigneesByTask[l.task_id] ??= []).push(l.user_id);
      }

      const [{ data: attachments }, { data: comments }, { data: checklist }] = await Promise.all([
        supabase
          .from("kanban_task_attachments")
          .select("task_id, file_path, mime_type, is_cover")
          .order("created_at", { ascending: false }),
        supabase.from("kanban_task_comments").select("task_id"),
        supabase.from("kanban_task_checklist_items").select("task_id, done"),
      ]);

      const attachmentsCount: Record<string, number> = {};
      // Capa: a escolhida pelo usuário (estrela); se não houver, a foto mais recente da tarefa.
      const chosenCover: Record<string, string> = {};
      const latestImage: Record<string, string> = {};
      for (const a of attachments ?? []) {
        attachmentsCount[a.task_id] = (attachmentsCount[a.task_id] ?? 0) + 1;
        if (a.is_cover) chosenCover[a.task_id] = a.file_path;
        if (!latestImage[a.task_id] && a.mime_type.startsWith("image/")) latestImage[a.task_id] = a.file_path;
      }
      const cover = (taskId: string) => chosenCover[taskId] ?? latestImage[taskId] ?? null;
      const commentsCount: Record<string, number> = {};
      for (const c of comments ?? []) commentsCount[c.task_id] = (commentsCount[c.task_id] ?? 0) + 1;
      const checklistTotal: Record<string, number> = {};
      const checklistDone: Record<string, number> = {};
      for (const i of checklist ?? []) {
        checklistTotal[i.task_id] = (checklistTotal[i.task_id] ?? 0) + 1;
        if (i.done) checklistDone[i.task_id] = (checklistDone[i.task_id] ?? 0) + 1;
      }

      return tasks.map((t) => {
        const assigneeIds = assigneesByTask[t.id] ?? [];
        return {
          ...t,
          assignee_ids: assigneeIds,
          assignees: assigneeIds.map((id) => profilesMap[id] ?? { id, full_name: null }),
          total_minutes: 0,
          attachments_count: attachmentsCount[t.id] ?? 0,
          comments_count: commentsCount[t.id] ?? 0,
          checklist_total: checklistTotal[t.id] ?? 0,
          checklist_done: checklistDone[t.id] ?? 0,
          // Capa enviada do computador tem prioridade sobre as fotos anexadas.
          cover_path: t.cover_file_path ?? cover(t.id),
        };
      }) as KanbanTask[];
    },
  });
}

function useAfterChange() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    invalidateGamification(qc);
  };
}

// Troca a lista de responsáveis da tarefa. Lista vazia = sem responsável (aberta para todos).
// Feito numa única operação no servidor: apagar antes e inserir depois fazia o responsável
// perder a permissão no meio do caminho (erro de RLS em kanban_task_assignees).
async function setKanbanAssignees(taskId: string, assigneeIds: string[]) {
  const { error } = await supabase.rpc("kanban_set_assignees", { _task_id: taskId, _user_ids: assigneeIds });
  if (error) throw error;
}

type KanbanTaskInput = Omit<TablesInsert<"kanban_tasks">, "created_by"> & { assignee_ids?: string[] };

export function useKanbanCreateTask() {
  const after = useAfterChange();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ assignee_ids = [], ...row }: KanbanTaskInput) => {
      const { data, error } = await supabase
        .from("kanban_tasks")
        .insert({ ...row, created_by: user!.id })
        .select("id")
        .single();
      if (error) throw error;
      await setKanbanAssignees(data.id, [...new Set(assignee_ids)]);
      return data;
    },
    onSuccess: after,
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useKanbanUpdateTask() {
  const after = useAfterChange();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, assignee_ids, ...updates }: TablesUpdate<"kanban_tasks"> & { id: string; assignee_ids?: string[] }) => {
      const { data: old } = await supabase.from("kanban_tasks").select("title").eq("id", id).maybeSingle();
      const { data: oldLinks } = await supabase.from("kanban_task_assignees").select("user_id").eq("task_id", id);
      const oldIds = (oldLinks ?? []).map((l) => l.user_id);

      const { error } = await supabase.from("kanban_tasks").update(updates).eq("id", id);
      if (error) throw error;

      if (assignee_ids) {
        const nextIds = [...new Set(assignee_ids)];
        await setKanbanAssignees(id, nextIds);

        if (user) {
          const added = nextIds.filter((uid) => !oldIds.includes(uid) && uid !== user.id);
          for (const uid of added) {
            await supabase.from("notifications").insert({
              user_id: uid,
              type: "assigned",
              message: `Você recebeu a tarefa do Kanban "${old?.title || "sem título"}"`,
              created_by: user.id,
            });
          }
        }
      }
    },
    onSuccess: after,
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useKanbanDeleteTask() {
  const after = useAfterChange();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("kanban_tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: after,
    onError: (e: Error) => toast.error(e.message),
  });
}
