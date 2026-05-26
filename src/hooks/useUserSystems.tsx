import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
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
  const { user, loading: authLoading } = useAuth();
  const [systems, setSystems] = useState<SystemKey[]>([]);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const inflightFor = useRef<string | null>(null);

  const fetchSystems = async () => {
    if (!user) {
      setSystems([]);
      setFetchedFor(null);
      return;
    }
    inflightFor.current = user.id;
    const { data } = await (supabase as any)
      .from("user_systems")
      .select("system, enabled")
      .eq("user_id", user.id)
      .eq("enabled", true);
    // Ignora resposta antiga se o usuário mudou enquanto buscava
    if (inflightFor.current !== user.id) return;
    setSystems(((data as { system: SystemKey }[]) ?? []).map((d) => d.system));
    setFetchedFor(user.id);
  };

  useEffect(() => {
    void fetchSystems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // loading = true enquanto auth resolve OU enquanto não buscamos systems pra esse usuário
  const loading = authLoading || (!!user && fetchedFor !== user.id);

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
