import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useUserSystems } from "@/hooks/useUserSystems";
import { toast } from "sonner";

export type MovementType =
  | "in" | "out" | "transfer" | "damage" | "discard" | "adjust" | "assign" | "return"
  | "upgrade";

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
  last_upgrade_at: string | null;
  upgrade_count: number;

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

/** Antes/depois gravado na movimentação do tipo "upgrade". */
export interface ItemUpgradeDetails {
  before: Record<string, string | number | null>;
  after: Record<string, string | number | null>;
  changed_fields: string[];
}

export interface InventoryMovement {
  id: string;
  item_id: string;
  asset_id: string | null;
  type: MovementType;
  quantity: number;
  reason: string | null;
  notes: string | null;
  upgrade_details: ItemUpgradeDetails | null;
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

export const INVENTORY_ADMIN_EMAILS = [
  "angel.kauan@orcoma.com.br",
  "gabriel.anacleto@orcoma.com.br",
  "sofia.nardes@orcoma.com.br",
  "timaracas@orcoma.com.br",
  "welder@orcoma.com.br",
];

export function canManageInventory(email: string | null | undefined): boolean {
  return INVENTORY_ADMIN_EMAILS.includes((email ?? "").trim().toLowerCase());
}

export function useCanManageInventory() {
  const { user } = useAuth();
  return canManageInventory(user?.email);
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

// Sem limite de registros: a busca é feita em blocos até a última página, senão
// o db-max-rows do PostgREST (1000) cortaria o histórico mais antigo em silêncio.
const MOVEMENTS_PAGE = 1000;

export function useInventoryMovements() {
  return useQuery({
    queryKey: ["inventory", "movements"],
    queryFn: async () => {
      const rows: InventoryMovement[] = [];
      for (let from = 0; ; from += MOVEMENTS_PAGE) {
        const { data, error } = await supabase
          .from("inventory_movements")
          .select("*")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, from + MOVEMENTS_PAGE - 1);
        if (error) throw error;
        rows.push(...((data ?? []) as unknown as InventoryMovement[]));
        if (!data || data.length < MOVEMENTS_PAGE) break;
      }
      return rows;
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
        subcategory: payload.subcategory || null,
        brand: payload.brand || null,
        model: payload.model || null,
        description: payload.description || null,
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
      const { error } = await (supabase as any).from("inventory_items").update(patch).eq("id", id);
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

export function useDeactivateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reactivate }: { id: string; reactivate?: boolean }) => {
      const { error } = await supabase.from("inventory_items")
        .update({ status: reactivate ? "active" : "inactive" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, v) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success(v.reactivate ? "Item reativado" : "Item desativado");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível desativar"),
  });
}

export function useCreateAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<InventoryAsset>) => {
      const patrimony = payload.patrimony_number?.trim();
      if (!payload.item_id) throw new Error("Selecione um item");
      if (!patrimony) throw new Error("Informe o nº de patrimônio");

      const { data: dupPat, error: dupErr } = await supabase
        .from("inventory_assets")
        .select("id")
        .ilike("patrimony_number", escapeIlike(patrimony))
        .maybeSingle();
      if (dupErr) throw dupErr;
      if (dupPat) throw new Error(`Patrimônio ${patrimony} já cadastrado — edite o registro existente em vez de criar um novo.`);

      const serial = payload.serial_number?.trim() || null;
      if (serial) {
        const { data: dupSer, error: serErr } = await supabase
          .from("inventory_assets")
          .select("patrimony_number")
          .ilike("serial_number", escapeIlike(serial))
          .maybeSingle();
        if (serErr) throw serErr;
        if (dupSer) throw new Error(`Nº de série já cadastrado no patrimônio ${(dupSer as { patrimony_number?: string }).patrimony_number}`);
      }

      const { error } = await supabase.from("inventory_assets").insert({
        item_id: payload.item_id!,
        patrimony_number: patrimony,
        serial_number: serial,
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

export type AssetBatchRow =
  | {
      kind: "update";
      id: string;
      item_id: string;
      patrimony_number: string;
      serial_number: string | null;
      value: number;
      status: AssetStatus;
      location_id: string | null;
      collaborator_id: string | null;
      department: string | null;
      original: {
        item_id: string; patrimony_number: string; serial_number: string | null; value: number;
        status: string; location_id: string | null; collaborator_id: string | null; department: string | null;
      };
    }
  | {
      kind: "new";
      item_id: string;
      patrimony_number: string;
      serial_number: string | null;
      value: number;
      status: AssetStatus;
      location_id: string | null;
      collaborator_id: string | null;
      department: string | null;
    };

/** Salva todas as linhas da planilha de patrimônios numa única transação no banco. */
export function useSaveAssetBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: AssetBatchRow[]) => {
      const { data, error } = await supabase.rpc("save_asset_batch", { _rows: rows as unknown as Json });
      if (error) throw error;
      return data as unknown as EntryBatchResult;
    },
    onSuccess: (res) => {
      if (res.ok) qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar as edições"),
  });
}

export function useDeleteAsset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Patrimônio excluído");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
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

export type MovementPatch = Pick<InventoryMovement, "type" | "quantity"> &
  Partial<Pick<InventoryMovement,
    "reason" | "notes" | "unit_price" | "supplier" | "invoice_number" |
    "from_location_id" | "to_location_id" | "collaborator_id" | "department" |
    "patrimony_number" | "serial_number" | "occurred_at">>;

export function useUpdateMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: MovementPatch & { id: string }) => {
      const { data, error } = await supabase.from("inventory_movements")
        .update({
          type: patch.type,
          quantity: patch.quantity,
          reason: patch.reason || null,
          notes: patch.notes || null,
          unit_price: patch.unit_price ?? 0,
          supplier: patch.supplier || null,
          invoice_number: patch.invoice_number || null,
          from_location_id: patch.from_location_id || null,
          to_location_id: patch.to_location_id || null,
          collaborator_id: patch.collaborator_id || null,
          department: patch.department || null,
          patrimony_number: patch.patrimony_number || null,
          serial_number: patch.serial_number || null,
          occurred_at: patch.occurred_at || new Date().toISOString(),
        })
        .eq("id", id)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Movimentação atualizada");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível atualizar"),
  });
}

