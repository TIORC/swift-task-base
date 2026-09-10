import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserSystems } from "@/hooks/useUserSystems";
import { toast } from "sonner";

export type MovementType =
  | "in" | "out" | "transfer" | "damage" | "discard" | "adjust" | "assign" | "return";

export type AssetStatus = "available" | "in_use" | "damaged" | "discarded" | "maintenance";

export interface InventoryCategory { id: string; name: string; description: string | null; }
export interface InventoryLocation { id: string; name: string; description: string | null; }

export interface InventoryItem {
  id: string;
  name: string;
  sku: string | null;
  category_id: string | null;
  subcategory: string | null;
  brand: string | null;
  model: string | null;
  description: string | null;
  location_id: string | null;
  tracked_individually: boolean;
  unit_price: number;
  min_stock: number;
  ideal_stock: number;
  quantity: number;
  in_use_quantity: number;
  damaged_quantity: number;
  discarded_quantity: number;
  status: "active" | "inactive";
  notes: string | null;
  responsible_id: string | null;
  responsible_collaborator_id: string | null;

  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryAsset {
  id: string;
  item_id: string;
  patrimony_number: string;
  serial_number: string | null;
  value: number;
  status: AssetStatus;
  location_id: string | null;
  assigned_to: string | null;
  collaborator_id: string | null;
  department: string | null;
  supplier: string | null;
  invoice_number: string | null;
  acquired_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  asset_id: string | null;
  type: MovementType;
  quantity: number;
  reason: string | null;
  notes: string | null;
  from_location_id: string | null;
  to_location_id: string | null;
  assigned_to: string | null;
  collaborator_id: string | null;
  department: string | null;
  supplier: string | null;
  invoice_number: string | null;
  unit_price: number;
  patrimony_number: string | null;
  serial_number: string | null;
  occurred_at: string;
  status_from: string | null;
  status_to: string | null;
  performed_by: string;
  created_at: string;
}

export interface InventoryCollaborator {
  id: string;
  full_name: string;
  department: string;
  job_title: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  created_at: string;
}

export interface InventoryRequest {
  id: string;
  requester_id: string;
  item_id: string;
  quantity: number;
  justification: string | null;
  status: "pending" | "approved" | "rejected" | "delivered" | "cancelled";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}


export function useCanWriteInventory() {
  const { profile } = useUserRole();
  const { systems } = useUserSystems();
  return profile === "admin" || profile === "gestor" || profile === "lider" || systems.includes("ti");
}

export function useInventoryCategories() {
  return useQuery({
    queryKey: ["inventory", "categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_categories").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as InventoryCategory[];
    },
  });
}

export function useInventoryLocations() {
  return useQuery({
    queryKey: ["inventory", "locations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_locations").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as InventoryLocation[];
    },
  });
}

export function useInventoryItems() {
  return useQuery({
    queryKey: ["inventory", "items"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_items").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as InventoryItem[];
    },
  });
}

export function useInventoryAssets() {
  return useQuery({
    queryKey: ["inventory", "assets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_assets").select("*").order("patrimony_number");
      if (error) throw error;
      return (data ?? []) as InventoryAsset[];
    },
  });
}

export function useInventoryMovements(limit = 500) {
  return useQuery({
    queryKey: ["inventory", "movements", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as InventoryMovement[];
    },
  });
}

export function useInventoryRequests() {
  return useQuery({
    queryKey: ["inventory", "requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as InventoryRequest[];
    },
  });
}

export function useCreateItem() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<InventoryItem>) => {
      const { error } = await supabase.from("inventory_items").insert({
        name: payload.name!,
        sku: payload.sku || null,
        category_id: payload.category_id || null,
        location_id: payload.location_id || null,
        tracked_individually: !!payload.tracked_individually,
        unit_price: payload.unit_price ?? 0,
        min_stock: payload.min_stock ?? 0,
        ideal_stock: payload.ideal_stock ?? 0,
        quantity: payload.quantity ?? 0,
        status: payload.status ?? "active",
        notes: payload.notes || null,
        responsible_id: payload.responsible_id || null,
        created_by: user?.id ?? null,

      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item cadastrado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao cadastrar"),
  });
}

export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<InventoryItem> & { id: string }) => {
      const { error } = await supabase.from("inventory_items").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item atualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao atualizar"),
  });
}

