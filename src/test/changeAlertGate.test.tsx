import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChangeAlertGate } from "@/components/automations/ChangeAlertGate";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: vi.fn() },
}));

const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;

const pendingAlerts = [
  {
    event_id: "evt-1",
    automation_id: "auto-1",
    title: "Sistema Contábil",
    requester: "Talita",
    description: "Alteração solicitada por Talita:\nIncluir coluna de CNPJ",
    created_at: "2026-10-27T12:00:00Z",
  },
  {
    event_id: "evt-2",
    automation_id: "auto-2",
    title: "DTE - Notificações",
    requester: "Gabriel",
    description: "Alteração solicitada por Gabriel:\nTrocar o envio de e-mail",
    created_at: "2026-10-27T13:00:00Z",
  },
];

function renderGate() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ChangeAlertGate />
    </QueryClientProvider>,
  );
}

describe("ChangeAlertGate (alerta de Alteração solicitada)", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("bloqueia a tela com os pedidos pendentes e libera ao clicar em Entendi!", async () => {
    let pending = pendingAlerts;
    rpc.mockImplementation(async (name: string) => {
      if (name === "pending_change_alerts") return { data: pending, error: null };
      if (name === "acknowledge_change_alerts") {
        pending = [];
        return { data: pendingAlerts.length, error: null };
      }
      return { data: null, error: new Error(`rpc inesperada: ${name}`) };
    });

    renderGate();

    // Tela bloqueada: diálogo modal com os dois pedidos
    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("Alteração solicitada (2)")).toBeInTheDocument();
    expect(screen.getByText("Sistema Contábil")).toBeInTheDocument();
    expect(screen.getByText("DTE - Notificações")).toBeInTheDocument();
    expect(screen.getByText(/Incluir coluna de CNPJ/)).toBeInTheDocument();

    // Clique em "Entendi!" confirma os pedidos e libera a tela
    fireEvent.click(screen.getByRole("button", { name: /Entendi!/ }));

    await waitFor(() => {
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
    expect(rpc).toHaveBeenCalledWith("acknowledge_change_alerts");
  });

  it("não renderiza nada quando não há pedidos pendentes", async () => {
    rpc.mockResolvedValue({ data: [], error: null });

    renderGate();

    await waitFor(() => expect(rpc).toHaveBeenCalledWith("pending_change_alerts"));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Entendi!/ })).not.toBeInTheDocument();
  });
});
