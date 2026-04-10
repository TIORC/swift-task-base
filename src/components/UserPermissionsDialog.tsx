import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, Menu, ShieldCheck, ShieldOff } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAdminPermissions } from "@/hooks/usePermissions";
import { MENU_ACCESS_ITEMS } from "@/lib/menu-access";

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
    let cancelled = false;

    if (!open || !userId) return;
    setLoading(true);

    Promise.all([loadUserMenuAccess(userId), loadUserTaskVisibility(userId)])
      .then(([menuData, visData]) => {
        if (cancelled) return;

        const menuMap: Record<string, boolean> = {};
        MENU_ACCESS_ITEMS.forEach((item) => {
          menuMap[item.key] = true;
        });
        menuData.forEach((item: any) => {
          menuMap[item.menu_key] = item.enabled;
        });

        setMenuState(menuMap);
        setVisibleUserIds(visData.map((item: any) => item.target_user_id));
        setLoading(false);
      })
      .catch((error: any) => {
        if (cancelled) return;
        toast.error(error.message ?? "Erro ao carregar permissões");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const menuItems = Object.entries(menuState).map(([menu_key, enabled]) => ({
        menu_key,
        enabled,
      }));

      await Promise.all([saveMenuAccess(userId, menuItems), saveTaskVisibility(userId, visibleUserIds)]);
      toast.success(`Permissões de ${userEmail} salvas!`);
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleMenu = (key: string, checked: boolean) => {
    setMenuState((prev) => ({ ...prev, [key]: checked }));
  };

  const toggleVisibility = (targetId: string) => {
    setVisibleUserIds((prev) =>
      prev.includes(targetId) ? prev.filter((id) => id !== targetId) : [...prev, targetId],
    );
  };

  const otherUsers = allUsers.filter((user) => user.id !== userId);

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
          <Tabs defaultValue="menu">
            <TabsList className="w-full">
              <TabsTrigger value="menu" className="flex-1 gap-1.5">
                <Menu className="h-3.5 w-3.5" />
                Menu
              </TabsTrigger>
              <TabsTrigger value="visibility" className="flex-1 gap-1.5">
                <Eye className="h-3.5 w-3.5" />
                Visibilidade
              </TabsTrigger>
            </TabsList>

            <TabsContent value="menu" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Controle quais itens do menu este usuário pode acessar.
              </p>

              <Separator />

              <div className="space-y-1">
                {MENU_ACCESS_ITEMS.map((item) => {
                  const isEnabled = menuState[item.key] !== false;

                  return (
                    <div
                      key={item.key}
                      className={`flex items-center gap-3 rounded-lg p-2 transition-colors ${
                        !isEnabled ? "bg-destructive/5" : "hover:bg-muted/50"
                      }`}
                    >
                      <Checkbox
                        id={`menu-${item.key}`}
                        checked={isEnabled}
                        onCheckedChange={(checked) => toggleMenu(item.key, !!checked)}
                      />
                      <label htmlFor={`menu-${item.key}`} className="text-sm cursor-pointer flex-1">
                        {item.label}
                      </label>

                      {!isEnabled ? (
                        <span className="flex items-center gap-1 text-[10px] text-destructive">
                          <ShieldOff className="h-3 w-3" />
                          Bloqueado
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] text-primary">
                          <ShieldCheck className="h-3 w-3" />
                          Liberado
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="visibility" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Selecione quais usuários este usuário pode ver as tarefas. Ele sempre vê as próprias.
              </p>
              <Separator />
              {otherUsers.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum outro usuário</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {otherUsers.map((user) => (
                    <div key={user.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                      <Checkbox
                        id={`vis-${user.id}`}
                        checked={visibleUserIds.includes(user.id)}
                        onCheckedChange={() => toggleVisibility(user.id)}
                      />
                      <label htmlFor={`vis-${user.id}`} className="text-sm cursor-pointer flex-1">
                        <span className="font-medium">{user.full_name || user.email}</span>
                        {user.full_name && <span className="text-muted-foreground text-xs ml-2">{user.email}</span>}
                      </label>
                    </div>
                  ))}
                </div>
              )}
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
