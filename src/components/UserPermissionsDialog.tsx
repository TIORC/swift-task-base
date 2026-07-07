import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, Menu, ShieldCheck, ShieldOff, Zap } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAdminPermissions } from "@/hooks/usePermissions";
import { MENU_ACCESS_ITEMS } from "@/lib/menu-access";
import { useAutomations } from "@/hooks/useAutomationsData";
import { SECTOR_COLORS } from "@/types/sectors";

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
  const {
    loadUserMenuAccess,
    loadUserTaskVisibility,
    loadUserAutomationVisibility,
    saveMenuAccess,
    saveTaskVisibility,
    saveAutomationVisibility,
  } = useAdminPermissions();
  const { data: automations = [] } = useAutomations();

  const [menuState, setMenuState] = useState<Record<string, boolean>>({});
  const [visibleUserIds, setVisibleUserIds] = useState<string[]>([]);
  const [visibleAutomationIds, setVisibleAutomationIds] = useState<string[]>([]);
  const [automationSearch, setAutomationSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!open || !userId) return;
    setLoading(true);

    Promise.all([
      loadUserMenuAccess(userId),
      loadUserTaskVisibility(userId),
      loadUserAutomationVisibility(userId),
    ])
      .then(([menuData, visData, autoData]) => {
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
        setVisibleAutomationIds(autoData);
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

      await Promise.all([
        saveMenuAccess(userId, menuItems),
        saveTaskVisibility(userId, visibleUserIds),
        saveAutomationVisibility(userId, visibleAutomationIds),
      ]);
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

  const toggleAutomation = (autoId: string) => {
    setVisibleAutomationIds((prev) =>
      prev.includes(autoId) ? prev.filter((id) => id !== autoId) : [...prev, autoId],
    );
  };

  const otherUsers = allUsers.filter((user) => user.id !== userId);

  const filteredAutomations = useMemo(() => {
    const q = automationSearch.toLowerCase().trim();
    const list = q
      ? automations.filter((a) => a.title.toLowerCase().includes(q) || (a.sector || "").toLowerCase().includes(q))
      : automations;
    return [...list].sort((a, b) => (a.sector || "zz").localeCompare(b.sector || "zz") || a.title.localeCompare(b.title));
  }, [automations, automationSearch]);

  const selectAllFiltered = () => {
    setVisibleAutomationIds((prev) => Array.from(new Set([...prev, ...filteredAutomations.map((a) => a.id)])));
  };
  const clearAllFiltered = () => {
    const ids = new Set(filteredAutomations.map((a) => a.id));
    setVisibleAutomationIds((prev) => prev.filter((id) => !ids.has(id)));
  };

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
                Tarefas
              </TabsTrigger>
              <TabsTrigger value="automations" className="flex-1 gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Automações
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

            <TabsContent value="automations" className="space-y-3 mt-4">
              <p className="text-xs text-muted-foreground">
                Libere automações específicas para este usuário. Por padrão o usuário só vê automações do(s) seu(s) setor(es);
                as marcadas aqui aparecem mesmo fora do setor. Admin, gestor e membros do sistema TI veem todas independentemente desta lista.
              </p>
              <div className="flex gap-2">
                <Input
                  placeholder="Buscar por título ou setor..."
                  value={automationSearch}
                  onChange={(e) => setAutomationSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button size="sm" variant="outline" className="h-8" onClick={selectAllFiltered}>Todas</Button>
                <Button size="sm" variant="outline" className="h-8" onClick={clearAllFiltered}>Limpar</Button>
              </div>
              <p className="text-[10px] text-muted-foreground">{visibleAutomationIds.length} selecionada(s)</p>
              <Separator />
              {filteredAutomations.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma automação</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto">
                  {filteredAutomations.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-muted/50">
                      <Checkbox
                        id={`auto-${a.id}`}
                        checked={visibleAutomationIds.includes(a.id)}
                        onCheckedChange={() => toggleAutomation(a.id)}
                      />
                      <label htmlFor={`auto-${a.id}`} className="text-sm cursor-pointer flex-1 flex items-center gap-2">
                        <span className="truncate">{a.title}</span>
                        {a.sector && (
                          <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${SECTOR_COLORS[a.sector] || ""}`}>
                            {a.sector}
                          </Badge>
                        )}
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

