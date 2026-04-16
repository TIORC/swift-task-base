import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  ShieldCheck, UserPlus, KeyRound, Trash2, Users, Loader2, Search, Shield, Settings2, Headset,
} from "lucide-react";
import { UserPermissionsDialog } from "@/components/UserPermissionsDialog";

const SUPPORT_USERS_EMAILS = [
  "adalgiza.argolo@orcoma.com.br","adeir@orcoma.com.br","aelica.sampaio@orcoma.com.br","anderson.rocha@orcoma.com.br",
  "angel.kauan@orcoma.com.br","anna.gabriella@orcoma.com.br","antonio.carlos@orcoma.com.br","bianca.souza@orcoma.com.br",
  "carolane.brito@orcoma.com.br","cauan.argolo@orcoma.com.br","celso.alcantara@orcoma.com.br","claudia.girolamo@orcoma.com.br",
  "cleo@orcoma.com.br","daiane.torres@orcoma.com.br","danicarla@orcoma.com.br","daniel.silva@orcoma.com.br",
  "daniela.ferreira@orcoma.com.br","danusa.moura@orcoma.com.br","dinara.santos@orcoma.com.br","edimeia.ramos@orcoma.com.br",
  "eduarda.vitoria@orcoma.com.br","emily.karoline@orcoma.com.br","evelyn.matos@orcoma.com.br","evillin.reis@orcoma.com.br",
  "felipe.costa@orcoma.com.br","geane.lopes@orcoma.com.br","gilton.novaes@orcoma.com.br","gustavo.pires@orcoma.com.br",
  "helio@orcoma.com.br","heloisa.dutra@orcoma.com.br","isadora.nascimento@orcoma.com.br","ivani.oliveira@orcoma.com.br",
  "jacson@orcoma.com.br","jaqueline.miranda@orcoma.com.br","joao.pedro@orcoma.com.br","jonatas.braga@orcoma.com.br",
  "josiane.souza@orcoma.com.br","joyce.narde@orcoma.com.br","joyce.nascimento@orcoma.com.br","jusirlene.cunha@orcoma.com.br",
  "kaylane.oliveira@orcoma.com.br","lara.anacleto@orcoma.com.br","luana.machado@orcoma.com.br","lucas.duarte@orcoma.com.br",
  "lucas.novaes@orcoma.com.br","macleide@orcoma.com.br","olandson@orcoma.com.br","patrick.leite@orcoma.com.br",
  "pedro.henrique@orcoma.com.br","pedro.vitor@orcoma.com.br","r.claudio@orcoma.com.br","ramon.sapocaia@orcoma.com.br",
  "raydan.santana@orcoma.com.br","ronaldy.souza@orcoma.com.br","rosalia.almeida@orcoma.com.br","rosangela.souza@orcoma.com.br",
  "samuel.rizzuto@orcoma.com.br","sara.nascimento@orcoma.com.br","sara.santos@orcoma.com.br","saulo.assis@orcoma.com.br",
  "silvia.vieira@orcoma.com.br","sirleide@orcoma.com.br","stefani@orcoma.com.br","sucessodocliente@orcoma.com.br",
  "suzane.souza@orcoma.com.br","taina@orcoma.com.br","talita.silva@orcoma.com.br","thaylla.vitoria@orcoma.com.br",
  "thais.carvalho@orcoma.com.br","thays@orcoma.com.br","thiago.jesus@orcoma.com.br","thiala.cabral@orcoma.com.br",
  "vanessa.bastos@orcoma.com.br","vanessa.santos@orcoma.com.br","victor.alves@orcoma.com.br","vitor.teles@orcoma.com.br",
  "vitoria.dias@orcoma.com.br","wesley.vieira@orcoma.com.br","yasmin.pires@orcoma.com.br",
];

const ALL_ROLES = [
  { value: "admin", label: "Administrador" },
  { value: "gestor", label: "Gestor" },
  { value: "lider", label: "Líder" },
  { value: "dev", label: "Desenvolvedor" },
  { value: "member", label: "Membro" },
] as const;

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/20",
  gestor: "bg-primary/10 text-primary border-primary/20",
  lider: "bg-warning/10 text-warning border-warning/20",
  dev: "bg-success/10 text-success border-success/20",
  member: "bg-muted text-muted-foreground border-border",
};

interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string;
  roles: string[];
  created_at: string;
  last_sign_in_at: string | null;
}

async function callAdmin(action: string, body: Record<string, unknown> = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Não autenticado");

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(
    `https://${projectId}.supabase.co/functions/v1/admin-users`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...body }),
    }
  );

  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error || "Erro desconhecido");
  return data;
}