export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Item excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<InventoryAsset>) => {
      const { error } = await supabase.from("inventory_assets").insert({
        item_id: payload.item_id!,
        patrimony_number: payload.patrimony_number!,
        serial_number: payload.serial_number || null,
        value: payload.value ?? 0,
        status: payload.status ?? "available",
        location_id: payload.location_id || null,
        assigned_to: payload.assigned_to || null,
        acquired_at: payload.acquired_at || null,
        notes: payload.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Patrimônio cadastrado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

export function useUpdateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<InventoryAsset> & { id: string }) => {
      const { error } = await supabase.from("inventory_assets").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Patrimônio atualizado");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

export function useCreateMovement() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<InventoryMovement>) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("inventory_movements").insert({
        item_id: payload.item_id!,
        asset_id: payload.asset_id || null,
        type: payload.type!,
        quantity: payload.quantity ?? 1,
        reason: payload.reason || null,
        notes: payload.notes || null,
        from_location_id: payload.from_location_id || null,
        to_location_id: payload.to_location_id || null,
        assigned_to: payload.assigned_to || null,
        performed_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Movimentação registrada");
    },
    onError: (e: any) => toast.error(e.message ?? "Erro na movimentação"),
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { error } = await supabase.from("inventory_categories").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Categoria criada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; description?: string }) => {
      const { error } = await supabase.from("inventory_locations").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Local criado"); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

export interface InventoryDepartment {
  id: string;
  name: string;
  active: boolean;
}

export function useInventoryDepartments() {
  return useQuery({
    queryKey: ["inventory", "departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("inventory_departments").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as InventoryDepartment[];
    },
  });
}

export function useSaveDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; name: string; active?: boolean }) => {
      const body = { name: payload.name.trim(), active: payload.active ?? true };
      if (payload.id) {
        const { error } = await supabase.from("inventory_departments").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_departments").insert(body);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Setor salvo"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar setor"),
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: { item_id: string; quantity: number; justification?: string }) => {
      if (!user) throw new Error("Não autenticado");
      const { error } = await supabase.from("inventory_requests").insert({
        requester_id: user.id,
        item_id: payload.item_id,
        quantity: payload.quantity,
        justification: payload.justification || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Solicitação enviada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

export function useUpdateRequest() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, status, review_notes }: { id: string; status: InventoryRequest["status"]; review_notes?: string }) => {
      const { error } = await supabase.from("inventory_requests").update({
        status,
        review_notes: review_notes || null,
        reviewed_by: user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Solicitação atualizada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

/* ------------------------------------------------------------------ */
/* Colaboradores                                                       */
/* ------------------------------------------------------------------ */

export function useInventoryCollaborators() {
  return useQuery({
    queryKey: ["inventory", "collaborators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_collaborators").select("*").order("full_name");
      if (error) throw error;
      return (data ?? []) as InventoryCollaborator[];
    },
  });
}

export function useSaveCollaborator() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (payload: Partial<InventoryCollaborator> & { id?: string }) => {
      const body = {
        full_name: payload.full_name!,
        department: payload.department!,
        job_title: payload.job_title || null,
        email: payload.email || null,
        phone: payload.phone || null,
        active: payload.active ?? true,
      };
      if (payload.id) {
        const { error } = await supabase.from("inventory_collaborators").update(body).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inventory_collaborators")
          .insert({ ...body, created_by: user?.id ?? null });
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Colaborador salvo"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar colaborador"),
  });
}

/* ------------------------------------------------------------------ */
/* Configurações                                                       */
/* ------------------------------------------------------------------ */

export function useInventorySettings() {
  return useQuery({
    queryKey: ["inventory", "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_settings").select("*").maybeSingle();
      if (error) throw error;
      return (data ?? { id: true, include_damaged_in_value: true }) as { id: boolean; include_damaged_in_value: boolean };
    },
  });
}

export function useUpdateInventorySettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { include_damaged_in_value: boolean }) => {
      const { error } = await supabase.from("inventory_settings")
        .upsert({ id: true, ...patch, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Configuração salva"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar configuração"),
  });
}

/* ------------------------------------------------------------------ */
/* Fluxo de entrada                                                    */
/* ------------------------------------------------------------------ */

