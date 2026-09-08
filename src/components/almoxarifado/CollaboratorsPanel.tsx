import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Users, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SECTORS } from "@/types/sectors";
import { useInventoryCollaborators, useSaveCollaborator, type InventoryCollaborator } from "@/hooks/useInventory";

const empty = { full_name: "", department: "", active: true };

export function CollaboratorsPanel({ canWrite }: { canWrite: boolean }) {
  const { data: collaborators = [] } = useInventoryCollaborators();
  const save = useSaveCollaborator();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<InventoryCollaborator | null>(null);
  const [form, setForm] = useState(empty);

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (c: InventoryCollaborator) => {
    setEditing(c);
    setForm({ full_name: c.full_name, department: c.department, active: c.active });
    setOpen(true);
  };

  const submit = async () => {
    await save.mutateAsync({ ...form, id: editing?.id });
    setOpen(false);
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Colaboradores</CardTitle>
        {canWrite && <Button size="sm" onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo colaborador</Button>}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>Setor</TableHead><TableHead>Status</TableHead>
            {canWrite && <TableHead className="text-right">Ações</TableHead>}
          </TableRow></TableHeader>
          <TableBody>
            {collaborators.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.full_name}</TableCell>
                <TableCell>{c.department}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={c.active
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-normal"
                    : "border-border bg-muted text-muted-foreground font-normal"}>
                    {c.active ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                {canWrite && (
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Editar</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {collaborators.length === 0 && (
              <TableRow><TableCell colSpan={canWrite ? 4 : 3} className="text-center text-muted-foreground py-6">
                Nenhum colaborador cadastrado.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar colaborador" : "Novo colaborador"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 py-2">
            <div><Label>Nome completo *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div>
              <Label>Setor *</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <p className="text-sm">{form.active ? "Ativo" : "Inativo"}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={submit} disabled={!form.full_name || !form.department || save.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
