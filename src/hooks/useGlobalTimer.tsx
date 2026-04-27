import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

type TimerTarget = { type: "task"; id: string } | { type: "automation"; id: string };

interface GlobalTimerContextType {
  activeTaskId: string | null;
  activeAutomationId: string | null;
  activeTarget: TimerTarget | null;
  isRunning: boolean;
  elapsed: number;
  start: (taskId: string) => Promise<void>;
  startAutomation: (automationId: string) => Promise<void>;
  stop: () => Promise<void>;
}

const GlobalTimerContext = createContext<GlobalTimerContextType>({
  activeTaskId: null,
  activeAutomationId: null,
  activeTarget: null,
  isRunning: false,
  elapsed: 0,
  start: async () => {},
  startAutomation: async () => {},
  stop: async () => {},
});

export function GlobalTimerProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTarget, setActiveTarget] = useState<TimerTarget | null>(null);
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);
  const activeLogIdRef = useRef<string | null>(null);
  const activeTargetRef = useRef<TimerTarget | null>(null);

  useEffect(() => { activeLogIdRef.current = activeLogId; }, [activeLogId]);
  useEffect(() => { activeTargetRef.current = activeTarget; }, [activeTarget]);

  const stopCurrent = useCallback(async () => {
    if (!activeLogIdRef.current || !startTimeRef.current || !activeTargetRef.current) return;
    const now = new Date();
    const diffMs = now.getTime() - startTimeRef.current.getTime();
    const durationMinutes = Math.max(1, Math.round(diffMs / 60000));
    const table = activeTargetRef.current.type === "task" ? "time_logs" : "automation_time_logs";
    await supabase.from(table).update({ ended_at: now.toISOString(), duration_minutes: durationMinutes }).eq("id", activeLogIdRef.current);
  }, []);

  const start = useCallback(async (taskId: string) => {
    if (!user) return;
    if (isRunning) await stopCurrent();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("time_logs")
      .insert({ task_id: taskId, user_id: user.id, started_at: now, duration_minutes: 0 })
      .select().single();
    if (error || !data) return;
    setActiveTarget({ type: "task", id: taskId });
    setActiveLogId(data.id);
    startTimeRef.current = new Date(now);
    setElapsed(0);
    setIsRunning(true);
  }, [user, isRunning, stopCurrent]);

  const startAutomation = useCallback(async (automationId: string) => {
    if (!user) return;
    if (isRunning) await stopCurrent();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("automation_time_logs")
      .insert({ automation_id: automationId, user_id: user.id, started_at: now, duration_minutes: 0 })
      .select().single();
    if (error || !data) return;
    setActiveTarget({ type: "automation", id: automationId });
    setActiveLogId(data.id);
    startTimeRef.current = new Date(now);
    setElapsed(0);
    setIsRunning(true);
  }, [user, isRunning, stopCurrent]);

  const stop = useCallback(async () => {
    await stopCurrent();
    const prev = activeTargetRef.current;
    setActiveLogId(null);
    setActiveTarget(null);
    setIsRunning(false);
    setElapsed(0);
    startTimeRef.current = null;
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["automations"] });
    queryClient.invalidateQueries({ queryKey: ["automation_time_logs"] });
    if (prev?.type === "task") queryClient.invalidateQueries({ queryKey: ["time-logs", prev.id] });
    if (prev?.type === "automation") queryClient.invalidateQueries({ queryKey: ["automation_time_logs", prev.id] });
  }, [queryClient, stopCurrent]);

  // Tick
  useEffect(() => {
    if (isRunning && startTimeRef.current) {
      intervalRef.current = setInterval(() => {
        const now = new Date();
        setElapsed(Math.floor((now.getTime() - startTimeRef.current!.getTime()) / 1000));
      }, 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  // Auto-stop on unmount
  useEffect(() => {
    return () => {
      if (activeLogIdRef.current && startTimeRef.current && activeTargetRef.current) {
        const now = new Date();
        const diffMs = now.getTime() - startTimeRef.current.getTime();
        const durationMinutes = Math.max(1, Math.round(diffMs / 60000));
        const table = activeTargetRef.current.type === "task" ? "time_logs" : "automation_time_logs";
        supabase.from(table).update({ ended_at: now.toISOString(), duration_minutes: durationMinutes })
          .eq("id", activeLogIdRef.current)
          .then(() => queryClient.invalidateQueries({ queryKey: ["tasks"] }));
      }
    };
  }, []);

  const activeTaskId = activeTarget?.type === "task" ? activeTarget.id : null;
  const activeAutomationId = activeTarget?.type === "automation" ? activeTarget.id : null;

  return (
    <GlobalTimerContext.Provider value={{ activeTaskId, activeAutomationId, activeTarget, isRunning, elapsed, start, startAutomation, stop }}>
      {children}
    </GlobalTimerContext.Provider>
  );
}

export const useGlobalTimer = () => useContext(GlobalTimerContext);
