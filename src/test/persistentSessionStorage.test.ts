import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { persistentSessionStorage } from "@/integrations/supabase/persistentSessionStorage";

const KEY = "sb-projeto-auth-token";
const SESSION = '{"access_token":"abc","refresh_token":"def","expires_at":9999999999}';

describe("persistentSessionStorage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it("mantém a sessão salva depois de recarregar a página", () => {
    const primeiraAba = persistentSessionStorage();
    primeiraAba!.setItem(KEY, SESSION);

    // simula um F5: nova instância do client lê do mesmo localStorage
    const aposRecarregar = persistentSessionStorage();
    expect(aposRecarregar!.getItem(KEY)).toBe(SESSION);
  });

  it("só encerra a sessão quando o removeItem é chamado (logout explícito)", () => {
    const storage = persistentSessionStorage();
    storage!.setItem(KEY, SESSION);

    // leitura repetida não pode invalidar nada
    expect(storage!.getItem(KEY)).toBe(SESSION);
    expect(storage!.getItem(KEY)).toBe(SESSION);
    expect(storage!.getItem(KEY)).toBe(SESSION);

    storage!.removeItem(KEY);

    expect(persistentSessionStorage()!.getItem(KEY)).toBeNull();
  });

  it("ignora chaves desconhecidas sem afetar a sessão", () => {
    const storage = persistentSessionStorage();
    storage!.setItem(KEY, SESSION);

    expect(storage!.getItem("outra-chave")).toBeNull();
    expect(storage!.getItem(KEY)).toBe(SESSION);
  });

  it("não usa postMessage nem o broker de preview", () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, "parent", {
      configurable: true,
      value: { postMessage },
    });

    const storage = persistentSessionStorage();
    storage!.setItem(KEY, SESSION);

    expect(postMessage).not.toHaveBeenCalled();
  });

  it("mantém a sessão nesta aba quando o localStorage está indisponível", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    const storage = persistentSessionStorage();
    storage!.setItem(KEY, SESSION);

    expect(storage!.getItem(KEY)).toBe(SESSION);
  });
});