export interface EntryPayload {
  mode: "new" | "existing";
  item_id?: string;
  name?: string;
  category_id?: string | null;
  subcategory?: string | null;
  brand?: string | null;
  model?: string | null;
  description?: string | null;
  location_id?: string | null;
  quantity: number;
  unit_price: number;
  min_stock?: number | null;
  has_patrimony: boolean;
  patrimony_number?: string | null;
  serial_number?: string | null;
  supplier?: string | null;
  invoice_number?: string | null;
  entry_date: string;
  notes?: string | null;
}

export function useCreateEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: EntryPayload) => {
      if (!user) throw new Error("Não autenticado");
      const minStock = p.min_stock && p.min_stock > 0 ? p.min_stock : 2;
      let itemId = p.item_id ?? "";

      if (p.mode === "new") {
        const { data, error } = await supabase.from("inventory_items").insert({
          name: p.name!,
          category_id: p.category_id || null,
          subcategory: p.subcategory || null,
          brand: p.brand || null,
          model: p.model || null,
          description: p.description || null,
          location_id: p.location_id || null,
          tracked_individually: false,
          unit_price: p.unit_price,
          min_stock: minStock,
          ideal_stock: 0,
          quantity: 0,
          status: "active",
          notes: p.notes || null,
          created_by: user.id,
        }).select("id").single();
        if (error) throw error;
        itemId = data.id;
      } else {
        if (!itemId) throw new Error("Selecione um item");
        const { error } = await supabase.from("inventory_items")
          .update({ unit_price: p.unit_price, min_stock: minStock })
          .eq("id", itemId);
        if (error) throw error;
      }

      if (p.has_patrimony && p.patrimony_number) {
        const { error } = await supabase.from("inventory_assets").insert({
          item_id: itemId,
          patrimony_number: p.patrimony_number,
          serial_number: p.serial_number || null,
          value: p.unit_price,
          status: "available",
          location_id: p.location_id || null,
          supplier: p.supplier || null,
          invoice_number: p.invoice_number || null,
          acquired_at: p.entry_date || null,
        });
        if (error) throw error;
      }

      const { error: movErr } = await supabase.from("inventory_movements").insert({
        item_id: itemId,
        type: "in",
        quantity: p.quantity,
        unit_price: p.unit_price,
        supplier: p.supplier || null,
        invoice_number: p.invoice_number || null,
        patrimony_number: p.has_patrimony ? (p.patrimony_number || null) : null,
        serial_number: p.serial_number || null,
        to_location_id: p.location_id || null,
        occurred_at: p.entry_date ? new Date(`${p.entry_date}T12:00:00`).toISOString() : new Date().toISOString(),
        reason: "Entrada de estoque",
        notes: p.notes || null,
        status_from: null,
        status_to: "available",
        performed_by: user.id,
      });
      if (movErr) throw movErr;
      return itemId;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Entrada registrada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar entrada"),
  });
}

/* ------------------------------------------------------------------ */
/* Fluxo de saída                                                      */
/* ------------------------------------------------------------------ */

export interface ExitPayload {
  item_id: string;
  quantity: number;
  collaborator_id: string;
  department: string;
  location_id?: string | null;
  patrimony_number?: string | null;
  serial_number?: string | null;
  reason?: string | null;
  exit_date: string;
  notes?: string | null;
  unit_price: number;
}

