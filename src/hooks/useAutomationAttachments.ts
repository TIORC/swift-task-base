import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { AutomationAttachment } from "@/types/automation";

const BUCKET = "task-attachments";
export const MAX_ATTACHMENT_MB = 80;
const ALLOWED_PREFIXES = ["image/", "video/"];
const ALLOWED_EXACT = ["application/pdf"];

export function isAllowedAttachment(file: File) {
  return (
    ALLOWED_PREFIXES.some((p) => file.type.startsWith(p)) || ALLOWED_EXACT.includes(file.type)
  );
}

export function attachmentPublicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

export function useAutomationAttachments(automationId: string | null) {
  return useQuery({
    queryKey: ["automation_attachments", automationId],
    enabled: !!automationId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("automation_attachments")
        .select("*")
        .eq("automation_id", automationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AutomationAttachment[];
    },
  });
}

export function useUploadAutomationAttachment() {
  const qc = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ automationId, file }: { automationId: string; file: File }) => {
      if (!user) throw new Error("Não autenticado");
      if (!isAllowedAttachment(file)) {
        throw new Error("Formato não permitido. Envie imagem, vídeo ou PDF.");
      }
      if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
        throw new Error(`Arquivo muito grande (limite de ${MAX_ATTACHMENT_MB} MB).`);
      }

      const safeName = file.name.replace(/[^\w.\-]+/g, "_");
      const path = `automations/${automationId}/${crypto.randomUUID()}-${safeName}`;

      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (upErr) throw new Error(`Falha no envio do arquivo: ${upErr.message}`);

      const { error } = await (supabase as any).from("automation_attachments").insert({
        automation_id: automationId,
        user_id: user.id,
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type || "application/octet-stream",
      });
      if (error) {
        await supabase.storage.from(BUCKET).remove([path]);
        throw error;
      }
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["automation_attachments", v.automationId] });
      toast.success("Arquivo enviado!");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteAutomationAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attachment: AutomationAttachment) => {
      const { error } = await (supabase as any)
        .from("automation_attachments")
        .delete()
        .eq("id", attachment.id);
      if (error) throw error;
      await supabase.storage.from(BUCKET).remove([attachment.file_path]);
    },
    onSuccess: (_d, a) => {
      qc.invalidateQueries({ queryKey: ["automation_attachments", a.automation_id] });
      toast.success("Arquivo removido.");
    },
    onError: (e: Error) => toast.error(e.message),
  });
}
