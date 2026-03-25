import { useRef } from "react";
import {
  useTaskAttachments,
  useUploadAttachment,
  useDeleteAttachment,
  getPublicUrl,
  formatFileSize,
} from "@/hooks/useAttachments";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, FileText, Image, FileSpreadsheet, Loader2, Download } from "lucide-react";

const iconMap: Record<string, typeof FileText> = {
  "application/pdf": FileText,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": FileText,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": FileSpreadsheet,
  "image/jpeg": Image,
  "image/png": Image,
};

interface TaskAttachmentsProps {
  taskId: string;
}

export function TaskAttachments({ taskId }: TaskAttachmentsProps) {
  const { data: attachments, isLoading } = useTaskAttachments(taskId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      uploadAttachment.mutate({ taskId, file });
    });
    e.target.value = "";
  };

  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          Arquivos
          {attachments && attachments.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">({attachments.length})</span>
          )}
        </h4>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => inputRef.current?.click()}
          disabled={uploadAttachment.isPending}
        >
          {uploadAttachment.isPending ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Upload className="h-3 w-3 mr-1" />
          )}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png"
          multiple
          onChange={handleFileChange}
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : attachments && attachments.length > 0 ? (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {attachments.map((att) => {
            const Icon = iconMap[att.mime_type] || FileText;
            const url = getPublicUrl(att.file_path);

            return (
              <div
                key={att.id}
                className="flex items-center gap-2 rounded-md border border-border bg-secondary/20 px-2.5 py-1.5"
              >
                <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{att.file_name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatFileSize(att.file_size)}</p>
                </div>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
                <button
                  onClick={() => deleteAttachment.mutate({ id: att.id, filePath: att.file_path, taskId })}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
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
