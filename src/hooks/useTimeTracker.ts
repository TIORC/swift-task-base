import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";

interface TimeLog {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number;
  description: string | null;
}

interface UserTimeSummary {
  user_id: string;
  full_name: string | null;
  total_minutes: number;
}

export function useTimeTracker(taskId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeLogId, setActiveLogId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<Date | null>(null);

  // Start timer
  const start = useCallback(async () => {
    if (!taskId || !user || isRunning) return;

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("time_logs")
      .insert({
        task_id: taskId,
        user_id: user.id,
        started_at: now,
        duration_minutes: 0,
      })
      .select()
      .single();

    if (error || !data) return;

    setActiveLogId(data.id);
    startTimeRef.current = new Date(now);
    setElapsed(0);
    setIsRunning(true);
  }, [taskId, user, isRunning]);

  // Stop timer
  const stop = useCallback(async () => {
    if (!activeLogId || !startTimeRef.current) return;

    const now = new Date();
    const diffMs = now.getTime() - startTimeRef.current.getTime();
    const durationMinutes = Math.max(1, Math.round(diffMs / 60000));

    await supabase
      .from("time_logs")
      .update({
        ended_at: now.toISOString(),
        duration_minutes: durationMinutes,
      })
      .eq("id", activeLogId);

    setActiveLogId(null);
    setIsRunning(false);
    setElapsed(0);
    startTimeRef.current = null;
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["time-logs", taskId] });
  }, [activeLogId, taskId, queryClient]);

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

  // Auto-stop on unmount / task change
  useEffect(() => {
    return () => {
      // We can't await in cleanup, so fire and forget
      if (activeLogId && startTimeRef.current) {
        const now = new Date();
        const diffMs = now.getTime() - startTimeRef.current.getTime();
        const durationMinutes = Math.max(1, Math.round(diffMs / 60000));
        supabase
          .from("time_logs")
          .update({ ended_at: now.toISOString(), duration_minutes: durationMinutes })
          .eq("id", activeLogId)
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ["tasks"] });
          });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLogId]);

  return { isRunning, elapsed, start, stop };
}

export function useTaskTimeLogs(taskId: string | null) {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserTimeSummary[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!taskId) return;

    const fetchLogs = async () => {
      setLoading(true);
      const { data: timeLogs } = await supabase
        .from("time_logs")
        .select("*")
        .eq("task_id", taskId)
        .order("started_at", { ascending: false });

      if (!timeLogs) {
        setLoading(false);
        return;
      }

      setLogs(timeLogs as TimeLog[]);

      const total = timeLogs.reduce((sum, l) => sum + l.duration_minutes, 0);
      setTotalMinutes(total);

      // Group by user
      const userMap: Record<string, number> = {};
      timeLogs.forEach((l) => {
        userMap[l.user_id] = (userMap[l.user_id] || 0) + l.duration_minutes;
      });

      const userIds = Object.keys(userMap);
      let profilesMap: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p.full_name]));
        }
      }

      setUserSummaries(
        userIds.map((uid) => ({
          user_id: uid,
          full_name: profilesMap[uid] || null,
          total_minutes: userMap[uid],
        }))
      );

      setLoading(false);
    };

    fetchLogs();
  }, [taskId]);

  return { logs, userSummaries, totalMinutes, loading };
}

export function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
