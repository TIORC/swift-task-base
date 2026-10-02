export type AlertKind = "request" | "message" | "mention" | "default";

export interface AlertItem {
  id: string;
  kind: AlertKind;
  title: string;
  description: string;
  createdAt: number;
}

type AlertListener = (alerts: AlertItem[]) => void;

const listeners = new Set<AlertListener>();
let queue: AlertItem[] = [];
let counter = 0;

function notify() {
  for (const l of listeners) l(queue);
}

export function showAlert(alert: Omit<AlertItem, "id" | "createdAt">): string {
  const id = `alert-${++counter}-${Date.now()}`;
  const item: AlertItem = { ...alert, id, createdAt: Date.now() };
  queue = [...queue, item];
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