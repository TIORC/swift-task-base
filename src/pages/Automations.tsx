import { useState } from "react";
import {
  useAutomationRules,
  useCreateAutomationRule,
  useToggleAutomationRule,
  useDeleteAutomationRule,
  TRIGGER_FIELDS,
  ACTION_TYPES,
} from "@/hooks/useAutomationRules";
import { useProfiles, COLUMNS } from "@/hooks/useTasks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2, Zap, Loader2, ArrowRight } from "lucide-react";

const PRIORITY_OPTIONS = [
  { value: "low", label: "Baixa" },
  { value: "medium", label: "Média" },
  { value: "high", label: "Alta" },
  { value: "urgent", label: "Urgente" },
];

const Automations = () => {
  const { data: rules, isLoading } = useAutomationRules();
  const { data: profiles } = useProfiles();
  const createRule = useCreateAutomationRule();
  const toggleRule = useToggleAutomationRule();
  const deleteRule = useDeleteAutomationRule();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerField, setTriggerField] = useState<string>("status");
  const [triggerValue, setTriggerValue] = useState("");
  const [actionType, setActionType] = useState<string>("change_status");
  const [actionValue, setActionValue] = useState("");

  const resetForm = () => {
    setName("");
    setTriggerField("status");
    setTriggerValue("");
    setActionType("change_status");
    setActionValue("");
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createRule.mutate(
      {
        name,
        trigger_field: triggerField as any,
        trigger_value: triggerValue,
        action_type: actionType as any,
        action_value: actionValue || null,
        enabled: true,
      },
      {
        onSuccess: () => {
          setDialogOpen(false);
          resetForm();
        },
      }
    );
  };

  const getTriggerLabel = (field: string, value: string) => {
    const fieldLabel = TRIGGER_FIELDS.find((f) => f.value === field)?.label || field;
    if (field === "status") {
      const statusLabel = COLUMNS.find((c) => c.status === value)?.title || value;
      return `${fieldLabel} "${statusLabel}"`;
    }
    if (field === "priority") {
      const prioLabel = PRIORITY_OPTIONS.find((p) => p.value === value)?.label || value;
      return `${fieldLabel} "${prioLabel}"`;
    }
    if (field === "assigned_to") {
      const profileName = profiles?.find((p) => p.id === value)?.full_name || value;
      return `${fieldLabel} "${profileName}"`;
    }
    return `${fieldLabel} "${value}"`;
  };

  const getActionLabel = (type: string, value: string | null) => {
    const typeLabel = ACTION_TYPES.find((a) => a.value === type)?.label || type;
    if (!value) return typeLabel;
    if (type === "change_status") {
      const statusLabel = COLUMNS.find((c) => c.status === value)?.title || value;
      return `${typeLabel} "${statusLabel}"`;
    }
    if (type === "assign_to") {
      const profileName = profiles?.find((p) => p.id === value)?.full_name || value;
      return `${typeLabel} "${profileName}"`;
    }
    return `${typeLabel} "${value}"`;
  };

  const needsActionValue = actionType === "change_status" || actionType === "assign_to";

  const renderTriggerValueSelect = () => {
    if (triggerField === "status") {
      return (
        <Select value={triggerValue} onValueChange={setTriggerValue}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {COLUMNS.map((c) => (
              <SelectItem key={c.status} value={c.status}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (triggerField === "priority") {
      return (
        <Select value={triggerValue} onValueChange={setTriggerValue}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {PRIORITY_OPTIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (triggerField === "assigned_to") {
      return (
        <Select value={triggerValue} onValueChange={setTriggerValue}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {profiles?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return <Input value={triggerValue} onChange={(e) => setTriggerValue(e.target.value)} className="bg-secondary border-border" />;
  };

  const renderActionValueSelect = () => {
    if (actionType === "change_status") {
      return (
        <Select value={actionValue} onValueChange={setActionValue}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {COLUMNS.map((c) => (
              <SelectItem key={c.status} value={c.status}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (actionType === "assign_to") {
      return (
        <Select value={actionValue} onValueChange={setActionValue}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue placeholder="Selecionar..." /></SelectTrigger>
          <SelectContent>
            {profiles?.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.full_name || "Sem nome"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">Configure regras IF → THEN para automatizar ações.</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Regra
        </Button>
      </div>

      {!rules || rules.length === 0 ? (
        <Card className="border-border">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">Nenhuma automação criada.</p>
            <p className="text-sm text-muted-foreground/70 mt-1">Crie regras para automatizar ações nas tarefas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <Card key={rule.id} className={`border-border transition-opacity ${!rule.enabled ? "opacity-50" : ""}`}>
              <CardContent className="flex items-center gap-4 py-4">
                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(enabled) => toggleRule.mutate({ id: rule.id, enabled })}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{rule.name}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
                    <Badge variant="secondary" className="text-[10px]">
                      SE {getTriggerLabel(rule.trigger_field, rule.trigger_value)}
                    </Badge>
                    <ArrowRight className="h-3 w-3 text-primary shrink-0" />
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary">
                      ENTÃO {getActionLabel(rule.action_type, rule.action_value)}
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => deleteRule.mutate(rule.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Rule Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Nova Regra de Automação
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da regra</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Enviar para aprovação ao concluir"
                required
                className="bg-secondary border-border"
              />
            </div>

            <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">SE (Trigger)</p>
              <div className="space-y-2">
                <Label className="text-xs">Campo</Label>
                <Select value={triggerField} onValueChange={(v) => { setTriggerField(v); setTriggerValue(""); }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIGGER_FIELDS.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Valor</Label>
                {renderTriggerValueSelect()}
              </div>
            </div>

            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-3">
              <p className="text-xs font-semibold text-primary uppercase tracking-wider">ENTÃO (Ação)</p>
              <div className="space-y-2">
                <Label className="text-xs">Ação</Label>
                <Select value={actionType} onValueChange={(v) => { setActionType(v); setActionValue(""); }}>
                  <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTION_TYPES.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {needsActionValue && (
                <div className="space-y-2">
                  <Label className="text-xs">Valor</Label>
                  {renderActionValueSelect()}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createRule.isPending || !triggerValue}>
                {createRule.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Criar Regra
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Automations;
