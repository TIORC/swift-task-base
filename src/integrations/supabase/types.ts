export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      approvals: {
        Row: {
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          level: string
          status: string
          task_id: string
        }
        Insert: {
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          level: string
          status?: string
          task_id: string
        }
        Update: {
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          level?: string
          status?: string
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_blockers: {
        Row: {
          automation_id: string
          blocker_type: string
          created_at: string
          created_by: string
          description: string | null
          id: string
          impact_on_deadline: string | null
          pending_since: string | null
          resolved_at: string | null
          responsible_id: string | null
        }
        Insert: {
          automation_id: string
          blocker_type: string
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          impact_on_deadline?: string | null
          pending_since?: string | null
          resolved_at?: string | null
          responsible_id?: string | null
        }
        Update: {
          automation_id?: string
          blocker_type?: string
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          impact_on_deadline?: string | null
          pending_since?: string | null
          resolved_at?: string | null
          responsible_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "automation_blockers_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_comments: {
        Row: {
          automation_id: string
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          user_id: string
        }
        Insert: {
          automation_id: string
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          user_id: string
        }
        Update: {
          automation_id?: string
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          user_id?: string
        }
        Relationships: []
      }
      automation_dependencies: {
        Row: {
          automation_id: string
          created_at: string
          created_by: string
          depends_on_automation_id: string
          id: string
          line_color: string | null
          relation_type: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          created_by: string
          depends_on_automation_id: string
          id?: string
          line_color?: string | null
          relation_type?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          created_by?: string
          depends_on_automation_id?: string
          id?: string
          line_color?: string | null
          relation_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_dependencies_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_dependencies_depends_on_automation_id_fkey"
            columns: ["depends_on_automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          automation_id: string
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_rules: {
        Row: {
          action_type: string
          action_value: string | null
          created_at: string
          created_by: string
          enabled: boolean
          id: string
          name: string
          trigger_field: string
          trigger_value: string
        }
        Insert: {
          action_type: string
          action_value?: string | null
          created_at?: string
          created_by: string
          enabled?: boolean
          id?: string
          name: string
          trigger_field: string
          trigger_value: string
        }
        Update: {
          action_type?: string
          action_value?: string | null
          created_at?: string
          created_by?: string
          enabled?: boolean
          id?: string
          name?: string
          trigger_field?: string
          trigger_value?: string
        }
        Relationships: []
      }
      automation_subtasks: {
        Row: {
          assigned_to: string | null
          automation_id: string
          completed: boolean | null
          created_at: string
          deadline: string | null
          id: string
          notes: string | null
          sort_order: number | null
          title: string
        }
        Insert: {
          assigned_to?: string | null
          automation_id: string
          completed?: boolean | null
          created_at?: string
          deadline?: string | null
          id?: string
          notes?: string | null
          sort_order?: number | null
          title: string
        }
        Update: {
          assigned_to?: string | null
          automation_id?: string
          completed?: boolean | null
          created_at?: string
          deadline?: string | null
          id?: string
          notes?: string | null
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_subtasks_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_time_logs: {
        Row: {
          automation_id: string
          created_at: string
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          started_at: string
          user_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_time_logs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          assigned_to: string | null
          automation_type: string | null
          completed_at: string | null
          complexity: string | null
          created_at: string
          created_by: string
          deploy_status: string | null
          deployed_at: string | null
          description: string | null
          documentation_done: boolean | null
          environment: string | null
          estimated_deadline: string | null
          estimated_hours: number | null
          final_deadline: string | null
          id: string
          language_tool: string | null
          needs_credentials: boolean | null
          needs_external_integration: boolean | null
          objective: string | null
          priority: string
          process_impact: string | null
          progress_percent: number | null
          requester: string | null
          requester_department: string | null
          risk_level: string | null
          sector: string
          spent_hours: number | null
          started_at: string | null
          status: string
          system_process: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          automation_type?: string | null
          completed_at?: string | null
          complexity?: string | null
          created_at?: string
          created_by: string
          deploy_status?: string | null
          deployed_at?: string | null
          description?: string | null
          documentation_done?: boolean | null
          environment?: string | null
          estimated_deadline?: string | null
          estimated_hours?: number | null
          final_deadline?: string | null
          id?: string
          language_tool?: string | null
          needs_credentials?: boolean | null
          needs_external_integration?: boolean | null
          objective?: string | null
          priority?: string
          process_impact?: string | null
          progress_percent?: number | null
          requester?: string | null
          requester_department?: string | null
          risk_level?: string | null
          sector: string
          spent_hours?: number | null
          started_at?: string | null
          status?: string
          system_process?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          automation_type?: string | null
          completed_at?: string | null
          complexity?: string | null
          created_at?: string
          created_by?: string
          deploy_status?: string | null
          deployed_at?: string | null
          description?: string | null
          documentation_done?: boolean | null
          environment?: string | null
          estimated_deadline?: string | null
          estimated_hours?: number | null
          final_deadline?: string | null
          id?: string
          language_tool?: string | null
          needs_credentials?: boolean | null
          needs_external_integration?: boolean | null
          objective?: string | null
          priority?: string
          process_impact?: string | null
          progress_percent?: number | null
          requester?: string | null
          requester_department?: string | null
          risk_level?: string | null
          sector?: string
          spent_hours?: number | null
          started_at?: string | null
          status?: string
          system_process?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_group: boolean
          last_message_at: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_group?: boolean
          last_message_at?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          mentioned_sm_task_ids: string[]
          mentioned_task_ids: string[]
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          mentioned_sm_task_ids?: string[]
          mentioned_task_ids?: string[]
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          mentioned_sm_task_ids?: string[]
          mentioned_task_ids?: string[]
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          conversation_id: string
          created_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      dependency_map_positions: {
        Row: {
          id: string
          node_id: string
          node_type: string
          position_x: number
          position_y: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          node_id: string
          node_type: string
          position_x?: number
          position_y?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          node_id?: string
          node_type?: string
          position_x?: number
          position_y?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hippocampus_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          is_archived: boolean
          is_pinned: boolean
          is_sensitive: boolean
          reminder_at: string | null
          reminder_repeat: string | null
          reminder_seen: boolean
          tags: string[]
          title: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          is_sensitive?: boolean
          reminder_at?: string | null
          reminder_repeat?: string | null
          reminder_seen?: boolean
          tags?: string[]
          title?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_archived?: boolean
          is_pinned?: boolean
          is_sensitive?: boolean
          reminder_at?: string | null
          reminder_repeat?: string | null
          reminder_seen?: boolean
          tags?: string[]
          title?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory_assets: {
        Row: {
          acquired_at: string | null
          assigned_to: string | null
          collaborator_id: string | null
          created_at: string
          department: string | null
          id: string
          invoice_number: string | null
          item_id: string
          location_id: string | null
          notes: string | null
          patrimony_number: string
          serial_number: string | null
          status: string
          supplier: string | null
          updated_at: string
          value: number
        }
        Insert: {
          acquired_at?: string | null
          assigned_to?: string | null
          collaborator_id?: string | null
          created_at?: string
          department?: string | null
          id?: string
          invoice_number?: string | null
          item_id: string
          location_id?: string | null
          notes?: string | null
          patrimony_number: string
          serial_number?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          acquired_at?: string | null
          assigned_to?: string | null
          collaborator_id?: string | null
          created_at?: string
          department?: string | null
          id?: string
          invoice_number?: string | null
          item_id?: string
          location_id?: string | null
          notes?: string | null
          patrimony_number?: string
          serial_number?: string | null
          status?: string
          supplier?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_assets_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "inventory_collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assets_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_assets_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_collaborators: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          department: string
          email: string | null
          full_name: string
          id: string
          job_title: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department: string
          email?: string | null
          full_name: string
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          department?: string
          email?: string | null
          full_name?: string
          id?: string
          job_title?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_departments: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          brand: string | null
          category_id: string | null
          created_at: string
          created_by: string | null
          damaged_quantity: number
          description: string | null
          discarded_quantity: number
          id: string
          ideal_stock: number
          in_use_quantity: number
          location_id: string | null
          min_stock: number
          model: string | null
          name: string
          notes: string | null
          quantity: number
          responsible_collaborator_id: string | null
          responsible_id: string | null
          sku: string | null
          status: string
          subcategory: string | null
          tracked_individually: boolean
          unit_price: number
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          damaged_quantity?: number
          description?: string | null
          discarded_quantity?: number
          id?: string
          ideal_stock?: number
          in_use_quantity?: number
          location_id?: string | null
          min_stock?: number
          model?: string | null
          name: string
          notes?: string | null
          quantity?: number
          responsible_collaborator_id?: string | null
          responsible_id?: string | null
          sku?: string | null
          status?: string
          subcategory?: string | null
          tracked_individually?: boolean
          unit_price?: number
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          damaged_quantity?: number
          description?: string | null
          discarded_quantity?: number
          id?: string
          ideal_stock?: number
          in_use_quantity?: number
          location_id?: string | null
          min_stock?: number
          model?: string | null
          name?: string
          notes?: string | null
          quantity?: number
          responsible_collaborator_id?: string | null
          responsible_id?: string | null
          sku?: string | null
          status?: string
          subcategory?: string | null
          tracked_individually?: boolean
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "inventory_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_items_responsible_collaborator_id_fkey"
            columns: ["responsible_collaborator_id"]
            isOneToOne: false
            referencedRelation: "inventory_collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_locations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      inventory_movements: {
        Row: {
          asset_id: string | null
          assigned_to: string | null
          collaborator_id: string | null
          created_at: string
          department: string | null
          from_location_id: string | null
          id: string
          invoice_number: string | null
          item_id: string
          notes: string | null
          occurred_at: string
          patrimony_number: string | null
          performed_by: string
          quantity: number
          reason: string | null
          serial_number: string | null
          status_from: string | null
          status_to: string | null
          supplier: string | null
          to_location_id: string | null
          type: string
          unit_price: number
        }
        Insert: {
          asset_id?: string | null
          assigned_to?: string | null
          collaborator_id?: string | null
          created_at?: string
          department?: string | null
          from_location_id?: string | null
          id?: string
          invoice_number?: string | null
          item_id: string
          notes?: string | null
          occurred_at?: string
          patrimony_number?: string | null
          performed_by?: string
          quantity?: number
          reason?: string | null
          serial_number?: string | null
          status_from?: string | null
          status_to?: string | null
          supplier?: string | null
          to_location_id?: string | null
          type: string
          unit_price?: number
        }
        Update: {
          asset_id?: string | null
          assigned_to?: string | null
          collaborator_id?: string | null
          created_at?: string
          department?: string | null
          from_location_id?: string | null
          id?: string
          invoice_number?: string | null
          item_id?: string
          notes?: string | null
          occurred_at?: string
          patrimony_number?: string | null
          performed_by?: string
          quantity?: number
          reason?: string | null
          serial_number?: string | null
          status_from?: string | null
          status_to?: string | null
          supplier?: string | null
          to_location_id?: string | null
          type?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "inventory_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "inventory_collaborators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "inventory_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_requests: {
        Row: {
          created_at: string
          id: string
          item_id: string
          justification: string | null
          quantity: number
          requester_id: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          justification?: string | null
          quantity?: number
          requester_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          justification?: string | null
          quantity?: number
          requester_id?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_requests_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "inventory_items"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_settings: {
        Row: {
          id: boolean
          include_damaged_in_value: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          include_damaged_in_value?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          include_damaged_in_value?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          message: string
          read: boolean
          task_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          message: string
          read?: boolean
          task_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          message?: string
          read?: boolean
          task_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      recurring_task_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          task_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_task_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      responsibility_history: {
        Row: {
          changed_by: string
          created_at: string
          from_user_id: string | null
          id: string
          task_id: string
          to_user_id: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          task_id: string
          to_user_id?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          from_user_id?: string | null
          id?: string
          task_id?: string
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responsibility_history_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_briefings: {
        Row: {
          attachments: Json | null
          campaign_id: string | null
          client_id: string
          content: string | null
          created_at: string
          created_by: string
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json | null
          campaign_id?: string | null
          client_id: string
          content?: string | null
          created_at?: string
          created_by: string
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json | null
          campaign_id?: string | null
          client_id?: string
          content?: string | null
          created_at?: string
          created_by?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_briefings_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_briefings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "sm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_calendar_events: {
        Row: {
          campaign_id: string | null
          client_id: string | null
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          ends_at: string | null
          id: string
          kind: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          campaign_id?: string | null
          client_id?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string | null
          client_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sm_campaigns: {
        Row: {
          budget: number | null
          client_id: string
          created_at: string
          created_by: string
          end_date: string | null
          id: string
          name: string
          objective: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          client_id: string
          created_at?: string
          created_by: string
          end_date?: string | null
          id?: string
          name: string
          objective?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          client_id?: string
          created_at?: string
          created_by?: string
          end_date?: string | null
          id?: string
          name?: string
          objective?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_campaigns_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "sm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_client_users: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_approver: boolean
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_approver?: boolean
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_approver?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_client_users_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "sm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_clients: {
        Row: {
          account_owner_id: string | null
          active: boolean
          brand_identity: string | null
          created_at: string
          created_by: string
          general_briefing: string | null
          id: string
          logo_url: string | null
          name: string
          onboarding_completed_at: string | null
          onboarding_started_at: string | null
          plan_formats: string | null
          plan_notes: string | null
          plan_posts_per_month: number | null
          primary_color: string | null
          updated_at: string
          useful_links: Json | null
        }
        Insert: {
          account_owner_id?: string | null
          active?: boolean
          brand_identity?: string | null
          created_at?: string
          created_by: string
          general_briefing?: string | null
          id?: string
          logo_url?: string | null
          name: string
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          plan_formats?: string | null
          plan_notes?: string | null
          plan_posts_per_month?: number | null
          primary_color?: string | null
          updated_at?: string
          useful_links?: Json | null
        }
        Update: {
          account_owner_id?: string | null
          active?: boolean
          brand_identity?: string | null
          created_at?: string
          created_by?: string
          general_briefing?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          onboarding_completed_at?: string | null
          onboarding_started_at?: string | null
          plan_formats?: string | null
          plan_notes?: string | null
          plan_posts_per_month?: number | null
          primary_color?: string | null
          updated_at?: string
          useful_links?: Json | null
        }
        Relationships: []
      }
      sm_content_types: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sm_ideas: {
        Row: {
          client_id: string | null
          converted_to_post_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          status: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          converted_to_post_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          converted_to_post_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          status?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_ideas_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "sm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_ideas_converted_to_post_id_fkey"
            columns: ["converted_to_post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_metrics: {
        Row: {
          clicks: number | null
          comments_count: number | null
          conversions: number | null
          created_at: string
          created_by: string
          id: string
          impressions: number | null
          likes: number | null
          measured_at: string
          post_id: string
          reach: number | null
          saves: number | null
          shares: number | null
          updated_at: string
        }
        Insert: {
          clicks?: number | null
          comments_count?: number | null
          conversions?: number | null
          created_at?: string
          created_by: string
          id?: string
          impressions?: number | null
          likes?: number | null
          measured_at?: string
          post_id: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
          updated_at?: string
        }
        Update: {
          clicks?: number | null
          comments_count?: number | null
          conversions?: number | null
          created_at?: string
          created_by?: string
          id?: string
          impressions?: number | null
          likes?: number | null
          measured_at?: string
          post_id?: string
          reach?: number | null
          saves?: number | null
          shares?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_metrics_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_post_approvals: {
        Row: {
          approver_id: string
          comments: string | null
          created_at: string
          id: string
          level: string
          post_id: string
          status: string
        }
        Insert: {
          approver_id: string
          comments?: string | null
          created_at?: string
          id?: string
          level: string
          post_id: string
          status?: string
        }
        Update: {
          approver_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          level?: string
          post_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_post_approvals_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_post_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_post_attachments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_post_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          mentions: string[] | null
          post_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          post_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mentions?: string[] | null
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "sm_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_posts: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          caption: string | null
          client_id: string
          content_type_id: string | null
          created_at: string
          created_by: string
          hashtags: string | null
          id: string
          is_recurring_template: boolean
          last_spawned_at: string | null
          network_id: string | null
          notes: string | null
          parent_recurring_post_id: string | null
          priority: Database["public"]["Enums"]["sm_priority"]
          published_at: string | null
          recurrence_interval: number | null
          recurrence_type: string | null
          recurrence_until: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["sm_post_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          caption?: string | null
          client_id: string
          content_type_id?: string | null
          created_at?: string
          created_by: string
          hashtags?: string | null
          id?: string
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          network_id?: string | null
          notes?: string | null
          parent_recurring_post_id?: string | null
          priority?: Database["public"]["Enums"]["sm_priority"]
          published_at?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["sm_post_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          caption?: string | null
          client_id?: string
          content_type_id?: string | null
          created_at?: string
          created_by?: string
          hashtags?: string | null
          id?: string
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          network_id?: string | null
          notes?: string | null
          parent_recurring_post_id?: string | null
          priority?: Database["public"]["Enums"]["sm_priority"]
          published_at?: string | null
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["sm_post_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_posts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "sm_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_posts_content_type_id_fkey"
            columns: ["content_type_id"]
            isOneToOne: false
            referencedRelation: "sm_content_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_posts_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "sm_social_networks"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_sla_config: {
        Row: {
          hours: number
          priority: string
          updated_at: string
        }
        Insert: {
          hours: number
          priority: string
          updated_at?: string
        }
        Update: {
          hours?: number
          priority?: string
          updated_at?: string
        }
        Relationships: []
      }
      sm_social_networks: {
        Row: {
          active: boolean
          created_at: string
          icon: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean
          created_at?: string
          icon?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sm_task_checklist_items: {
        Row: {
          created_at: string
          created_by: string
          done: boolean
          id: string
          sort_order: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          done?: boolean
          id?: string
          sort_order?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          done?: boolean
          id?: string
          sort_order?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sm_task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          mentions: string[]
          task_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          mentions?: string[]
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "sm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_task_template_items: {
        Row: {
          created_at: string
          created_by: string
          id: string
          sort_order: number
          template_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          sort_order?: number
          template_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          sort_order?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_task_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "sm_task_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_task_templates: {
        Row: {
          client_id: string | null
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          priority: Database["public"]["Enums"]["sm_priority"]
          title: string
          updated_at: string
        }
        Insert: {
          client_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          priority?: Database["public"]["Enums"]["sm_priority"]
          title: string
          updated_at?: string
        }
        Update: {
          client_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          priority?: Database["public"]["Enums"]["sm_priority"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sm_task_time_logs: {
        Row: {
          created_at: string
          description: string | null
          duration_minutes: number | null
          ended_at: string | null
          id: string
          started_at: string
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          ended_at?: string | null
          id?: string
          started_at?: string
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_task_time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "sm_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_tasks: {
        Row: {
          approval_link: string | null
          approval_notes: string | null
          approval_status: string | null
          approver_id: string | null
          assigned_to: string | null
          billable: string | null
          campaign_id: string | null
          client_id: string | null
          created_at: string
          created_by: string
          description: string | null
          discard_reason: string | null
          due_date: string | null
          id: string
          is_approval_step: boolean
          is_recurring_template: boolean
          last_spawned_at: string | null
          nature: string
          parent_recurring_task_id: string | null
          priority: Database["public"]["Enums"]["sm_priority"]
          recurrence_interval: number | null
          recurrence_type: string | null
          recurrence_until: string | null
          requires_approval: boolean
          stage: string | null
          status: string
          title: string
          updated_at: string
          workflow_id: string | null
          workflow_step_id: string | null
        }
        Insert: {
          approval_link?: string | null
          approval_notes?: string | null
          approval_status?: string | null
          approver_id?: string | null
          assigned_to?: string | null
          billable?: string | null
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          discard_reason?: string | null
          due_date?: string | null
          id?: string
          is_approval_step?: boolean
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          nature?: string
          parent_recurring_task_id?: string | null
          priority?: Database["public"]["Enums"]["sm_priority"]
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          requires_approval?: boolean
          stage?: string | null
          status?: string
          title: string
          updated_at?: string
          workflow_id?: string | null
          workflow_step_id?: string | null
        }
        Update: {
          approval_link?: string | null
          approval_notes?: string | null
          approval_status?: string | null
          approver_id?: string | null
          assigned_to?: string | null
          billable?: string | null
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          discard_reason?: string | null
          due_date?: string | null
          id?: string
          is_approval_step?: boolean
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          nature?: string
          parent_recurring_task_id?: string | null
          priority?: Database["public"]["Enums"]["sm_priority"]
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          requires_approval?: boolean
          stage?: string | null
          status?: string
          title?: string
          updated_at?: string
          workflow_id?: string | null
          workflow_step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sm_tasks_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "sm_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sm_tasks_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "sm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_workflow_step_items: {
        Row: {
          created_at: string
          created_by: string
          id: string
          sort_order: number
          step_id: string
          title: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          sort_order?: number
          step_id: string
          title: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          sort_order?: number
          step_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_workflow_step_items_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "sm_workflow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_workflow_steps: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string
          days_offset: number
          description: string | null
          id: string
          is_approval: boolean
          sort_order: number
          title: string
          updated_at: string
          workflow_id: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by: string
          days_offset?: number
          description?: string | null
          id?: string
          is_approval?: boolean
          sort_order?: number
          title: string
          updated_at?: string
          workflow_id: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string
          days_offset?: number
          description?: string | null
          id?: string
          is_approval?: boolean
          sort_order?: number
          title?: string
          updated_at?: string
          workflow_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sm_workflow_steps_workflow_id_fkey"
            columns: ["workflow_id"]
            isOneToOne: false
            referencedRelation: "sm_workflows"
            referencedColumns: ["id"]
          },
        ]
      }
      sm_workflows: {
        Row: {
          active: boolean
          created_at: string
          created_by: string
          description: string | null
          id: string
          is_default_operation: boolean
          name: string
          service: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          is_default_operation?: boolean
          name: string
          service?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          is_default_operation?: boolean
          name?: string
          service?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_catalog: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          mime_type: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          mime_type: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          mime_type?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_dependencies: {
        Row: {
          created_at: string
          created_by: string
          depends_on_task_id: string
          id: string
          line_color: string | null
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          depends_on_task_id: string
          id?: string
          line_color?: string | null
          task_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          depends_on_task_id?: string
          id?: string
          line_color?: string | null
          task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_dependencies_depends_on_task_id_fkey"
            columns: ["depends_on_task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_dependencies_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_events: {
        Row: {
          created_at: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_events_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring_template: boolean
          last_spawned_at: string | null
          legal_date: string | null
          legal_is_business_day: boolean
          meta_date: string | null
          meta_is_business_day: boolean
          parent_recurring_task_id: string | null
          priority: Database["public"]["Enums"]["task_priority"]
          recurrence_business_day_direction: string
          recurrence_day_of_month: number | null
          recurrence_days: string[]
          recurrence_deadline_days: number | null
          recurrence_interval: number | null
          recurrence_months: number[]
          recurrence_only_business_days: boolean
          recurrence_start_time: string
          recurrence_type: string | null
          recurrence_until: string | null
          status: Database["public"]["Enums"]["task_status"]
          support_equipment: string | null
          support_real_reason: string | null
          support_site: string | null
          support_system: string | null
          support_tags: string[]
          support_technical_notes: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          legal_date?: string | null
          legal_is_business_day?: boolean
          meta_date?: string | null
          meta_is_business_day?: boolean
          parent_recurring_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_business_day_direction?: string
          recurrence_day_of_month?: number | null
          recurrence_days?: string[]
          recurrence_deadline_days?: number | null
          recurrence_interval?: number | null
          recurrence_months?: number[]
          recurrence_only_business_days?: boolean
          recurrence_start_time?: string
          recurrence_type?: string | null
          recurrence_until?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          support_equipment?: string | null
          support_real_reason?: string | null
          support_site?: string | null
          support_system?: string | null
          support_tags?: string[]
          support_technical_notes?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          legal_date?: string | null
          legal_is_business_day?: boolean
          meta_date?: string | null
          meta_is_business_day?: boolean
          parent_recurring_task_id?: string | null
          priority?: Database["public"]["Enums"]["task_priority"]
          recurrence_business_day_direction?: string
          recurrence_day_of_month?: number | null
          recurrence_days?: string[]
          recurrence_deadline_days?: number | null
          recurrence_interval?: number | null
          recurrence_months?: number[]
          recurrence_only_business_days?: boolean
          recurrence_start_time?: string
          recurrence_type?: string | null
          recurrence_until?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          support_equipment?: string | null
          support_real_reason?: string | null
          support_site?: string | null
          support_system?: string | null
          support_tags?: string[]
          support_technical_notes?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      time_logs: {
        Row: {
          description: string | null
          duration_minutes: number
          ended_at: string | null
          id: string
          logged_at: string
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          description?: string | null
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          logged_at?: string
          started_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          description?: string | null
          duration_minutes?: number
          ended_at?: string | null
          id?: string
          logged_at?: string
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_automation_visibility: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_automation_visibility_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_medals: {
        Row: {
          awarded_at: string
          id: string
          medal_key: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          medal_key: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          medal_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_menu_access: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          menu_key: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          menu_key: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          menu_key?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sectors: {
        Row: {
          created_at: string
          id: string
          sector: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          sector: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          sector?: string
          user_id?: string
        }
        Relationships: []
      }
      user_social_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["social_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["social_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["social_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_systems: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          system: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          system: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          system?: string
          user_id?: string
        }
        Relationships: []
      }
      user_task_visibility: {
        Row: {
          created_at: string
          id: string
          target_user_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_user_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_user_id?: string
          user_id?: string
        }
        Relationships: []
      }
      xp_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          task_id: string
          user_id: string
          xp_earned: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          task_id: string
          user_id: string
          xp_earned?: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          task_id?: string
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "xp_logs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_xp: {
        Args: { _action: string; _task_id: string; _user_id: string }
        Returns: undefined
      }
      get_admin_user_ids: { Args: never; Returns: string[] }
      get_gestor_user_ids: { Args: never; Returns: string[] }
      get_or_create_direct_chat: { Args: { _other: string }; Returns: string }
      get_social_assignable_user_ids: { Args: never; Returns: string[] }
      get_ti_assignable_user_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_sector_access: {
        Args: { _sector: string; _user_id: string }
        Returns: boolean
      }
      has_social_access: { Args: { _user_id: string }; Returns: boolean }
      has_social_role: {
        Args: {
          _role: Database["public"]["Enums"]["social_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_ti_write: { Args: { _user_id: string }; Returns: boolean }
      is_chat_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      user_client_ids: { Args: { _user_id: string }; Returns: string[] }
      user_sector_codes: { Args: { _user_id: string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "member" | "dev" | "lider" | "gestor" | "suporte"
      sm_post_status:
        | "ideia"
        | "roteiro"
        | "design"
        | "revisao_interna"
        | "aprovacao_cliente"
        | "agendado"
        | "publicado"
        | "reprovado"
      sm_priority: "low" | "medium" | "high" | "urgent"
      social_role:
        | "admin"
        | "gestor"
        | "social_media"
        | "designer"
        | "redator"
        | "cliente"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status:
        | "backlog"
        | "pending"
        | "todo"
        | "in_progress"
        | "review"
        | "done"
        | "discarded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "member", "dev", "lider", "gestor", "suporte"],
      sm_post_status: [
        "ideia",
        "roteiro",
        "design",
        "revisao_interna",
        "aprovacao_cliente",
        "agendado",
        "publicado",
        "reprovado",
      ],
      sm_priority: ["low", "medium", "high", "urgent"],
      social_role: [
        "admin",
        "gestor",
        "social_media",
        "designer",
        "redator",
        "cliente",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: [
        "backlog",
        "pending",
        "todo",
        "in_progress",
        "review",
        "done",
        "discarded",
      ],
    },
  },
} as const