export function useDeleteMovement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_movements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Movimentação excluída e estoque estornado");
    },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
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

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; description?: string | null }) => {
      const { error } = await supabase.from("inventory_categories").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Categoria atualizada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Categoria excluída"); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
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

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; name?: string; description?: string | null }) => {
      const { error } = await supabase.from("inventory_locations").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Local atualizado"); },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_locations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Local excluído"); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
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

export function useDeleteDepartment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Setor excluído"); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
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

export function useDeleteRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Solicitação excluída"); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
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

export function useDeleteCollaborator() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inventory_collaborators").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Colaborador excluído"); },
    onError: (e: any) => toast.error(e.message ?? "Não foi possível excluir"),
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
  /** Hora da chegada no formato HH:MM. Sem valor, usa 12:00. */
  entry_time?: string | null;
  notes?: string | null;
}

export interface EntryResult {
  itemId: string;
  /** "created" = patrimônio novo cadastrado · "updated" = patrimônio existente atualizado · "none" = sem patrimônio */
  assetAction: "created" | "updated" | "none";
  /** Nome do item ao qual o patrimônio atualizado já estava vinculado (quando diferente do item da entrada) */
  assetItemName?: string | null;
}

/** Escapa curingas (%, _) do LIKE/ILIKE para busca exata case-insensitive */
const escapeIlike = (v: string) => v.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

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

      let assetAction: EntryResult["assetAction"] = "none";
      let assetItemName: string | null = null;

      const patrimony = p.patrimony_number?.trim() || null;
      const serial = p.serial_number?.trim() || null;

      if (p.has_patrimony && patrimony) {
        const { data: existing, error: findErr } = await supabase
          .from("inventory_assets")
          .select("id, item_id, patrimony_number")
          .ilike("patrimony_number", escapeIlike(patrimony))
          .maybeSingle();
        if (findErr) throw findErr;

        if (serial) {
          const { data: serialOwner, error: serialErr } = await supabase
            .from("inventory_assets")
            .select("id, patrimony_number")
            .ilike("serial_number", escapeIlike(serial))
            .maybeSingle();
          if (serialErr) throw serialErr;
          if (serialOwner && serialOwner.id !== existing?.id) {
            throw new Error(`Nº de série já cadastrado no patrimônio ${serialOwner.patrimony_number}`);
          }
        }

        if (existing) {
          const { error: updErr } = await supabase.from("inventory_assets").update({
            serial_number: serial,
            value: p.unit_price,
            location_id: p.location_id || null,
            supplier: p.supplier || null,
            invoice_number: p.invoice_number || null,
            acquired_at: p.entry_date || null,
          }).eq("id", existing.id);
          if (updErr) throw updErr;
          assetAction = "updated";
          if (existing.item_id !== itemId) {
            const { data: linkedItem } = await supabase
              .from("inventory_items").select("name").eq("id", existing.item_id).maybeSingle();
            assetItemName = (linkedItem as { name?: string } | null)?.name ?? null;
          }
        } else {
          const { error } = await supabase.from("inventory_assets").insert({
            item_id: itemId,
            patrimony_number: patrimony,
            serial_number: serial,
            value: p.unit_price,
            status: "available",
            location_id: p.location_id || null,
            supplier: p.supplier || null,
            invoice_number: p.invoice_number || null,
            acquired_at: p.entry_date || null,
          });
          if (error) throw error;
          assetAction = "created";
        }
      }

      const { error: movErr } = await (supabase as any).from("inventory_movements").insert({
        item_id: itemId,
        type: "in",
        quantity: p.quantity,
        unit_price: p.unit_price,
        supplier: p.supplier || null,
        invoice_number: p.invoice_number || null,
        patrimony_number: p.has_patrimony ? patrimony : null,
        serial_number: serial,
        to_location_id: p.location_id || null,
        occurred_at: p.entry_date ? new Date(`${p.entry_date}T${p.entry_time || "12:00"}:00`).toISOString() : new Date().toISOString(),
        reason: "Entrada de estoque",
        notes: p.notes || null,
        status_from: null,
        status_to: "available",
        performed_by: user.id,
      });
      if (movErr) throw movErr;
      return { itemId, assetAction, assetItemName } satisfies EntryResult;
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      if (res.assetAction === "updated") {
        toast.success("Entrada registrada · patrimônio atualizado");
        if (res.assetItemName) {
          toast.info(`Patrimônio já estava vinculado ao item "${res.assetItemName}" — vínculo mantido.`);
        }
      } else if (res.assetAction === "created") {
        toast.success("Entrada registrada · patrimônio cadastrado");
      } else {
        toast.success("Entrada registrada");
      }
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar entrada"),
  });
}

