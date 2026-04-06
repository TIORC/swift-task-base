import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// Role hierarchy: admin > gestor/lider > member/dev
export type RoleProfile = "admin" | "gestor" | "membro";

interface UserRoleContextType {
  roles: AppRole[];
  profile: RoleProfile;
  loading: boolean;
  isAdmin: boolean;
  isGestor: boolean;
  isMembro: boolean;
  canAccess: (route: string) => boolean;
}

const UserRoleContext = createContext<UserRoleContextType>({
  roles: [],
  profile: "membro",
  loading: true,
  isAdmin: false,
  isGestor: false,
  isMembro: true,
  canAccess: () => false,
});

// Map routes to allowed profiles
const routePermissions: Record<string, RoleProfile[]> = {
  "/": ["admin", "gestor", "membro"],
  "/kanban": ["admin", "gestor", "membro"],
  "/tasks": ["admin", "gestor", "membro"],
  "/focus": ["admin", "gestor", "membro"],
  "/notifications": ["admin", "gestor", "membro"],
  "/dependencies": ["admin", "gestor", "membro"],
  "/automations": ["admin", "gestor"],
  "/ranking": ["admin", "gestor"],
  "/manager": ["admin", "gestor"],
  "/admin": ["admin"],
};

// Default route per profile
export const defaultRouteForProfile: Record<RoleProfile, string> = {
  membro: "/kanban",
  gestor: "/manager",
  admin: "/",
};

function resolveProfile(roles: AppRole[]): RoleProfile {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("gestor") || roles.includes("lider")) return "gestor";
  return "membro";
}

export function UserRoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRoles([]);
      setLoading(false);
      return;
    }

    const fetchRoles = async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      setRoles(data?.map((r) => r.role) ?? []);
      setLoading(false);
    };

    fetchRoles();

    // Listen for realtime role changes
    const channel = supabase
      .channel("user-role-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => fetchRoles()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const profile = resolveProfile(roles);
  const isAdmin = profile === "admin";
  const isGestor = profile === "gestor";
  const isMembro = profile === "membro";

  const canAccess = (route: string) => {
    if (isAdmin) return true;
    const allowed = routePermissions[route];
    if (!allowed) return true; // unknown routes are accessible
    return allowed.includes(profile);
  };

  return (
    <UserRoleContext.Provider value={{ roles, profile, loading, isAdmin, isGestor, isMembro, canAccess }}>
      {children}
    </UserRoleContext.Provider>
  );
}

export const useUserRole = () => useContext(UserRoleContext);
