import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, FileText, Loader2, Download, Star, X } from "lucide-react";
import { formatFileSize } from "@/hooks/useAttachments";
import {
  getKanbanFileUrl,
  isImageMime,
  useDeleteKanbanAttachment,
  useKanbanAttachments,
  useSetKanbanCover,
  useUploadKanbanAttachments,
  validateKanbanFiles,
} from "@/hooks/useKanbanAttachments";
import { toast } from "sonner";

interface Props {
  taskId: string | null;
  readOnly?: boolean;
  // Só usado ao criar a tarefa: os arquivos ficam aqui e sobem depois do "Salvar".
  pendingFiles: File[];
  onPendingChange: (files: File[]) => void;
}

export function KanbanAttachments({ taskId, readOnly, pendingFiles, onPendingChange }: Props) {
  const { data: attachments = [], isLoading } = useKanbanAttachments(taskId);
  const upload = useUploadKanbanAttachments();
  const remove = useDeleteKanbanAttachment();
  const setCover = useSetKanbanCover();
  const inputRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(
    () => pendingFiles.map((f) => (isImageMime(f.type) ? URL.createObjectURL(f) : null)),
    [pendingFiles]
  );
  useEffect(() => () => previews.forEach((url) => url && URL.revokeObjectURL(url)), [previews]);

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;

    if (taskId) {
      upload.mutate({ taskId, files });
      return;
    }
    try {
      validateKanbanFiles(files);
      onPendingChange([...pendingFiles, ...files]);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const uploadButton = !readOnly && (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
      >
        {upload.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Upload className="h-3 w-3 mr-1" />}
        Adicionar
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.docx,.xlsx"
        multiple
        onChange={handleFiles}
      />
    </>
  );

  // Criação: arquivos ainda não enviados
  if (!taskId) {
    return (
      <div className="space-y-2 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            Anexos
            {pendingFiles.length > 0 && <span className="text-xs font-normal text-muted-foreground">({pendingFiles.length})</span>}
          </h4>
          {uploadButton}
        </div>
        {pendingFiles.length > 0 ? (
          <div className="grid grid-cols-2 gap-2">
            {pendingFiles.map((f, i) => (
              <div key={`${f.name}-${i}`} className="relative overflow-hidden rounded-lg border border-border bg-secondary/20">
                {previews[i] ? (
                  <img src={previews[i]!} alt={f.name} className="h-20 w-full object-cover" />
                ) : (
                  <div className="flex h-20 items-center justify-center">
                    <FileText className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
                <div className="flex items-center gap-1 p-1.5">
                  <p className="flex-1 min-w-0 truncate text-xs">{f.name}</p>
                  <button
                    type="button"
                    onClick={() => onPendingChange(pendingFiles.filter((_, j) => j !== i))}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Nenhum arquivo. Os anexos são enviados ao salvar.</p>
        )}
      </div>
    );
  }

  // Edição: galeria com capa
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Anexos
          {attachments.length > 0 && <span className="text-xs font-normal text-muted-foreground">({attachments.length})</span>}
        </h4>
        {uploadButton}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {attachments.map((att) => {
            const url = getKanbanFileUrl(att.file_path);
            const isImage = isImageMime(att.mime_type);
            return (
              <div key={att.id} className="overflow-hidden rounded-lg border border-border bg-secondary/20">
                {isImage ? (
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt={att.file_name} className="h-24 w-full object-cover" loading="lazy" />
                  </a>
                ) : (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="flex h-24 items-center justify-center">
                    <FileText className="h-8 w-8 text-muted-foreground" />
                  </a>
                )}
                <div className="flex items-center gap-1 p-1.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{att.file_name}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {formatFileSize(att.file_size)}
                      {att.is_cover && " · capa"}
                    </p>
                  </div>
                  {!readOnly && isImage && (
                    <button
                      type="button"
                      title={att.is_cover ? "Remover capa" : "Usar como capa"}
                      onClick={() => setCover.mutate({ taskId, attachmentId: att.is_cover ? null : att.id })}
                      className={`shrink-0 rounded p-1 transition-colors ${att.is_cover ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <Star className={`h-3.5 w-3.5 ${att.is_cover ? "fill-current" : ""}`} />
                    </button>
                  )}
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Abrir / baixar"
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </a>
                  {!readOnly && (
                    <button
                      type="button"
                      title="Excluir"
                      onClick={() => remove.mutate({ id: att.id, filePath: att.file_path, taskId })}
                      className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum arquivo anexado.</p>
      )}
    </div>
  );
}
