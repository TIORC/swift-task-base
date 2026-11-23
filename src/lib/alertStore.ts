export type AlertKind = "request" | "message" | "mention" | "default";

export interface AlertItem {
  id: string;
  kind: AlertKind;
  title: string;
  description: string;
  createdAt: number;
  // Rota para abrir ao clicar no alerta (ex.: "/tasks?task=<id>").
  href?: string;
}

type AlertListener = (alerts: AlertItem[]) => void;

const listeners = new Set<AlertListener>();
let queue: AlertItem[] = [];
let counter = 0;

// No máximo 2 alertos na tela; ao chegar um terceiro, o mais antigo sai.
const MAX_VISIBLE_ALERTS = 2;

function notify() {
  for (const l of listeners) l(queue);
}

export function showAlert(alert: Omit<AlertItem, "id" | "createdAt">): string {
  const id = `alert-${++counter}-${Date.now()}`;
  const item: AlertItem = { ...alert, id, createdAt: Date.now() };
  queue = [...queue, item].slice(-MAX_VISIBLE_ALERTS);
  notify();
  return id;
}

export function dismissAlert(id: string) {
  queue = queue.filter((a) => a.id !== id);
  notify();
}

export function dismissAllAlerts() {
  queue = [];
  notify();
}

export function subscribeAlerts(listener: AlertListener): () => void {
  listeners.add(listener);
  listener(queue);
  return () => { listeners.delete(listener); };
}