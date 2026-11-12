import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, Send, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CHAT_EMOJIS } from "@/lib/chatEmojis";
import { cn } from "@/lib/utils";

/** Texto que representa uma mensagem só com imagem (também gravado no banco). */
export const CHAT_IMAGE_FALLBACK = "📷 Imagem";
// Mesmos limites dos comentários do Kanban.
export const MAX_CHAT_IMAGES = 5;
export const MAX_CHAT_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

interface Props {
  placeholder: string;
  /** Envio em andamento (o pai controla): desabilita os botões. */
  busy: boolean;
  /** "dark" para o portal do solicitante (fundo escuro), "default" para o app do dev. */
  variant?: "default" | "dark";
  /** Recebe o texto e as imagens. Devolve true quando enviou, para limpar o campo. */
  onSend: (content: string, files: File[]) => Promise<boolean>;
}

/**
 * Campo de mensagem com emoji, anexo de imagem e colagem de print (Ctrl+V).
 * Enter envia, Shift+Enter quebra a linha. Não sabe onde guarda a imagem:
 * quem envia (dev ou solicitante) decide como fazer o upload.
 */
export function ChatComposer({ placeholder, busy, variant = "default", onSend }: Props) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dark = variant === "dark";

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const addFiles = (incoming: File[]) => {
    const images = incoming.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return;
    if (images.some((f) => f.size > MAX_CHAT_IMAGE_SIZE)) {
      toast.error("Cada imagem pode ter no máximo 10MB.");
      return;
    }
    if (files.length + images.length > MAX_CHAT_IMAGES) {
      toast.error(`No máximo ${MAX_CHAT_IMAGES} imagens por mensagem.`);
      return;
    }
    setFiles((prev) => [...prev, ...images].slice(0, MAX_CHAT_IMAGES));
  };

  const submit = async () => {
    const content = text.trim();
    if ((!content && files.length === 0) || busy) return;
    const sent = await onSend(content, files);
    if (sent) {
      setText("");
      setFiles([]);
    }
  };

  const iconBtn = cn("h-9 w-9 shrink-0", dark && "text-white/70 hover:bg-white/10 hover:text-white");
  const fieldClass = cn(
    "min-h-[2.5rem] flex-1 resize-none rounded-lg px-3 py-2 text-sm focus:outline-none",
    dark
      ? "border border-white/10 bg-black/25 text-white placeholder:text-white/35 focus:border-sky-300/40"
      : "border border-input bg-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring",
  );

  return (
    <div>
      {files.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {previews.map((url, i) => (
            <div key={url} className="relative">
              <img src={url} alt="Anexo a enviar" className="h-14 w-14 rounded-md border border-white/20 object-cover" />
              <button
                type="button"
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Remover imagem"
                className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={iconBtn}
          title="Anexar print"
          disabled={busy || files.length >= MAX_CHAT_IMAGES}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className={iconBtn} title="Emojis">
              <Smile className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          {/* `dark` no conteúdo: o popover é portal e precisa das cores do tema escuro. */}
          <PopoverContent align="start" className={cn("w-64 p-2", dark && "dark")}>
            <div className="grid grid-cols-6 gap-1">
              {CHAT_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setText((t) => t + emoji)}
                  className="rounded p-1 text-xl leading-none hover:bg-muted"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          onPaste={(e) => {
            const pasted = Array.from(e.clipboardData.files);
            if (pasted.some((f) => f.type.startsWith("image/"))) {
              e.preventDefault();
              addFiles(pasted);
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder={placeholder}
          className={fieldClass}
        />
        <Button
          type="button"
          size="icon"
          onClick={() => void submit()}
          disabled={busy || (!text.trim() && files.length === 0)}
          aria-label="Enviar mensagem"
          className={cn("h-10 w-10 shrink-0", dark ? "rounded-lg bg-sky-500 hover:bg-sky-400" : "h-9 w-9")}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
      <p className={cn("mt-1 text-[10px]", dark ? "text-white/35" : "text-muted-foreground")}>
        Enter envia · Shift+Enter quebra a linha · Ctrl+V cola print
      </p>
    </div>
  );
}
