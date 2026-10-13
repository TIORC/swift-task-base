// Menções em comentários: o texto guarda "@Nome Completo" e a lista guarda os ids.
// Só conta como menção o nome inteiro (sem casar "@Ana" dentro de "@Ana Paula").

export interface MentionableProfile {
  id: string;
  full_name: string | null;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function findMentionedIds(content: string, profiles: MentionableProfile[]): string[] {
  const found: { id: string; start: number; end: number }[] = [];
  for (const p of profiles) {
    if (!p.full_name) continue;
    // Nome seguido de fim de texto ou de algo que não é letra/número.
    const pattern = new RegExp(`@${escapeRegExp(p.full_name)}(?![\\p{L}\\p{N}])`, "gu");
    for (const m of content.matchAll(pattern)) {
      found.push({ id: p.id, start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
    }
  }
  // "@Ana" dentro de "@Ana Paula" não conta: quando um nome mais longo começa no mesmo lugar, ele vence.
  const kept = found.filter((f) => !found.some((g) => g !== f && g.start === f.start && g.end > f.end));
  const ids = new Set(kept.map((k) => k.id));

  // "@Sofia" digitado sem escolher da lista: vale só se existir uma única pessoa com esse primeiro nome.
  const firstName = (name: string) => normalizeName(name.split(" ")[0]);
  for (const m of content.matchAll(/@(\p{L}+)(?![\p{L}\p{N}])/gu)) {
    const matches = profiles.filter((p) => p.full_name && firstName(p.full_name) === normalizeName(m[1]));
    if (matches.length === 1) ids.add(matches[0].id);
  }
  return [...ids];
}

// Separa o texto em partes: as menções reais viram { mention: "@Nome" }, o resto vira texto.
export function splitMentions(content: string, mentionedNames: string[]) {
  if (mentionedNames.length === 0) return [{ text: content, mention: false }];
  const alternatives = [...mentionedNames]
    .sort((a, b) => b.length - a.length)
    .map((n) => escapeRegExp(`@${n}`))
    .join("|");
  const parts = content.split(new RegExp(`(${alternatives})`, "u"));
  return parts
    .filter((part) => part !== "")
    .map((part) => ({ text: part, mention: mentionedNames.some((n) => part === `@${n}`) }));
}

// Texto normalizado (sem acento, minúsculo) para filtrar a lista ao digitar "@".
export const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
