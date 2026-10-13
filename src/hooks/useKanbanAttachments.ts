import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";

export type KanbanAttachment = Tables<"kanban_task_attachments">;

// Mesmo bucket de /tarefas: as políticas de storage já existentes cobrem o caminho <user_id>/...
const BUCKET = "task-attachments";

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

const MAX_SIZE = 80 * 1024 * 1024; // 80MB

export const isImageMime = (mime: string) => mime.startsWith("image/");

export function getKanbanFileUrl(filePath: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(filePath).data.publicUrl;
}

export function useKanbanAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ["kanban-attachments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("kanban_task_attachments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as KanbanAttachment[];
    },
  });
}

export function validateKanbanFiles(files: File[]) {
  for (const file of files) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      throw new Error(`"${file.name}": use imagem (JPG, PNG, WEBP, GIF), PDF, DOCX ou XLSX.`);
    }
    if (file.size > MAX_SIZE) throw new Error(`"${file.name}" excede o limite de 80MB.`);
  }
}

export function useUploadKanbanAttachments() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, files }: { taskId: string; files: File[] }) => {
      if (!user) throw new Error("Não autenticado");
      validateKanbanFiles(files);

      for (const [i, file] of files.entries()) {
        const filePath = `${user.id}/kanban/${taskId}/${Date.now()}_${i}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { error } = await supabase.from("kanban_task_attachments").insert({
          task_id: taskId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kanban-attachments", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
      toast.success("Arquivo(s) enviado(s)!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteKanbanAttachment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath }: { id: string; filePath: string; taskId: string }) => {
      await supabase.storage.from(BUCKET).remove([filePath]);
      const { error } = await supabase.from("kanban_task_attachments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kanban-attachments", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
      toast.success("Arquivo removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Capa: só uma por tarefa. attachmentId = null remove a capa.
export function useSetKanbanCover() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, attachmentId }: { taskId: string; attachmentId: string | null }) => {
      const { error: clearError } = await supabase
        .from("kanban_task_attachments")
        .update({ is_cover: false })
        .eq("task_id", taskId)
        .eq("is_cover", true);
      if (clearError) throw clearError;

      if (attachmentId) {
        const { error } = await supabase
          .from("kanban_task_attachments")
          .update({ is_cover: true })
          .eq("id", attachmentId);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kanban-attachments", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
