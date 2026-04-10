type RoleProfile = "admin" | "gestor" | "membro";

export const MENU_ACCESS_ITEMS = [
  { key: "/", label: "Dashboard" },
  { key: "/manager", label: "Painel Gestor" },
  { key: "/kanban", label: "Kanban" },
  { key: "/tasks", label: "Tarefas" },
  { key: "/support", label: "Chamados" },
  { key: "/automacoes", label: "Automações" },
  { key: "/focus", label: "Modo Foco" },
  { key: "/dependencies", label: "Dependências" },
  { key: "/reports", label: "Relatórios" },
  { key: "/ranking", label: "Ranking" },
  { key: "/notifications", label: "Notificações" },
] as const;

const MENU_ACCESS_KEYS = new Set(MENU_ACCESS_ITEMS.map((item) => item.key));

const FALLBACK_ROUTES_BY_PROFILE: Record<RoleProfile, string[]> = {
  admin: ["/", "/manager", "/kanban", "/tasks", "/support", "/automacoes", "/focus", "/dependencies", "/reports", "/ranking", "/notifications", "/admin"],
  gestor: ["/manager", "/", "/kanban", "/tasks", "/automacoes", "/support", "/reports", "/ranking", "/focus", "/dependencies", "/notifications"],
  membro: ["/kanban", "/tasks", "/automacoes", "/focus", "/dependencies", "/reports", "/notifications", "/"],
};

export function canAccessMenuRoute({
  route,
  profile,
  canAccess,
  isMenuEnabled,
}: {
  route: string;
  profile: RoleProfile;
  canAccess: (route: string) => boolean;
  isMenuEnabled: (route: string) => boolean | null;
}) {
  if (profile === "admin") return true;

  const menuOverride = MENU_ACCESS_KEYS.has(route) ? isMenuEnabled(route) : null;

  if (menuOverride === false) return false;
  if (menuOverride === true) return true;

  return canAccess(route);
}

export function getAccessibleFallbackRoute({
  profile,
  canAccess,
  isMenuEnabled,
  defaultRoute,
}: {
  profile: RoleProfile;
  canAccess: (route: string) => boolean;
  isMenuEnabled: (route: string) => boolean | null;
  defaultRoute: string;
}) {
  const candidates = Array.from(
    new Set([defaultRoute, ...FALLBACK_ROUTES_BY_PROFILE[profile], ...MENU_ACCESS_ITEMS.map((item) => item.key)]),
  );

  return (
    candidates.find((route) =>
      canAccessMenuRoute({
        route,
        profile,
        canAccess,
        isMenuEnabled,
      }),
    ) ?? null
  );
}
