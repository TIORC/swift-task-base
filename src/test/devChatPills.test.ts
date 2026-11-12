import { describe, expect, it } from "vitest";
import {
  MAX_OPEN_WINDOWS,
  MAX_VISIBLE_PILLS,
  type ChatPill,
  type ChatPillPayload,
  isChatPillPayload,
  markRead,
  mergeComment,
  openWindowList,
  receivePill,
} from "@/lib/devChatPills";

const payload = (automationId: string, content = "oi", id = `c-${automationId}-${content}`): ChatPillPayload => ({
  automation_id: automationId,
  automation_title: `Automação ${automationId}`,
  sender_name: "Maria",
  comment: { id, automation_id: automationId, user_id: "req-1", content, created_at: "2026-11-12T10:00:00.000Z" },
});

describe("receivePill", () => {
  it("cria a pílula com contagem não lida quando a janela está fechada", () => {
    const pills = receivePill([], payload("a1"), []);
    expect(pills).toHaveLength(1);
    expect(pills[0].unread).toBe(1);
    expect(pills[0].senderName).toBe("Maria");
  });

  it("não conta como não lida quando a janela da conversa está aberta", () => {
    const pills = receivePill([], payload("a1"), ["a1"]);
    expect(pills[0].unread).toBe(0);
  });

  it("acumula não lidas e sobe a conversa para o início", () => {
    let pills: ChatPill[] = [];
    pills = receivePill(pills, payload("a1", "primeira"), []);
    pills = receivePill(pills, payload("a2"), []);
    pills = receivePill(pills, payload("a1", "segunda"), []);
    expect(pills.map((p) => p.automationId)).toEqual(["a1", "a2"]);
    expect(pills[0].unread).toBe(2);
    expect(pills[0].lastContent).toBe("segunda");
  });

  it("mantém no máximo MAX_VISIBLE_PILLS pílulas", () => {
    let pills: ChatPill[] = [];
    for (let i = 0; i < MAX_VISIBLE_PILLS + 3; i++) pills = receivePill(pills, payload(`x${i}`), []);
    expect(pills).toHaveLength(MAX_VISIBLE_PILLS);
    expect(pills[0].automationId).toBe(`x${MAX_VISIBLE_PILLS + 2}`);
  });
});

describe("markRead / openWindowList", () => {
  it("zera as não lidas ao abrir a conversa", () => {
    const pills = markRead(receivePill([], payload("a1"), []), "a1");
    expect(pills[0].unread).toBe(0);
  });

  it("a janela mais recente fica na frente e o número de janelas é limitado", () => {
    let open: string[] = [];
    open = openWindowList(open, "a1");
    open = openWindowList(open, "a2");
    open = openWindowList(open, "a3");
    expect(open).toHaveLength(MAX_OPEN_WINDOWS);
    expect(open[0]).toBe("a3");
    expect(open).not.toContain("a1");
  });

  it("reabrir uma janela já aberta não a duplica", () => {
    expect(openWindowList(["a2", "a1"], "a1")).toEqual(["a1", "a2"]);
  });
});

describe("mergeComment", () => {
  const base = { automation_id: "a1", user_id: "u", mentions: [], profile: null };
  it("não duplica uma mensagem já presente e ordena por data", () => {
    const first = { ...base, id: "1", content: "a", created_at: "2026-11-12T10:00:00.000Z" };
    const later = { ...base, id: "2", content: "b", created_at: "2026-11-12T11:00:00.000Z" };
    const merged = mergeComment([later], first);
    expect(merged.map((c) => c.id)).toEqual(["1", "2"]);
    expect(mergeComment(merged, first)).toBe(merged);
  });
});

describe("isChatPillPayload", () => {
  it("aceita payload completo e recusa lixo", () => {
    expect(isChatPillPayload(payload("a1"))).toBe(true);
    expect(isChatPillPayload({ automation_id: "a1" })).toBe(false);
    expect(isChatPillPayload(null)).toBe(false);
  });
});
