import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type SystemKey = "ti" | "social";

interface UserSystemsContextType {
  systems: SystemKey[];
  loading: boolean;
  hasSystem: (s: SystemKey) => boolean;
  refresh: () => Promise<void>;
}

const Ctx = createContext<UserSystemsContextType>({
  systems: [],
  loading: true,
  hasSystem: () => false,
  refresh: async () => {},
});

export function UserSystemsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [systems, setSystems] = useState<SystemKey[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSystems = async () => {
    if (!user) {
      setSystems([]);
      setLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("user_systems")
      .select("system, enabled")
      .eq("user_id", user.id)
      .eq("enabled", true);
    setSystems(((data as { system: SystemKey }[]) ?? []).map((d) => d.system));
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    void fetchSystems();
  }, [user?.id]);

  return (
    <Ctx.Provider
      value={{
        systems,
        loading,
        hasSystem: (s) => systems.includes(s),
        refresh: fetchSystems,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export const useUserSystems = () => useContext(Ctx);
