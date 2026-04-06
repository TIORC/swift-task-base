import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface GlobalTimerContextType {
  activeTaskId: string | null;
  isRunning: boolean;
  elapsed: number;
  start: (taskId: string) => Promise<void>;
  stop: () => Promise<void>;
}

const GlobalTimerContext = createContext<GlobalTimerContextType>({
  activeTaskId: null,
  isRunning: false,
  elapsed: 0,
  start: async () => {},
  stop: async () => {},
});

export function GlobalTimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const activeLogIdRef = useRef<string | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => { activeLogIdRef.current = activeLogId; }, [activeLogId]);
  useEffect(() => { activeTaskIdRef.current = activeTaskId; }, [activeTaskId]);

  const start = useCallback(async (taskId: string) => {
    if (!user || isRunning) return;

    // If switching tasks, stop the current one first
    if (activeLogIdRef.current && startTimeRef.current) {
      const now = new Date();
      const diffMs = now.getTime() - startTimeRef.current.getTime();
      const durationMinutes = Math.max(1, Math.round(diffMs / 60000));
      await supabase
        .from("time_logs")
        .update({ ended_at: now.toISOString(), duration_minutes: durationMinutes })
        .eq("id", activeLogIdRef.current);
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("time_logs")
      .insert({ task_id: taskId, user_id: user.id, started_at: now, duration_minutes: 0 })
      .select()
      .single();

    if (error || !data) return;

    setActiveTaskId(taskId);
    setActiveLogId(data.id);
    startTimeRef.current = new Date(now);
    setElapsed(0);
    setIsRunning(true);
  }, [user, isRunning]);

  const stop = useCallback(async () => {
    if (!activeLogIdRef.current || !startTimeRef.current) return;

    const now = new Date();
    const diffMs = now.getTime() - startTimeRef.current.getTime();
    const durationMinutes = Math.max(1, Math.round(diffMs / 60000));

    await supabase
      .from("time_logs")
      .update({ ended_at: now.toISOString(), duration_minutes: durationMinutes })
      .eq("id", activeLogIdRef.current);

    const prevTaskId = activeTaskIdRef.current;
    setActiveLogId(null);
    setActiveTaskId(null);
    setIsRunning(false);
    setElapsed(0);
    startTimeRef.current = null;
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    if (prevTaskId) queryClient.invalidateQueries({ queryKey: ["time-logs", prevTaskId] });
  }, [queryClient]);

  // Tick
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        setElapsed(Math.floor((now.getTime() - startTimeRef.current!.getTime()) / 1000));
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      if (activeLogIdRef.current && startTimeRef.current) {
        const now = new Date();
        const diffMs = now.getTime() - startTimeRef.current.getTime();
        const durationMinutes = Math.max(1, Math.round(diffMs / 60000));
        supabase
          .from("time_logs")
          .update({ ended_at: now.toISOString(), duration_minutes: durationMinutes })
          .eq("id", activeLogIdRef.current)
          .then(() => queryClient.invalidateQueries({ queryKey: ["tasks"] }));
      }
    };
  }, []);

  return (
    <GlobalTimerContext.Provider value={{ activeTaskId, isRunning, elapsed, start, stop }}>
      {children}
    </GlobalTimerContext.Provider>
  );
}

export const useGlobalTimer = () => useContext(GlobalTimerContext);