const AdminPanel = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Create user dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("member");
  const [creating, setCreating] = useState(false);

  // Password dialog
  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwdUserId, setPwdUserId] = useState("");
  const [pwdUserEmail, setPwdUserEmail] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [updatingPwd, setUpdatingPwd] = useState(false);

  // Roles dialog
  const [rolesOpen, setRolesOpen] = useState(false);
  const [rolesUserId, setRolesUserId] = useState("");
  const [rolesUserEmail, setRolesUserEmail] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [updatingRoles, setUpdatingRoles] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [deleteUserEmail, setDeleteUserEmail] = useState("");
  const [deleting, setDeleting] = useState(false);

  // Permissions dialog
  const [permsOpen, setPermsOpen] = useState(false);
  const [permsUserId, setPermsUserId] = useState("");
  const [permsUserEmail, setPermsUserEmail] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await callAdmin("list");
      setUsers(data);
      setIsAdmin(true);
    } catch (err: any) {
      if (err.message?.includes("Acesso negado") || err.message?.includes("403")) {
        setIsAdmin(false);
      } else {
        toast.error(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = async () => {
    if (!newEmail || !newPassword) { toast.error("Preencha email e senha"); return; }
    setCreating(true);
    try {
      await callAdmin("create", { email: newEmail, password: newPassword, full_name: newName, role: newRole });
      toast.success("Usuário criado com sucesso!");
      setCreateOpen(false);
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewRole("member");
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPwd || newPwd.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    setUpdatingPwd(true);
    try {
      await callAdmin("update_password", { user_id: pwdUserId, password: newPwd });
      toast.success(`Senha de ${pwdUserEmail} alterada!`);
      setPwdOpen(false); setNewPwd("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingPwd(false);
    }
  };

  const handleUpdateRoles = async () => {
    setUpdatingRoles(true);
    try {
      await callAdmin("update_roles", { user_id: rolesUserId, roles: selectedRoles });
      toast.success(`Papéis de ${rolesUserEmail} atualizados!`);
      setRolesOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUpdatingRoles(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await callAdmin("delete", { user_id: deleteUserId });
      toast.success(`Usuário ${deleteUserEmail} excluído!`);
      setDeleteOpen(false);
      loadUsers();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDeleting(false);
    }
  };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  if (isAdmin === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <EmptyState
          icon={ShieldCheck}
          title="Acesso restrito"
          description="Apenas administradores podem acessar este painel."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <PageHeader
        title="Administração"
        description="Gerenciar usuários, papéis e acessos"
        icon={<ShieldCheck className="h-5 w-5" />}
        actions={
          <Button onClick={() => setCreateOpen(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Novo Usuário
          </Button>
        }
      />

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* User List */}
      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Usuários ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={Users} title="Nenhum usuário encontrado" />
          ) : (
            <div className="space-y-2">
              {filtered.map((u) => {
                const initials = u.full_name
                  ? u.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
                  : u.email?.slice(0, 2).toUpperCase() || "?";
                const isSelf = u.id === user?.id;

                return (
                  <div key={u.id} className="flex items-center gap-3 rounded-xl bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {u.full_name || u.email}
                        </p>
                        {isSelf && <Badge variant="outline" className="text-[9px]">Você</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                      {u.roles.length > 0 ? u.roles.map(r => (
                        <Badge key={r} className={`text-[10px] ${ROLE_COLORS[r] || ROLE_COLORS.member}`}>
                          {ALL_ROLES.find(ar => ar.value === r)?.label || r}
                        </Badge>
                      )) : (
                        <Badge variant="outline" className="text-[10px]">Sem papel</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Permissões"
                        onClick={() => {
                          setPermsUserId(u.id);
                          setPermsUserEmail(u.email);
                          setPermsOpen(true);
                        }}
                      >
                        <Settings2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Gerenciar papéis"
                        onClick={() => {
                          setRolesUserId(u.id);
                          setRolesUserEmail(u.email);
                          setSelectedRoles([...u.roles]);
                          setRolesOpen(true);
                        }}
                      >
                        <Shield className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        title="Alterar senha"
                        onClick={() => {
                          setPwdUserId(u.id);
                          setPwdUserEmail(u.email);
                          setNewPwd("");
                          setPwdOpen(true);
                        }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      {!isSelf && (
                        <Button
                          variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Excluir usuário"
                          onClick={() => {
                            setDeleteUserId(u.id);
                            setDeleteUserEmail(u.email);
                            setDeleteOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE USER DIALOG */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário no sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome completo</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="João Silva" />
            </div>
            <div>
              <Label>Email *</Label>
              <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="joao@empresa.com" />
            </div>
            <div>
              <Label>Senha *</Label>
              <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div>
              <Label>Papel</Label>
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PASSWORD DIALOG */}
      <Dialog open={pwdOpen} onOpenChange={setPwdOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>Definir nova senha para {pwdUserEmail}</DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nova senha</Label>
            <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} placeholder="Mínimo 6 caracteres" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPwdOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdatePassword} disabled={updatingPwd}>
              {updatingPwd && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ROLES DIALOG */}
      <Dialog open={rolesOpen} onOpenChange={setRolesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gerenciar Papéis</DialogTitle>
            <DialogDescription>Definir papéis de {rolesUserEmail}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {ALL_ROLES.map(r => (
              <div key={r.value} className="flex items-center gap-3">
                <Checkbox
                  id={`role-${r.value}`}
                  checked={selectedRoles.includes(r.value)}
                  onCheckedChange={(checked) => {
                    setSelectedRoles(prev =>
                      checked ? [...prev, r.value] : prev.filter(x => x !== r.value)
                    );
                  }}
                />
                <label htmlFor={`role-${r.value}`} className="text-sm cursor-pointer">
                  {r.label}
                </label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRolesOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdateRoles} disabled={updatingRoles}>
              {updatingRoles && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DIALOG */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {deleteUserEmail}? Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* PERMISSIONS DIALOG */}
      <UserPermissionsDialog
        open={permsOpen}
        onOpenChange={setPermsOpen}
        userId={permsUserId}
        userEmail={permsUserEmail}
        allUsers={users.map((u) => ({ id: u.id, email: u.email, full_name: u.full_name }))}
      />
    </div>
  );
};

export default AdminPanel;
