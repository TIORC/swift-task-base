import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, Loader2, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSmSlaConfig } from "@/hooks/useSmDemands";
import { SM_PRIORITY_LABEL } from "@/types/social";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const sb = supabase as any;
const SM_ROLES = [
  { v: "admin", l: "Admin SM" },
  { v: "gestor", l: "Gestor" },
  { v: "social_media", l: "Social Media" },
  { v: "designer", l: "Designer" },
  { v: "redator", l: "Redator" },
  { v: "cliente", l: "Cliente (portal)" },
];

interface Row {
  id: string;
  email: string;
  full_name: string;
  has_social: boolean;
  social_roles: string[];
}

export default function SocialAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [draftRoles, setDraftRoles] = useState<string[]>([]);
  const [draftAccess, setDraftAccess] = useState(false);
  const sla = useSmSlaConfig();

  const load = async () => {
    setLoading(true);
    const [{ data: profiles }, { data: systems }, { data: roles }] = await Promise.all([
      sb.from("profiles").select("id, full_name"),
      sb.from("user_systems").select("user_id, system, enabled").eq("system", "social"),
      sb.from("user_social_roles").select("user_id, role"),
    ]);

    const { data: { session } } = await supabase.auth.getSession();
    // use admin-users edge function to get emails
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    let emails: Record<string, string> = {};
    try {
      const r = await fetch(`https://${projectId}.supabase.co/functions/v1/admin-users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ action: "list" }),
      });
      const d = await r.json();
      if (Array.isArray(d)) d.forEach((u: any) => { emails[u.id] = u.email; });
    } catch {}

    const accessSet = new Set((systems ?? []).filter((s: any) => s.enabled).map((s: any) => s.user_id));
    const rolesByUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      rolesByUser[r.user_id] = [...(rolesByUser[r.user_id] ?? []), r.role];
    });

    setRows((profiles ?? [])
      .map((p: any) => ({
        id: p.id, full_name: p.full_name ?? "", email: emails[p.id] ?? "",
        has_social: accessSet.has(p.id),
        social_roles: rolesByUser[p.id] ?? [],
      }))
      .filter((r) => r.has_social || r.social_roles.length > 0)
      .sort((a, b) => (a.email || a.full_name).localeCompare(b.email || b.full_name)));
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const openEdit = (r: Row) => {
    setEditing(r); setDraftRoles(r.social_roles); setDraftAccess(r.has_social);
  };

  const save = async () => {
    if (!editing) return;
    // toggle access
    if (draftAccess !== editing.has_social) {
      if (draftAccess) {
        await sb.from("user_systems").upsert({ user_id: editing.id, system: "social", enabled: true });
      } else {
        await sb.from("user_systems").update({ enabled: false }).eq("user_id", editing.id).eq("system", "social");
      }
    }
    // sync roles: delete removed, insert new
    const toRemove = editing.social_roles.filter(r => !draftRoles.includes(r));
    const toAdd = draftRoles.filter(r => !editing.social_roles.includes(r));
    for (const r of toRemove) await sb.from("user_social_roles").delete().eq("user_id", editing.id).eq("role", r);
    for (const r of toAdd) await sb.from("user_social_roles").insert({ user_id: editing.id, role: r });
    toast.success("Permissões atualizadas");
    setEditing(null); load();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Administração Social" description="Gerencie acesso ao ambiente e papéis do Social Media" icon={<ShieldCheck className="h-5 w-5"/>}/>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Timer className="h-4 w-4 text-muted-foreground"/>
            <p className="text-sm font-medium">SLA por prioridade (horas)</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["urgent","high","medium","low"] as const).map(p => (
              <div key={p}>
                <Label className="text-xs">{SM_PRIORITY_LABEL[p]}</Label>
                <Input
                  type="number" min={1}
                  defaultValue={sla.config[p]}
                  onBlur={(e) => sla.save(p, Number(e.target.value) || 1).then(() => toast.success("SLA atualizado"))}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin"/></div>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y divide-border">
            {rows.map(r => (
              <div key={r.id} className="flex items-center gap-3 p-3">
                <Avatar className="h-8 w-8"><AvatarFallback className="text-xs">{(r.email || r.full_name || "?").slice(0,2).toUpperCase()}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{r.full_name || r.email || r.id}</p>
                  <p className="text-xs text-muted-foreground truncate">{r.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {r.has_social && <Badge variant="outline" className="bg-success/10 text-success">Acesso SM</Badge>}
                  {r.social_roles.map(role => <Badge key={role} variant="secondary" className="text-[10px]">{SM_ROLES.find(s => s.v === role)?.l ?? role}</Badge>)}
                </div>
                <Button size="sm" variant="outline" onClick={() => openEdit(r)}>Gerenciar</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.email || editing?.full_name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg border border-border">
              <Checkbox checked={draftAccess} onCheckedChange={(v) => setDraftAccess(!!v)} />
              <span className="text-sm">Liberar acesso ao Social Media</span>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Papéis no Social Media</p>
              <div className="space-y-2">
                {SM_ROLES.map(r => (
                  <label key={r.v} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={draftRoles.includes(r.v)}
                      onCheckedChange={(v) => setDraftRoles(v ? [...draftRoles, r.v] : draftRoles.filter(x => x !== r.v))}
                    />
                    {r.l}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
