import { useEffect, useState } from "react";
import { Coffee, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGlobalTimer } from "@/hooks/useGlobalTimer";
import { formatTime } from "@/hooks/useTimeTracker";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const STORAGE_KEY = "coffee_task_id";

export function CoffeeButton() {
  const { user } = useAuth();
  const { activeTaskId, isRunning, elapsed, start, stop } = useGlobalTimer();
  const [coffeeTaskId, setCoffeeTaskId] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (coffeeTaskId) localStorage.setItem(STORAGE_KEY, coffeeTaskId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [coffeeTaskId]);

  const isCoffeeRunning = isRunning && activeTaskId === coffeeTaskId && !!coffeeTaskId;

  const handleClick = async () => {
    if (!user || busy) return;
    setBusy(true);
    try {
      if (isCoffeeRunning) {
        await stop();
        if (coffeeTaskId) {
          await supabase
            .from("tasks")
            .update({ status: "done", completed_at: new Date().toISOString() } as any)
            .eq("id", coffeeTaskId);
        }
        setCoffeeTaskId(null);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success("Pausa para café concluída ☕");
      } else {
        const now = new Date();
        const title = `☕ Café — ${now.toLocaleDateString("pt-BR")} ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
        const { data, error } = await supabase
          .from("tasks")
          .insert({
            title,
            description: "Pausa para café registrada automaticamente.",
            status: "in_progress" as any,
            priority: "low" as any,
            assigned_to: user.id,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (error || !data) throw error || new Error("Falha ao criar tarefa");
        setCoffeeTaskId(data.id);
        await start(data.id);
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success("Bom café! Timer iniciado ☕");
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro no café");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title={isCoffeeRunning ? "Concluir pausa de café" : "Iniciar pausa para café"}
      className={cn(
        "fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full shadow-lg border transition-all",
        "px-4 py-3 font-medium text-sm",
        isCoffeeRunning
          ? "bg-amber-500 text-white border-amber-600 hover:bg-amber-600 animate-pulse"
          : "bg-card text-foreground border-border hover:bg-muted",
        busy && "opacity-70 cursor-not-allowed",
      )}
    >
      {busy ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : (
        <Coffee className={cn("h-5 w-5", isCoffeeRunning ? "text-white" : "text-amber-600")} />
      )}
      {isCoffeeRunning && (
        <span className="font-mono tabular-nums text-sm">{formatTime(elapsed)}</span>
      )}
    </button>
  );
}
