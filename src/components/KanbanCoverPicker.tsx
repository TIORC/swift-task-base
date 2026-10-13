import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { KanbanTask } from "@/hooks/useKanbanTasks";
import {
  getKanbanFileUrl,
  isImageMime,
  useKanbanAttachments,
  useSetKanbanCover,
  useSetKanbanCoverPreset,
  useUploadKanbanCover,
} from "@/hooks/useKanbanAttachments";
import { KANBAN_COVER_PRESETS, coverPresetStyle } from "@/lib/kanban-covers";

interface Props {
  task: KanbanTask;
  readOnly?: boolean;
}

// Capa da tarefa no topo do diálogo. Ao passar o mouse, aparece o botão para trocar o fundo:
// cor/gradiente ou uma das fotos anexadas (como no Trello).
export function KanbanCoverPicker({ task, readOnly }: Props) {
  const { data: attachments = [] } = useKanbanAttachments(task.id);
  const setPreset = useSetKanbanCoverPreset();
  const setCover = useSetKanbanCover();
  const uploadCover = useUploadKanbanCover();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);

  // Envia uma imagem do computador, guarda como anexo e a usa como capa.
  const handleComputerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Escolha uma imagem (JPG, PNG, WEBP ou GIF) para a capa.");
      return;
    }
    setOpen(false);
    try {
      await uploadCover.mutateAsync({ taskId: task.id, file });
    } catch {
      // O hook já mostra o erro na tela.
    }
  };

  const presetStyle = coverPresetStyle(task.cover_preset);
  const photos = attachments.filter((a) => isImageMime(a.mime_type));
  const hasCover = !!presetStyle || !!task.cover_path;

  const cover = presetStyle ? (
    <div className="h-44 w-full sm:h-52" style={presetStyle} />
  ) : task.cover_path ? (
    <img src={getKanbanFileUrl(task.cover_path)} alt="" className="block h-44 w-full object-cover sm:h-52" />
  ) : (
    <div className="h-24 w-full bg-muted/40" />
  );

  if (readOnly) return hasCover ? cover : null;

  return (
    <div className="group relative">
      {cover}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="absolute bottom-3 right-3 rounded-md bg-background/85 px-2.5 py-1 text-xs font-medium text-foreground opacity-0 shadow transition-opacity hover:bg-background group-hover:opacity-100 focus-visible:opacity-100"
          >
            {hasCover ? "Alterar capa" : "Adicionar capa"}
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground">Cores</p>
            <div className="grid grid-cols-4 gap-2">
              {KANBAN_COVER_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  title={p.label}
                  aria-label={p.label}
                  onClick={() => {
                    setPreset.mutate({ taskId: task.id, preset: p.key });
                    setOpen(false);
                  }}
                  className={`h-10 rounded-md transition-transform hover:scale-105 ${task.cover_preset === p.key ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                  style={{ background: p.background }}
                />
              ))}
            </div>
          </div>

          {photos.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Fotos anexadas</p>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    title={p.file_name}
                    onClick={() => {
                      setCover.mutate({ taskId: task.id, attachmentId: p.id });
                      setOpen(false);
                    }}
                    className={`overflow-hidden rounded-md ${p.is_cover && !task.cover_preset ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
                  >
                    <img src={getKanbanFileUrl(p.file_path)} alt={p.file_name} className="h-14 w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <Button
            variant="outline"
            size="sm"
            className="w-full"
            disabled={uploadCover.isPending}
            onClick={() => fileRef.current?.click()}
          >
            {uploadCover.isPending ? "Enviando..." : "Enviar do computador"}
          </Button>

          {hasCover && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                setPreset.mutate({ taskId: task.id, preset: null });
                setOpen(false);
              }}
            >
              Remover capa
            </Button>
          )}
        </PopoverContent>
      </Popover>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleComputerFile}
      />
    </div>
  );
}