export type EntryBatchRow =
  | {
      kind: "update";
      id: string;
      name: string;
      quantity: number;
      unit_price: number;
      occurred_at: string;
      notes: string | null;
      brand: string | null;
      model: string | null;
      patrimony_number: string | null;
      purchased: boolean;
      original: {
        name: string; quantity: number; unit_price: number; occurred_at: string; notes: string | null;
        brand: string | null; model: string | null; patrimony_number: string | null;
      };
    }
  | {
      kind: "new";
      name: string;
      brand: string | null;
      model: string | null;
      patrimony_number: string | null;
      serial_number: string | null;
      quantity: number;
      unit_price: number;
      entry_date: string;
      occurred_at: string;
      notes: string | null;
      purchased: true;
    };

export interface EntryBatchResult {
  ok: boolean;
  count?: number;
  conflicts?: { id: string; reason: "alterada" | "removida" }[];
}

/** Salva todas as linhas da planilha de entradas numa única transação no banco. */
export function useSaveEntryBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: EntryBatchRow[]) => {
      const { data, error } = await supabase.rpc("save_entry_batch", { _rows: rows as unknown as Json });
      if (error) throw error;
      return data as unknown as EntryBatchResult;
    },
    onSuccess: (res) => {
      if (res.ok) qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar as edições"),
  });
}

/* ------------------------------------------------------------------ */
/* Fluxo de saída                                                      */
/* ------------------------------------------------------------------ */

