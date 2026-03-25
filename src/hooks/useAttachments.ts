import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface TaskAttachment {
  id: string;
  task_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

const MAX_SIZE = 80 * 1024 * 1024; // 80MB

export function useTaskAttachments(taskId: string | null) {
  return useQuery({
    queryKey: ["task-attachments", taskId],
    enabled: !!taskId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_attachments")
        .select("*")
        .eq("task_id", taskId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TaskAttachment[];
    },
  });
}

export function useUploadAttachment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ taskId, file }: { taskId: string; file: File }) => {
      if (!user) throw new Error("Não autenticado");

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error("Tipo de arquivo não permitido. Use PDF, DOCX, XLSX, JPG ou PNG.");
      }

      if (file.size > MAX_SIZE) {
        throw new Error("Arquivo excede o limite de 80MB.");
      }

      const filePath = `${user.id}/${taskId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("task-attachments")
        .upload(filePath, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data, error: insertError } = await supabase
        .from("task_attachments")
        .insert({
          task_id: taskId,
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", vars.taskId] });
      toast.success("Arquivo enviado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAttachment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, filePath, taskId }: { id: string; filePath: string; taskId: string }) => {
      await supabase.storage.from("task-attachments").remove([filePath]);
      const { error } = await supabase.from("task_attachments").delete().eq("id", id);
      if (error) throw error;
      return taskId;
    },
    onSuccess: (taskId) => {
      queryClient.invalidateQueries({ queryKey: ["task-attachments", taskId] });
      toast.success("Arquivo removido!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function getPublicUrl(filePath: string) {
  const { data } = supabase.storage.from("task-attachments").getPublicUrl(filePath);
  return data.publicUrl;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
