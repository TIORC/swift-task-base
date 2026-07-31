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
  location_id: string | null;
  tracked_individually: boolean;
  unit_price: number;
  min_stock: number;
  ideal_stock: number;
  quantity: number;
  status: "active" | "inactive";
  notes: string | null;
  responsible_id: string | null;

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
  performed_by: string;
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
