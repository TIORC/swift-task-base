import { describe, expect, it } from "vitest";
import { mergeSolicitanteComments } from "@/lib/solicitanteChat";

const row = (id: string, content: string, created_at = "2026-11-12T14:00:00Z") => ({
  id, content, created_at, automation_id: "a1", user_id: "u1", images: [],
});

describe("incremental requester chat", () => {
  it("keeps emoji content unchanged", () => {
    expect(mergeSolicitanteComments([], [row("1", "😎😎")])[0].content).toBe("😎😎");
  });
  it("keeps image paths when merging messages", () => {
    const image = { ...row("1", "📷 Imagem"), images: ["u1/automations/a1/comments/print.png"] };
    expect(mergeSolicitanteComments([], [image])[0].images).toEqual(image.images);
  });
  it("does not duplicate the boundary message but keeps distinct messages at the same time", () => {
    const first = row("1", "primeira");
    expect(mergeSolicitanteComments([first], [first, row("2", "segunda")]).map((c) => c.id)).toEqual(["1", "2"]);
  });
  it("retains history when no new messages arrive", () => {
    const history = [row("1", "histórico")];
    expect(mergeSolicitanteComments(history, [])).toEqual(history);
  });
});