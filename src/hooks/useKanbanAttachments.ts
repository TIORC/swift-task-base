import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { attachmentMime, ATTACHMENT_FORMATS_LABEL, storageSafeName } from "@/lib/attachment-types";

export type KanbanAttachment = Tables<"kanban_task_attachments">;

// Mesmo bucket de /tarefas: as políticas de storage já existentes cobrem o caminho <user_id>/...
const BUCKET = "task-attachments";

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
    if (!attachmentMime(file)) {
      throw new Error(`"${file.name}": use ${ATTACHMENT_FORMATS_LABEL}.`);
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

      const ids: string[] = [];
      for (const [i, file] of files.entries()) {
        const filePath = `${user.id}/kanban/${taskId}/${Date.now()}_${i}_${storageSafeName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(filePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data, error } = await supabase
          .from("kanban_task_attachments")
          .insert({
            task_id: taskId,
            user_id: user.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: attachmentMime(file)!,
          })
          .select("id")
          .single();
        if (error) throw error;
        ids.push(data.id);
      }
      return ids;
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

// Capa enviada do computador: vai para o storage e fica na tarefa, sem criar anexo.
export function useUploadKanbanCover() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      if (!user) throw new Error("Não autenticado");
      if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem para a capa.");
      if (file.size > MAX_SIZE) throw new Error(`"${file.name}" excede o limite de 80MB.`);

      const filePath = `${user.id}/kanban/${taskId}/cover_${Date.now()}_${storageSafeName(file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { upsert: false });
      if (uploadError) throw uploadError;

      // A capa enviada substitui a cor e a foto marcada.
      const { error: taskError } = await supabase
        .from("kanban_tasks")
        .update({ cover_file_path: filePath, cover_preset: null })
        .eq("id", taskId);
      if (taskError) throw taskError;

      const { error: clearError } = await supabase
        .from("kanban_task_attachments")
        .update({ is_cover: false })
        .eq("task_id", taskId)
        .eq("is_cover", true);
      if (clearError) throw clearError;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kanban-attachments", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

// Capa de cor/gradiente. preset = null remove a capa de cor e também a foto marcada.
export function useSetKanbanCoverPreset() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ taskId, preset }: { taskId: string; preset: string | null }) => {
      const { error } = await supabase
        .from("kanban_tasks")
        .update({ cover_preset: preset, cover_file_path: null })
        .eq("id", taskId);
      if (error) throw error;

      if (!preset) {
        const { error: clearError } = await supabase
          .from("kanban_task_attachments")
          .update({ is_cover: false })
          .eq("task_id", taskId)
          .eq("is_cover", true);
        if (clearError) throw clearError;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["kanban-attachments", vars.taskId] });
      qc.invalidateQueries({ queryKey: ["kanban-tasks"] });
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

      // Escolher uma foto tira a capa de cor/gradiente e a capa enviada do computador.
      const { error: presetError } = await supabase
        .from("kanban_tasks")
        .update({ cover_preset: null, cover_file_path: null })
        .eq("id", taskId);
      if (presetError) throw presetError;

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