export function useRegisterExit() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: ExitPayload) => {
      if (!user) throw new Error("Não autenticado");
      if (!p.collaborator_id) throw new Error("Selecione o responsável pelo item");

      if (!p.patrimony_number) {
        // Sem patrimônio informado: vincula automaticamente os patrimônios disponíveis do item
        const { data: freeAssets } = await supabase
          .from("inventory_assets")
          .select("id")
          .eq("item_id", p.item_id)
          .eq("status", "available")
          .order("created_at", { ascending: true })
          .limit(Math.max(1, p.quantity));
        if (freeAssets && freeAssets.length > 0) {
          const { error: assignErr } = await supabase.from("inventory_assets").update({
            status: "in_use",
            collaborator_id: p.collaborator_id,
            department: p.department || null,
            location_id: p.location_id || null,
          }).in("id", freeAssets.map((a) => a.id));
          if (assignErr) throw assignErr;
        }
      }

      if (p.patrimony_number) {
        const { data: existing, error: findErr } = await supabase
          .from("inventory_assets").select("id").eq("patrimony_number", p.patrimony_number).maybeSingle();
        if (findErr) throw findErr;
        if (existing) {
          const { data: updated, error } = await supabase.from("inventory_assets").update({
            status: "in_use",
            collaborator_id: p.collaborator_id,
            department: p.department || null,
            location_id: p.location_id || null,
            serial_number: p.serial_number || null,
          }).eq("id", existing.id).select("id");
          if (error) throw error;
          if (!updated || updated.length === 0) throw new Error("Sem permissão para atualizar o patrimônio");
        } else {
          const { data: created, error } = await supabase.from("inventory_assets").insert({
            item_id: p.item_id,
            patrimony_number: p.patrimony_number,
            serial_number: p.serial_number || null,
            value: p.unit_price,
            status: "in_use",
            collaborator_id: p.collaborator_id,
            department: p.department || null,
            location_id: p.location_id || null,
          }).select("id");
          if (error) throw error;
          if (!created || created.length === 0) throw new Error("Sem permissão para cadastrar o patrimônio");
        }
      }


      const { error } = await supabase.from("inventory_movements").insert({
        item_id: p.item_id,
        type: "out",
        quantity: p.quantity,
        unit_price: p.unit_price,
        collaborator_id: p.collaborator_id,
        department: p.department || null,
        to_location_id: p.location_id || null,
        patrimony_number: p.patrimony_number || null,
        serial_number: p.serial_number || null,
        reason: p.reason || "Saída para responsável",
        notes: p.notes || null,
        occurred_at: p.exit_date ? new Date(`${p.exit_date}T12:00:00`).toISOString() : new Date().toISOString(),
        status_from: "available",
        status_to: "in_use",
        performed_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Saída registrada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar saída"),
  });
}

/* ------------------------------------------------------------------ */
/* Dano / descarte / recuperação                                       */
/* ------------------------------------------------------------------ */

export interface StatusChangePayload {
  item_id: string;
  quantity: number;
  patrimony_number?: string | null;
  reason?: string | null;
  date: string;
  notes?: string | null;
  collaborator_id?: string | null;
  from_damaged?: boolean;
}

function useStatusChange(type: "damage" | "discard", statusTo: string, okMsg: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: StatusChangePayload) => {
      if (!user) throw new Error("Não autenticado");

      if (p.patrimony_number) {
        const { data: asset } = await supabase
          .from("inventory_assets").select("id").eq("patrimony_number", p.patrimony_number).maybeSingle();
        if (asset) {
          const { error } = await supabase.from("inventory_assets")
            .update({ status: statusTo }).eq("id", asset.id);
          if (error) throw error;
        }
      }

      const { error } = await supabase.from("inventory_movements").insert({
        item_id: p.item_id,
        type,
        quantity: p.quantity,
        collaborator_id: p.collaborator_id || null,
        patrimony_number: p.patrimony_number || null,
        reason: p.reason || null,
        notes: p.notes || null,
        occurred_at: p.date ? new Date(`${p.date}T12:00:00`).toISOString() : new Date().toISOString(),
        status_from: p.from_damaged ? "damaged" : "available",
        status_to: statusTo,
        performed_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success(okMsg); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar"),
  });
}

export const useMarkDamaged = () => useStatusChange("damage", "damaged", "Item marcado como danificado");
export const useDiscardItem = () => useStatusChange("discard", "discarded", "Descarte registrado");

export function useRecoverDamaged() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: { item: InventoryItem; quantity: number; patrimony_number?: string | null }) => {
      if (!user) throw new Error("Não autenticado");
      const qty = Math.min(p.quantity, p.item.damaged_quantity);
      if (p.patrimony_number) {
        const { data: asset } = await supabase
          .from("inventory_assets").select("id").eq("patrimony_number", p.patrimony_number).maybeSingle();
        if (asset) await supabase.from("inventory_assets").update({ status: "available" }).eq("id", asset.id);
      }
      const { error } = await supabase.from("inventory_items").update({
        quantity: p.item.quantity + qty,
        damaged_quantity: Math.max(0, p.item.damaged_quantity - qty),
      }).eq("id", p.item.id);
      if (error) throw error;

      await supabase.from("inventory_movements").insert({
        item_id: p.item.id, type: "adjust", quantity: 0,
        reason: `Recuperação de ${qty} unidade(s)`,
        status_from: "damaged", status_to: "available",
        patrimony_number: p.patrimony_number || null,
        performed_by: user.id,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Item recuperado"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao recuperar"),
  });
}
