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
    if (!user) { setMenuAccess([]); setLoading(false); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from("user_menu_access")
        .select("menu_key, enabled")
        .eq("user_id", user.id);
      setMenuAccess((data as MenuAccessEntry[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, [user?.id]);

  const isMenuEnabled = (key: string): boolean | null => {
    const entry = menuAccess.find((m) => m.menu_key === key);
    if (!entry) return null; // no override
    return entry.enabled;
  };

  return { menuAccess, loading, isMenuEnabled };
}

export function useMyTaskVisibility() {
  const { user } = useAuth();
  const [visibleUsers, setVisibleUsers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setVisibleUsers([]); setLoading(false); return; }

    const fetch = async () => {
      const { data } = await supabase
        .from("user_task_visibility")
        .select("target_user_id")
        .eq("user_id", user.id);
      setVisibleUsers((data as TaskVisibilityEntry[])?.map((d) => d.target_user_id) ?? []);
      setLoading(false);
    };
    fetch();
  }, [user?.id]);

  // Check if current user can see a specific user's tasks
  // Returns true if: no restrictions set (empty = see own only), or target is in list, or target is self
  const canViewUserTasks = (targetUserId: string): boolean => {
    if (!user) return false;
    if (targetUserId === user.id) return true; // always see own tasks
    return visibleUsers.includes(targetUserId);
  };

  return { visibleUsers, loading, canViewUserTasks };
}

// Admin hook to manage all permissions
export function useAdminPermissions() {
  const loadUserMenuAccess = async (userId: string) => {
    const { data } = await supabase
      .from("user_menu_access")
      .select("*")
      .eq("user_id", userId);
    return data ?? [];
  };

  const loadUserTaskVisibility = async (userId: string) => {
    const { data } = await supabase
      .from("user_task_visibility")
      .select("*")
      .eq("user_id", userId);
    return data ?? [];
  };

  const saveMenuAccess = async (userId: string, items: { menu_key: string; enabled: boolean }[]) => {
    // Delete existing
    await supabase.from("user_menu_access").delete().eq("user_id", userId);
    // Insert new
    if (items.length > 0) {
      const { error } = await supabase.from("user_menu_access").insert(
        items.map((i) => ({ user_id: userId, menu_key: i.menu_key, enabled: i.enabled }))
      );
      if (error) throw error;
    }
  };

  const saveTaskVisibility = async (userId: string, targetUserIds: string[]) => {
    // Delete existing
    await supabase.from("user_task_visibility").delete().eq("user_id", userId);
    // Insert new
    if (targetUserIds.length > 0) {
      const { error } = await supabase.from("user_task_visibility").insert(
        targetUserIds.map((tid) => ({ user_id: userId, target_user_id: tid }))
      );
      if (error) throw error;
    }
  };

  return { loadUserMenuAccess, loadUserTaskVisibility, saveMenuAccess, saveTaskVisibility };
}
