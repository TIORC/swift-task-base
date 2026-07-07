import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface MenuAccessEntry {
  menu_key: string;
  enabled: boolean;
}

export interface TaskVisibilityEntry {
  target_user_id: string;
}

export function useMyMenuAccess() {
  const { user } = useAuth();
  const [menuAccess, setMenuAccess] = useState<MenuAccessEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setMenuAccess([]);
      setLoading(false);
      return;
    }

    const fetchMenuAccess = async (withLoading = false) => {
      if (withLoading) setLoading(true);

      const { data, error } = await supabase
        .from("user_menu_access")
        .select("menu_key, enabled")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar permissões de menu", error);
        setMenuAccess([]);
      } else {
        setMenuAccess((data as MenuAccessEntry[]) ?? []);
      }

      setLoading(false);
    };

    setMenuAccess([]);
    void fetchMenuAccess(true);

    const handleWindowFocus = () => {
      void fetchMenuAccess(false);
    };

    window.addEventListener("focus", handleWindowFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [user?.id]);

  const isMenuEnabled = (key: string): boolean | null => {
    const entry = menuAccess.find((m) => m.menu_key === key);
    if (!entry) return null;
    return entry.enabled;
  };

  return { menuAccess, loading, isMenuEnabled };
}

export function useMyTaskVisibility() {
  const { user } = useAuth();
  const [visibleUsers, setVisibleUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setVisibleUsers([]);
      setLoading(false);
      return;
    }

    const fetch = async () => {
      const { data } = await supabase
        .from("user_task_visibility")
        .select("target_user_id")
        .eq("user_id", user.id);
      setVisibleUsers((data as TaskVisibilityEntry[])?.map((d) => d.target_user_id) ?? []);
      setLoading(false);
    };

    void fetch();
  }, [user?.id]);

  const canViewUserTasks = (targetUserId: string): boolean => {
    if (!user) return false;
    if (targetUserId === user.id) return true;
    return visibleUsers.includes(targetUserId);
  };

  return { visibleUsers, loading, canViewUserTasks };
}

export function useMyAutomationVisibility() {
  const { user } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIds([]);
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await (supabase as any)
        .from("user_automation_visibility")
        .select("automation_id")
        .eq("user_id", user.id);
      setIds(((data as any[]) ?? []).map((d) => d.automation_id));
      setLoading(false);
    })();
  }, [user?.id]);

  return { allowedAutomationIds: ids, loading };
}

export function useAdminPermissions() {
  const loadUserMenuAccess = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_menu_access")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data ?? [];
  };

  const loadUserTaskVisibility = async (userId: string) => {
    const { data, error } = await supabase
      .from("user_task_visibility")
      .select("*")
      .eq("user_id", userId);

    if (error) throw error;
    return data ?? [];
  };

  const saveMenuAccess = async (userId: string, items: { menu_key: string; enabled: boolean }[]) => {
    const { error: delError } = await supabase.from("user_menu_access").delete().eq("user_id", userId);
    if (delError) throw delError;

    if (items.length > 0) {
      const { error } = await supabase.from("user_menu_access").insert(
        items.map((item) => ({ user_id: userId, menu_key: item.menu_key, enabled: item.enabled })),
      );
      if (error) throw error;
    }
  };

  const saveTaskVisibility = async (userId: string, targetUserIds: string[]) => {
    const { error: delError } = await supabase.from("user_task_visibility").delete().eq("user_id", userId);
    if (delError) throw delError;

    if (targetUserIds.length > 0) {
      const { error } = await supabase.from("user_task_visibility").insert(
        targetUserIds.map((targetUserId) => ({ user_id: userId, target_user_id: targetUserId })),
      );
      if (error) throw error;
    }
  };

  const loadUserAutomationVisibility = async (userId: string) => {
    const { data, error } = await (supabase as any)
      .from("user_automation_visibility")
      .select("automation_id")
      .eq("user_id", userId);
    if (error) throw error;
    return ((data as any[]) ?? []).map((d) => d.automation_id as string);
  };

  const saveAutomationVisibility = async (userId: string, automationIds: string[]) => {
    const { error: delError } = await (supabase as any)
      .from("user_automation_visibility")
      .delete()
      .eq("user_id", userId);
    if (delError) throw delError;

    if (automationIds.length > 0) {
      const { error } = await (supabase as any).from("user_automation_visibility").insert(
        automationIds.map((automation_id) => ({ user_id: userId, automation_id })),
      );
      if (error) throw error;
    }
  };

  return {
    loadUserMenuAccess,
    loadUserTaskVisibility,
    loadUserAutomationVisibility,
    saveMenuAccess,
    saveTaskVisibility,
    saveAutomationVisibility,
  };
}
