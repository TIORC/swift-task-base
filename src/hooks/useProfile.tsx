import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user?.id) { setProfile(null); setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

  const avatarUrl = profile?.avatar_url
    ? (() => {
        const { data } = (supabase as any).storage.from("avatars").getPublicUrl(profile.avatar_url);
        return data?.publicUrl as string | undefined;
      })()
    : undefined;

  return { profile, avatarUrl, loading, refresh };
}
