// Formatos aceitos nos anexos das tarefas (/tarefas e Kanban).
// A checagem é pela extensão do arquivo; o tipo MIME é gravado de acordo com ela,
// porque alguns navegadores enviam tipo vazio para .doc, .ppt, .txt etc.

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Valor para o atributo accept do input de arquivo.
export const ATTACHMENT_ACCEPT = ["image/*", ...Object.keys(MIME_BY_EXTENSION).map((ext) => `.${ext}`)].join(",");

// Texto para mensagens de erro.
export const ATTACHMENT_FORMATS_LABEL = "imagem (JPG, PNG, WEBP, GIF), PDF, Word, Excel, PowerPoint ou TXT";

// Nome seguro para a chave do storage: sem acento, espaço nem símbolos ("Invalid key" do Supabase).
// O nome original continua em file_name, usado na exibição.
export function storageSafeName(fileName: string) {
  return fileName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/_+/g, "_");
}

export function extensionOf(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

// Devolve o MIME a gravar, ou null se o formato não é aceito.
export function attachmentMime(file: File): string | null {
  return MIME_BY_EXTENSION[extensionOf(file.name)] ?? null;
}
