import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, Menu } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAdminPermissions } from "@/hooks/usePermissions";

const MENU_ITEMS = [
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
];

interface UserPermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
  allUsers: { id: string; email: string; full_name: string }[];
}

export function UserPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  allUsers,
}: UserPermissionsDialogProps) {
  const { loadUserMenuAccess, loadUserTaskVisibility, saveMenuAccess, saveTaskVisibility } = useAdminPermissions();

  const [menuState, setMenuState] = useState<Record<string, boolean>>({});
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    Promise.all([
      loadUserMenuAccess(userId),
      loadUserTaskVisibility(userId),
    ]).then(([menuData, visData]) => {
      const menuMap: Record<string, boolean> = {};
      menuData.forEach((m: any) => { menuMap[m.menu_key] = m.enabled; });
      setMenuState(menuMap);
      setVisibleUserIds(visData.map((v: any) => v.target_user_id));
      setLoading(false);
    });
  }, [open, userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const menuItems = Object.entries(menuState).map(([menu_key, enabled]) => ({
        menu_key,
        enabled,
      }));

      await Promise.all([
        saveMenuAccess(userId, menuItems),
        saveTaskVisibility(userId, visibleUserIds),
      ]);
      toast.success(`Permissões de ${userEmail} salvas!`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleMenu = (key: string, checked: boolean) => {
    setMenuState((prev) => ({ ...prev, [key]: checked }));
  };

  const toggleVisibility = (targetId: string) => {
    setVisibleUserIds((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId]
    );
  };

  const otherUsers = allUsers.filter((u) => u.id !== userId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões</DialogTitle>
          <DialogDescription>Configurar permissões de {userEmail}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="visibility">
            <TabsList className="w-full">
              <TabsTrigger value="visibility" className="flex-1 gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Visibilidade
              </TabsTrigger>
              <TabsTrigger value="menu" className="flex-1 gap-1.5">
                <Menu className="h-3.5 w-3.5" />
                Menu
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visibility" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Selecione quais usuários este usuário pode ver as tarefas. Ele sempre vê as próprias.
              </p>
              <Separator />
              {otherUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum outro usuário</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {otherUsers.map((u) => (
                    <div key={u.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                      <Checkbox
                        id={`vis-${u.id}`}
                        checked={visibleUserIds.includes(u.id)}
                        onCheckedChange={() => toggleVisibility(u.id)}
                      />
                      <label htmlFor={`vis-${u.id}`} className="text-sm cursor-pointer flex-1">
                        <span className="font-medium">{u.full_name || u.email}</span>
                        {u.full_name && (
                          <span className="text-muted-foreground text-xs ml-2">{u.email}</span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="menu" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Desmarque para bloquear o acesso a itens do menu. Itens marcados ficam visíveis para o usuário.
              </p>
              <Separator />
              <div className="space-y-2">
                {MENU_ITEMS.map((item) => {
                  // If there's an explicit override, use it. Otherwise default to enabled.
                  const isEnabled = menuState[item.key] !== undefined ? menuState[item.key] : true;
                  return (
                    <div key={item.key} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                      <Checkbox
                        id={`menu-${item.key}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) => toggleMenu(item.key, !!checked)}
                      />
                      <label htmlFor={`menu-${item.key}`} className="text-sm cursor-pointer">
                        {item.label}
                      </label>
                    </div>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