export type ExitBatchRow =
  | {
      kind: "update";
      id: string;
      name: string;
      quantity: number;
      occurred_at: string;
      collaborator_id: string;
      department: string | null;
      reason: string | null;
      patrimony_number: string | null;
      notes: string | null;
      original: {
        name: string; quantity: number; occurred_at: string; collaborator_id: string | null;
        department: string | null; reason: string | null; patrimony_number: string | null; notes: string | null;
      };
    }
  | {
      kind: "new";
      item_id: string;
      quantity: number;
      occurred_at: string;
      collaborator_id: string;
      department: string | null;
      reason: string | null;
      patrimony_number: string | null;
      notes: string | null;
    };

/** Salva todas as linhas da planilha de saídas numa única transação no banco. */
export function useSaveExitBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: ExitBatchRow[]) => {
      const { data, error } = await supabase.rpc("save_exit_batch", { _rows: rows as unknown as Json });
      if (error) throw error;
      return data as unknown as EntryBatchResult;
    },
    onSuccess: (res) => {
      if (res.ok) qc.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar as edições"),
  });
}

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
          .limit(Math.max(1, Math.trunc(Number(p.quantity) || 1)));
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

/* ------------------------------------------------------------------ */
/* Atualização (upgrade) do item                                       */
/* ------------------------------------------------------------------ */

export const UPGRADE_FIELDS = ["name", "brand", "model", "description", "unit_price"] as const;
export type UpgradeField = (typeof UPGRADE_FIELDS)[number];

export const UPGRADE_FIELD_LABELS: Record<UpgradeField, string> = {
  name: "Nome do item",
  brand: "Marca",
  model: "Modelo",
  description: "Descrição",
  unit_price: "Valor unitário",
};

export interface ItemUpgradePayload {
  item_id: string;
  quantity?: number;
  reason: string;
  date: string;
  notes?: string | null;
  asset_id?: string | null;
  location_id?: string | null;
  changes?: Partial<Record<UpgradeField, string | number | null>>;
}

/**
 * Registra a atualização do item e grava o antes/depois na movimentação.
 *
 * A movimentação entra antes do update: o trigger public.apply_inventory_movement()
 * não tem ramo para 'upgrade', então ela não mexe em estoque. Se o update do item
 * falhar, sobra o registro de histórico — o inverso deixaria o item alterado
 * sem nenhum rastro.
 */
export function useRegisterItemUpgrade() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (p: ItemUpgradePayload) => {
      if (!user) throw new Error("Não autenticado");

      const { data: current, error: readErr } = await (supabase as any)
        .from("inventory_items")
        .select("brand, model, description, unit_price, location_id, upgrade_count")
        .eq("id", p.item_id)
        .maybeSingle();
      if (readErr) throw readErr;
      if (!current) throw new Error("Item não encontrado");

      const before: Record<string, string | number | null> = {};
      const after: Record<string, string | number | null> = {};
      const patch: Record<string, string | number | null> = {};

      for (const field of UPGRADE_FIELDS) {
        const incoming = p.changes?.[field];
        if (incoming === undefined) continue;
        const from = (current[field] ?? "") as string | number;
        if (incoming === from || (incoming === "" && from === "")) continue;
        before[field] = from === "" ? null : from;
        after[field] = incoming === "" ? null : incoming;
        patch[field] = incoming;
      }

      if (p.location_id && p.location_id !== current.location_id) {
        before.location_id = current.location_id;
        after.location_id = p.location_id;
        patch.location_id = p.location_id;
      }

      const changed = Object.keys(after);
      const now = new Date().toISOString();

      const { error: movErr } = await (supabase as any).from("inventory_movements").insert({
        item_id: p.item_id,
        asset_id: p.asset_id || null,
        type: "upgrade",
        quantity: Math.max(1, p.quantity ?? 1),
        reason: p.reason,
        notes: p.notes || null,
        to_location_id: p.location_id || null,
        occurred_at: p.date ? new Date(`${p.date}T12:00:00`).toISOString() : now,
        upgrade_details: { before, after, changed_fields: changed },
        performed_by: user.id,
      });
      if (movErr) throw movErr;

      const { error } = await (supabase as any)
        .from("inventory_items")
        .update({ ...patch, last_upgrade_at: now, upgrade_count: (current.upgrade_count ?? 0) + 1 })
        .eq("id", p.item_id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast.success("Atualização registrada"); },
    onError: (e: any) => toast.error(e.message ?? "Erro ao registrar atualização"),
  });
}
