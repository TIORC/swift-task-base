import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import {
  useAutomationAttachments,
  useUploadAutomationAttachment,
  useDeleteAutomationAttachment,
  attachmentPublicUrl,
  MAX_ATTACHMENT_MB,
} from "@/hooks/useAutomationAttachments";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  automationId: string;
  canDelete?: boolean;
}

export function AutomationAttachments({ automationId, canDelete = true }: Props) {
  const { data: files = [], isLoading, isError } = useAutomationAttachments(automationId);
  const upload = useUploadAutomationAttachment();
  const remove = useDeleteAutomationAttachment();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const send = (list: FileList | null) => {
    if (!list) return;
    Array.from(list).forEach((file) => upload.mutate({ automationId, file }));
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); send(e.dataTransfer.files); }}
        className={`rounded-lg border border-dashed p-4 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
      >
        <Upload className="h-4 w-4 mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground mt-1">
          Arraste imagens, vídeos ou PDF (até {MAX_ATTACHMENT_MB} MB)
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 mt-2 text-xs"
          disabled={upload.isPending}
          onClick={() => inputRef.current?.click()}
        >
          {upload.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Paperclip className="h-3 w-3 mr-1" />}
          {upload.isPending ? "Enviando..." : "Selecionar arquivos"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,application/pdf"
          className="hidden"
          onChange={(e) => send(e.target.files)}
        />
      </div>

      {isLoading && <p className="text-xs text-muted-foreground text-center py-2">Carregando anexos...</p>}
      {isError && <p className="text-xs text-destructive text-center py-2">Não foi possível carregar os anexos.</p>}
      {!isLoading && files.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhum anexo enviado.</p>
      )}

      <div className="space-y-1.5">
        {files.map((f) => {
          const url = attachmentPublicUrl(f.file_path);
          return (
            <div key={f.id} className="flex items-center gap-2 rounded-md border p-2">
              {f.mime_type.startsWith("image/") ? (
                <img src={url} alt={f.file_name} loading="lazy" className="h-10 w-10 rounded object-cover" />
              ) : (
                <div className="h-10 w-10 rounded bg-muted flex items-center justify-center">
                  <Paperclip className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <a href={url} target="_blank" rel="noreferrer" className="text-sm truncate block hover:underline">
                  {f.file_name}
                </a>
                <p className="text-[10px] text-muted-foreground">
                  {(f.file_size / 1024 / 1024).toFixed(2)} MB • {format(new Date(f.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                </p>
              </div>
              {canDelete && (
                <button
                  onClick={() => remove.mutate(f)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${f.file_name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
