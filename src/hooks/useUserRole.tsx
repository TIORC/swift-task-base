import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

export type RoleProfile = "admin" | "gestor" | "lider" | "membro";

interface UserRoleContextType {
  roles: AppRole[];
  profile: RoleProfile;
  loading: boolean;
  isAdmin: boolean;
  isGestor: boolean;
  isLider: boolean;
  isMembro: boolean;
  canAccess: (route: string) => boolean;
}

const UserRoleContext = createContext<UserRoleContextType>({
  roles: [],
  profile: "membro",
  loading: true,
  isAdmin: false,
  isGestor: false,
  isLider: false,
  isMembro: true,
  canAccess: () => false,
});

const routePermissions: Record<string, RoleProfile[]> = {
  "/": ["admin", "gestor", "lider", "membro"],
  "/kanban": ["admin", "gestor", "lider", "membro"],
  "/tasks": ["admin", "gestor", "lider", "membro"],
  "/focus": ["admin", "lider", "membro"],
  "/notifications": ["admin", "gestor", "lider", "membro"],
  "/dependencies": ["admin", "lider", "membro"],
  "/automacoes": ["admin", "gestor", "lider", "membro"],
  "/ranking": ["admin", "gestor", "lider"],
  "/manager": ["admin", "gestor", "lider"],
  "/reports": ["admin", "gestor", "lider", "membro"],
  "/support": ["admin", "gestor", "lider"],
  "/hipocampo": ["admin", "gestor", "lider", "membro"],
  "/almoxarifado": ["admin", "gestor", "lider", "membro"],
  "/admin": ["admin"],
};

export const defaultRouteForProfile: Record<RoleProfile, string> = {
  membro: "/kanban",
  lider: "/manager",
  gestor: "/manager",
  admin: "/",
};

function resolveProfile(roles: AppRole[]): RoleProfile {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("gestor")) return "gestor";
  if (roles.includes("lider")) return "lider";
  return "membro";
}

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async (withLoading = false) => {
      if (withLoading) setLoading(true);

      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar papéis do usuário", error);
        setRoles([]);
      } else {
        setRoles(data?.map((item) => item.role) ?? []);
      }

      setLoading(false);
    };

    setRoles([]);
    void fetchRoles(true);

    const handleWindowFocus = () => {
      void fetchRoles(false);
    };

    window.addEventListener("focus", handleWindowFocus);

    const channel = supabase
      .channel(`user-role-changes-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => {
          void fetchRoles(false);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleWindowFocus);
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const profile = resolveProfile(roles);
  const isAdmin = profile === "admin";
  const isGestor = profile === "gestor";
  const isLider = profile === "lider";
  const isMembro = profile === "membro";

  const canAccess = (route: string) => {
    if (isAdmin) return true;
    const allowed = routePermissions[route];
    if (!allowed) return true;
    return allowed.includes(profile);
  };

  return (
    <UserRoleContext.Provider value={{ roles, profile, loading, isAdmin, isGestor, isLider, isMembro, canAccess }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export const useUserRole = () => useContext(UserRoleContext);
