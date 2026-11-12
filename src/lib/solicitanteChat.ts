import type { SolicitanteComment } from "./solicitacoesApi";

export const CHAT_POLL_INTERVAL_MS = 5000;

export function mergeSolicitanteComments(previous: SolicitanteComment[], incoming: SolicitanteComment[]): SolicitanteComment[] {
  const rows = new Map(previous.map((row) => [row.id ?? `${row.created_at}:${row.user_id}`, row]));
  for (const row of incoming) rows.set(row.id ?? `${row.created_at}:${row.user_id}`, row);
  return [...rows.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
}