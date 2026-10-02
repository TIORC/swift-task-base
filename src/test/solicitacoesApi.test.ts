import { describe, it, expect, beforeEach, vi } from "vitest";
import { SOLICITANTE_TOKEN_KEY, solicitanteCall } from "@/lib/solicitacoesApi";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;

describe("solicitacoesApi", () => {
  beforeEach(() => {
    sessionStorage.clear();
    invoke.mockReset();
  });

  it("recusa ação autenticada sem token em sessionStorage", async () => {
    await expect(solicitanteCall("list")).rejects.toThrow(/identifique-se/i);
    expect(invoke).not.toHaveBeenCalled();
  });

  it("envia o token do sessionStorage em toda chamada", async () => {
    sessionStorage.setItem(SOLICITANTE_TOKEN_KEY, "token-curto");
    invoke.mockResolvedValue({ data: { requests: [] }, error: null });
    await solicitanteCall("list");
    expect(invoke).toHaveBeenCalledWith("solicitacoes", {
      body: { action: "list", token: "token-curto" },
    });
  });

  it("transforma o 403 do servidor no erro de e-mail não cadastrado", async () => {
    sessionStorage.setItem(SOLICITANTE_TOKEN_KEY, "token-curto");
    invoke.mockResolvedValue({ data: { error: "E-mail não cadastrado como solicitante" }, error: null });
    await expect(solicitanteCall("list")).rejects.toThrow("E-mail não cadastrado como solicitante");
  });
});
