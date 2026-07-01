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
      academic_arms: {
        Row: {
          capacity: number | null
          class_id: string
          class_teacher_user_id: string | null
          code: string
          created_at: string
          department_id: string | null
          id: string
          name: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          class_id: string
          class_teacher_user_id?: string | null
          code: string
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          class_id?: string
          class_teacher_user_id?: string | null
          code?: string
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_arms_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "academic_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_arms_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "academic_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_arms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_arms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_arms_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_calendar: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          kind: string
          periods: Json
          school_id: string
          session: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          kind?: string
          periods?: Json
          school_id: string
          session: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          kind?: string
          periods?: Json
          school_id?: string
          session?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_calendar_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_calendar_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_calendar_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_classes: {
        Row: {
          capacity: number | null
          category: string | null
          code: string
          created_at: string
          description: string | null
          id: string
          level_id: string
          name: string
          promotion_target_class_id: string | null
          school_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          category?: string | null
          code: string
          created_at?: string
          description?: string | null
          id?: string
          level_id: string
          name: string
          promotion_target_class_id?: string | null
          school_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          category?: string | null
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          level_id?: string
          name?: string
          promotion_target_class_id?: string | null
          school_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_classes_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_classes_promotion_target_class_id_fkey"
            columns: ["promotion_target_class_id"]
            isOneToOne: false
            referencedRelation: "academic_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_departments: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          name: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_departments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_levels: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          promotion_target_level_id: string | null
          school_id: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          promotion_target_level_id?: string | null
          school_id: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          promotion_target_level_id?: string | null
          school_id?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_levels_promotion_target_level_id_fkey"
            columns: ["promotion_target_level_id"]
            isOneToOne: false
            referencedRelation: "academic_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_levels_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_policies: {
        Row: {
          body: Json
          created_at: string
          id: string
          policy_kind: string
          school_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: Json
          created_at?: string
          id?: string
          policy_kind: string
          school_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: Json
          created_at?: string
          id?: string
          policy_kind?: string
          school_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academic_policies_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_policies_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_policies_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_policy_defaults: {
        Row: {
          body: Json
          created_at: string
          id: string
          policy_kind: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body?: Json
          created_at?: string
          id?: string
          policy_kind: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body?: Json
          created_at?: string
          id?: string
          policy_kind?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      academic_promotion_rules: {
        Row: {
          created_at: string
          from_class_id: string | null
          id: string
          min_attendance_pct: number | null
          min_average: number | null
          notes: string | null
          required_core_pass: Json | null
          school_id: string
          to_class_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          from_class_id?: string | null
          id?: string
          min_attendance_pct?: number | null
          min_average?: number | null
          notes?: string | null
          required_core_pass?: Json | null
          school_id: string
          to_class_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          from_class_id?: string | null
          id?: string
          min_attendance_pct?: number | null
          min_average?: number | null
          notes?: string | null
          required_core_pass?: Json | null
          school_id?: string
          to_class_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_promotion_rules_from_class_id_fkey"
            columns: ["from_class_id"]
            isOneToOne: false
            referencedRelation: "academic_classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_promotion_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_promotion_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_promotion_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_promotion_rules_to_class_id_fkey"
            columns: ["to_class_id"]
            isOneToOne: false
            referencedRelation: "academic_classes"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_subjects: {
        Row: {
          category: string
          code: string
          created_at: string
          department_id: string | null
          description: string | null
          id: string
          name: string
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          code: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name: string
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          code?: string
          created_at?: string
          department_id?: string | null
          description?: string | null
          id?: string
          name?: string
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academic_subjects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "academic_departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academic_subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      academic_templates: {
        Row: {
          body: Json
          code: string
          country: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          body?: Json
          code: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          body?: Json
          code?: string
          country?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      admin_role_slots: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          name: string
          permissions: Json
          school_id: string
          slot: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          permissions?: Json
          school_id: string
          slot: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          permissions?: Json
          school_id?: string
          slot?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_role_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_role_slots_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_approvals: {
        Row: {
          ai_job_id: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string
          draft: Json
          edits: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          notes: string | null
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          ai_job_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by: string
          draft: Json
          edits?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          notes?: string | null
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          ai_job_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string
          draft?: Json
          edits?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          notes?: string | null
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_approvals_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_cache: {
        Row: {
          cache_key: string
          completion_tokens: number
          cost_saved_usd: number
          cost_usd: number
          created_at: string
          expires_at: string
          hits: number
          kind: string
          last_used_at: string
          model: string
          prompt_tokens: number
          response: Json
          school_id: string
          tokens_saved: number
        }
        Insert: {
          cache_key: string
          completion_tokens?: number
          cost_saved_usd?: number
          cost_usd?: number
          created_at?: string
          expires_at?: string
          hits?: number
          kind: string
          last_used_at?: string
          model: string
          prompt_tokens?: number
          response: Json
          school_id: string
          tokens_saved?: number
        }
        Update: {
          cache_key?: string
          completion_tokens?: number
          cost_saved_usd?: number
          cost_usd?: number
          created_at?: string
          expires_at?: string
          hits?: number
          kind?: string
          last_used_at?: string
          model?: string
          prompt_tokens?: number
          response?: Json
          school_id?: string
          tokens_saved?: number
        }
        Relationships: []
      }
      ai_chats: {
        Row: {
          attachments: Json
          audio_url: string | null
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          role: string
          school_id: string
          user_id: string
        }
        Insert: {
          attachments?: Json
          audio_url?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role: string
          school_id: string
          user_id: string
        }
        Update: {
          attachments?: Json
          audio_url?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role?: string
          school_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_chats_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_chats_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_conversations: {
        Row: {
          archived: boolean
          created_at: string
          id: string
          last_message_at: string
          pinned: boolean
          school_id: string
          title: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string
          pinned?: boolean
          school_id: string
          title?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          id?: string
          last_message_at?: string
          pinned?: boolean
          school_id?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_jobs: {
        Row: {
          completion_tokens: number | null
          cost_usd: number | null
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json | null
          kind: string
          latency_ms: number | null
          model: string | null
          output: Json | null
          prompt_tokens: number | null
          school_id: string
          status: string
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          kind: string
          latency_ms?: number | null
          model?: string | null
          output?: Json | null
          prompt_tokens?: number | null
          school_id: string
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json | null
          kind?: string
          latency_ms?: number | null
          model?: string | null
          output?: Json | null
          prompt_tokens?: number | null
          school_id?: string
          status?: string
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      ai_model_routing: {
        Row: {
          created_at: string
          id: string
          model: string
          role: string
          school_id: string
          task_kind: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          model: string
          role?: string
          school_id: string
          task_kind: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          model?: string
          role?: string
          school_id?: string
          task_kind?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_model_routing_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_routing_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_model_routing_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "platform_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          body: string | null
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          school_id: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          school_id: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          school_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      arm_enrollments: {
        Row: {
          arm_id: string
          created_at: string
          id: string
          joined_at: string
          school_id: string
          status: string
          student_user_id: string
          updated_at: string
        }
        Insert: {
          arm_id: string
          created_at?: string
          id?: string
          joined_at?: string
          school_id: string
          status?: string
          student_user_id: string
          updated_at?: string
        }
        Update: {
          arm_id?: string
          created_at?: string
          id?: string
          joined_at?: string
          school_id?: string
          status?: string
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "arm_enrollments_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "academic_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arm_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arm_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arm_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_answers_v2: {
        Row: {
          ai_feedback: Json | null
          ai_grade: number | null
          ai_job_id: string | null
          answered_at: string
          attempt_id: string
          id: string
          is_correct: boolean | null
          marked_for_review: boolean
          points_awarded: number | null
          question_id: string
          school_id: string
          selected: Json | null
        }
        Insert: {
          ai_feedback?: Json | null
          ai_grade?: number | null
          ai_job_id?: string | null
          answered_at?: string
          attempt_id: string
          id?: string
          is_correct?: boolean | null
          marked_for_review?: boolean
          points_awarded?: number | null
          question_id: string
          school_id: string
          selected?: Json | null
        }
        Update: {
          ai_feedback?: Json | null
          ai_grade?: number | null
          ai_job_id?: string | null
          answered_at?: string
          attempt_id?: string
          id?: string
          is_correct?: boolean | null
          marked_for_review?: boolean
          points_awarded?: number | null
          question_id?: string
          school_id?: string
          selected?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "assessment_answers_v2_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_answers_v2_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["attempt_id"]
          },
          {
            foreignKeyName: "assessment_answers_v2_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_attempts_v2: {
        Row: {
          assessment_id: string
          expires_at: string | null
          id: string
          meta: Json
          question_order: string[]
          school_id: string
          started_at: string
          status: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at: string | null
          violations: number
        }
        Insert: {
          assessment_id: string
          expires_at?: string | null
          id?: string
          meta?: Json
          question_order?: string[]
          school_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id: string
          submitted_at?: string | null
          violations?: number
        }
        Update: {
          assessment_id?: string
          expires_at?: string | null
          id?: string
          meta?: Json
          question_order?: string[]
          school_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["attempt_status"]
          student_id?: string
          submitted_at?: string | null
          violations?: number
        }
        Relationships: [
          {
            foreignKeyName: "assessment_attempts_v2_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_attempts_v2_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["assessment_id"]
          },
        ]
      }
      assessment_legacy_map: {
        Row: {
          assessment_id: string
          attempt_id: string | null
          attempt_legacy_id: string | null
          created_at: string
          id: string
          legacy_id: string
          legacy_kind: string
        }
        Insert: {
          assessment_id: string
          attempt_id?: string | null
          attempt_legacy_id?: string | null
          created_at?: string
          id?: string
          legacy_id: string
          legacy_kind: string
        }
        Update: {
          assessment_id?: string
          attempt_id?: string | null
          attempt_legacy_id?: string | null
          created_at?: string
          id?: string
          legacy_id?: string
          legacy_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_legacy_map_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_legacy_map_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_legacy_map_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_legacy_map_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["attempt_id"]
          },
        ]
      }
      assessment_results: {
        Row: {
          assessment_id: string
          attempt_id: string
          grade: string | null
          graded_at: string
          max_score: number
          per_section: Json
          per_topic: Json
          percentage: number
          position: number | null
          presenter: string
          projected: Json
          raw_score: number
          school_id: string
          student_id: string
        }
        Insert: {
          assessment_id: string
          attempt_id: string
          grade?: string | null
          graded_at?: string
          max_score?: number
          per_section?: Json
          per_topic?: Json
          percentage?: number
          position?: number | null
          presenter?: string
          projected?: Json
          raw_score?: number
          school_id: string
          student_id: string
        }
        Update: {
          assessment_id?: string
          attempt_id?: string
          grade?: string | null
          graded_at?: string
          max_score?: number
          per_section?: Json
          per_topic?: Json
          percentage?: number
          position?: number | null
          presenter?: string
          projected?: Json
          raw_score?: number
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "assessment_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "assessment_attempts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "student_assessments_v"
            referencedColumns: ["attempt_id"]
          },
        ]
      }
      assessment_sections: {
        Row: {
          assessment_id: string
          created_at: string
          id: string
          position: number
          question_count: number
          school_id: string
          source_filter: Json
          subject_code: string | null
          time_limit_min: number | null
          title: string
        }
        Insert: {
          assessment_id: string
          created_at?: string
          id?: string
          position?: number
          question_count?: number
          school_id: string
          source_filter?: Json
          subject_code?: string | null
          time_limit_min?: number | null
          title: string
        }
        Update: {
          assessment_id?: string
          created_at?: string
          id?: string
          position?: number
          question_count?: number
          school_id?: string
          source_filter?: Json
          subject_code?: string | null
          time_limit_min?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_sections_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_sections_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["assessment_id"]
          },
        ]
      }
      assessment_structures: {
        Row: {
          components: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          components?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          components?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_structures_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_violations_v2: {
        Row: {
          attempt_id: string
          created_at: string
          detail: string | null
          id: string
          school_id: string
          type: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          detail?: string | null
          id?: string
          school_id: string
          type: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          detail?: string | null
          id?: string
          school_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_violations_v2_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "assessment_attempts_v2"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_violations_v2_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["attempt_id"]
          },
        ]
      }
      assessments: {
        Row: {
          class_id: string | null
          closes_at: string | null
          config: Json
          counts_to_results: boolean
          created_at: string
          created_by: string
          delivery_mode: Database["public"]["Enums"]["assessment_delivery"]
          description: string | null
          id: string
          opens_at: string | null
          scheduled_at: string | null
          school_id: string
          source: Database["public"]["Enums"]["assessment_source"]
          status: Database["public"]["Enums"]["assessment_status_v2"]
          title: string
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at: string
          weight: number
        }
        Insert: {
          class_id?: string | null
          closes_at?: string | null
          config?: Json
          counts_to_results?: boolean
          created_at?: string
          created_by: string
          delivery_mode?: Database["public"]["Enums"]["assessment_delivery"]
          description?: string | null
          id?: string
          opens_at?: string | null
          scheduled_at?: string | null
          school_id: string
          source?: Database["public"]["Enums"]["assessment_source"]
          status?: Database["public"]["Enums"]["assessment_status_v2"]
          title: string
          type: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
          weight?: number
        }
        Update: {
          class_id?: string | null
          closes_at?: string | null
          config?: Json
          counts_to_results?: boolean
          created_at?: string
          created_by?: string
          delivery_mode?: Database["public"]["Enums"]["assessment_delivery"]
          description?: string | null
          id?: string
          opens_at?: string | null
          scheduled_at?: string | null
          school_id?: string
          source?: Database["public"]["Enums"]["assessment_source"]
          status?: Database["public"]["Enums"]["assessment_status_v2"]
          title?: string
          type?: Database["public"]["Enums"]["assessment_type"]
          updated_at?: string
          weight?: number
        }
        Relationships: []
      }
      assignment_submissions: {
        Row: {
          assignment_id: string
          attachments: Json
          content: string | null
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          school_id: string
          score: number | null
          student_id: string
          submitted_at: string
        }
        Insert: {
          assignment_id: string
          attachments?: Json
          content?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id: string
          score?: number | null
          student_id: string
          submitted_at?: string
        }
        Update: {
          assignment_id?: string
          attachments?: Json
          content?: string | null
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          school_id?: string
          score?: number | null
          student_id?: string
          submitted_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          attachments: Json
          class_id: string | null
          created_at: string
          description: string | null
          due_at: string | null
          id: string
          max_score: number
          school_id: string
          subject: string | null
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          attachments?: Json
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          max_score?: number
          school_id: string
          subject?: string | null
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          attachments?: Json
          class_id?: string | null
          created_at?: string
          description?: string | null
          due_at?: string | null
          id?: string
          max_score?: number
          school_id?: string
          subject?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      attendance: {
        Row: {
          class_id: string
          created_at: string
          date: string
          id: string
          marked_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          date: string
          id?: string
          marked_by?: string | null
          school_id: string
          status: Database["public"]["Enums"]["attendance_status"]
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          date?: string
          id?: string
          marked_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["attendance_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_events: {
        Row: {
          created_at: string
          event: string
          id: string
          school_id: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          school_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          school_id?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      behavior_notes: {
        Row: {
          category: string | null
          created_at: string
          id: string
          note: string
          school_id: string
          severity: string
          student_id: string
          teacher_id: string
          type: string
          visible_to_parent: boolean
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          note: string
          school_id: string
          severity?: string
          student_id: string
          teacher_id: string
          type?: string
          visible_to_parent?: boolean
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          note?: string
          school_id?: string
          severity?: string
          student_id?: string
          teacher_id?: string
          type?: string
          visible_to_parent?: boolean
        }
        Relationships: []
      }
      broadcast_deliveries: {
        Row: {
          broadcast_id: string
          channel: string
          created_at: string
          error: string | null
          id: string
          read_at: string | null
          school_id: string
          sent_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          broadcast_id: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          read_at?: string | null
          school_id: string
          sent_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          broadcast_id?: string
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          read_at?: string | null
          school_id?: string
          sent_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_deliveries_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "broadcast_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_jobs: {
        Row: {
          audience: Json
          body: string
          channels: string[]
          created_at: string
          created_by: string
          id: string
          recurrence: string | null
          scheduled_for: string | null
          school_id: string
          sent_at: string | null
          stats: Json
          status: string
          template_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: Json
          body: string
          channels?: string[]
          created_at?: string
          created_by: string
          id?: string
          recurrence?: string | null
          scheduled_for?: string | null
          school_id: string
          sent_at?: string | null
          stats?: Json
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: Json
          body?: string
          channels?: string[]
          created_at?: string
          created_by?: string
          id?: string
          recurrence?: string | null
          scheduled_for?: string | null
          school_id?: string
          sent_at?: string | null
          stats?: Json
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_jobs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "comms_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      class_enrollments: {
        Row: {
          class_id: string
          created_at: string
          id: string
          school_id: string
          student_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          school_id: string
          student_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          school_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subject_teachers: {
        Row: {
          class_id: string
          created_at: string
          id: string
          is_lead: boolean
          school_id: string
          session: string | null
          subject_id: string
          teacher_user_id: string
          term: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          is_lead?: boolean
          school_id: string
          session?: string | null
          subject_id: string
          teacher_user_id: string
          term?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          is_lead?: boolean
          school_id?: string
          session?: string | null
          subject_id?: string
          teacher_user_id?: string
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_subject_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subject_teachers_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          arm: string | null
          code: string
          created_at: string
          grade_level: string | null
          id: string
          name: string
          school_id: string
          subject: string | null
          teacher_id: string | null
          track: string | null
        }
        Insert: {
          arm?: string | null
          code: string
          created_at?: string
          grade_level?: string | null
          id?: string
          name: string
          school_id: string
          subject?: string | null
          teacher_id?: string | null
          track?: string | null
        }
        Update: {
          arm?: string | null
          code?: string
          created_at?: string
          grade_level?: string | null
          id?: string
          name?: string
          school_id?: string
          subject?: string | null
          teacher_id?: string | null
          track?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "classes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      client_errors: {
        Row: {
          affected_users: string[]
          browser: string | null
          cause: string | null
          context: Json | null
          created_at: string
          fingerprint: string | null
          first_seen_at: string
          id: string
          last_seen_at: string
          message: string
          occurrence_count: number
          os: string | null
          resolution_note: string | null
          resolution_status: string
          resolved_at: string | null
          resolved_by: string | null
          role: string | null
          route: string | null
          school_id: string | null
          severity: string | null
          source: string | null
          stack: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          affected_users?: string[]
          browser?: string | null
          cause?: string | null
          context?: Json | null
          created_at?: string
          fingerprint?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message: string
          occurrence_count?: number
          os?: string | null
          resolution_note?: string | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          role?: string | null
          route?: string | null
          school_id?: string | null
          severity?: string | null
          source?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          affected_users?: string[]
          browser?: string | null
          cause?: string | null
          context?: Json | null
          created_at?: string
          fingerprint?: string | null
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          message?: string
          occurrence_count?: number
          os?: string | null
          resolution_note?: string | null
          resolution_status?: string
          resolved_at?: string | null
          resolved_by?: string | null
          role?: string | null
          route?: string | null
          school_id?: string | null
          severity?: string | null
          source?: string | null
          stack?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      comms_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          metadata: Json
          ref_id: string | null
          school_id: string
          surface: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          metadata?: Json
          ref_id?: string | null
          school_id: string
          surface?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          metadata?: Json
          ref_id?: string | null
          school_id?: string
          surface?: string | null
          user_id?: string
        }
        Relationships: []
      }
      comms_templates: {
        Row: {
          body: string
          category: string
          created_at: string
          created_by: string
          id: string
          name: string
          school_id: string
          subject: string | null
          updated_at: string
          variables: Json
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          created_by: string
          id?: string
          name: string
          school_id: string
          subject?: string | null
          updated_at?: string
          variables?: Json
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          school_id?: string
          subject?: string | null
          updated_at?: string
          variables?: Json
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          attachments: Json
          body: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          kind: string
          reply_to: string | null
          school_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          kind?: string
          reply_to?: string | null
          school_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          kind?: string
          reply_to?: string | null
          school_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          archived: boolean
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string | null
          muted: boolean
          role_at_join: string | null
          starred: boolean
          user_id: string
        }
        Insert: {
          archived?: boolean
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          muted?: boolean
          role_at_join?: string | null
          starred?: boolean
          user_id: string
        }
        Update: {
          archived?: boolean
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string | null
          muted?: boolean
          role_at_join?: string | null
          starred?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          channel_type: string | null
          created_at: string
          created_by: string
          id: string
          kind: string
          last_message_at: string | null
          last_message_preview: string | null
          metadata: Json
          school_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          channel_type?: string | null
          created_at?: string
          created_by: string
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          school_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          channel_type?: string | null
          created_at?: string
          created_by?: string
          id?: string
          kind?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          metadata?: Json
          school_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      exam_answers: {
        Row: {
          attempt_id: string
          id: string
          marked_for_review: boolean
          question_id: string
          selected_index: number | null
          updated_at: string
        }
        Insert: {
          attempt_id: string
          id?: string
          marked_for_review?: boolean
          question_id: string
          selected_index?: number | null
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          id?: string
          marked_for_review?: boolean
          question_id?: string
          selected_index?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_appeals: {
        Row: {
          attempt_id: string
          created_at: string
          exam_kind: string
          id: string
          reason: string
          recalculation: Json | null
          school_id: string
          stage_notes: Json
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          exam_kind?: string
          id?: string
          reason: string
          recalculation?: Json | null
          school_id: string
          stage_notes?: Json
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          exam_kind?: string
          id?: string
          reason?: string
          recalculation?: Json | null
          school_id?: string
          stage_notes?: Json
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_appeals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_appeals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_appeals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_approvals: {
        Row: {
          acted_at: string | null
          actor_id: string | null
          created_at: string
          exam_id: string
          exam_kind: string
          id: string
          note: string | null
          school_id: string
          stage: string
          status: string
        }
        Insert: {
          acted_at?: string | null
          actor_id?: string | null
          created_at?: string
          exam_id: string
          exam_kind?: string
          id?: string
          note?: string | null
          school_id: string
          stage: string
          status?: string
        }
        Update: {
          acted_at?: string | null
          actor_id?: string | null
          created_at?: string
          exam_id?: string
          exam_kind?: string
          id?: string
          note?: string | null
          school_id?: string
          stage?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_approvals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_approvals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_approvals_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_attempts: {
        Row: {
          exam_id: string
          id: string
          school_id: string
          score: number | null
          started_at: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          exam_id: string
          id?: string
          school_id: string
          score?: number | null
          started_at?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          exam_id?: string
          id?: string
          school_id?: string
          score?: number | null
          started_at?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_attempts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_audit_entries: {
        Row: {
          attempt_id: string
          correct_answer: Json | null
          id: string
          question_id: string
          question_position: number | null
          recorded_at: string
          school_id: string
          score_awarded: number | null
          student_answer: Json | null
        }
        Insert: {
          attempt_id: string
          correct_answer?: Json | null
          id?: string
          question_id: string
          question_position?: number | null
          recorded_at?: string
          school_id: string
          score_awarded?: number | null
          student_answer?: Json | null
        }
        Update: {
          attempt_id?: string
          correct_answer?: Json | null
          id?: string
          question_id?: string
          question_position?: number | null
          recorded_at?: string
          school_id?: string
          score_awarded?: number | null
          student_answer?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_audit_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_audit_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_audit_entries_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_questions: {
        Row: {
          correct_index: number
          exam_id: string
          id: string
          options: Json
          points: number
          position: number
          prompt: string
          school_id: string
        }
        Insert: {
          correct_index?: number
          exam_id: string
          id?: string
          options?: Json
          points?: number
          position?: number
          prompt: string
          school_id: string
        }
        Update: {
          correct_index?: number
          exam_id?: string
          id?: string
          options?: Json
          points?: number
          position?: number
          prompt?: string
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_review_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          exam_id: string
          exam_kind: string
          id: string
          notes: string | null
          school_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          exam_id: string
          exam_kind: string
          id?: string
          notes?: string | null
          school_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          exam_id?: string
          exam_kind?: string
          id?: string
          notes?: string | null
          school_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_review_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_review_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_review_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_violations: {
        Row: {
          attempt_id: string
          created_at: string
          detail: string | null
          evidence_path: string | null
          id: string
          reviewed_at: string | null
          reviewer_decision: string | null
          reviewer_id: string | null
          risk_score: number
          school_id: string
          student_explanation: Json | null
          type: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          detail?: string | null
          evidence_path?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_decision?: string | null
          reviewer_id?: string | null
          risk_score?: number
          school_id: string
          student_explanation?: Json | null
          type: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          detail?: string | null
          evidence_path?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_decision?: string | null
          reviewer_id?: string | null
          risk_score?: number
          school_id?: string
          student_explanation?: Json | null
          type?: string
        }
        Relationships: []
      }
      exams: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          auto_close_at: string | null
          auto_publish_at: string | null
          class_id: string | null
          class_restrictions: string[]
          counts_to_results: boolean
          created_at: string
          created_by: string
          duration_min: number | null
          duration_minutes: number
          id: string
          mode: Database["public"]["Enums"]["exam_mode"]
          proctor_action: string
          proctor_snapshot_interval_sec: number
          proctored: boolean
          published_at: string | null
          published_by: string | null
          randomize: boolean
          results_release_at: string | null
          review_notes: string | null
          scheduled_at: string | null
          school_id: string
          show_answers_after_each: boolean
          status: Database["public"]["Enums"]["exam_status"]
          subject: string | null
          submitted_at: string | null
          submitted_by: string | null
          title: string
          violation_limit: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          auto_close_at?: string | null
          auto_publish_at?: string | null
          class_id?: string | null
          class_restrictions?: string[]
          counts_to_results?: boolean
          created_at?: string
          created_by: string
          duration_min?: number | null
          duration_minutes?: number
          id?: string
          mode?: Database["public"]["Enums"]["exam_mode"]
          proctor_action?: string
          proctor_snapshot_interval_sec?: number
          proctored?: boolean
          published_at?: string | null
          published_by?: string | null
          randomize?: boolean
          results_release_at?: string | null
          review_notes?: string | null
          scheduled_at?: string | null
          school_id: string
          show_answers_after_each?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          subject?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title: string
          violation_limit?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          auto_close_at?: string | null
          auto_publish_at?: string | null
          class_id?: string | null
          class_restrictions?: string[]
          counts_to_results?: boolean
          created_at?: string
          created_by?: string
          duration_min?: number | null
          duration_minutes?: number
          id?: string
          mode?: Database["public"]["Enums"]["exam_mode"]
          proctor_action?: string
          proctor_snapshot_interval_sec?: number
          proctored?: boolean
          published_at?: string | null
          published_by?: string | null
          randomize?: boolean
          results_release_at?: string | null
          review_notes?: string | null
          scheduled_at?: string | null
          school_id?: string
          show_answers_after_each?: boolean
          status?: Database["public"]["Enums"]["exam_status"]
          subject?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          title?: string
          violation_limit?: number
        }
        Relationships: [
          {
            foreignKeyName: "exams_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      fees: {
        Row: {
          amount: number
          created_at: string
          description: string
          due_date: string | null
          id: string
          school_id: string
          status: Database["public"]["Enums"]["fee_status"]
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          due_date?: string | null
          id?: string
          school_id: string
          status?: Database["public"]["Enums"]["fee_status"]
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          due_date?: string | null
          id?: string
          school_id?: string
          status?: Database["public"]["Enums"]["fee_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fees_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      gradebook_entries: {
        Row: {
          category: string
          class_id: string
          created_at: string
          id: string
          max_score: number
          recorded_at: string
          school_id: string
          score: number
          student_id: string
          subject: string
          teacher_id: string
          term: string
          title: string
        }
        Insert: {
          category?: string
          class_id: string
          created_at?: string
          id?: string
          max_score?: number
          recorded_at?: string
          school_id: string
          score?: number
          student_id: string
          subject: string
          teacher_id: string
          term?: string
          title: string
        }
        Update: {
          category?: string
          class_id?: string
          created_at?: string
          id?: string
          max_score?: number
          recorded_at?: string
          school_id?: string
          score?: number
          student_id?: string
          subject?: string
          teacher_id?: string
          term?: string
          title?: string
        }
        Relationships: []
      }
      grading_scales: {
        Row: {
          bands: Json
          created_at: string
          id: string
          is_default: boolean
          name: string
          school_id: string
          updated_at: string
        }
        Insert: {
          bands?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          school_id: string
          updated_at?: string
        }
        Update: {
          bands?: Json
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grading_scales_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      hostels: {
        Row: {
          capacity: number
          created_at: string
          gender: string | null
          id: string
          name: string
          occupied: number
          school_id: string
          warden: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          gender?: string | null
          id?: string
          name: string
          occupied?: number
          school_id: string
          warden?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          gender?: string | null
          id?: string
          name?: string
          occupied?: number
          school_id?: string
          warden?: string | null
        }
        Relationships: []
      }
      impersonation_sessions: {
        Row: {
          actions: Json
          created_at: string
          end_reason: string | null
          ended_at: string | null
          expires_at: string
          id: string
          reason: string
          school_id: string | null
          started_at: string
          super_admin_id: string
          target_role: string | null
          target_user_id: string
        }
        Insert: {
          actions?: Json
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at: string
          id?: string
          reason: string
          school_id?: string | null
          started_at?: string
          super_admin_id: string
          target_role?: string | null
          target_user_id: string
        }
        Update: {
          actions?: Json
          created_at?: string
          end_reason?: string | null
          ended_at?: string | null
          expires_at?: string
          id?: string
          reason?: string
          school_id?: string | null
          started_at?: string
          super_admin_id?: string
          target_role?: string | null
          target_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impersonation_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "impersonation_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_stars: {
        Row: {
          created_at: string
          id: string
          item_id: string
          item_type: string
          school_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          item_type: string
          school_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          item_type?: string
          school_id?: string
          user_id?: string
        }
        Relationships: []
      }
      invite_codes: {
        Row: {
          admin_slot: number | null
          assigned_to_user_id: string | null
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number
          metadata: Json
          revoked_at: string | null
          role: Database["public"]["Enums"]["member_role"]
          school_id: string
          uses: number
        }
        Insert: {
          admin_slot?: number | null
          assigned_to_user_id?: string | null
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          metadata?: Json
          revoked_at?: string | null
          role: Database["public"]["Enums"]["member_role"]
          school_id: string
          uses?: number
        }
        Update: {
          admin_slot?: number | null
          assigned_to_user_id?: string | null
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          metadata?: Json
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          school_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_redeem_attempts: {
        Row: {
          code: string
          created_at: string
          id: string
          success: boolean
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          success?: boolean
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          success?: boolean
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          amount_cents: number
          amount_kobo: number | null
          currency: string
          due_at: string | null
          id: string
          issued_at: string
          kind: string
          line_items: Json
          metadata: Json
          number: string
          paid_at: string | null
          paid_method: string | null
          paystack_authorization_url: string | null
          paystack_reference: string | null
          period_end: string | null
          period_start: string | null
          plan: string | null
          school_id: string
          status: string
        }
        Insert: {
          amount_cents: number
          amount_kobo?: number | null
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string
          kind?: string
          line_items?: Json
          metadata?: Json
          number: string
          paid_at?: string | null
          paid_method?: string | null
          paystack_authorization_url?: string | null
          paystack_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          school_id: string
          status?: string
        }
        Update: {
          amount_cents?: number
          amount_kobo?: number | null
          currency?: string
          due_at?: string | null
          id?: string
          issued_at?: string
          kind?: string
          line_items?: Json
          metadata?: Json
          number?: string
          paid_at?: string | null
          paid_method?: string | null
          paystack_authorization_url?: string | null
          paystack_reference?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          metadata: Json
          school_id: string
          token_count: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          metadata?: Json
          school_id: string
          token_count?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          metadata?: Json
          school_id?: string
          token_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          chunk_count: number
          class_id: string | null
          created_at: string
          curriculum: string | null
          error: string | null
          id: string
          metadata: Json
          mime_type: string | null
          school_id: string
          source_kind: string
          source_path: string | null
          status: string
          student_id: string | null
          subject_code: string | null
          title: string
          updated_at: string
          uploaded_by: string | null
          visibility: string
        }
        Insert: {
          chunk_count?: number
          class_id?: string | null
          created_at?: string
          curriculum?: string | null
          error?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          school_id: string
          source_kind?: string
          source_path?: string | null
          status?: string
          student_id?: string | null
          subject_code?: string | null
          title: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Update: {
          chunk_count?: number
          class_id?: string | null
          created_at?: string
          curriculum?: string | null
          error?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          school_id?: string
          source_kind?: string
          source_path?: string | null
          status?: string
          student_id?: string | null
          subject_code?: string | null
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_documents_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_notes: {
        Row: {
          admin_feedback: string | null
          content: string
          created_at: string
          duration_min: number | null
          grade_level: string | null
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string
          status: string
          subject: string | null
          teacher_id: string
          title: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          admin_feedback?: string | null
          content: string
          created_at?: string
          duration_min?: number | null
          grade_level?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id: string
          status?: string
          subject?: string | null
          teacher_id: string
          title: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          admin_feedback?: string | null
          content?: string
          created_at?: string
          duration_min?: number | null
          grade_level?: string | null
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string
          status?: string
          subject?: string | null
          teacher_id?: string
          title?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lesson_plans: {
        Row: {
          ai_job_id: string | null
          class_id: string | null
          content: string
          created_at: string
          curriculum: string | null
          duration_minutes: number
          grade_level: string | null
          id: string
          school_id: string
          status: string
          subject: string
          teacher_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          ai_job_id?: string | null
          class_id?: string | null
          content: string
          created_at?: string
          curriculum?: string | null
          duration_minutes?: number
          grade_level?: string | null
          id?: string
          school_id: string
          status?: string
          subject: string
          teacher_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          ai_job_id?: string | null
          class_id?: string | null
          content?: string
          created_at?: string
          curriculum?: string | null
          duration_minutes?: number
          grade_level?: string | null
          id?: string
          school_id?: string
          status?: string
          subject?: string
          teacher_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_ai_job_id_fkey"
            columns: ["ai_job_id"]
            isOneToOne: false
            referencedRelation: "ai_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      library_files: {
        Row: {
          category: string | null
          created_at: string
          id: string
          name: string
          school_id: string
          size_bytes: number | null
          storage_path: string
          uploaded_by: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
          size_bytes?: number | null
          storage_path: string
          uploaded_by: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
          size_bytes?: number | null
          storage_path?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_files_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_files_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "library_files_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      marking_rubrics: {
        Row: {
          created_at: string
          created_by: string | null
          criteria: Json
          id: string
          name: string
          school_id: string
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          id?: string
          name: string
          school_id: string
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          criteria?: Json
          id?: string
          name?: string
          school_id?: string
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marking_rubrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marking_rubrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marking_rubrics_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          admin_slot: number | null
          bio_completed: boolean
          created_at: string
          id: string
          must_change_pin: boolean
          profile_data: Json
          role: Database["public"]["Enums"]["member_role"]
          school_id: string
          status: string
          user_id: string
        }
        Insert: {
          admin_slot?: number | null
          bio_completed?: boolean
          created_at?: string
          id?: string
          must_change_pin?: boolean
          profile_data?: Json
          role: Database["public"]["Enums"]["member_role"]
          school_id: string
          status?: string
          user_id: string
        }
        Update: {
          admin_slot?: number | null
          bio_completed?: boolean
          created_at?: string
          id?: string
          must_change_pin?: boolean
          profile_data?: Json
          role?: Database["public"]["Enums"]["member_role"]
          school_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          school_id: string
          sender_id: string
        }
        Insert: {
          attachments?: Json
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          school_id: string
          sender_id: string
        }
        Update: {
          attachments?: Json
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          school_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_answers: {
        Row: {
          answered_at: string
          id: string
          marked_for_review: boolean
          question_id: string
          selected_index: number | null
          session_id: string
          subject_id: string
        }
        Insert: {
          answered_at?: string
          id?: string
          marked_for_review?: boolean
          question_id: string
          selected_index?: number | null
          session_id: string
          subject_id: string
        }
        Update: {
          answered_at?: string
          id?: string
          marked_for_review?: boolean
          question_id?: string
          selected_index?: number | null
          session_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_answers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_questions: {
        Row: {
          correct_index: number
          created_at: string
          explanation: string | null
          id: string
          options: Json
          position: number
          prompt: string
          school_id: string
          subject_id: string
        }
        Insert: {
          correct_index?: number
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          position?: number
          prompt: string
          school_id: string
          subject_id: string
        }
        Update: {
          correct_index?: number
          created_at?: string
          explanation?: string | null
          id?: string
          options?: Json
          position?: number
          prompt?: string
          school_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "mock_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_session_subjects: {
        Row: {
          answered_count: number
          id: string
          score: number
          session_id: string
          sort: number
          subject_id: string
        }
        Insert: {
          answered_count?: number
          id?: string
          score?: number
          session_id: string
          sort?: number
          subject_id: string
        }
        Update: {
          answered_count?: number
          id?: string
          score?: number
          session_id?: string
          sort?: number
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mock_session_subjects_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "mock_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mock_session_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "mock_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      mock_sessions: {
        Row: {
          ai_summary: Json | null
          duration_minutes: number
          fullscreen: boolean
          id: string
          integrity_events: Json
          integrity_score: number
          lockdown: boolean
          mode: string
          questions_per_subject: number
          school_id: string
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          total_questions: number | null
          total_score: number | null
        }
        Insert: {
          ai_summary?: Json | null
          duration_minutes?: number
          fullscreen?: boolean
          id?: string
          integrity_events?: Json
          integrity_score?: number
          lockdown?: boolean
          mode: string
          questions_per_subject?: number
          school_id: string
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          total_questions?: number | null
          total_score?: number | null
        }
        Update: {
          ai_summary?: Json | null
          duration_minutes?: number
          fullscreen?: boolean
          id?: string
          integrity_events?: Json
          integrity_score?: number
          lockdown?: boolean
          mode?: string
          questions_per_subject?: number
          school_id?: string
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          total_questions?: number | null
          total_score?: number | null
        }
        Relationships: []
      }
      mock_subjects: {
        Row: {
          code: string
          color: string
          created_at: string
          exam_body: string
          id: string
          name: string
          school_id: string
          sort: number
        }
        Insert: {
          code: string
          color?: string
          created_at?: string
          exam_body: string
          id?: string
          name: string
          school_id: string
          sort?: number
        }
        Update: {
          code?: string
          color?: string
          created_at?: string
          exam_body?: string
          id?: string
          name?: string
          school_id?: string
          sort?: number
        }
        Relationships: []
      }
      module_requests: {
        Row: {
          created_at: string
          description: string | null
          id: string
          module_id: string | null
          requested_by: string
          school_id: string
          status: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          module_id?: string | null
          requested_by: string
          school_id: string
          status?: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          module_id?: string | null
          requested_by?: string
          school_id?: string
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_requests_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_requests_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          category: string
          config_schema: Json
          created_at: string
          default_config: Json
          deleted_at: string | null
          description: string | null
          global_default: boolean
          icon: string | null
          id: string
          monthly_price_cents: number
          name: string
          pricing_model: string
          slug: string
          status: string
          term_price_kobo: number
          updated_at: string
          version: string
        }
        Insert: {
          category?: string
          config_schema?: Json
          created_at?: string
          default_config?: Json
          deleted_at?: string | null
          description?: string | null
          global_default?: boolean
          icon?: string | null
          id?: string
          monthly_price_cents?: number
          name: string
          pricing_model?: string
          slug: string
          status?: string
          term_price_kobo?: number
          updated_at?: string
          version?: string
        }
        Update: {
          category?: string
          config_schema?: Json
          created_at?: string
          default_config?: Json
          deleted_at?: string | null
          description?: string | null
          global_default?: boolean
          icon?: string | null
          id?: string
          monthly_price_cents?: number
          name?: string
          pricing_model?: string
          slug?: string
          status?: string
          term_price_kobo?: number
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      onboarding_events: {
        Row: {
          code_id: string | null
          created_at: string
          event: string
          id: string
          metadata: Json
          role: string | null
          school_id: string
          user_id: string | null
        }
        Insert: {
          code_id?: string | null
          created_at?: string
          event: string
          id?: string
          metadata?: Json
          role?: string | null
          school_id: string
          user_id?: string | null
        }
        Update: {
          code_id?: string | null
          created_at?: string
          event?: string
          id?: string
          metadata?: Json
          role?: string | null
          school_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "onboarding_events_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "invite_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "onboarding_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      page_views: {
        Row: {
          created_at: string
          device: string | null
          id: string
          path: string
          referrer: string | null
          school_id: string | null
          session_id: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          device?: string | null
          id?: string
          path: string
          referrer?: string | null
          school_id?: string | null
          session_id: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          device?: string | null
          id?: string
          path?: string
          referrer?: string | null
          school_id?: string | null
          session_id?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      parent_alerts: {
        Row: {
          ai_job_id: string | null
          approval_id: string | null
          created_at: string
          dedupe_key: string
          draft_message: string | null
          id: string
          kind: string
          parent_id: string | null
          school_id: string
          sent_at: string | null
          severity: string
          signal: Json
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          ai_job_id?: string | null
          approval_id?: string | null
          created_at?: string
          dedupe_key: string
          draft_message?: string | null
          id?: string
          kind: string
          parent_id?: string | null
          school_id: string
          sent_at?: string | null
          severity?: string
          signal?: Json
          status?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          ai_job_id?: string | null
          approval_id?: string | null
          created_at?: string
          dedupe_key?: string
          draft_message?: string | null
          id?: string
          kind?: string
          parent_id?: string | null
          school_id?: string
          sent_at?: string | null
          severity?: string
          signal?: Json
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_alerts_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_comms: {
        Row: {
          body: string
          created_at: string
          id: string
          parent_id: string
          read_at: string | null
          school_id: string
          student_id: string
          subject: string
          teacher_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          parent_id: string
          read_at?: string | null
          school_id: string
          student_id: string
          subject: string
          teacher_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          parent_id?: string
          read_at?: string | null
          school_id?: string
          student_id?: string
          subject?: string
          teacher_id?: string
        }
        Relationships: []
      }
      parent_links: {
        Row: {
          can_pickup: boolean
          created_at: string
          id: string
          is_primary: boolean
          parent_user_id: string
          phone_e164: string | null
          receives_attendance: boolean
          receives_behavior: boolean
          receives_fees: boolean
          receives_results: boolean
          relationship: string
          school_id: string
          student_user_id: string
        }
        Insert: {
          can_pickup?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_user_id: string
          phone_e164?: string | null
          receives_attendance?: boolean
          receives_behavior?: boolean
          receives_fees?: boolean
          receives_results?: boolean
          relationship?: string
          school_id: string
          student_user_id: string
        }
        Update: {
          can_pickup?: boolean
          created_at?: string
          id?: string
          is_primary?: boolean
          parent_user_id?: string
          phone_e164?: string | null
          receives_attendance?: boolean
          receives_behavior?: boolean
          receives_fees?: boolean
          receives_results?: boolean
          relationship?: string
          school_id?: string
          student_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_links_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_plans: {
        Row: {
          amount_kobo: number
          created_at: string
          due_date: string | null
          id: string
          installment_no: number
          invoice_id: string
          status: Database["public"]["Enums"]["invoice_status"]
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_no: number
          invoice_id: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          due_date?: string | null
          id?: string
          installment_no?: number
          invoice_id?: string
          status?: Database["public"]["Enums"]["invoice_status"]
        }
        Relationships: [
          {
            foreignKeyName: "payment_plans_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "school_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_types: {
        Row: {
          active: boolean
          allow_partial: boolean
          audience: Database["public"]["Enums"]["payment_audience"]
          category: Database["public"]["Enums"]["payment_category"]
          class_id: string | null
          code: string | null
          created_at: string
          created_by: string | null
          currency: string
          default_amount_kobo: number
          description: string | null
          due_date: string | null
          id: string
          late_fee_kobo: number
          level: string | null
          mandatory: boolean
          name: string
          recurrence: Database["public"]["Enums"]["payment_recurrence"]
          school_id: string
          session: string | null
          term: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          allow_partial?: boolean
          audience?: Database["public"]["Enums"]["payment_audience"]
          category?: Database["public"]["Enums"]["payment_category"]
          class_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_amount_kobo?: number
          description?: string | null
          due_date?: string | null
          id?: string
          late_fee_kobo?: number
          level?: string | null
          mandatory?: boolean
          name: string
          recurrence?: Database["public"]["Enums"]["payment_recurrence"]
          school_id: string
          session?: string | null
          term?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          allow_partial?: boolean
          audience?: Database["public"]["Enums"]["payment_audience"]
          category?: Database["public"]["Enums"]["payment_category"]
          class_id?: string | null
          code?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          default_amount_kobo?: number
          description?: string | null
          due_date?: string | null
          id?: string
          late_fee_kobo?: number
          level?: string | null
          mandatory?: boolean
          name?: string
          recurrence?: Database["public"]["Enums"]["payment_recurrence"]
          school_id?: string
          session?: string | null
          term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_types_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_pricing: {
        Row: {
          extra_student_kobo: number
          included_students: number
          label: string
          plan: string
          sort_order: number
          term_price_kobo: number
          updated_at: string
        }
        Insert: {
          extra_student_kobo?: number
          included_students?: number
          label: string
          plan: string
          sort_order?: number
          term_price_kobo?: number
          updated_at?: string
        }
        Update: {
          extra_student_kobo?: number
          included_students?: number
          label?: string
          plan?: string
          sort_order?: number
          term_price_kobo?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_announcements: {
        Row: {
          audience: string
          body: string
          created_at: string
          created_by: string
          deleted_at: string | null
          id: string
          priority: string
          scheduled_for: string | null
          target: Json
          title: string
        }
        Insert: {
          audience?: string
          body: string
          created_at?: string
          created_by: string
          deleted_at?: string | null
          id?: string
          priority?: string
          scheduled_for?: string | null
          target?: Json
          title: string
        }
        Update: {
          audience?: string
          body?: string
          created_at?: string
          created_by?: string
          deleted_at?: string | null
          id?: string
          priority?: string
          scheduled_for?: string | null
          target?: Json
          title?: string
        }
        Relationships: []
      }
      platform_audit: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          ip: string | null
          payload: Json
          school_id: string | null
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
          ip?: string | null
          payload?: Json
          school_id?: string | null
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          ip?: string | null
          payload?: Json
          school_id?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          brand: Json
          id: number
          integrations: Json
          maintenance_message: string | null
          maintenance_mode: boolean
          smtp: Json
          updated_at: string
        }
        Insert: {
          brand?: Json
          id?: number
          integrations?: Json
          maintenance_message?: string | null
          maintenance_mode?: boolean
          smtp?: Json
          updated_at?: string
        }
        Update: {
          brand?: Json
          id?: number
          integrations?: Json
          maintenance_message?: string | null
          maintenance_mode?: boolean
          smtp?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          created_at: string
          dob: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: []
      }
      promotion_rules: {
        Row: {
          core_subjects: string[]
          created_at: string
          extra: Json
          id: string
          min_attendance_pct: number
          min_average: number
          school_id: string
          updated_at: string
        }
        Insert: {
          core_subjects?: string[]
          created_at?: string
          extra?: Json
          id?: string
          min_attendance_pct?: number
          min_average?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          core_subjects?: string[]
          created_at?: string
          extra?: Json
          id?: string
          min_attendance_pct?: number
          min_average?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "promotion_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "promotion_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      question_bank: {
        Row: {
          answer: Json | null
          approval_status: string
          body: string
          created_at: string
          created_by: string
          difficulty: string
          explanation: string | null
          id: string
          options: Json
          parent_id: string | null
          school_id: string
          subject: string
          topic: string | null
          type: string
          updated_at: string
          version: number
        }
        Insert: {
          answer?: Json | null
          approval_status?: string
          body: string
          created_at?: string
          created_by: string
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json
          parent_id?: string | null
          school_id: string
          subject: string
          topic?: string | null
          type?: string
          updated_at?: string
          version?: number
        }
        Update: {
          answer?: Json | null
          approval_status?: string
          body?: string
          created_at?: string
          created_by?: string
          difficulty?: string
          explanation?: string | null
          id?: string
          options?: Json
          parent_id?: string | null
          school_id?: string
          subject?: string
          topic?: string | null
          type?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      question_bank_versions: {
        Row: {
          created_at: string
          edited_by: string | null
          id: string
          question_id: string
          school_id: string
          snapshot: Json
          version: number
        }
        Insert: {
          created_at?: string
          edited_by?: string | null
          id?: string
          question_id: string
          school_id: string
          snapshot: Json
          version: number
        }
        Update: {
          created_at?: string
          edited_by?: string | null
          id?: string
          question_id?: string
          school_id?: string
          snapshot?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_versions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      question_banks: {
        Row: {
          created_at: string
          exam_body: Database["public"]["Enums"]["exam_body"]
          id: string
          managed_by: string | null
          name: string
          school_id: string | null
          scope: Database["public"]["Enums"]["bank_scope"]
          subject_code: string | null
        }
        Insert: {
          created_at?: string
          exam_body?: Database["public"]["Enums"]["exam_body"]
          id?: string
          managed_by?: string | null
          name: string
          school_id?: string | null
          scope?: Database["public"]["Enums"]["bank_scope"]
          subject_code?: string | null
        }
        Update: {
          created_at?: string
          exam_body?: Database["public"]["Enums"]["exam_body"]
          id?: string
          managed_by?: string | null
          name?: string
          school_id?: string | null
          scope?: Database["public"]["Enums"]["bank_scope"]
          subject_code?: string | null
        }
        Relationships: []
      }
      question_tags: {
        Row: {
          id: string
          question_id: string
          tag: string
        }
        Insert: {
          id?: string
          question_id: string
          tag: string
        }
        Update: {
          id?: string
          question_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_tags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "question_bank"
            referencedColumns: ["id"]
          },
        ]
      }
      questions_v2: {
        Row: {
          ai_generated: boolean
          approved_at: string | null
          approved_by: string | null
          assessment_id: string | null
          bank_id: string | null
          correct: Json
          created_at: string
          created_by: string | null
          difficulty: Database["public"]["Enums"]["question_difficulty"]
          exam_body: Database["public"]["Enums"]["exam_body"] | null
          explanation: string | null
          id: string
          media: Json
          options: Json
          points: number
          prompt: string
          school_id: string | null
          section_id: string | null
          subject_code: string | null
          topic: string | null
          type: Database["public"]["Enums"]["question_type"]
          year: number | null
        }
        Insert: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          assessment_id?: string | null
          bank_id?: string | null
          correct?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          exam_body?: Database["public"]["Enums"]["exam_body"] | null
          explanation?: string | null
          id?: string
          media?: Json
          options?: Json
          points?: number
          prompt: string
          school_id?: string | null
          section_id?: string | null
          subject_code?: string | null
          topic?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          year?: number | null
        }
        Update: {
          ai_generated?: boolean
          approved_at?: string | null
          approved_by?: string | null
          assessment_id?: string | null
          bank_id?: string | null
          correct?: Json
          created_at?: string
          created_by?: string | null
          difficulty?: Database["public"]["Enums"]["question_difficulty"]
          exam_body?: Database["public"]["Enums"]["exam_body"] | null
          explanation?: string | null
          id?: string
          media?: Json
          options?: Json
          points?: number
          prompt?: string
          school_id?: string | null
          section_id?: string | null
          subject_code?: string | null
          topic?: string | null
          type?: Database["public"]["Enums"]["question_type"]
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "questions_v2_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_v2_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "student_assessments_v"
            referencedColumns: ["assessment_id"]
          },
          {
            foreignKeyName: "questions_v2_bank_id_fkey"
            columns: ["bank_id"]
            isOneToOne: false
            referencedRelation: "question_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questions_v2_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "assessment_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          count: number
          created_at: string
          id: string
          key: string
          school_id: string | null
          updated_at: string
          user_id: string | null
          window_start: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          key: string
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          key?: string
          school_id?: string | null
          updated_at?: string
          user_id?: string | null
          window_start?: string
        }
        Relationships: []
      }
      result_release_rules: {
        Row: {
          approval_chain: string[]
          auto_release_at: string | null
          created_at: string
          id: string
          pin_price_kobo: number
          pin_required: boolean
          requires_approval: boolean
          school_id: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          approval_chain?: string[]
          auto_release_at?: string | null
          created_at?: string
          id?: string
          pin_price_kobo?: number
          pin_required?: boolean
          requires_approval?: boolean
          school_id: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          approval_chain?: string[]
          auto_release_at?: string | null
          created_at?: string
          id?: string
          pin_price_kobo?: number
          pin_required?: boolean
          requires_approval?: boolean
          school_id?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_release_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_release_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "result_release_rules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      result_verifications: {
        Row: {
          created_at: string
          id: string
          issued_by: string | null
          school_id: string
          session: string | null
          snapshot: Json
          student_id: string
          term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          issued_by?: string | null
          school_id: string
          session?: string | null
          snapshot: Json
          student_id: string
          term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          issued_by?: string | null
          school_id?: string
          session?: string | null
          snapshot?: Json
          student_id?: string
          term?: string | null
        }
        Relationships: []
      }
      results: {
        Row: {
          assignment_score: number | null
          breakdown: Json
          ca_score: number | null
          class_id: string | null
          created_at: string
          exam_score: number | null
          grade: string | null
          id: string
          published_at: string | null
          published_by: string | null
          remarks: string | null
          report_score: number | null
          school_id: string
          score: number
          session: string | null
          student_id: string
          subject: string
          teacher_id: string | null
          term: string
          updated_at: string
        }
        Insert: {
          assignment_score?: number | null
          breakdown?: Json
          ca_score?: number | null
          class_id?: string | null
          created_at?: string
          exam_score?: number | null
          grade?: string | null
          id?: string
          published_at?: string | null
          published_by?: string | null
          remarks?: string | null
          report_score?: number | null
          school_id: string
          score: number
          session?: string | null
          student_id: string
          subject: string
          teacher_id?: string | null
          term?: string
          updated_at?: string
        }
        Update: {
          assignment_score?: number | null
          breakdown?: Json
          ca_score?: number | null
          class_id?: string | null
          created_at?: string
          exam_score?: number | null
          grade?: string | null
          id?: string
          published_at?: string | null
          published_by?: string | null
          remarks?: string | null
          report_score?: number | null
          school_id?: string
          score?: number
          session?: string | null
          student_id?: string
          subject?: string
          teacher_id?: string | null
          term?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_academic_structure: {
        Row: {
          activated_at: string
          created_at: string
          school_id: string
          settings: Json
          template_code: string
          updated_at: string
        }
        Insert: {
          activated_at?: string
          created_at?: string
          school_id: string
          settings?: Json
          template_code: string
          updated_at?: string
        }
        Update: {
          activated_at?: string
          created_at?: string
          school_id?: string
          settings?: Json
          template_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_academic_structure_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_academic_structure_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_academic_structure_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_academic_structure_template_code_fkey"
            columns: ["template_code"]
            isOneToOne: false
            referencedRelation: "academic_templates"
            referencedColumns: ["code"]
          },
        ]
      }
      school_ai_quotas: {
        Row: {
          cost_used_usd: number
          enabled: boolean
          monthly_cost_cap_usd: number
          monthly_token_cap: number
          period_start: string
          school_id: string
          tokens_used: number
          updated_at: string
        }
        Insert: {
          cost_used_usd?: number
          enabled?: boolean
          monthly_cost_cap_usd?: number
          monthly_token_cap?: number
          period_start?: string
          school_id: string
          tokens_used?: number
          updated_at?: string
        }
        Update: {
          cost_used_usd?: number
          enabled?: boolean
          monthly_cost_cap_usd?: number
          monthly_token_cap?: number
          period_start?: string
          school_id?: string
          tokens_used?: number
          updated_at?: string
        }
        Relationships: []
      }
      school_custom_roles: {
        Row: {
          base_role: string
          created_at: string
          deleted_at: string | null
          enabled: boolean
          id: string
          key: string
          label: string
          school_id: string
          updated_at: string
        }
        Insert: {
          base_role: string
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          key: string
          label: string
          school_id: string
          updated_at?: string
        }
        Update: {
          base_role?: string
          created_at?: string
          deleted_at?: string | null
          enabled?: boolean
          id?: string
          key?: string
          label?: string
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_custom_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_custom_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_custom_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_invoices: {
        Row: {
          amount_due_kobo: number
          amount_paid_kobo: number
          currency: string
          due_date: string | null
          id: string
          issued_at: string
          issued_by: string | null
          notes: string | null
          payment_type_id: string | null
          school_id: string
          session: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term: string | null
          updated_at: string
        }
        Insert: {
          amount_due_kobo: number
          amount_paid_kobo?: number
          currency?: string
          due_date?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          payment_type_id?: string | null
          school_id: string
          session?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          term?: string | null
          updated_at?: string
        }
        Update: {
          amount_due_kobo?: number
          amount_paid_kobo?: number
          currency?: string
          due_date?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          notes?: string | null
          payment_type_id?: string | null
          school_id?: string
          session?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_invoices_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_invoices_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_modules: {
        Row: {
          beta: boolean
          config: Json
          enabled: boolean
          enabled_at: string
          expires_at: string | null
          id: string
          module_id: string
          school_id: string
          term_price_kobo_override: number | null
        }
        Insert: {
          beta?: boolean
          config?: Json
          enabled?: boolean
          enabled_at?: string
          expires_at?: string | null
          id?: string
          module_id: string
          school_id: string
          term_price_kobo_override?: number | null
        }
        Update: {
          beta?: boolean
          config?: Json
          enabled?: boolean
          enabled_at?: string
          expires_at?: string | null
          id?: string
          module_id?: string
          school_id?: string
          term_price_kobo_override?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "school_modules_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_modules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_modules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_modules_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_payment_settings: {
        Row: {
          account_name: string | null
          account_number: string | null
          auto_late_fee: boolean
          bank_name: string | null
          grace_days: number
          paystack_subaccount_code: string | null
          receipt_footer: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          account_name?: string | null
          account_number?: string | null
          auto_late_fee?: boolean
          bank_name?: string | null
          grace_days?: number
          paystack_subaccount_code?: string | null
          receipt_footer?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          account_name?: string | null
          account_number?: string | null
          auto_late_fee?: boolean
          bank_name?: string | null
          grace_days?: number
          paystack_subaccount_code?: string | null
          receipt_footer?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_payment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payment_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      school_payments: {
        Row: {
          amount_kobo: number
          created_at: string
          currency: string
          id: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes: string | null
          paid_at: string | null
          payer_user_id: string | null
          proof_url: string | null
          provider_payload: Json | null
          provider_reference: string | null
          recorded_by: string | null
          school_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Insert: {
          amount_kobo: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id: string
          method: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          payer_user_id?: string | null
          proof_url?: string | null
          provider_payload?: Json | null
          provider_reference?: string | null
          recorded_by?: string | null
          school_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id: string
        }
        Update: {
          amount_kobo?: number
          created_at?: string
          currency?: string
          id?: string
          invoice_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          notes?: string | null
          paid_at?: string | null
          payer_user_id?: string | null
          proof_url?: string | null
          provider_payload?: Json | null
          provider_reference?: string | null
          recorded_by?: string | null
          school_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "school_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_payments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          billing_cycle: string
          branding: Json
          created_at: string
          created_by: string
          currency: string
          current_session: string | null
          current_term: string | null
          deleted_at: string | null
          email: string | null
          exams_violation_limit: number
          extra_student_kobo: number | null
          grading_system: string | null
          id: string
          included_students: number | null
          logo_url: string | null
          motto: string | null
          name: string
          neco_subject_codes: Json
          phone: string | null
          pilot_alerts_sent: Json
          pilot_converted_at: string | null
          pilot_ends_at: string | null
          pilot_premium_until: string | null
          pilot_started_at: string | null
          pilot_status: string
          plan: Database["public"]["Enums"]["school_plan"]
          plan_expires_at: string | null
          plan_started_at: string
          platform_notice: string | null
          proctoring_default: boolean
          report_theme: Json
          resumption_date: string | null
          settings: Json
          slug: string
          status: Database["public"]["Enums"]["school_status"]
          student_count: number
          suspended_reason: string | null
          term_ends_at: string | null
          term_starts_at: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          billing_cycle?: string
          branding?: Json
          created_at?: string
          created_by: string
          currency?: string
          current_session?: string | null
          current_term?: string | null
          deleted_at?: string | null
          email?: string | null
          exams_violation_limit?: number
          extra_student_kobo?: number | null
          grading_system?: string | null
          id?: string
          included_students?: number | null
          logo_url?: string | null
          motto?: string | null
          name: string
          neco_subject_codes?: Json
          phone?: string | null
          pilot_alerts_sent?: Json
          pilot_converted_at?: string | null
          pilot_ends_at?: string | null
          pilot_premium_until?: string | null
          pilot_started_at?: string | null
          pilot_status?: string
          plan?: Database["public"]["Enums"]["school_plan"]
          plan_expires_at?: string | null
          plan_started_at?: string
          platform_notice?: string | null
          proctoring_default?: boolean
          report_theme?: Json
          resumption_date?: string | null
          settings?: Json
          slug: string
          status?: Database["public"]["Enums"]["school_status"]
          student_count?: number
          suspended_reason?: string | null
          term_ends_at?: string | null
          term_starts_at?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          billing_cycle?: string
          branding?: Json
          created_at?: string
          created_by?: string
          currency?: string
          current_session?: string | null
          current_term?: string | null
          deleted_at?: string | null
          email?: string | null
          exams_violation_limit?: number
          extra_student_kobo?: number | null
          grading_system?: string | null
          id?: string
          included_students?: number | null
          logo_url?: string | null
          motto?: string | null
          name?: string
          neco_subject_codes?: Json
          phone?: string | null
          pilot_alerts_sent?: Json
          pilot_converted_at?: string | null
          pilot_ends_at?: string | null
          pilot_premium_until?: string | null
          pilot_started_at?: string | null
          pilot_status?: string
          plan?: Database["public"]["Enums"]["school_plan"]
          plan_expires_at?: string | null
          plan_started_at?: string
          platform_notice?: string | null
          proctoring_default?: boolean
          report_theme?: Json
          resumption_date?: string | null
          settings?: Json
          slug?: string
          status?: Database["public"]["Enums"]["school_status"]
          student_count?: number
          suspended_reason?: string | null
          term_ends_at?: string | null
          term_starts_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      security_events: {
        Row: {
          created_at: string
          detail: Json
          id: string
          ip: string | null
          school_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          school_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json
          id?: string
          ip?: string | null
          school_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      student_subjects: {
        Row: {
          created_at: string
          id: string
          school_id: string
          session: string | null
          status: string
          student_id: string
          subject_id: string
          term: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          session?: string | null
          status?: string
          student_id: string
          subject_id: string
          term?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          session?: string | null
          status?: string
          student_id?: string
          subject_id?: string
          term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      student_topic_mastery: {
        Row: {
          attempts: number
          correct: number
          ema_mastery: number
          id: string
          last_attempt_at: string | null
          school_id: string
          student_id: string
          subject_code: string | null
          topic: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          correct?: number
          ema_mastery?: number
          id?: string
          last_attempt_at?: string | null
          school_id: string
          student_id: string
          subject_code?: string | null
          topic: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          correct?: number
          ema_mastery?: number
          id?: string
          last_attempt_at?: string | null
          school_id?: string
          student_id?: string
          subject_code?: string | null
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      subject_arm_assignments: {
        Row: {
          arm_id: string
          created_at: string
          id: string
          is_required: boolean
          school_id: string
          subject_id: string
        }
        Insert: {
          arm_id: string
          created_at?: string
          id?: string
          is_required?: boolean
          school_id: string
          subject_id: string
        }
        Update: {
          arm_id?: string
          created_at?: string
          id?: string
          is_required?: boolean
          school_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_arm_assignments_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "academic_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_arm_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_arm_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_arm_assignments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_arm_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          class_id: string | null
          code: string | null
          created_at: string
          id: string
          name: string
          school_id: string
        }
        Insert: {
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name: string
          school_id: string
        }
        Update: {
          class_id?: string | null
          code?: string | null
          created_at?: string
          id?: string
          name?: string
          school_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          last_invoice_id: string | null
          monthly_amount_cents: number
          paystack_reference: string | null
          period_start: string | null
          plan: Database["public"]["Enums"]["school_plan"]
          school_id: string
          started_at: string
          status: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_invoice_id?: string | null
          monthly_amount_cents?: number
          paystack_reference?: string | null
          period_start?: string | null
          plan: Database["public"]["Enums"]["school_plan"]
          school_id: string
          started_at?: string
          status?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          last_invoice_id?: string | null
          monthly_amount_cents?: number
          paystack_reference?: string | null
          period_start?: string | null
          plan?: Database["public"]["Enums"]["school_plan"]
          school_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          author: string
          body: string
          created_at: string
          id: string
          internal: boolean
          ticket_id: string
        }
        Insert: {
          author: string
          body: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id: string
        }
        Update: {
          author?: string
          body?: string
          created_at?: string
          id?: string
          internal?: boolean
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_categories: {
        Row: {
          created_at: string
          default_assignee: string | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          school_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_assignee?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          school_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_assignee?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          school_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      support_tickets: {
        Row: {
          assignee: string | null
          created_at: string
          id: string
          opened_by: string
          priority: string
          school_id: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assignee?: string | null
          created_at?: string
          id?: string
          opened_by: string
          priority?: string
          school_id?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assignee?: string | null
          created_at?: string
          id?: string
          opened_by?: string
          priority?: string
          school_id?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_subject_arm: {
        Row: {
          arm_id: string
          created_at: string
          id: string
          role: string
          school_id: string
          subject_id: string
          teacher_user_id: string
        }
        Insert: {
          arm_id: string
          created_at?: string
          id?: string
          role?: string
          school_id: string
          subject_id: string
          teacher_user_id: string
        }
        Update: {
          arm_id?: string
          created_at?: string
          id?: string
          role?: string
          school_id?: string
          subject_id?: string
          teacher_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_subject_arm_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "academic_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_arm_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_arm_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_arm_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_subject_arm_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      term_grade_weights: {
        Row: {
          assignment_pct: number
          ca_pct: number
          exam_pct: number
          passing_pct: number
          report_pct: number
          school_id: string
          updated_at: string
        }
        Insert: {
          assignment_pct?: number
          ca_pct?: number
          exam_pct?: number
          passing_pct?: number
          report_pct?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          assignment_pct?: number
          ca_pct?: number
          exam_pct?: number
          passing_pct?: number
          report_pct?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "term_grade_weights_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_grade_weights_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "term_grade_weights_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      timetable: {
        Row: {
          class_id: string
          created_at: string
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          school_id: string
          start_time: string
          subject: string
          teacher_id: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          school_id: string
          start_time: string
          subject: string
          teacher_id?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          school_id?: string
          start_time?: string
          subject?: string
          teacher_id?: string | null
        }
        Relationships: []
      }
      trad_exam_answers: {
        Row: {
          attempt_id: string
          created_at: string
          feedback: string | null
          graded_at: string | null
          graded_by: string | null
          id: string
          is_correct: boolean | null
          marks_awarded: number | null
          question_id: string
          school_id: string
          selected_index: number | null
          text_answer: string | null
          updated_at: string
        }
        Insert: {
          attempt_id: string
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id: string
          school_id: string
          selected_index?: number | null
          text_answer?: string | null
          updated_at?: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          feedback?: string | null
          graded_at?: string | null
          graded_by?: string | null
          id?: string
          is_correct?: boolean | null
          marks_awarded?: number | null
          question_id?: string
          school_id?: string
          selected_index?: number | null
          text_answer?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "trad_exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "trad_exam_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exam_attempts: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          integrity_events: Json
          max_score: number | null
          mcq_score: number | null
          percentage: number | null
          school_id: string
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
          theory_score: number | null
          total_score: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          integrity_events?: Json
          max_score?: number | null
          mcq_score?: number | null
          percentage?: number | null
          school_id: string
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
          theory_score?: number | null
          total_score?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          integrity_events?: Json
          max_score?: number | null
          mcq_score?: number | null
          percentage?: number | null
          school_id?: string
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
          theory_score?: number | null
          total_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_attempts_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "trad_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exam_questions: {
        Row: {
          ai_generated: boolean
          correct_index: number | null
          created_at: string
          exam_id: string
          explanation: string | null
          id: string
          image_path: string | null
          marks: number
          model_answer: string | null
          options: Json | null
          position: number
          prompt: string
          school_id: string
          section_id: string | null
          type: Database["public"]["Enums"]["trad_question_type"]
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          correct_index?: number | null
          created_at?: string
          exam_id: string
          explanation?: string | null
          id?: string
          image_path?: string | null
          marks?: number
          model_answer?: string | null
          options?: Json | null
          position?: number
          prompt: string
          school_id: string
          section_id?: string | null
          type: Database["public"]["Enums"]["trad_question_type"]
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          correct_index?: number | null
          created_at?: string
          exam_id?: string
          explanation?: string | null
          id?: string
          image_path?: string | null
          marks?: number
          model_answer?: string | null
          options?: Json | null
          position?: number
          prompt?: string
          school_id?: string
          section_id?: string | null
          type?: Database["public"]["Enums"]["trad_question_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_questions_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "trad_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_questions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "trad_exam_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exam_results: {
        Row: {
          attempt_id: string
          created_at: string
          exam_id: string
          forwarded_by: string | null
          forwarded_to_admin_at: string | null
          grade: string | null
          id: string
          max_score: number | null
          mcq_score: number | null
          percentage: number | null
          released_at: string | null
          scheduled_release_at: string | null
          school_id: string
          status: string
          student_id: string
          theory_score: number | null
          total_score: number | null
          updated_at: string
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          exam_id: string
          forwarded_by?: string | null
          forwarded_to_admin_at?: string | null
          grade?: string | null
          id?: string
          max_score?: number | null
          mcq_score?: number | null
          percentage?: number | null
          released_at?: string | null
          scheduled_release_at?: string | null
          school_id: string
          status?: string
          student_id: string
          theory_score?: number | null
          total_score?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          exam_id?: string
          forwarded_by?: string | null
          forwarded_to_admin_at?: string | null
          grade?: string | null
          id?: string
          max_score?: number | null
          mcq_score?: number | null
          percentage?: number | null
          released_at?: string | null
          scheduled_release_at?: string | null
          school_id?: string
          status?: string
          student_id?: string
          theory_score?: number | null
          total_score?: number | null
          updated_at?: string
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_results_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: true
            referencedRelation: "trad_exam_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "trad_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exam_sections: {
        Row: {
          created_at: string
          exam_id: string
          id: string
          instructions: string | null
          label: string
          position: number
          school_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          exam_id: string
          id?: string
          instructions?: string | null
          label: string
          position?: number
          school_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          exam_id?: string
          id?: string
          instructions?: string | null
          label?: string
          position?: number
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_sections_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "trad_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_sections_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exam_sessions: {
        Row: {
          academic_year: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          name: string
          school_id: string
          start_date: string | null
          status: Database["public"]["Enums"]["trad_session_status"]
          term: string | null
          updated_at: string
        }
        Insert: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name: string
          school_id: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trad_session_status"]
          term?: string | null
          updated_at?: string
        }
        Update: {
          academic_year?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          name?: string
          school_id?: string
          start_date?: string | null
          status?: Database["public"]["Enums"]["trad_session_status"]
          term?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exam_timetable: {
        Row: {
          class_id: string
          coordinator_name: string | null
          created_at: string
          created_by: string | null
          duration_minutes: number
          exam_date: string
          id: string
          invigilator_name: string | null
          notes: string | null
          school_id: string
          session_id: string
          start_time: string
          status: Database["public"]["Enums"]["trad_timetable_status"]
          subject_id: string | null
          subject_name: string | null
          updated_at: string
          venue: string | null
        }
        Insert: {
          class_id: string
          coordinator_name?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          exam_date: string
          id?: string
          invigilator_name?: string | null
          notes?: string | null
          school_id: string
          session_id: string
          start_time: string
          status?: Database["public"]["Enums"]["trad_timetable_status"]
          subject_id?: string | null
          subject_name?: string | null
          updated_at?: string
          venue?: string | null
        }
        Update: {
          class_id?: string
          coordinator_name?: string | null
          created_at?: string
          created_by?: string | null
          duration_minutes?: number
          exam_date?: string
          id?: string
          invigilator_name?: string | null
          notes?: string | null
          school_id?: string
          session_id?: string
          start_time?: string
          status?: Database["public"]["Enums"]["trad_timetable_status"]
          subject_id?: string | null
          subject_name?: string | null
          updated_at?: string
          venue?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_timetable_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_timetable_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_timetable_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_timetable_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_timetable_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "trad_exam_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_timetable_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exam_uploads: {
        Row: {
          created_at: string
          error: string | null
          exam_id: string
          file_name: string | null
          file_path: string
          id: string
          mime: string | null
          parse_meta: Json
          school_id: string
          status: Database["public"]["Enums"]["trad_upload_status"]
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          exam_id: string
          file_name?: string | null
          file_path: string
          id?: string
          mime?: string | null
          parse_meta?: Json
          school_id: string
          status?: Database["public"]["Enums"]["trad_upload_status"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          exam_id?: string
          file_name?: string | null
          file_path?: string
          id?: string
          mime?: string | null
          parse_meta?: Json
          school_id?: string
          status?: Database["public"]["Enums"]["trad_upload_status"]
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trad_exam_uploads_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "trad_exams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_uploads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_uploads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exam_uploads_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_exams: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          author_id: string | null
          created_at: string
          draft_status: Database["public"]["Enums"]["trad_draft_status"]
          exam_type: Database["public"]["Enums"]["trad_exam_type"]
          id: string
          instructions: string | null
          published_at: string | null
          published_by: string | null
          rejection_reason: string | null
          review_notes: string | null
          school_id: string
          submitted_at: string | null
          submitted_by: string | null
          timetable_id: string | null
          title: string
          total_marks: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string | null
          created_at?: string
          draft_status?: Database["public"]["Enums"]["trad_draft_status"]
          exam_type?: Database["public"]["Enums"]["trad_exam_type"]
          id?: string
          instructions?: string | null
          published_at?: string | null
          published_by?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          school_id: string
          submitted_at?: string | null
          submitted_by?: string | null
          timetable_id?: string | null
          title: string
          total_marks?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          author_id?: string | null
          created_at?: string
          draft_status?: Database["public"]["Enums"]["trad_draft_status"]
          exam_type?: Database["public"]["Enums"]["trad_exam_type"]
          id?: string
          instructions?: string | null
          published_at?: string | null
          published_by?: string | null
          rejection_reason?: string | null
          review_notes?: string | null
          school_id?: string
          submitted_at?: string | null
          submitted_by?: string | null
          timetable_id?: string | null
          title?: string
          total_marks?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exams_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_exams_timetable_id_fkey"
            columns: ["timetable_id"]
            isOneToOne: true
            referencedRelation: "trad_exam_timetable"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_result_unlocks: {
        Row: {
          card_id: string
          id: string
          result_id: string
          school_id: string
          unlocked_at: string
          unlocked_by: string
        }
        Insert: {
          card_id: string
          id?: string
          result_id: string
          school_id: string
          unlocked_at?: string
          unlocked_by: string
        }
        Update: {
          card_id?: string
          id?: string
          result_id?: string
          school_id?: string
          unlocked_at?: string
          unlocked_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_result_unlocks_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "trad_scratch_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_result_unlocks_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "trad_exam_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_result_unlocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_result_unlocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_result_unlocks_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_scratch_batches: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number
          name: string
          price_kobo: number
          quantity: number
          school_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          name: string
          price_kobo: number
          quantity: number
          school_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number
          name?: string
          price_kobo?: number
          quantity?: number
          school_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_scratch_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_batches_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_scratch_cards: {
        Row: {
          batch_id: string
          buyer_user_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          max_uses: number
          pin_hash: string
          school_id: string
          serial: string
          sold_at: string | null
          status: string
          updated_at: string
          use_count: number
        }
        Insert: {
          batch_id: string
          buyer_user_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          pin_hash: string
          school_id: string
          serial: string
          sold_at?: string | null
          status?: string
          updated_at?: string
          use_count?: number
        }
        Update: {
          batch_id?: string
          buyer_user_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          max_uses?: number
          pin_hash?: string
          school_id?: string
          serial?: string
          sold_at?: string | null
          status?: string
          updated_at?: string
          use_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "trad_scratch_cards_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "trad_scratch_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_cards_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      trad_scratch_purchases: {
        Row: {
          amount_kobo: number
          batch_id: string
          buyer_user_id: string
          card_id: string | null
          created_at: string
          currency: string
          id: string
          paid_at: string | null
          paystack_reference: string | null
          school_id: string
          status: string
        }
        Insert: {
          amount_kobo: number
          batch_id: string
          buyer_user_id: string
          card_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          paystack_reference?: string | null
          school_id: string
          status?: string
        }
        Update: {
          amount_kobo?: number
          batch_id?: string
          buyer_user_id?: string
          card_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          paid_at?: string | null
          paystack_reference?: string | null
          school_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "trad_scratch_purchases_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "trad_scratch_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_purchases_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "trad_scratch_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_purchases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_purchases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trad_scratch_purchases_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_buses: {
        Row: {
          active: boolean
          capacity: number | null
          created_at: string
          driver_name: string | null
          driver_phone: string | null
          driver_user_id: string | null
          id: string
          name: string
          plate_number: string | null
          route_id: string | null
          school_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          driver_user_id?: string | null
          id?: string
          name: string
          plate_number?: string | null
          route_id?: string | null
          school_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          capacity?: number | null
          created_at?: string
          driver_name?: string | null
          driver_phone?: string | null
          driver_user_id?: string | null
          id?: string
          name?: string
          plate_number?: string | null
          route_id?: string | null
          school_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_buses_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_buses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_routes: {
        Row: {
          capacity: number
          created_at: string
          driver: string | null
          fee: number
          id: string
          name: string
          school_id: string
          vehicle_no: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string
          driver?: string | null
          fee?: number
          id?: string
          name: string
          school_id: string
          vehicle_no?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          driver?: string | null
          fee?: number
          id?: string
          name?: string
          school_id?: string
          vehicle_no?: string | null
        }
        Relationships: []
      }
      transport_stops: {
        Row: {
          created_at: string
          geofence_radius_m: number
          id: string
          lat: number
          lng: number
          name: string
          route_id: string
          school_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          geofence_radius_m?: number
          id?: string
          lat: number
          lng: number
          name: string
          route_id: string
          school_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          geofence_radius_m?: number
          id?: string
          lat?: number
          lng?: number
          name?: string
          route_id?: string
          school_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_student_stops: {
        Row: {
          bus_id: string
          created_at: string
          dropoff_stop_id: string | null
          id: string
          pickup_stop_id: string | null
          school_id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          dropoff_stop_id?: string | null
          id?: string
          pickup_stop_id?: string | null
          school_id: string
          student_id: string
          updated_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          dropoff_stop_id?: string | null
          id?: string
          pickup_stop_id?: string | null
          school_id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_student_stops_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "transport_buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_student_stops_dropoff_stop_id_fkey"
            columns: ["dropoff_stop_id"]
            isOneToOne: false
            referencedRelation: "transport_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_student_stops_pickup_stop_id_fkey"
            columns: ["pickup_stop_id"]
            isOneToOne: false
            referencedRelation: "transport_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_student_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_student_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_student_stops_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_trip_events: {
        Row: {
          bus_id: string
          id: number
          kind: string
          note: string | null
          occurred_at: string
          school_id: string
          stop_id: string | null
          student_id: string | null
          trip_id: string
        }
        Insert: {
          bus_id: string
          id?: number
          kind: string
          note?: string | null
          occurred_at?: string
          school_id: string
          stop_id?: string | null
          student_id?: string | null
          trip_id: string
        }
        Update: {
          bus_id?: string
          id?: number
          kind?: string
          note?: string | null
          occurred_at?: string
          school_id?: string
          stop_id?: string | null
          student_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_trip_events_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "transport_buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_events_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_events_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "transport_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_events_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "transport_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_trip_locations: {
        Row: {
          accuracy: number | null
          heading: number | null
          id: number
          lat: number
          lng: number
          recorded_at: string
          school_id: string
          speed: number | null
          trip_id: string
        }
        Insert: {
          accuracy?: number | null
          heading?: number | null
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          school_id: string
          speed?: number | null
          trip_id: string
        }
        Update: {
          accuracy?: number | null
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          school_id?: string
          speed?: number | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_trip_locations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_locations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_locations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trip_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "transport_trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transport_trips: {
        Row: {
          bus_id: string
          created_at: string
          direction: string
          driver_user_id: string
          ended_at: string | null
          id: string
          last_heading: number | null
          last_lat: number | null
          last_lng: number | null
          last_ping_at: string | null
          last_speed: number | null
          route_id: string | null
          school_id: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          bus_id: string
          created_at?: string
          direction?: string
          driver_user_id: string
          ended_at?: string | null
          id?: string
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_ping_at?: string | null
          last_speed?: number | null
          route_id?: string | null
          school_id: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          bus_id?: string
          created_at?: string
          direction?: string
          driver_user_id?: string
          ended_at?: string | null
          id?: string
          last_heading?: number | null
          last_lat?: number | null
          last_lng?: number | null
          last_ping_at?: string | null
          last_speed?: number | null
          route_id?: string | null
          school_id?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transport_trips_bus_id_fkey"
            columns: ["bus_id"]
            isOneToOne: false
            referencedRelation: "transport_buses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "transport_routes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transport_trips_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      school_directory: {
        Row: {
          id: string | null
          logo_url: string | null
          motto: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          id?: string | null
          logo_url?: string | null
          motto?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          id?: string | null
          logo_url?: string | null
          motto?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      schools_public: {
        Row: {
          id: string | null
          logo_url: string | null
          name: string | null
          slug: string | null
        }
        Insert: {
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
        }
        Update: {
          id?: string | null
          logo_url?: string | null
          name?: string | null
          slug?: string | null
        }
        Relationships: []
      }
      student_assessments_v: {
        Row: {
          assessment_id: string | null
          attempt_id: string | null
          attempt_status: Database["public"]["Enums"]["attempt_status"] | null
          closes_at: string | null
          grade: string | null
          opens_at: string | null
          percentage: number | null
          scheduled_at: string | null
          school_id: string | null
          status: Database["public"]["Enums"]["assessment_status_v2"] | null
          title: string | null
          type: Database["public"]["Enums"]["assessment_type"] | null
        }
        Relationships: []
      }
      student_subjects_v2: {
        Row: {
          arm_id: string | null
          is_required: boolean | null
          school_id: string | null
          student_user_id: string | null
          subject_code: string | null
          subject_id: string | null
          subject_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "arm_enrollments_arm_id_fkey"
            columns: ["arm_id"]
            isOneToOne: false
            referencedRelation: "academic_arms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arm_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "school_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arm_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "arm_enrollments_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_arm_assignments_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "academic_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_list_memberships_with_profile: {
        Args: {
          _role: Database["public"]["Enums"]["member_role"]
          _school: string
        }
        Returns: {
          bio_completed: boolean
          created_at: string
          profile_data: Json
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }[]
      }
      apply_academic_template: {
        Args: { _school_id: string; _template_code: string }
        Returns: Json
      }
      apply_payment: { Args: { _payment_id: string }; Returns: undefined }
      apply_subscription_payment: {
        Args: { _invoice_id: string; _method?: string; _reference: string }
        Returns: Json
      }
      auth_user_id_by_email: { Args: { _email: string }; Returns: string }
      bump_ai_quota: {
        Args: { _cost: number; _school_id: string; _tokens: number }
        Returns: undefined
      }
      bump_ai_quota_savings: {
        Args: { _cost: number; _school_id: string; _tokens: number }
        Returns: undefined
      }
      can_approve_exams: {
        Args: { _school: string; _user: string }
        Returns: boolean
      }
      can_read_platform_announcement: {
        Args: {
          _announcement: Database["public"]["Tables"]["platform_announcements"]["Row"]
        }
        Returns: boolean
      }
      check_rate_limit: {
        Args: {
          _key: string
          _max: number
          _school_id?: string
          _window_seconds: number
        }
        Returns: boolean
      }
      comms_backfill_channels: { Args: never; Returns: number }
      comms_ensure_class_channel: {
        Args: { _class_id: string }
        Returns: string
      }
      comms_sync_class_participants: {
        Args: { _class_id: string }
        Returns: undefined
      }
      complete_admin_onboarding: {
        Args: {
          _classes: Json
          _default_subjects?: string[]
          _profile: Json
          _school_id: string
        }
        Returns: Json
      }
      compute_grade: {
        Args: { _school: string; _score: number }
        Returns: {
          grade: string
          remark: string
        }[]
      }
      create_subscription_invoice: {
        Args: { _cycle?: string; _plan: string; _school_id: string }
        Returns: string
      }
      end_impersonation: {
        Args: { _reason?: string; _session_id: string }
        Returns: undefined
      }
      get_assessment_questions_for_attempt: {
        Args: { _attempt_id: string }
        Returns: {
          q_id: string
          q_media: Json
          q_options: Json
          q_points: number
          q_position: number
          q_prompt: string
          q_section_id: string
          q_subject_code: string
          q_topic: string
          q_type: Database["public"]["Enums"]["question_type"]
        }[]
      }
      get_assessment_review: {
        Args: { _attempt_id: string }
        Returns: {
          q_correct: Json
          q_explanation: string
          q_id: string
          q_is_correct: boolean
          q_options: Json
          q_points: number
          q_position: number
          q_prompt: string
          q_selected: Json
          q_subject_code: string
          q_topic: string
        }[]
      }
      get_exam_questions_for_attempt: {
        Args: { _attempt_id: string }
        Returns: {
          q_exam_id: string
          q_id: string
          q_options: Json
          q_points: number
          q_position: number
          q_prompt: string
          q_school_id: string
        }[]
      }
      get_exam_review: {
        Args: { _attempt_id: string }
        Returns: {
          q_correct_index: number
          q_id: string
          q_is_correct: boolean
          q_options: Json
          q_points: number
          q_position: number
          q_prompt: string
          q_selected_index: number
        }[]
      }
      get_mock_questions_for_session: {
        Args: { _session_id: string }
        Returns: {
          q_id: string
          q_options: Json
          q_position: number
          q_prompt: string
          q_subject_id: string
        }[]
      }
      get_mock_review: {
        Args: { _session_id: string }
        Returns: {
          q_correct_index: number
          q_explanation: string
          q_id: string
          q_is_correct: boolean
          q_options: Json
          q_position: number
          q_prompt: string
          q_selected_index: number
          q_subject_id: string
        }[]
      }
      get_my_membership_profile: { Args: { _school: string }; Returns: Json }
      get_public_profiles: {
        Args: { _ids: string[] }
        Returns: {
          full_name: string
          id: string
          photo_url: string
        }[]
      }
      get_school_by_slug: {
        Args: { _slug: string }
        Returns: {
          id: string
          logo_url: string
          name: string
          slug: string
        }[]
      }
      get_school_custom_roles: {
        Args: { _school_id: string }
        Returns: {
          base_role: string
          key: string
          label: string
        }[]
      }
      grade_mock_session: {
        Args: { _auto?: boolean; _session_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_school_role: {
        Args: {
          _role: Database["public"]["Enums"]["member_role"]
          _school: string
          _user: string
        }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { _conv: string; _user: string }
        Returns: boolean
      }
      is_member: { Args: { _school: string; _user: string }; Returns: boolean }
      is_school_admin: {
        Args: { _school: string; _user: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user: string }; Returns: boolean }
      issue_invoices_for_audience: {
        Args: { _payment_type_id: string; _student_ids?: string[] }
        Returns: number
      }
      log_impersonation_action: {
        Args: { _action: Json; _session_id: string }
        Returns: undefined
      }
      log_mock_integrity_event: {
        Args: { _detail?: Json; _kind: string; _session_id: string }
        Returns: undefined
      }
      log_security_event: {
        Args: { _detail?: Json; _kind: string; _school_id?: string }
        Returns: undefined
      }
      match_knowledge_chunks: {
        Args: {
          _class_id?: string
          _match_count?: number
          _query_embedding: string
          _school_id: string
          _student_id?: string
        }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          metadata: Json
          similarity: number
          title: string
          visibility: string
        }[]
      }
      pilot_convert_manual: {
        Args: { _plan?: string; _school_id: string }
        Returns: Json
      }
      pilot_extend_days: {
        Args: { _days: number; _school_id: string }
        Returns: Json
      }
      pilot_my_status: { Args: { _school_id: string }; Returns: Json }
      pilot_super_overview: { Args: never; Returns: Json }
      promote_arm: {
        Args: { _arm_id: string; _to_arm_id: string }
        Returns: Json
      }
      publish_assessment: {
        Args: { _assessment_id: string }
        Returns: undefined
      }
      publish_results: {
        Args: { _ids: string[]; _publish?: boolean }
        Returns: number
      }
      recompute_term_result: {
        Args: {
          _class?: string
          _report_score?: number
          _school: string
          _session?: string
          _student: string
          _subject: string
          _term: string
        }
        Returns: Json
      }
      recompute_term_results_for_class: {
        Args: { _class: string; _session?: string; _term: string }
        Returns: number
      }
      redeem_invite: { Args: { _code: string }; Returns: string }
      report_client_error: {
        Args: {
          _browser?: string
          _message: string
          _metadata?: Json
          _os?: string
          _role?: string
          _route?: string
          _school_id?: string
          _source?: string
          _stack?: string
        }
        Returns: string
      }
      resolve_academic_policy: {
        Args: { _kind: string; _school: string }
        Returns: Json
      }
      school_is_pilot_writable: {
        Args: { _school_id: string }
        Returns: boolean
      }
      seed_mock_bank: { Args: { _school: string }; Returns: undefined }
      set_subscription_status: {
        Args: { _action: string; _school_id: string }
        Returns: {
          current_period_end: string
          plan: string
          status: string
        }[]
      }
      start_assessment: { Args: { _assessment_id: string }; Returns: string }
      start_impersonation: {
        Args: {
          _duration_minutes?: number
          _reason: string
          _school_id: string
          _target_user: string
        }
        Returns: string
      }
      submit_assessment: { Args: { _attempt_id: string }; Returns: Json }
      super_admin_exists: { Args: never; Returns: boolean }
      super_ai_cache_stats: { Args: never; Returns: Json }
      super_list_ai_quotas: {
        Args: never
        Returns: {
          cost_used_usd: number
          enabled: boolean
          monthly_cost_cap_usd: number
          monthly_token_cap: number
          period_start: string
          plan: string
          school_id: string
          school_name: string
          school_slug: string
          tokens_used: number
          updated_at: string
        }[]
      }
      super_recent_auth_events: {
        Args: { _event?: string; _limit?: number; _since?: string }
        Returns: {
          created_at: string
          email: string
          event: string
          full_name: string
          id: string
          school_id: string
          session_id: string
          user_id: string
        }[]
      }
      super_reset_ai_quota: { Args: { _school_id: string }; Returns: undefined }
      super_set_ai_quota: {
        Args: {
          _cost_cap: number
          _enabled: boolean
          _school_id: string
          _token_cap: number
        }
        Returns: undefined
      }
      trad_admin_schedule_release: {
        Args: { _attempt_id: string; _release_at: string }
        Returns: undefined
      }
      trad_committee_forward_result: {
        Args: { _attempt_id: string }
        Returns: undefined
      }
      trad_finalize_result: {
        Args: { _attempt_id: string }
        Returns: undefined
      }
      trad_get_attempt_questions: {
        Args: { _attempt_id: string }
        Returns: {
          q_id: string
          q_image_path: string
          q_marks: number
          q_options: Json
          q_position: number
          q_prompt: string
          q_section_id: string
          q_selected_index: number
          q_text_answer: string
          q_type: string
        }[]
      }
      trad_get_paper_questions: {
        Args: { _exam_id: string }
        Returns: {
          q_ai_generated: boolean
          q_correct_index: number
          q_created_at: string
          q_exam_id: string
          q_explanation: string
          q_id: string
          q_image_path: string
          q_marks: number
          q_model_answer: string
          q_options: Json
          q_position: number
          q_prompt: string
          q_school_id: string
          q_section_id: string
          q_type: string
          q_updated_at: string
        }[]
      }
      trad_get_theory_grading_queue: {
        Args: { _school_id: string }
        Returns: {
          answer_id: string
          attempt_status: string
          exam_id: string
          feedback: string
          graded_at: string
          marks: number
          marks_awarded: number
          model_answer: string
          prompt: string
          question_id: string
          student_id: string
          submitted_at: string
          text_answer: string
        }[]
      }
      trad_grade_theory: {
        Args: { _answer_id: string; _feedback?: string; _marks: number }
        Returns: Json
      }
      trad_hash_pin: {
        Args: { _pin: string; _serial: string }
        Returns: string
      }
      trad_is_result_unlocked: {
        Args: { _result_id: string }
        Returns: boolean
      }
      trad_list_student_papers: {
        Args: { _school: string }
        Returns: {
          attempt_id: string
          attempt_status: string
          duration_minutes: number
          exam_date: string
          exam_id: string
          exam_type: string
          instructions: string
          result_released: boolean
          start_time: string
          status: string
          title: string
          total_marks: number
          venue: string
        }[]
      }
      trad_my_cards: {
        Args: never
        Returns: {
          expires_at: string
          id: string
          max_uses: number
          school_id: string
          serial: string
          sold_at: string
          status: string
          use_count: number
        }[]
      }
      trad_redeem_card: {
        Args: { _pin: string; _result_id: string; _serial: string }
        Returns: Json
      }
      trad_review_paper: {
        Args: { _action: string; _exam_id: string; _reason?: string }
        Returns: undefined
      }
      trad_start_attempt: { Args: { _exam_id: string }; Returns: string }
      trad_submit_attempt: {
        Args: { _attempt_id: string; _auto?: boolean }
        Returns: Json
      }
      trad_validate_result: {
        Args: { _action: string; _attempt_id: string }
        Returns: undefined
      }
      verify_result_slip: {
        Args: { _id: string }
        Returns: {
          created_at: string
          snapshot: Json
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "teacher" | "student" | "parent" | "super_admin"
      assessment_delivery: "proctored" | "open" | "practice"
      assessment_source: "manual" | "question_bank" | "ai_generated" | "mixed"
      assessment_status_v2:
        | "draft"
        | "in_review"
        | "scheduled"
        | "published"
        | "archived"
      assessment_type:
        | "school_test"
        | "school_exam"
        | "jamb_mock"
        | "neco_mock"
        | "waec_mock"
        | "ai_assessment"
      attempt_status: "in_progress" | "submitted" | "expired" | "voided"
      attendance_status: "present" | "absent" | "late" | "excused"
      bank_scope: "school" | "global"
      exam_body: "jamb" | "waec" | "neco" | "school" | "generic"
      exam_mode: "neco_sim" | "school" | "practice"
      exam_status: "draft" | "scheduled" | "active" | "closed"
      fee_status: "pending" | "paid" | "overdue"
      invoice_status:
        | "pending"
        | "partial"
        | "paid"
        | "overdue"
        | "waived"
        | "cancelled"
      member_role:
        | "admin"
        | "teacher"
        | "student"
        | "parent"
        | "driver"
        | "staff"
      payment_audience: "school" | "level" | "class" | "custom"
      payment_category:
        | "tuition"
        | "levy"
        | "uniform"
        | "exam"
        | "hostel"
        | "transport"
        | "excursion"
        | "book"
        | "other"
      payment_method: "paystack" | "cash" | "bank_transfer" | "pos" | "waiver"
      payment_recurrence: "one_off" | "termly" | "sessional" | "monthly"
      payment_status: "initiated" | "successful" | "failed" | "refunded"
      question_difficulty: "easy" | "medium" | "hard"
      question_type: "mcq" | "multi" | "short" | "essay" | "numeric"
      school_plan: "trial" | "basic" | "standard" | "premium" | "enterprise"
      school_status: "active" | "suspended" | "expired" | "trial"
      trad_draft_status:
        | "draft"
        | "submitted"
        | "approved"
        | "locked"
        | "changes_requested"
      trad_exam_type: "mcq" | "theory" | "mixed"
      trad_question_type: "mcq" | "theory"
      trad_session_status: "planning" | "published" | "locked"
      trad_timetable_status: "draft" | "pending" | "approved"
      trad_upload_status: "pending" | "parsing" | "parsed" | "failed"
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
      app_role: ["admin", "teacher", "student", "parent", "super_admin"],
      assessment_delivery: ["proctored", "open", "practice"],
      assessment_source: ["manual", "question_bank", "ai_generated", "mixed"],
      assessment_status_v2: [
        "draft",
        "in_review",
        "scheduled",
        "published",
        "archived",
      ],
      assessment_type: [
        "school_test",
        "school_exam",
        "jamb_mock",
        "neco_mock",
        "waec_mock",
        "ai_assessment",
      ],
      attempt_status: ["in_progress", "submitted", "expired", "voided"],
      attendance_status: ["present", "absent", "late", "excused"],
      bank_scope: ["school", "global"],
      exam_body: ["jamb", "waec", "neco", "school", "generic"],
      exam_mode: ["neco_sim", "school", "practice"],
      exam_status: ["draft", "scheduled", "active", "closed"],
      fee_status: ["pending", "paid", "overdue"],
      invoice_status: [
        "pending",
        "partial",
        "paid",
        "overdue",
        "waived",
        "cancelled",
      ],
      member_role: ["admin", "teacher", "student", "parent", "driver", "staff"],
      payment_audience: ["school", "level", "class", "custom"],
      payment_category: [
        "tuition",
        "levy",
        "uniform",
        "exam",
        "hostel",
        "transport",
        "excursion",
        "book",
        "other",
      ],
      payment_method: ["paystack", "cash", "bank_transfer", "pos", "waiver"],
      payment_recurrence: ["one_off", "termly", "sessional", "monthly"],
      payment_status: ["initiated", "successful", "failed", "refunded"],
      question_difficulty: ["easy", "medium", "hard"],
      question_type: ["mcq", "multi", "short", "essay", "numeric"],
      school_plan: ["trial", "basic", "standard", "premium", "enterprise"],
      school_status: ["active", "suspended", "expired", "trial"],
      trad_draft_status: [
        "draft",
        "submitted",
        "approved",
        "locked",
        "changes_requested",
      ],
      trad_exam_type: ["mcq", "theory", "mixed"],
      trad_question_type: ["mcq", "theory"],
      trad_session_status: ["planning", "published", "locked"],
      trad_timetable_status: ["draft", "pending", "approved"],
      trad_upload_status: ["pending", "parsing", "parsed", "failed"],
    },
  },
} as const
