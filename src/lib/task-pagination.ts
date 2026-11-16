export const TASKS_PAGE_SIZE = 10;

export function taskPageRange(page: number) {
  const from = (Math.max(1, page) - 1) * TASKS_PAGE_SIZE;
  return { from, to: from + TASKS_PAGE_SIZE - 1 };
}

export function taskPageCount(total: number) {
  return Math.max(1, Math.ceil(total / TASKS_PAGE_SIZE));
}