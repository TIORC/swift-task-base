import { describe, expect, it } from "vitest";
import { TASKS_PAGE_SIZE, taskPageRange, taskPageCount } from "./task-pagination";

describe("ten tasks per page", () => {
  it("requests exactly ten tasks", () => {
    expect(TASKS_PAGE_SIZE).toBe(10);
    expect(taskPageRange(1)).toEqual({ from: 0, to: 9 });
  });
  it("moves to the next ten without overlap", () => {
    expect(taskPageRange(2)).toEqual({ from: 10, to: 19 });
    expect(taskPageCount(21)).toBe(3);
  });
});