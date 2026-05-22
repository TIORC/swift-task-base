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
    PostgrestVersion: "14.4"
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
          spent_hours?: number | null
          started_at?: string | null
          status?: string
          system_process?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
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
          active: boolean
          brand_identity: string | null
          created_at: string
          created_by: string
          general_briefing: string | null
          id: string
          logo_url: string | null
          name: string
          primary_color: string | null
          updated_at: string
          useful_links: Json | null
        }
        Insert: {
          active?: boolean
          brand_identity?: string | null
          created_at?: string
          created_by: string
          general_briefing?: string | null
          id?: string
          logo_url?: string | null
          name: string
          primary_color?: string | null
          updated_at?: string
          useful_links?: Json | null
        }
        Update: {
          active?: boolean
          brand_identity?: string | null
          created_at?: string
          created_by?: string
          general_briefing?: string | null
          id?: string
          logo_url?: string | null
          name?: string
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
      sm_tasks: {
        Row: {
          assigned_to: string | null
          campaign_id: string | null
          client_id: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          is_recurring_template: boolean
          last_spawned_at: string | null
          parent_recurring_task_id: string | null
          priority: Database["public"]["Enums"]["sm_priority"]
          recurrence_interval: number | null
          recurrence_type: string | null
          recurrence_until: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          parent_recurring_task_id?: string | null
          priority?: Database["public"]["Enums"]["sm_priority"]
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          campaign_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring_template?: boolean
          last_spawned_at?: string | null
          parent_recurring_task_id?: string | null
          priority?: Database["public"]["Enums"]["sm_priority"]
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          status?: string
          title?: string
          updated_at?: string
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
          task_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          depends_on_task_id: string
          id?: string
          task_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          depends_on_task_id?: string
          id?: string
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
          recurrence_interval: number | null
          recurrence_type: string | null
          recurrence_until: string | null
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
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
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
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
          recurrence_interval?: number | null
          recurrence_type?: string | null
          recurrence_until?: string | null
          status?: Database["public"]["Enums"]["task_status"]
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
      get_admin_user_ids: { Args: never; Returns: string[] }
      get_gestor_user_ids: { Args: never; Returns: string[] }
      get_social_assignable_user_ids: { Args: never; Returns: string[] }
      get_ti_assignable_user_ids: { Args: never; Returns: string[] }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
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
      user_client_ids: { Args: { _user_id: string }; Returns: string[] }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
