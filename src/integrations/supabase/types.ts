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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      academy_certificates: {
        Row: {
          certificate_number: string
          enrollment_id: string
          id: string
          issued_at: string
          pdf_url: string | null
        }
        Insert: {
          certificate_number: string
          enrollment_id: string
          id?: string
          issued_at?: string
          pdf_url?: string | null
        }
        Update: {
          certificate_number?: string
          enrollment_id?: string
          id?: string
          issued_at?: string
          pdf_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "academy_enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_courses: {
        Row: {
          accreditation_number: string | null
          audience: string
          category: string | null
          cover_image_url: string | null
          created_at: string
          creator_id: string | null
          description: string | null
          id: string
          is_accredited: boolean
          is_published: boolean
          issues_certificate: boolean
          platform_commission_percent: number | null
          price: number | null
          requires_evidence: boolean
          revenue_type: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          accreditation_number?: string | null
          audience?: string
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          is_accredited?: boolean
          is_published?: boolean
          issues_certificate?: boolean
          platform_commission_percent?: number | null
          price?: number | null
          requires_evidence?: boolean
          revenue_type?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          accreditation_number?: string | null
          audience?: string
          category?: string | null
          cover_image_url?: string | null
          created_at?: string
          creator_id?: string | null
          description?: string | null
          id?: string
          is_accredited?: boolean
          is_published?: boolean
          issues_certificate?: boolean
          platform_commission_percent?: number | null
          price?: number | null
          requires_evidence?: boolean
          revenue_type?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_courses_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          enrolled_at: string
          id: string
          teacher_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          enrolled_at?: string
          id?: string
          teacher_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          enrolled_at?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_enrollments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_evidence_submissions: {
        Row: {
          created_at: string
          description: string
          enrollment_id: string
          file_url: string | null
          id: string
          reviewed_at: string | null
          reviewer_comment: string | null
          reviewer_id: string | null
          status: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          enrollment_id: string
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_comment?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          enrollment_id?: string
          file_url?: string | null
          id?: string
          reviewed_at?: string | null
          reviewer_comment?: string | null
          reviewer_id?: string | null
          status?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_evidence_submissions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "academy_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_evidence_submissions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_module_completions: {
        Row: {
          completed_at: string
          enrollment_id: string
          id: string
          module_id: string
        }
        Insert: {
          completed_at?: string
          enrollment_id: string
          id?: string
          module_id: string
        }
        Update: {
          completed_at?: string
          enrollment_id?: string
          id?: string
          module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_module_completions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "academy_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_module_completions_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "academy_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_modules: {
        Row: {
          content: string | null
          course_id: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          content?: string | null
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          content?: string | null
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "academy_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_pathway_certificates: {
        Row: {
          certificate_number: string
          id: string
          issued_at: string
          pathway_id: string
          teacher_id: string
        }
        Insert: {
          certificate_number: string
          id?: string
          issued_at?: string
          pathway_id: string
          teacher_id: string
        }
        Update: {
          certificate_number?: string
          id?: string
          issued_at?: string
          pathway_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "academy_pathway_certificates_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "academy_pathways"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_pathway_certificates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_pathway_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          pathway_id: string
          sort_order: number
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          pathway_id: string
          sort_order?: number
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          pathway_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "academy_pathway_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "academy_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "academy_pathway_courses_pathway_id_fkey"
            columns: ["pathway_id"]
            isOneToOne: false
            referencedRelation: "academy_pathways"
            referencedColumns: ["id"]
          },
        ]
      }
      academy_pathways: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      articles: {
        Row: {
          category: string
          content: string
          created_at: string
          excerpt: string
          id: string
          published_date: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string
          content?: string
          created_at?: string
          excerpt?: string
          id?: string
          published_date?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          excerpt?: string
          id?: string
          published_date?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignment_attachments: {
        Row: {
          assignment_id: string
          file_name: string
          file_path: string
          file_size: number
          id: string
          student_id: string
          uploaded_at: string
        }
        Insert: {
          assignment_id: string
          file_name: string
          file_path: string
          file_size?: number
          id?: string
          student_id: string
          uploaded_at?: string
        }
        Update: {
          assignment_id?: string
          file_name?: string
          file_path?: string
          file_size?: number
          id?: string
          student_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignment_attachments_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignment_attachments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      assignment_attempts: {
        Row: {
          answers: Json
          assignment_id: string
          attempt_number: number
          created_at: string
          id: string
          last_saved_at: string
          max_score: number | null
          progress: Json
          score: number | null
          started_at: string
          status: string
          student_id: string
          submitted_at: string | null
        }
        Insert: {
          answers?: Json
          assignment_id: string
          attempt_number?: number
          created_at?: string
          id?: string
          last_saved_at?: string
          max_score?: number | null
          progress?: Json
          score?: number | null
          started_at?: string
          status?: string
          student_id: string
          submitted_at?: string | null
        }
        Update: {
          answers?: Json
          assignment_id?: string
          attempt_number?: number
          created_at?: string
          id?: string
          last_saved_at?: string
          max_score?: number | null
          progress?: Json
          score?: number | null
          started_at?: string
          status?: string
          student_id?: string
          submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignment_attempts_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          activity_data: Json
          class_id: string | null
          created_at: string
          deadline: string | null
          description: string
          exam_type: string | null
          id: string
          is_portfolio_task: boolean
          lesson_plan_id: string | null
          lockdown_mode: boolean
          max_attempts: number
          randomize_choices: boolean
          randomize_order: boolean
          settings: Json
          status: string
          teacher_id: string
          title: string
          updated_at: string
          worksheet_id: string | null
        }
        Insert: {
          activity_data?: Json
          class_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          exam_type?: string | null
          id?: string
          is_portfolio_task?: boolean
          lesson_plan_id?: string | null
          lockdown_mode?: boolean
          max_attempts?: number
          randomize_choices?: boolean
          randomize_order?: boolean
          settings?: Json
          status?: string
          teacher_id: string
          title?: string
          updated_at?: string
          worksheet_id?: string | null
        }
        Update: {
          activity_data?: Json
          class_id?: string | null
          created_at?: string
          deadline?: string | null
          description?: string
          exam_type?: string | null
          id?: string
          is_portfolio_task?: boolean
          lesson_plan_id?: string | null
          lockdown_mode?: boolean
          max_attempts?: number
          randomize_choices?: boolean
          randomize_order?: boolean
          settings?: Json
          status?: string
          teacher_id?: string
          title?: string
          updated_at?: string
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assignments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_item_base_variants: {
        Row: {
          avatar_item_id: string
          base_id: string
          created_at: string
          id: string
          image_url: string | null
          image_url_back: string | null
          layer_offset_x: number
          layer_offset_y: number
          layer_scale: number
          updated_at: string
        }
        Insert: {
          avatar_item_id: string
          base_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_back?: string | null
          layer_offset_x?: number
          layer_offset_y?: number
          layer_scale?: number
          updated_at?: string
        }
        Update: {
          avatar_item_id?: string
          base_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          image_url_back?: string | null
          layer_offset_x?: number
          layer_offset_y?: number
          layer_scale?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_item_base_variants_avatar_item_id_fkey"
            columns: ["avatar_item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_item_base_variants_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      avatar_items: {
        Row: {
          category: string
          color_value: string | null
          created_at: string
          icon_name: string | null
          id: string
          image_url: string | null
          image_url_back: string | null
          is_active: boolean
          is_default: boolean
          is_neutral_color: boolean
          layer_offset_x: number
          layer_offset_y: number
          layer_scale: number
          layer_slot: string | null
          name: string
          rarity: string
          recommended_for_role: string
          slug: string
          sort_order: number
          thumbnail_url: string | null
          unlock_type: string
          unlock_value: string | null
          updated_at: string
        }
        Insert: {
          category: string
          color_value?: string | null
          created_at?: string
          icon_name?: string | null
          id?: string
          image_url?: string | null
          image_url_back?: string | null
          is_active?: boolean
          is_default?: boolean
          is_neutral_color?: boolean
          layer_offset_x?: number
          layer_offset_y?: number
          layer_scale?: number
          layer_slot?: string | null
          name: string
          rarity?: string
          recommended_for_role?: string
          slug: string
          sort_order?: number
          thumbnail_url?: string | null
          unlock_type?: string
          unlock_value?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          color_value?: string | null
          created_at?: string
          icon_name?: string | null
          id?: string
          image_url?: string | null
          image_url_back?: string | null
          is_active?: boolean
          is_default?: boolean
          is_neutral_color?: boolean
          layer_offset_x?: number
          layer_offset_y?: number
          layer_scale?: number
          layer_slot?: string | null
          name?: string
          rarity?: string
          recommended_for_role?: string
          slug?: string
          sort_order?: number
          thumbnail_url?: string | null
          unlock_type?: string
          unlock_value?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      avatar_profiles: {
        Row: {
          active_title: string | null
          background_color: string | null
          background_id: string | null
          badge_id: string | null
          base_color: string | null
          base_id: string | null
          clothing_bag_color: string | null
          clothing_bag_id: string | null
          clothing_bottom_color: string | null
          clothing_bottom_id: string | null
          clothing_face_color: string | null
          clothing_face_id: string | null
          clothing_full_color: string | null
          clothing_full_id: string | null
          clothing_hands_color: string | null
          clothing_hands_id: string | null
          clothing_head_color: string | null
          clothing_head_id: string | null
          clothing_neck_color: string | null
          clothing_neck_id: string | null
          clothing_shoes_color: string | null
          clothing_shoes_id: string | null
          clothing_top_color: string | null
          clothing_top_id: string | null
          created_at: string
          effect_id: string | null
          eyebrow_id: string | null
          eyes_id: string | null
          face_accessory_color: string | null
          face_accessory_id: string | null
          frame_id: string | null
          hair_accessory_color: string | null
          hair_accessory_id: string | null
          hair_color_id: string | null
          hairstyle_color: string | null
          hairstyle_id: string | null
          head_accessory_color: string | null
          head_accessory_id: string | null
          mouth_id: string | null
          outfit_color: string | null
          outfit_id: string | null
          reduce_motion: boolean
          skin_tone_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_title?: string | null
          background_color?: string | null
          background_id?: string | null
          badge_id?: string | null
          base_color?: string | null
          base_id?: string | null
          clothing_bag_color?: string | null
          clothing_bag_id?: string | null
          clothing_bottom_color?: string | null
          clothing_bottom_id?: string | null
          clothing_face_color?: string | null
          clothing_face_id?: string | null
          clothing_full_color?: string | null
          clothing_full_id?: string | null
          clothing_hands_color?: string | null
          clothing_hands_id?: string | null
          clothing_head_color?: string | null
          clothing_head_id?: string | null
          clothing_neck_color?: string | null
          clothing_neck_id?: string | null
          clothing_shoes_color?: string | null
          clothing_shoes_id?: string | null
          clothing_top_color?: string | null
          clothing_top_id?: string | null
          created_at?: string
          effect_id?: string | null
          eyebrow_id?: string | null
          eyes_id?: string | null
          face_accessory_color?: string | null
          face_accessory_id?: string | null
          frame_id?: string | null
          hair_accessory_color?: string | null
          hair_accessory_id?: string | null
          hair_color_id?: string | null
          hairstyle_color?: string | null
          hairstyle_id?: string | null
          head_accessory_color?: string | null
          head_accessory_id?: string | null
          mouth_id?: string | null
          outfit_color?: string | null
          outfit_id?: string | null
          reduce_motion?: boolean
          skin_tone_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_title?: string | null
          background_color?: string | null
          background_id?: string | null
          badge_id?: string | null
          base_color?: string | null
          base_id?: string | null
          clothing_bag_color?: string | null
          clothing_bag_id?: string | null
          clothing_bottom_color?: string | null
          clothing_bottom_id?: string | null
          clothing_face_color?: string | null
          clothing_face_id?: string | null
          clothing_full_color?: string | null
          clothing_full_id?: string | null
          clothing_hands_color?: string | null
          clothing_hands_id?: string | null
          clothing_head_color?: string | null
          clothing_head_id?: string | null
          clothing_neck_color?: string | null
          clothing_neck_id?: string | null
          clothing_shoes_color?: string | null
          clothing_shoes_id?: string | null
          clothing_top_color?: string | null
          clothing_top_id?: string | null
          created_at?: string
          effect_id?: string | null
          eyebrow_id?: string | null
          eyes_id?: string | null
          face_accessory_color?: string | null
          face_accessory_id?: string | null
          frame_id?: string | null
          hair_accessory_color?: string | null
          hair_accessory_id?: string | null
          hair_color_id?: string | null
          hairstyle_color?: string | null
          hairstyle_id?: string | null
          head_accessory_color?: string | null
          head_accessory_id?: string | null
          mouth_id?: string | null
          outfit_color?: string | null
          outfit_id?: string | null
          reduce_motion?: boolean
          skin_tone_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_profiles_background_id_fkey"
            columns: ["background_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_base_id_fkey"
            columns: ["base_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_bag_id_fkey"
            columns: ["clothing_bag_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_bottom_id_fkey"
            columns: ["clothing_bottom_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_face_id_fkey"
            columns: ["clothing_face_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_full_id_fkey"
            columns: ["clothing_full_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_hands_id_fkey"
            columns: ["clothing_hands_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_head_id_fkey"
            columns: ["clothing_head_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_neck_id_fkey"
            columns: ["clothing_neck_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_shoes_id_fkey"
            columns: ["clothing_shoes_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_clothing_top_id_fkey"
            columns: ["clothing_top_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_eyebrow_id_fkey"
            columns: ["eyebrow_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_eyes_id_fkey"
            columns: ["eyes_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_face_accessory_id_fkey"
            columns: ["face_accessory_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_hair_accessory_id_fkey"
            columns: ["hair_accessory_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_hair_color_id_fkey"
            columns: ["hair_color_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_hairstyle_id_fkey"
            columns: ["hairstyle_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_head_accessory_id_fkey"
            columns: ["head_accessory_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_mouth_id_fkey"
            columns: ["mouth_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_outfit_id_fkey"
            columns: ["outfit_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_skin_tone_id_fkey"
            columns: ["skin_tone_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avatar_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_points: {
        Row: {
          category: string
          class_id: string | null
          created_at: string
          id: string
          note: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          category: string
          class_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          category?: string
          class_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_points_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_points_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "behavior_points_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_leaderboard_baselines: {
        Row: {
          baseline_xp: number
          class_id: string
          created_at: string
          id: string
          student_id: string
        }
        Insert: {
          baseline_xp?: number
          class_id: string
          created_at?: string
          id?: string
          student_id: string
        }
        Update: {
          baseline_xp?: number
          class_id?: string
          created_at?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      class_members: {
        Row: {
          class_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_members_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_schedule_slots: {
        Row: {
          abbreviation: string | null
          bell_period_id: string | null
          class_id: string
          color: string | null
          created_at: string
          created_by: string | null
          day_of_week: number
          end_time: string
          id: string
          room: string | null
          start_time: string
          subject_id: string | null
          subject_label: string | null
          textbook_id: string | null
          textbook_type: string | null
          updated_at: string
          valid_from: string | null
          valid_to: string | null
          week_parity: string
        }
        Insert: {
          abbreviation?: string | null
          bell_period_id?: string | null
          class_id: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week: number
          end_time: string
          id?: string
          room?: string | null
          start_time: string
          subject_id?: string | null
          subject_label?: string | null
          textbook_id?: string | null
          textbook_type?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          week_parity?: string
        }
        Update: {
          abbreviation?: string | null
          bell_period_id?: string | null
          class_id?: string
          color?: string | null
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          end_time?: string
          id?: string
          room?: string | null
          start_time?: string
          subject_id?: string | null
          subject_label?: string | null
          textbook_id?: string | null
          textbook_type?: string | null
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
          week_parity?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedule_slots_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_schedule_slots_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_stories: {
        Row: {
          class_id: string
          created_at: string
          id: string
          image_url: string | null
          teacher_id: string
          text: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          teacher_id: string
          text?: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          teacher_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_stories_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_subjects: {
        Row: {
          archived: boolean
          class_id: string
          created_at: string
          id: string
          school_year: string
          subject_id: string
        }
        Insert: {
          archived?: boolean
          class_id: string
          created_at?: string
          id?: string
          school_year?: string
          subject_id: string
        }
        Update: {
          archived?: boolean
          class_id?: string
          created_at?: string
          id?: string
          school_year?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_subjects_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      class_teachers: {
        Row: {
          class_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          class_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          class_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      class_textbooks: {
        Row: {
          added_at: string
          added_by: string | null
          class_id: string
          id: string
          textbook_id: string
          textbook_type: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          class_id: string
          id?: string
          textbook_id: string
          textbook_type: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          class_id?: string
          id?: string
          textbook_id?: string
          textbook_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_textbooks_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          access_code: string | null
          access_code_active: boolean
          archived: boolean
          created_at: string
          created_by: string | null
          description: string
          field_of_study: string
          id: string
          leaderboard_anonymous: boolean
          leaderboard_enabled: boolean
          leaderboard_reset_at: string | null
          leaderboard_reset_period: string
          name: string
          school: string
          school_id: string | null
          teacher_join_code: string | null
          teacher_join_code_active: boolean
          updated_at: string
          year: number | null
        }
        Insert: {
          access_code?: string | null
          access_code_active?: boolean
          archived?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          field_of_study?: string
          id?: string
          leaderboard_anonymous?: boolean
          leaderboard_enabled?: boolean
          leaderboard_reset_at?: string | null
          leaderboard_reset_period?: string
          name: string
          school?: string
          school_id?: string | null
          teacher_join_code?: string | null
          teacher_join_code_active?: boolean
          updated_at?: string
          year?: number | null
        }
        Update: {
          access_code?: string | null
          access_code_active?: boolean
          archived?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          field_of_study?: string
          id?: string
          leaderboard_anonymous?: boolean
          leaderboard_enabled?: boolean
          leaderboard_reset_at?: string | null
          leaderboard_reset_period?: string
          name?: string
          school?: string
          school_id?: string | null
          teacher_join_code?: string | null
          teacher_join_code_active?: boolean
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      content_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          lesson_plan_id: string | null
          rating: number
          reviewer_id: string
          textbook_id: string | null
          updated_at: string
          worksheet_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          lesson_plan_id?: string | null
          rating: number
          reviewer_id: string
          textbook_id?: string | null
          updated_at?: string
          worksheet_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          lesson_plan_id?: string | null
          rating?: number
          reviewer_id?: string
          textbook_id?: string | null
          updated_at?: string
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_reviews_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reviews_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_reviews_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbook_marketplace_stats"
            referencedColumns: ["textbook_id"]
          },
          {
            foreignKeyName: "content_reviews_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      content_shares: {
        Row: {
          created_at: string
          id: string
          includes_presentations: boolean
          includes_worksheets: boolean
          lesson_plan_id: string | null
          shared_by: string
          shared_with: string | null
          status: string
          textbook_id: string | null
          worksheet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          includes_presentations?: boolean
          includes_worksheets?: boolean
          lesson_plan_id?: string | null
          shared_by: string
          shared_with?: string | null
          status?: string
          textbook_id?: string | null
          worksheet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          includes_presentations?: boolean
          includes_worksheets?: boolean
          lesson_plan_id?: string | null
          shared_by?: string
          shared_with?: string | null
          status?: string
          textbook_id?: string | null
          worksheet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "content_shares_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_shares_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_shares_shared_with_fkey"
            columns: ["shared_with"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_shares_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_shares_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbook_marketplace_stats"
            referencedColumns: ["textbook_id"]
          },
          {
            foreignKeyName: "content_shares_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_earnings: {
        Row: {
          amount: number
          calculated_at: string
          creator_id: string
          id: string
          paid_out: boolean
          paid_out_at: string | null
          payout_recipient_id: string | null
          payout_recipient_type: string | null
          period_month: string
          source_type: string
        }
        Insert: {
          amount?: number
          calculated_at?: string
          creator_id: string
          id?: string
          paid_out?: boolean
          paid_out_at?: string | null
          payout_recipient_id?: string | null
          payout_recipient_type?: string | null
          period_month: string
          source_type: string
        }
        Update: {
          amount?: number
          calculated_at?: string
          creator_id?: string
          id?: string
          paid_out?: boolean
          paid_out_at?: string | null
          payout_recipient_id?: string | null
          payout_recipient_type?: string | null
          period_month?: string
          source_type?: string
        }
        Relationships: []
      }
      creator_follows: {
        Row: {
          created_at: string
          creator_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_follows_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_contacts: {
        Row: {
          contact_category: string
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          marketing_consent: boolean
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          position: string | null
          unsubscribed_at: string | null
        }
        Insert: {
          contact_category?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          marketing_consent?: boolean
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          position?: string | null
          unsubscribed_at?: string | null
        }
        Update: {
          contact_category?: string
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          marketing_consent?: boolean
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          position?: string | null
          unsubscribed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_interactions: {
        Row: {
          contact_id: string | null
          created_at: string
          created_by: string | null
          id: string
          next_step: string | null
          next_step_date: string | null
          occurred_at: string
          organization_id: string | null
          related_user_id: string | null
          summary: string
          type: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_step?: string | null
          next_step_date?: string | null
          occurred_at?: string
          organization_id?: string | null
          related_user_id?: string | null
          summary: string
          type?: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          next_step?: string | null
          next_step_date?: string | null
          occurred_at?: string
          organization_id?: string | null
          related_user_id?: string | null
          summary?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "crm_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_interactions_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_organization_tags: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_organization_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_organization_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "crm_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_organizations: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          ico: string | null
          id: string
          linked_school_id: string | null
          name: string
          notes: string | null
          region: string | null
          source: string | null
          status: string
          type: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          ico?: string | null
          id?: string
          linked_school_id?: string | null
          name: string
          notes?: string | null
          region?: string | null
          source?: string | null
          status?: string
          type?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          ico?: string | null
          id?: string
          linked_school_id?: string | null
          name?: string
          notes?: string | null
          region?: string | null
          source?: string | null
          status?: string
          type?: string
          updated_at?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_organizations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_organizations_linked_school_id_fkey"
            columns: ["linked_school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_organizations_linked_school_id_fkey"
            columns: ["linked_school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      curriculum_topics: {
        Row: {
          ai_generated: boolean
          ai_modified_at: string | null
          created_at: string
          curriculum_plan_id: string
          id: string
          sort_order: number
          title: string
        }
        Insert: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          created_at?: string
          curriculum_plan_id: string
          id?: string
          sort_order?: number
          title: string
        }
        Update: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          created_at?: string
          curriculum_plan_id?: string
          id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_curriculum_plan_id_fkey"
            columns: ["curriculum_plan_id"]
            isOneToOne: false
            referencedRelation: "teacher_curriculum_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      export_jobs: {
        Row: {
          attempt: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          format: string
          id: string
          lesson_plan_id: string | null
          max_attempts: number
          options: Json
          output_url: string | null
          started_at: string | null
          status: string
          teacher_id: string
          worker_id: string | null
        }
        Insert: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          format?: string
          id?: string
          lesson_plan_id?: string | null
          max_attempts?: number
          options?: Json
          output_url?: string | null
          started_at?: string | null
          status?: string
          teacher_id: string
          worker_id?: string | null
        }
        Update: {
          attempt?: number
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          format?: string
          id?: string
          lesson_plan_id?: string | null
          max_attempts?: number
          options?: Json
          output_url?: string | null
          started_at?: string | null
          status?: string
          teacher_id?: string
          worker_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_jobs_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      game_backgrounds: {
        Row: {
          category: string
          created_at: string
          field_key: string | null
          id: string
          image_url: string
          is_active: boolean
          name: string
          season_key: string | null
          subject_key: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          field_key?: string | null
          id?: string
          image_url: string
          is_active?: boolean
          name: string
          season_key?: string | null
          subject_key?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          field_key?: string | null
          id?: string
          image_url?: string
          is_active?: boolean
          name?: string
          season_key?: string | null
          subject_key?: string | null
        }
        Relationships: []
      }
      game_players: {
        Row: {
          created_at: string
          hand_raised: boolean
          hand_raised_at: string | null
          id: string
          join_token: string | null
          nickname: string
          session_id: string
          student_index: number | null
          token_expires_at: string | null
          total_score: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          hand_raised?: boolean
          hand_raised_at?: string | null
          id?: string
          join_token?: string | null
          nickname: string
          session_id: string
          student_index?: number | null
          token_expires_at?: string | null
          total_score?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          hand_raised?: boolean
          hand_raised_at?: string | null
          id?: string
          join_token?: string | null
          nickname?: string
          session_id?: string
          student_index?: number | null
          token_expires_at?: string | null
          total_score?: number
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions_player_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_question_votes: {
        Row: {
          created_at: string
          id: string
          player_id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          player_id: string
          question_id: string
        }
        Update: {
          created_at?: string
          id?: string
          player_id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_question_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_question_votes_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_question_votes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "game_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      game_questions: {
        Row: {
          answered: boolean
          created_at: string
          id: string
          player_id: string
          session_id: string
          text: string
        }
        Insert: {
          answered?: boolean
          created_at?: string
          id?: string
          player_id: string
          session_id: string
          text: string
        }
        Update: {
          answered?: boolean
          created_at?: string
          id?: string
          player_id?: string
          session_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_questions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_questions_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_questions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions_player_view"
            referencedColumns: ["id"]
          },
        ]
      }
      game_responses: {
        Row: {
          answer: Json
          created_at: string
          id: string
          is_correct: boolean
          player_id: string
          question_index: number
          response_time_ms: number
          score: number
          session_id: string
        }
        Insert: {
          answer?: Json
          created_at?: string
          id?: string
          is_correct?: boolean
          player_id: string
          question_index?: number
          response_time_ms?: number
          score?: number
          session_id: string
        }
        Update: {
          answer?: Json
          created_at?: string
          id?: string
          is_correct?: boolean
          player_id?: string
          question_index?: number
          response_time_ms?: number
          score?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_responses_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "game_players_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions_player_view"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions: {
        Row: {
          activity_data: Json
          created_at: string
          current_question_index: number
          game_code: string
          id: string
          question_started_at: string | null
          settings: Json
          status: string
          teacher_id: string
          teams: Json
          title: string
          updated_at: string
          whiteboard_data: Json
          zoom_state: Json | null
        }
        Insert: {
          activity_data?: Json
          created_at?: string
          current_question_index?: number
          game_code: string
          id?: string
          question_started_at?: string | null
          settings?: Json
          status?: string
          teacher_id: string
          teams?: Json
          title?: string
          updated_at?: string
          whiteboard_data?: Json
          zoom_state?: Json | null
        }
        Update: {
          activity_data?: Json
          created_at?: string
          current_question_index?: number
          game_code?: string
          id?: string
          question_started_at?: string | null
          settings?: Json
          status?: string
          teacher_id?: string
          teams?: Json
          title?: string
          updated_at?: string
          whiteboard_data?: Json
          zoom_state?: Json | null
        }
        Relationships: []
      }
      grading_rubrics: {
        Row: {
          created_at: string
          id: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          teacher_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grading_rubrics_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      help_guides: {
        Row: {
          blocks: Json
          category: string
          created_at: string
          description: string
          id: string
          role: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          category?: string
          created_at?: string
          description?: string
          id?: string
          role?: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          category?: string
          created_at?: string
          description?: string
          id?: string
          role?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      landing_sections: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          order_index: number
          props: Json
          section_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          order_index: number
          props?: Json
          section_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          order_index?: number
          props?: Json
          section_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      learning_methods: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          difficulty: string | null
          example: string | null
          id: string
          name: string
          slug: string | null
          steps_json: Json | null
          template_phases_json: Json | null
          time_range: string | null
          tips: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          example?: string | null
          id?: string
          name: string
          slug?: string | null
          steps_json?: Json | null
          template_phases_json?: Json | null
          time_range?: string | null
          tips?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          difficulty?: string | null
          example?: string | null
          id?: string
          name?: string
          slug?: string | null
          steps_json?: Json | null
          template_phases_json?: Json | null
          time_range?: string | null
          tips?: string | null
        }
        Relationships: []
      }
      lesson_curriculum_coverage: {
        Row: {
          created_at: string
          curriculum_topic_id: string
          id: string
          lesson_id: string
        }
        Insert: {
          created_at?: string
          curriculum_topic_id: string
          id?: string
          lesson_id: string
        }
        Update: {
          created_at?: string
          curriculum_topic_id?: string
          id?: string
          lesson_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_curriculum_coverage_curriculum_topic_id_fkey"
            columns: ["curriculum_topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_curriculum_coverage_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbook_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_method_links: {
        Row: {
          created_at: string
          lesson_plan_id: string
          method_id: string
        }
        Insert: {
          created_at?: string
          lesson_plan_id: string
          method_id: string
        }
        Update: {
          created_at?: string
          lesson_plan_id?: string
          method_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_method_links_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_method_links_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "learning_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_placements: {
        Row: {
          class_id: string | null
          created_at: string
          grade_number: number
          id: string
          lesson_id: string
          scheduled_publish_at: string | null
          status: string
          subject_slug: string
          topic_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          grade_number: number
          id?: string
          lesson_id: string
          scheduled_publish_at?: string | null
          status?: string
          subject_slug: string
          topic_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          grade_number?: number
          id?: string
          lesson_id?: string
          scheduled_publish_at?: string | null
          status?: string
          subject_slug?: string
          topic_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_placements_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_placements_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbook_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_placements_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "textbook_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plan_phases: {
        Row: {
          content: string | null
          created_at: string
          duration_min: number
          end_time: string | null
          id: string
          lesson_date: string | null
          lesson_plan_id: string | null
          phase_key: string
          plan_title: string | null
          sort_order: number
          start_time: string | null
          subject: string | null
          teacher_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          duration_min?: number
          end_time?: string | null
          id?: string
          lesson_date?: string | null
          lesson_plan_id?: string | null
          phase_key: string
          plan_title?: string | null
          sort_order?: number
          start_time?: string | null
          subject?: string | null
          teacher_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          duration_min?: number
          end_time?: string | null
          id?: string
          lesson_date?: string | null
          lesson_plan_id?: string | null
          phase_key?: string
          plan_title?: string | null
          sort_order?: number
          start_time?: string | null
          subject?: string | null
          teacher_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plan_phases_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_plan_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          phases_json: Json
          teacher_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          phases_json: Json
          teacher_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          phases_json?: Json
          teacher_id?: string
          title?: string
        }
        Relationships: []
      }
      lesson_plans: {
        Row: {
          ai_generated: boolean
          ai_modified_at: string | null
          anonymous: boolean
          commission_rate_locked: number | null
          copied_from_lesson_plan_id: string | null
          created_at: string
          grade_band: string
          id: string
          input_data: Json
          is_for_sale: boolean
          lesson_id: string | null
          price: number | null
          shared_visibility: string
          slides: Json
          subject: string
          subject_id: string | null
          teacher_id: string
          theme_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          anonymous?: boolean
          commission_rate_locked?: number | null
          copied_from_lesson_plan_id?: string | null
          created_at?: string
          grade_band?: string
          id?: string
          input_data?: Json
          is_for_sale?: boolean
          lesson_id?: string | null
          price?: number | null
          shared_visibility?: string
          slides?: Json
          subject?: string
          subject_id?: string | null
          teacher_id: string
          theme_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          anonymous?: boolean
          commission_rate_locked?: number | null
          copied_from_lesson_plan_id?: string | null
          created_at?: string
          grade_band?: string
          id?: string
          input_data?: Json
          is_for_sale?: boolean
          lesson_id?: string | null
          price?: number | null
          shared_visibility?: string
          slides?: Json
          subject?: string
          subject_id?: string | null
          teacher_id?: string
          theme_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_copied_from_lesson_plan_id_fkey"
            columns: ["copied_from_lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "textbook_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_reflections: {
        Row: {
          class_id: string | null
          created_at: string
          id: string
          lesson_plan_id: string | null
          quick_notes: string | null
          rating: number | null
          reflection_date: string | null
          subject: string | null
          teacher_id: string
          what_to_change: string | null
          what_worked: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          id?: string
          lesson_plan_id?: string | null
          quick_notes?: string | null
          rating?: number | null
          reflection_date?: string | null
          subject?: string | null
          teacher_id: string
          what_to_change?: string | null
          what_worked?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          id?: string
          lesson_plan_id?: string | null
          quick_notes?: string | null
          rating?: number | null
          reflection_date?: string | null
          subject?: string | null
          teacher_id?: string
          what_to_change?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lesson_reflections_lesson_plan_id_fkey"
            columns: ["lesson_plan_id"]
            isOneToOne: false
            referencedRelation: "lesson_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_topic_assignments: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          scheduled_publish_at: string | null
          sort_order: number
          status: string
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          scheduled_publish_at?: string | null
          sort_order?: number
          status?: string
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          scheduled_publish_at?: string | null
          sort_order?: number
          status?: string
          topic_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_topic_assignments_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "textbook_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lesson_topic_assignments_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "textbook_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: string
          created_at: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: number
          identifier: string
          ip_address: string | null
          success: boolean
        }
        Insert: {
          attempted_at?: string
          id?: number
          identifier: string
          ip_address?: string | null
          success?: boolean
        }
        Update: {
          attempted_at?: string
          id?: number
          identifier?: string
          ip_address?: string | null
          success?: boolean
        }
        Relationships: []
      }
      marketplace_settings: {
        Row: {
          created_at: string
          current_phase: string
          founding_commission_percent: number
          founding_lock_years: number
          founding_threshold_type: string
          founding_threshold_value: number
          id: string
          standard_commission_percent: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_phase?: string
          founding_commission_percent?: number
          founding_lock_years?: number
          founding_threshold_type?: string
          founding_threshold_value?: number
          id?: string
          standard_commission_percent?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_phase?: string
          founding_commission_percent?: number
          founding_lock_years?: number
          founding_threshold_type?: string
          founding_threshold_value?: number
          id?: string
          standard_commission_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_subscriptions: {
        Row: {
          amount_paid: number
          created_at: string
          expires_at: string | null
          id: string
          starts_at: string
          status: string
          subscriber_id: string
          subscriber_type: string
          updated_at: string
        }
        Insert: {
          amount_paid?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          starts_at?: string
          status?: string
          subscriber_id: string
          subscriber_type?: string
          updated_at?: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          expires_at?: string | null
          id?: string
          starts_at?: string
          status?: string
          subscriber_id?: string
          subscriber_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      marketplace_usage_events: {
        Row: {
          content_id: string
          content_type: string
          creator_id: string
          event_type: string
          id: string
          occurred_at: string
          subscription_id: string
          weight: number
        }
        Insert: {
          content_id: string
          content_type: string
          creator_id: string
          event_type: string
          id?: string
          occurred_at?: string
          subscription_id: string
          weight?: number
        }
        Update: {
          content_id?: string
          content_type?: string
          creator_id?: string
          event_type?: string
          id?: string
          occurred_at?: string
          subscription_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_usage_events_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "marketplace_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      notebook_pages: {
        Row: {
          background_style: string
          content: Json
          created_at: string
          id: string
          notebook_id: string
          page_order: number
          updated_at: string
        }
        Insert: {
          background_style?: string
          content?: Json
          created_at?: string
          id?: string
          notebook_id: string
          page_order?: number
          updated_at?: string
        }
        Update: {
          background_style?: string
          content?: Json
          created_at?: string
          id?: string
          notebook_id?: string
          page_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebook_pages_notebook_id_fkey"
            columns: ["notebook_id"]
            isOneToOne: false
            referencedRelation: "notebooks"
            referencedColumns: ["id"]
          },
        ]
      }
      notebooks: {
        Row: {
          cover_color: string | null
          created_at: string
          id: string
          owner_id: string
          related_class_id: string | null
          related_lesson_id: string | null
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_color?: string | null
          created_at?: string
          id?: string
          owner_id: string
          related_class_id?: string | null
          related_lesson_id?: string | null
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_color?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          related_class_id?: string | null
          related_lesson_id?: string | null
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notebooks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebooks_related_class_id_fkey"
            columns: ["related_class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notebooks_related_lesson_id_fkey"
            columns: ["related_lesson_id"]
            isOneToOne: false
            referencedRelation: "textbook_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_broadcasts: {
        Row: {
          content: string
          created_at: string
          error_message: string | null
          id: string
          is_manual: boolean
          link: string | null
          receiver_ids: string[]
          receiver_type: string
          recipient_count: number
          scheduled_at: string | null
          sender_id: string
          sender_role: string
          sent_at: string | null
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_manual?: boolean
          link?: string | null
          receiver_ids?: string[]
          receiver_type: string
          recipient_count?: number
          scheduled_at?: string | null
          sender_id: string
          sender_role: string
          sent_at?: string | null
          status?: string
          title: string
          type?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          error_message?: string | null
          id?: string
          is_manual?: boolean
          link?: string | null
          receiver_ids?: string[]
          receiver_type?: string
          recipient_count?: number
          scheduled_at?: string | null
          sender_id?: string
          sender_role?: string
          sent_at?: string | null
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          broadcast_id: string | null
          created_at: string
          id: string
          is_manual: boolean
          link: string | null
          payload: Json
          read_at: string | null
          receiver_type: string | null
          recipient_id: string
          sender_id: string | null
          sender_role: string | null
          sent_at: string | null
          status: string
          title: string
          type: string
        }
        Insert: {
          body?: string
          broadcast_id?: string | null
          created_at?: string
          id?: string
          is_manual?: boolean
          link?: string | null
          payload?: Json
          read_at?: string | null
          receiver_type?: string | null
          recipient_id: string
          sender_id?: string | null
          sender_role?: string | null
          sent_at?: string | null
          status?: string
          title: string
          type: string
        }
        Update: {
          body?: string
          broadcast_id?: string | null
          created_at?: string
          id?: string
          is_manual?: boolean
          link?: string | null
          payload?: Json
          read_at?: string | null
          receiver_type?: string | null
          recipient_id?: string
          sender_id?: string | null
          sender_role?: string | null
          sent_at?: string | null
          status?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      parent_messages: {
        Row: {
          content: string
          created_at: string
          direction: string
          id: string
          parent_id: string
          read_at: string | null
          student_id: string
          teacher_id: string
        }
        Insert: {
          content: string
          created_at?: string
          direction: string
          id?: string
          parent_id: string
          read_at?: string | null
          student_id: string
          teacher_id: string
        }
        Update: {
          content?: string
          created_at?: string
          direction?: string
          id?: string
          parent_id?: string
          read_at?: string | null
          student_id?: string
          teacher_id?: string
        }
        Relationships: []
      }
      parent_student_links: {
        Row: {
          created_at: string | null
          id: string
          parent_id: string
          student_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_id: string
          student_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_id?: string
          student_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      podcast_episodes: {
        Row: {
          audio_url: string | null
          blocks: Json
          created_at: string
          duration: string | null
          excerpt: string | null
          id: string
          published_date: string
          sort_order: number
          status: string
          thumbnail_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audio_url?: string | null
          blocks?: Json
          created_at?: string
          duration?: string | null
          excerpt?: string | null
          id?: string
          published_date?: string
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audio_url?: string | null
          blocks?: Json
          created_at?: string
          duration?: string | null
          excerpt?: string | null
          id?: string
          published_date?: string
          sort_order?: number
          status?: string
          thumbnail_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profile_credentials: {
        Row: {
          encrypted_password: string | null
          pin_hash: string | null
          profile_id: string
          updated_at: string
        }
        Insert: {
          encrypted_password?: string | null
          pin_hash?: string | null
          profile_id: string
          updated_at?: string
        }
        Update: {
          encrypted_password?: string | null
          pin_hash?: string | null
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_credentials_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_title: string | null
          accessibility_settings: Json
          created_at: string
          email: string
          field_of_study: string
          first_name: string
          id: string
          last_name: string
          parent_email: string | null
          parent_email_notifications: boolean
          school: string
          school_id: string | null
          status: Database["public"]["Enums"]["account_status"]
          student_code: string | null
          updated_at: string
          username: string | null
          year: number | null
        }
        Insert: {
          academic_title?: string | null
          accessibility_settings?: Json
          created_at?: string
          email?: string
          field_of_study?: string
          first_name?: string
          id: string
          last_name?: string
          parent_email?: string | null
          parent_email_notifications?: boolean
          school?: string
          school_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          student_code?: string | null
          updated_at?: string
          username?: string | null
          year?: number | null
        }
        Update: {
          academic_title?: string | null
          accessibility_settings?: Json
          created_at?: string
          email?: string
          field_of_study?: string
          first_name?: string
          id?: string
          last_name?: string
          parent_email?: string | null
          parent_email_notifications?: boolean
          school?: string
          school_id?: string | null
          status?: Database["public"]["Enums"]["account_status"]
          student_code?: string | null
          updated_at?: string
          username?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      question_bank_items: {
        Row: {
          choices: Json | null
          correct_answer: string | null
          correct_index: number | null
          created_at: string
          curriculum_topic_id: string | null
          id: string
          is_true: boolean | null
          question_text: string
          question_type: string
          subject: string | null
          subject_id: string | null
          teacher_id: string
          updated_at: string
        }
        Insert: {
          choices?: Json | null
          correct_answer?: string | null
          correct_index?: number | null
          created_at?: string
          curriculum_topic_id?: string | null
          id?: string
          is_true?: boolean | null
          question_text: string
          question_type: string
          subject?: string | null
          subject_id?: string | null
          teacher_id: string
          updated_at?: string
        }
        Update: {
          choices?: Json | null
          correct_answer?: string | null
          correct_index?: number | null
          created_at?: string
          curriculum_topic_id?: string | null
          id?: string
          is_true?: boolean | null
          question_text?: string
          question_type?: string
          subject?: string | null
          subject_id?: string | null
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_bank_items_curriculum_topic_id_fkey"
            columns: ["curriculum_topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_bank_items_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_criteria: {
        Row: {
          created_at: string
          id: string
          rubric_id: string
          sort_order: number
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          rubric_id: string
          sort_order?: number
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          rubric_id?: string
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_criteria_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "grading_rubrics"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_evaluation_scores: {
        Row: {
          created_at: string
          criterion_id: string
          evaluation_id: string
          id: string
          level_id: string
        }
        Insert: {
          created_at?: string
          criterion_id: string
          evaluation_id: string
          id?: string
          level_id: string
        }
        Update: {
          created_at?: string
          criterion_id?: string
          evaluation_id?: string
          id?: string
          level_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rubric_evaluation_scores_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_evaluation_scores_evaluation_id_fkey"
            columns: ["evaluation_id"]
            isOneToOne: false
            referencedRelation: "rubric_evaluations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_evaluation_scores_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "rubric_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_evaluations: {
        Row: {
          created_at: string
          id: string
          portfolio_item_id: string
          rubric_id: string
          teacher_id: string
          total_points: number
        }
        Insert: {
          created_at?: string
          id?: string
          portfolio_item_id: string
          rubric_id: string
          teacher_id: string
          total_points?: number
        }
        Update: {
          created_at?: string
          id?: string
          portfolio_item_id?: string
          rubric_id?: string
          teacher_id?: string
          total_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_evaluations_portfolio_item_id_fkey"
            columns: ["portfolio_item_id"]
            isOneToOne: false
            referencedRelation: "student_portfolio_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_evaluations_rubric_id_fkey"
            columns: ["rubric_id"]
            isOneToOne: false
            referencedRelation: "grading_rubrics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rubric_evaluations_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rubric_levels: {
        Row: {
          created_at: string
          criterion_id: string
          id: string
          label: string
          points: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          criterion_id: string
          id?: string
          label: string
          points?: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          criterion_id?: string
          id?: string
          label?: string
          points?: number
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubric_levels_criterion_id_fkey"
            columns: ["criterion_id"]
            isOneToOne: false
            referencedRelation: "rubric_criteria"
            referencedColumns: ["id"]
          },
        ]
      }
      school_license_reminders: {
        Row: {
          created_at: string
          id: string
          license_id: string
          sent_at: string
          threshold_days: number
        }
        Insert: {
          created_at?: string
          id?: string
          license_id: string
          sent_at?: string
          threshold_days: number
        }
        Update: {
          created_at?: string
          id?: string
          license_id?: string
          sent_at?: string
          threshold_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "school_license_reminders_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "school_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      school_licenses: {
        Row: {
          admin_notes: string | null
          billing_cycle: string | null
          contract_years: number | null
          created_at: string
          expires_at: string | null
          id: string
          is_paid: boolean
          paid_at: string | null
          plan: string
          school_id: string
          seats_students: number | null
          seats_teachers: number | null
          starts_at: string
          status: string
          trial_duration_days: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_notes?: string | null
          billing_cycle?: string | null
          contract_years?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          plan?: string
          school_id: string
          seats_students?: number | null
          seats_teachers?: number | null
          starts_at?: string
          status?: string
          trial_duration_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_notes?: string | null
          billing_cycle?: string | null
          contract_years?: number | null
          created_at?: string
          expires_at?: string | null
          id?: string
          is_paid?: boolean
          paid_at?: string | null
          plan?: string
          school_id?: string
          seats_students?: number | null
          seats_teachers?: number | null
          starts_at?: string
          status?: string
          trial_duration_days?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "school_licenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_licenses_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_licenses_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          allows_teacher_creators: boolean
          created_at: string
          created_by: string | null
          creator_payout_recipient: string
          custom_logo_url: string | null
          custom_primary_color: string | null
          custom_welcome_text: string | null
          id: string
          name: string
          registration_code: string
          subdomain: string | null
          updated_at: string
        }
        Insert: {
          allows_teacher_creators?: boolean
          created_at?: string
          created_by?: string | null
          creator_payout_recipient?: string
          custom_logo_url?: string | null
          custom_primary_color?: string | null
          custom_welcome_text?: string | null
          id?: string
          name: string
          registration_code?: string
          subdomain?: string | null
          updated_at?: string
        }
        Update: {
          allows_teacher_creators?: boolean
          created_at?: string
          created_by?: string | null
          creator_payout_recipient?: string
          custom_logo_url?: string | null
          custom_primary_color?: string | null
          custom_welcome_text?: string | null
          id?: string
          name?: string
          registration_code?: string
          subdomain?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      section_links: {
        Row: {
          created_at: string
          id: string
          label: string
          section_name: string
          sort_order: number
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          section_name: string
          sort_order?: number
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          section_name?: string
          sort_order?: number
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      staff_calendar_events: {
        Row: {
          all_day: boolean
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          end_time: string | null
          id: string
          location: string | null
          recurrence_group_id: string | null
          recurrence_rule: string | null
          reminder_minutes: number[] | null
          start_time: string
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          recurrence_group_id?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number[] | null
          start_time: string
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          end_time?: string | null
          id?: string
          location?: string | null
          recurrence_group_id?: string | null
          recurrence_rule?: string | null
          reminder_minutes?: number[] | null
          start_time?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_calendar_events_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_calendar_notes: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          note_date: string
          updated_at: string
        }
        Insert: {
          author_id: string
          content?: string
          created_at?: string
          id?: string
          note_date: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          note_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_calendar_notes_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_event_attendees: {
        Row: {
          created_at: string
          event_id: string
          id: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          profile_id: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_event_attendees_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "staff_calendar_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_event_attendees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_event_reminder_log: {
        Row: {
          event_id: string
          id: string
          minutes_before: number
          sent_at: string
        }
        Insert: {
          event_id: string
          id?: string
          minutes_before: number
          sent_at?: string
        }
        Update: {
          event_id?: string
          id?: string
          minutes_before?: number
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_event_reminder_log_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "staff_calendar_events"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_knowledge_articles: {
        Row: {
          category: string | null
          content: string
          created_at: string
          created_by: string | null
          id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_knowledge_articles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean
          calendar_feed_token: string | null
          created_at: string
          hired_at: string | null
          id: string
          initials: string | null
          phone: string | null
          position: string | null
          private_email: string | null
          profile_id: string
          work_email: string | null
        }
        Insert: {
          active?: boolean
          calendar_feed_token?: string | null
          created_at?: string
          hired_at?: string | null
          id?: string
          initials?: string | null
          phone?: string | null
          position?: string | null
          private_email?: string | null
          profile_id: string
          work_email?: string | null
        }
        Update: {
          active?: boolean
          calendar_feed_token?: string | null
          created_at?: string
          hired_at?: string | null
          id?: string
          initials?: string | null
          phone?: string | null
          position?: string | null
          private_email?: string | null
          profile_id?: string
          work_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          staff_member_id: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          staff_member_id: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          staff_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_task_subitems: {
        Row: {
          created_at: string
          id: string
          is_done: boolean
          sort_order: number
          task_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_done?: boolean
          sort_order?: number
          task_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_task_subitems_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "staff_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_tasks: {
        Row: {
          assigned_by: string
          assigned_to: string
          color: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          related_organization_id: string | null
          related_user_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          color?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_organization_id?: string | null
          related_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          color?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          related_organization_id?: string | null
          related_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_tasks_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_related_organization_id_fkey"
            columns: ["related_organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staff_tasks_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_activity_results: {
        Row: {
          activity_index: number
          activity_type: string
          completed_at: string
          id: string
          lesson_id: string
          max_score: number
          score: number
          user_id: string
        }
        Insert: {
          activity_index?: number
          activity_type?: string
          completed_at?: string
          id?: string
          lesson_id: string
          max_score?: number
          score?: number
          user_id: string
        }
        Update: {
          activity_index?: number
          activity_type?: string
          completed_at?: string
          id?: string
          lesson_id?: string
          max_score?: number
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_activity_results_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "textbook_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_activity_results_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_alerts: {
        Row: {
          alert_type: string
          class_id: string | null
          context: string | null
          created_at: string
          detail: string
          id: string
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          student_id: string
          teacher_id: string | null
        }
        Insert: {
          alert_type: string
          class_id?: string | null
          context?: string | null
          created_at?: string
          detail: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          student_id: string
          teacher_id?: string | null
        }
        Update: {
          alert_type?: string
          class_id?: string | null
          context?: string | null
          created_at?: string
          detail?: string
          id?: string
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          student_id?: string
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_alerts_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      student_avatars: {
        Row: {
          avatar_slug: string
          student_id: string
          updated_at: string
        }
        Insert: {
          avatar_slug?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          avatar_slug?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      student_badges: {
        Row: {
          badge_slug: string
          earned_at: string
          id: string
          student_id: string
        }
        Insert: {
          badge_slug: string
          earned_at?: string
          id?: string
          student_id: string
        }
        Update: {
          badge_slug?: string
          earned_at?: string
          id?: string
          student_id?: string
        }
        Relationships: []
      }
      student_book_pages: {
        Row: {
          book_id: string
          created_at: string
          id: string
          image_url: string | null
          sort_order: number
          text: string | null
          updated_at: string
        }
        Insert: {
          book_id: string
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          text?: string | null
          updated_at?: string
        }
        Update: {
          book_id?: string
          created_at?: string
          id?: string
          image_url?: string | null
          sort_order?: number
          text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_book_pages_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "student_books"
            referencedColumns: ["id"]
          },
        ]
      }
      student_books: {
        Row: {
          cover_image_url: string | null
          created_at: string
          id: string
          published: boolean
          student_id: string
          subject: string | null
          title: string
          updated_at: string
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          student_id: string
          subject?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          id?: string
          published?: boolean
          student_id?: string
          subject?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_books_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_course_badges: {
        Row: {
          earned_at: string
          id: string
          student_id: string
          textbook_id: string
          textbook_title: string
        }
        Insert: {
          earned_at?: string
          id?: string
          student_id: string
          textbook_id: string
          textbook_title?: string
        }
        Update: {
          earned_at?: string
          id?: string
          student_id?: string
          textbook_id?: string
          textbook_title?: string
        }
        Relationships: []
      }
      student_lesson_completions: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "textbook_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lesson_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_lesson_mastery: {
        Row: {
          id: string
          lesson_id: string
          mastered_at: string | null
          mastery_percent: number
          sessions_count: number
          student_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          mastered_at?: string | null
          mastery_percent?: number
          sessions_count?: number
          student_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          mastered_at?: string | null
          mastery_percent?: number
          sessions_count?: number
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_lesson_mastery_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "textbook_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_lesson_mastery_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      student_portfolio_comments: {
        Row: {
          ai_generated: boolean
          ai_modified_at: string | null
          author_id: string
          body: string
          created_at: string
          id: string
          item_id: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          author_id: string
          body: string
          created_at?: string
          id?: string
          item_id: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          item_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_portfolio_comments_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "student_portfolio_items"
            referencedColumns: ["id"]
          },
        ]
      }
      student_portfolio_files: {
        Row: {
          created_at: string
          file_name: string
          file_type: string
          file_url: string
          id: string
          portfolio_item_id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          file_name: string
          file_type?: string
          file_url: string
          id?: string
          portfolio_item_id: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          file_name?: string
          file_type?: string
          file_url?: string
          id?: string
          portfolio_item_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "student_portfolio_files_portfolio_item_id_fkey"
            columns: ["portfolio_item_id"]
            isOneToOne: false
            referencedRelation: "student_portfolio_items"
            referencedColumns: ["id"]
          },
        ]
      }
      student_portfolio_items: {
        Row: {
          attachment_url: string | null
          content_json: Json
          created_at: string
          description: string | null
          id: string
          source_assignment_id: string | null
          source_type: string
          student_id: string
          subject: string | null
          title: string
          type: string
          updated_at: string
          video_url: string | null
        }
        Insert: {
          attachment_url?: string | null
          content_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          source_assignment_id?: string | null
          source_type?: string
          student_id: string
          subject?: string | null
          title: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          attachment_url?: string | null
          content_json?: Json
          created_at?: string
          description?: string | null
          id?: string
          source_assignment_id?: string | null
          source_type?: string
          student_id?: string
          subject?: string | null
          title?: string
          type?: string
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_portfolio_items_source_assignment_id_fkey"
            columns: ["source_assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      student_practice_recommendations: {
        Row: {
          generated_at: string
          id: string
          lesson_id: string | null
          recommendation: string
          student_id: string
          weak_topics: Json
        }
        Insert: {
          generated_at?: string
          id?: string
          lesson_id?: string | null
          recommendation?: string
          student_id: string
          weak_topics?: Json
        }
        Update: {
          generated_at?: string
          id?: string
          lesson_id?: string | null
          recommendation?: string
          student_id?: string
          weak_topics?: Json
        }
        Relationships: []
      }
      student_practice_sessions: {
        Row: {
          ai_generated: boolean
          ai_modified_at: string | null
          answers_json: Json | null
          created_at: string
          duration_min: number | null
          id: string
          lesson_id: string | null
          method_id: string
          score: number | null
          student_id: string
        }
        Insert: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          answers_json?: Json | null
          created_at?: string
          duration_min?: number | null
          id?: string
          lesson_id?: string | null
          method_id: string
          score?: number | null
          student_id: string
        }
        Update: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          answers_json?: Json | null
          created_at?: string
          duration_min?: number | null
          id?: string
          lesson_id?: string | null
          method_id?: string
          score?: number | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_practice_sessions_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "study_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      student_preferred_methods: {
        Row: {
          created_at: string
          method_id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          method_id: string
          student_id: string
        }
        Update: {
          created_at?: string
          method_id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_preferred_methods_method_id_fkey"
            columns: ["method_id"]
            isOneToOne: false
            referencedRelation: "study_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      student_xp: {
        Row: {
          last_activity_date: string | null
          level: number
          streak_days: number
          student_id: string
          total_xp: number
          updated_at: string
        }
        Insert: {
          last_activity_date?: string | null
          level?: number
          streak_days?: number
          student_id: string
          total_xp?: number
          updated_at?: string
        }
        Update: {
          last_activity_date?: string | null
          level?: number
          streak_days?: number
          student_id?: string
          total_xp?: number
          updated_at?: string
        }
        Relationships: []
      }
      study_methods: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          steps_json: Json | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          steps_json?: Json | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          steps_json?: Json | null
        }
        Relationships: []
      }
      subject_group_members: {
        Row: {
          created_at: string
          group_id: string
          id: string
          student_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          student_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_group_members_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subject_groups: {
        Row: {
          archived: boolean
          created_at: string
          created_by: string
          id: string
          name: string
          school_year: string
          subject_id: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          created_by: string
          id?: string
          name: string
          school_year?: string
          subject_id: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          school_year?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subject_groups_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          abbreviation: string | null
          archived: boolean
          color: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          abbreviation?: string | null
          archived?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          abbreviation?: string | null
          archived?: boolean
          color?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subjects_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools_public"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_curriculum_plans: {
        Row: {
          content: string | null
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          subject: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          subject: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          subject?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_curriculum_plans_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_game_templates: {
        Row: {
          activity_data: Json
          created_at: string
          curriculum_topic_id: string | null
          default_game_mode: string
          default_team_mode: string
          description: string | null
          id: string
          purpose: string | null
          subject: string | null
          teacher_id: string
          textbook_lesson_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          activity_data?: Json
          created_at?: string
          curriculum_topic_id?: string | null
          default_game_mode?: string
          default_team_mode?: string
          description?: string | null
          id?: string
          purpose?: string | null
          subject?: string | null
          teacher_id: string
          textbook_lesson_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          activity_data?: Json
          created_at?: string
          curriculum_topic_id?: string | null
          default_game_mode?: string
          default_team_mode?: string
          description?: string | null
          id?: string
          purpose?: string | null
          subject?: string | null
          teacher_id?: string
          textbook_lesson_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_game_templates_curriculum_topic_id_fkey"
            columns: ["curriculum_topic_id"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_game_templates_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_game_templates_textbook_lesson_id_fkey"
            columns: ["textbook_lesson_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbook_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_lesson_completions: {
        Row: {
          completed_at: string
          id: string
          lesson_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          lesson_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          lesson_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_lesson_completions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbook_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      teacher_media: {
        Row: {
          created_at: string
          filename: string
          id: string
          mime_type: string
          size_bytes: number
          storage_path: string
          tags: string[]
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filename: string
          id?: string
          mime_type: string
          size_bytes?: number
          storage_path: string
          tags?: string[]
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filename?: string
          id?: string
          mime_type?: string
          size_bytes?: number
          storage_path?: string
          tags?: string[]
          teacher_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      teacher_textbook_enrollments: {
        Row: {
          enrolled_at: string
          id: string
          student_id: string
          textbook_id: string
        }
        Insert: {
          enrolled_at?: string
          id?: string
          student_id: string
          textbook_id: string
        }
        Update: {
          enrolled_at?: string
          id?: string
          student_id?: string
          textbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_textbook_enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_textbook_enrollments_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_textbook_enrollments_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbook_marketplace_stats"
            referencedColumns: ["textbook_id"]
          },
        ]
      }
      teacher_textbook_lessons: {
        Row: {
          blocks: Json
          created_at: string
          hero_image_url: string | null
          id: string
          presentation_slides: Json | null
          require_activities: boolean
          scheduled_publish_at: string | null
          sort_order: number
          status: string
          textbook_id: string
          theme_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          id?: string
          presentation_slides?: Json | null
          require_activities?: boolean
          scheduled_publish_at?: string | null
          sort_order?: number
          status?: string
          textbook_id: string
          theme_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          id?: string
          presentation_slides?: Json | null
          require_activities?: boolean
          scheduled_publish_at?: string | null
          sort_order?: number
          status?: string
          textbook_id?: string
          theme_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_textbook_lessons_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_textbook_lessons_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbook_marketplace_stats"
            referencedColumns: ["textbook_id"]
          },
        ]
      }
      teacher_textbooks: {
        Row: {
          access_code: string
          archived: boolean
          commission_rate_locked: number | null
          copied_from_textbook_id: string | null
          created_at: string
          description: string
          difficulty_level: string | null
          grade_level: string[] | null
          id: string
          is_for_sale: boolean
          language: string
          order_index: number
          price: number | null
          school_type: string[] | null
          subject: string
          subject_id: string | null
          teacher_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          access_code: string
          archived?: boolean
          commission_rate_locked?: number | null
          copied_from_textbook_id?: string | null
          created_at?: string
          description?: string
          difficulty_level?: string | null
          grade_level?: string[] | null
          id?: string
          is_for_sale?: boolean
          language?: string
          order_index?: number
          price?: number | null
          school_type?: string[] | null
          subject?: string
          subject_id?: string | null
          teacher_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          access_code?: string
          archived?: boolean
          commission_rate_locked?: number | null
          copied_from_textbook_id?: string | null
          created_at?: string
          description?: string
          difficulty_level?: string | null
          grade_level?: string[] | null
          id?: string
          is_for_sale?: boolean
          language?: string
          order_index?: number
          price?: number | null
          school_type?: string[] | null
          subject?: string
          subject_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "teacher_textbooks_copied_from_textbook_id_fkey"
            columns: ["copied_from_textbook_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_textbooks_copied_from_textbook_id_fkey"
            columns: ["copied_from_textbook_id"]
            isOneToOne: false
            referencedRelation: "textbook_marketplace_stats"
            referencedColumns: ["textbook_id"]
          },
          {
            foreignKeyName: "teacher_textbooks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teacher_textbooks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      test_sessions: {
        Row: {
          assignment_id: string
          attempt_id: string | null
          created_at: string
          ended_at: string | null
          id: string
          left_test: boolean
          started_at: string
          student_id: string
          updated_at: string
          violation_count: number
          violations_json: Json
        }
        Insert: {
          assignment_id: string
          attempt_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          left_test?: boolean
          started_at?: string
          student_id: string
          updated_at?: string
          violation_count?: number
          violations_json?: Json
        }
        Update: {
          assignment_id?: string
          attempt_id?: string | null
          created_at?: string
          ended_at?: string | null
          id?: string
          left_test?: boolean
          started_at?: string
          student_id?: string
          updated_at?: string
          violation_count?: number
          violations_json?: Json
        }
        Relationships: []
      }
      textbook_grades: {
        Row: {
          created_at: string | null
          grade_number: number
          id: string
          label: string
          sort_order: number | null
          subject_id: string
        }
        Insert: {
          created_at?: string | null
          grade_number: number
          id?: string
          label: string
          sort_order?: number | null
          subject_id: string
        }
        Update: {
          created_at?: string | null
          grade_number?: number
          id?: string
          label?: string
          sort_order?: number | null
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "textbook_grades_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "textbook_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      textbook_lessons: {
        Row: {
          blocks: Json
          created_at: string
          hero_image_url: string | null
          id: string
          presentation_slides: Json | null
          require_activities: boolean
          scheduled_publish_at: string | null
          sort_order: number
          status: string
          theme_id: string | null
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          id?: string
          presentation_slides?: Json | null
          require_activities?: boolean
          scheduled_publish_at?: string | null
          sort_order?: number
          status?: string
          theme_id?: string | null
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          id?: string
          presentation_slides?: Json | null
          require_activities?: boolean
          scheduled_publish_at?: string | null
          sort_order?: number
          status?: string
          theme_id?: string | null
          title?: string
          topic_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "textbook_lessons_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "textbook_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      textbook_subjects: {
        Row: {
          abbreviation: string | null
          active: boolean | null
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          label: string
          slug: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          abbreviation?: string | null
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          label: string
          slug: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          abbreviation?: string | null
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          label?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "textbook_subjects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      textbook_templates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          grade_range: unknown
          id: string
          is_public: boolean
          name: string
          structure_json: Json
          subject: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string
          grade_range?: unknown
          id?: string
          is_public?: boolean
          name: string
          structure_json?: Json
          subject?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          grade_range?: unknown
          id?: string
          is_public?: boolean
          name?: string
          structure_json?: Json
          subject?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      textbook_topics: {
        Row: {
          created_at: string
          grade: number
          id: string
          sort_order: number
          subject: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade: number
          id?: string
          sort_order?: number
          subject: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: number
          id?: string
          sort_order?: number
          subject?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      textbook_trial_activations: {
        Row: {
          expires_at: string
          id: string
          started_at: string
          teacher_id: string
          textbook_id: string
        }
        Insert: {
          expires_at?: string
          id?: string
          started_at?: string
          teacher_id: string
          textbook_id: string
        }
        Update: {
          expires_at?: string
          id?: string
          started_at?: string
          teacher_id?: string
          textbook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "textbook_trial_activations_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "teacher_textbooks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "textbook_trial_activations_textbook_id_fkey"
            columns: ["textbook_id"]
            isOneToOne: false
            referencedRelation: "textbook_marketplace_stats"
            referencedColumns: ["textbook_id"]
          },
        ]
      }
      todos: {
        Row: {
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: string | null
          status: string | null
          title: string
          type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title: string
          type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string | null
          status?: string | null
          title?: string
          type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_avatar_items: {
        Row: {
          acquired_at: string
          avatar_item_id: string
          id: string
          is_favorite: boolean
          is_new: boolean
          user_id: string
        }
        Insert: {
          acquired_at?: string
          avatar_item_id: string
          id?: string
          is_favorite?: boolean
          is_new?: boolean
          user_id: string
        }
        Update: {
          acquired_at?: string
          avatar_item_id?: string
          id?: string
          is_favorite?: boolean
          is_new?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_avatar_items_avatar_item_id_fkey"
            columns: ["avatar_item_id"]
            isOneToOne: false
            referencedRelation: "avatar_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_avatar_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      website_assistant_faq: {
        Row: {
          answer: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          question: string
          updated_at: string
        }
        Insert: {
          answer: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          question: string
          updated_at?: string
        }
        Update: {
          answer?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          question?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "website_assistant_faq_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      website_chat_logs: {
        Row: {
          answer: string
          created_at: string
          feedback: string | null
          id: string
          question: string
          session_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          feedback?: string | null
          id?: string
          question: string
          session_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          feedback?: string | null
          id?: string
          question?: string
          session_id?: string
        }
        Relationships: []
      }
      worksheet_lessons: {
        Row: {
          added_at: string
          added_by: string | null
          id: string
          lesson_id: string
          lesson_type: string
          worksheet_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          id?: string
          lesson_id: string
          lesson_type: string
          worksheet_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          id?: string
          lesson_id?: string
          lesson_type?: string
          worksheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheet_lessons_worksheet_id_fkey"
            columns: ["worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
        ]
      }
      worksheets: {
        Row: {
          ai_generated: boolean
          ai_modified_at: string | null
          commission_rate_locked: number | null
          copied_from_worksheet_id: string | null
          created_at: string
          grade_band: string
          id: string
          is_for_sale: boolean
          price: number | null
          scheduled_publish_at: string | null
          source_lesson_id: string | null
          source_lesson_type: string | null
          spec: Json
          status: string
          subject: string
          subject_id: string | null
          teacher_id: string
          title: string
          updated_at: string
          worksheet_mode: string
        }
        Insert: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          commission_rate_locked?: number | null
          copied_from_worksheet_id?: string | null
          created_at?: string
          grade_band?: string
          id?: string
          is_for_sale?: boolean
          price?: number | null
          scheduled_publish_at?: string | null
          source_lesson_id?: string | null
          source_lesson_type?: string | null
          spec?: Json
          status?: string
          subject?: string
          subject_id?: string | null
          teacher_id: string
          title?: string
          updated_at?: string
          worksheet_mode?: string
        }
        Update: {
          ai_generated?: boolean
          ai_modified_at?: string | null
          commission_rate_locked?: number | null
          copied_from_worksheet_id?: string | null
          created_at?: string
          grade_band?: string
          id?: string
          is_for_sale?: boolean
          price?: number | null
          scheduled_publish_at?: string | null
          source_lesson_id?: string | null
          source_lesson_type?: string | null
          spec?: Json
          status?: string
          subject?: string
          subject_id?: string | null
          teacher_id?: string
          title?: string
          updated_at?: string
          worksheet_mode?: string
        }
        Relationships: [
          {
            foreignKeyName: "worksheets_copied_from_worksheet_id_fkey"
            columns: ["copied_from_worksheet_id"]
            isOneToOne: false
            referencedRelation: "worksheets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "worksheets_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      zedstart_prompts: {
        Row: {
          category: string | null
          created_at: string
          id: string
          prompt_text: string
          suggested_duration_minutes: number
          teacher_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          prompt_text: string
          suggested_duration_minutes?: number
          teacher_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          prompt_text?: string
          suggested_duration_minutes?: number
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "zedstart_prompts_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      game_players_public: {
        Row: {
          created_at: string | null
          hand_raised: boolean | null
          hand_raised_at: string | null
          id: string | null
          nickname: string | null
          session_id: string | null
          student_index: number | null
          total_score: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          hand_raised?: boolean | null
          hand_raised_at?: string | null
          id?: string | null
          nickname?: string | null
          session_id?: string | null
          student_index?: number | null
          total_score?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          hand_raised?: boolean | null
          hand_raised_at?: string | null
          id?: string | null
          nickname?: string | null
          session_id?: string | null
          student_index?: number | null
          total_score?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions_player_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      game_sessions_player_view: {
        Row: {
          activity_data_safe: Json | null
          created_at: string | null
          current_question_index: number | null
          game_code: string | null
          id: string | null
          question_started_at: string | null
          settings: Json | null
          status: string | null
          teacher_id: string | null
          teams: Json | null
          title: string | null
          updated_at: string | null
          whiteboard_data: Json | null
          zoom_state: Json | null
        }
        Insert: {
          activity_data_safe?: never
          created_at?: string | null
          current_question_index?: number | null
          game_code?: string | null
          id?: string | null
          question_started_at?: string | null
          settings?: Json | null
          status?: string | null
          teacher_id?: string | null
          teams?: Json | null
          title?: string | null
          updated_at?: string | null
          whiteboard_data?: Json | null
          zoom_state?: Json | null
        }
        Update: {
          activity_data_safe?: never
          created_at?: string | null
          current_question_index?: number | null
          game_code?: string | null
          id?: string | null
          question_started_at?: string | null
          settings?: Json | null
          status?: string | null
          teacher_id?: string | null
          teams?: Json | null
          title?: string | null
          updated_at?: string | null
          whiteboard_data?: Json | null
          zoom_state?: Json | null
        }
        Relationships: []
      }
      schools_public: {
        Row: {
          custom_logo_url: string | null
          custom_primary_color: string | null
          custom_welcome_text: string | null
          id: string | null
          name: string | null
          registration_code: string | null
          subdomain: string | null
        }
        Insert: {
          custom_logo_url?: string | null
          custom_primary_color?: string | null
          custom_welcome_text?: string | null
          id?: string | null
          name?: string | null
          registration_code?: string | null
          subdomain?: string | null
        }
        Update: {
          custom_logo_url?: string | null
          custom_primary_color?: string | null
          custom_welcome_text?: string | null
          id?: string | null
          name?: string | null
          registration_code?: string | null
          subdomain?: string | null
        }
        Relationships: []
      }
      textbook_marketplace_stats: {
        Row: {
          author: string | null
          direct_shares: number | null
          grade_level: string[] | null
          has_materials: boolean | null
          public_shares: number | null
          school_type: string[] | null
          subject: string | null
          teacher_id: string | null
          textbook_id: string | null
          title: string | null
          total_shares: number | null
          used_in_classes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teacher_textbooks_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _fanout_broadcast: { Args: { _broadcast_id: string }; Returns: number }
      _resolve_broadcast_recipients: {
        Args: {
          _b: Database["public"]["Tables"]["notification_broadcasts"]["Row"]
        }
        Returns: {
          recipient_id: string
        }[]
      }
      academy_stats_by_course: {
        Args: never
        Returns: {
          audience: string
          certificates_count: number
          completions_count: number
          course_id: string
          course_title: string
          enrollments_count: number
          issues_certificate: boolean
          price: number
          revenue_type: string
          students_completed: number
          teachers_completed: number
        }[]
      }
      add_xp: {
        Args: { _amount: number; _student: string }
        Returns: undefined
      }
      calculate_all_subscription_shares: {
        Args: { _period_month: string }
        Returns: number
      }
      calculate_subscription_shares: {
        Args: { _period_month: string; _subscription_id: string }
        Returns: number
      }
      can_access_realtime_topic: {
        Args: { _topic: string; _uid: string }
        Returns: boolean
      }
      can_access_textbooks: { Args: { _user_id: string }; Returns: boolean }
      can_creator_sell: { Args: { _creator_id: string }; Returns: boolean }
      can_manage_credentials: {
        Args: { _profile_id: string }
        Returns: boolean
      }
      cancel_notification: { Args: { _broadcast_id: string }; Returns: boolean }
      check_course_completion: {
        Args: { _textbook_id: string }
        Returns: boolean
      }
      claim_export_job: {
        Args: { _worker_id: string }
        Returns: {
          attempt: number
          completed_at: string | null
          created_at: string
          error_message: string | null
          format: string
          id: string
          lesson_plan_id: string | null
          max_attempts: number
          options: Json
          output_url: string | null
          started_at: string | null
          status: string
          teacher_id: string
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "export_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      clear_player_hand: { Args: { _player_id: string }; Returns: undefined }
      creator_payout_target: {
        Args: { _creator_id: string }
        Returns: {
          recipient_id: string
          recipient_type: string
        }[]
      }
      creator_usage_summary: {
        Args: { _period_month?: string }
        Returns: {
          content_type: string
          event_type: string
          events_count: number
          weight_total: number
        }[]
      }
      dispatch_scheduled_notifications: { Args: never; Returns: number }
      enroll_by_textbook_code: {
        Args: { _code: string; _student_id: string }
        Returns: string
      }
      find_student_by_code: {
        Args: { _code: string }
        Returns: {
          first_name: string
          id: string
          last_name: string
        }[]
      }
      generate_game_code: { Args: never; Returns: string }
      generate_school_registration_code: { Args: never; Returns: string }
      generate_teacher_join_code: { Args: never; Returns: string }
      get_follower_count: { Args: { _creator_id: string }; Returns: number }
      get_internal_secret: { Args: { _name: string }; Returns: string }
      get_login_password: { Args: { _profile_id: string }; Returns: string }
      get_player_session: {
        Args: { _join_token?: string; _session_id: string }
        Returns: {
          activity_data_safe: Json
          created_at: string
          current_question_index: number
          game_code: string
          id: string
          question_started_at: string
          settings: Json
          status: string
          teacher_id: string
          teams: Json
          title: string
          updated_at: string
          whiteboard_data: Json
          zoom_state: Json
        }[]
      }
      get_public_content_usage_counts: {
        Args: {
          _lesson_plan_ids: string[]
          _textbook_ids: string[]
          _worksheet_ids: string[]
        }
        Returns: {
          kind: string
          source_id: string
          usage_count: number
        }[]
      }
      get_public_textbook_all_lessons: {
        Args: { _textbook_id: string }
        Returns: {
          blocks: Json
          hero_image_url: string
          id: string
          sort_order: number
          title: string
          topic_id: string
          topic_sort_order: number
          topic_title: string
        }[]
      }
      get_public_textbook_first_lesson: {
        Args: { _textbook_id: string }
        Returns: {
          blocks: Json
          hero_image_url: string
          id: string
          title: string
        }[]
      }
      get_public_textbook_lesson: {
        Args: { _lesson_id: string; _textbook_id: string }
        Returns: {
          blocks: Json
          hero_image_url: string
          id: string
          title: string
        }[]
      }
      get_public_textbook_outline: {
        Args: { _textbook_id: string }
        Returns: {
          chapter_id: string
          chapter_sort_order: number
          chapter_title: string
          lesson_count: number
          textbook_id: string
          textbook_title: string
          total_lessons: number
        }[]
      }
      get_session_questions: {
        Args: { _join_token?: string; _session_id: string }
        Returns: Json
      }
      get_user_school_id: { Args: { _user_id: string }; Returns: string }
      grant_avatar_item_by_teacher: {
        Args: { p_item_slug: string; p_student_id: string }
        Returns: undefined
      }
      has_active_textbook_trial: {
        Args: { _textbook_id: string; _user_id: string }
        Returns: boolean
      }
      has_login_credential: { Args: { _profile_id: string }; Returns: boolean }
      has_pin: { Args: { _profile_id?: string }; Returns: boolean }
      has_staff_permission: {
        Args: { _module: string; _need_edit?: boolean; _user_id: string }
        Returns: boolean
      }
      increment_player_score: {
        Args: { _player_id: string; _score_delta: number }
        Returns: undefined
      }
      is_active_staff: { Args: { _user_id: string }; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_teacher: { Args: never; Returns: boolean }
      is_class_owner: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_class_teacher: {
        Args: { _class_id: string; _user_id: string }
        Returns: boolean
      }
      is_enrolled_in_textbook: {
        Args: { _student_id: string; _textbook_id: string }
        Returns: boolean
      }
      is_game_session_participant: {
        Args: { _join_token?: string; _session_id: string }
        Returns: boolean
      }
      is_parent_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      is_player_in_game_session: {
        Args: { _session_id: string }
        Returns: boolean
      }
      is_public_shared_textbook: {
        Args: { _textbook_id: string }
        Returns: boolean
      }
      is_school_admin: { Args: { _user_id: string }; Returns: boolean }
      is_school_admin_of: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_teacher_of_game_session: {
        Args: { _session_id: string }
        Returns: boolean
      }
      is_teacher_of_student: {
        Args: { _student_id: string; _user_id: string }
        Returns: boolean
      }
      join_class_as_teacher: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      join_class_by_code: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      join_school_by_code: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      marketplace_current_commission: { Args: never; Returns: number }
      marketplace_phase_metrics: {
        Args: never
        Returns: {
          active_schools: number
          active_subscriptions: number
          items_for_sale: number
          monthly_downloads: number
        }[]
      }
      my_school_sale_settings: {
        Args: never
        Returns: {
          allows_teacher_creators: boolean
          creator_payout_recipient: string
          school_id: string
          school_name: string
        }[]
      }
      notify_deadline_soon: { Args: never; Returns: undefined }
      owns_notebook: { Args: { _notebook_id: string }; Returns: boolean }
      owns_subject_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      owns_textbook: {
        Args: { _teacher_id: string; _textbook_id: string }
        Returns: boolean
      }
      publish_due_lessons: { Args: never; Returns: number }
      publish_due_worksheets: { Args: never; Returns: number }
      raise_hand: {
        Args: { _join_token: string; _raised: boolean }
        Returns: undefined
      }
      reap_stale_export_jobs: { Args: never; Returns: number }
      record_marketplace_usage: {
        Args: {
          _content_id: string
          _content_type: string
          _creator_id: string
          _event_type: string
          _subscription_id: string
        }
        Returns: string
      }
      regenerate_school_registration_code: {
        Args: { _school_id: string }
        Returns: string
      }
      reset_class_leaderboard: {
        Args: { _class_id: string }
        Returns: undefined
      }
      school_license_usage: {
        Args: { _school_id: string }
        Returns: {
          school_id: string
          students_used: number
          teachers_used: number
        }[]
      }
      school_license_usage_all: {
        Args: never
        Returns: {
          school_id: string
          students_used: number
          teachers_used: number
        }[]
      }
      send_admin_notification: {
        Args: {
          _body: string
          _link?: string
          _recipient_ids: string[]
          _title: string
        }
        Returns: number
      }
      send_notification: {
        Args: {
          _content: string
          _link?: string
          _receiver_ids?: string[]
          _receiver_type: string
          _scheduled_at?: string
          _title: string
          _type?: string
        }
        Returns: string
      }
      set_game_whiteboard_slide_strokes: {
        Args: { _session_id: string; _slide_index: number; _strokes: Json }
        Returns: Json
      }
      set_login_password: {
        Args: { _password: string; _profile_id: string }
        Returns: Json
      }
      set_question_answered: {
        Args: { _answered: boolean; _question_id: string }
        Returns: undefined
      }
      set_student_index: {
        Args: { _index: number; _join_token: string }
        Returns: undefined
      }
      set_user_pin: { Args: { _pin: string }; Returns: Json }
      set_user_pin_for: {
        Args: { _pin: string; _profile_id: string }
        Returns: Json
      }
      strip_correct_flags: { Args: { _data: Json }; Returns: Json }
      subject_dependency_counts: {
        Args: { _subject_ids: string[] }
        Returns: {
          class_subject_count: number
          group_count: number
          subject_id: string
        }[]
      }
      submit_live_question: {
        Args: { _join_token: string; _text: string }
        Returns: string
      }
      sync_avatar_unlocks: {
        Args: { p_student_id: string }
        Returns: undefined
      }
      toggle_game_whiteboard: { Args: { _session_id: string }; Returns: Json }
      toggle_question_vote: {
        Args: { _join_token: string; _question_id: string }
        Returns: boolean
      }
      verify_academy_certificate: {
        Args: { _cert_number: string }
        Returns: {
          certificate_number: string
          course_audience: string
          course_title: string
          issued_at: string
          recipient_name: string
        }[]
      }
      verify_academy_pathway_certificate: {
        Args: { _cert_number: string }
        Returns: {
          certificate_number: string
          courses: Json
          issued_at: string
          pathway_description: string
          pathway_title: string
          recipient_name: string
        }[]
      }
      verify_pin_login: {
        Args: { _pin: string; _username: string }
        Returns: Json
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "blocked"
      app_role:
        | "admin"
        | "user"
        | "teacher"
        | "rodic"
        | "school_admin"
        | "lektor"
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
      account_status: ["pending", "approved", "blocked"],
      app_role: ["admin", "user", "teacher", "rodic", "school_admin", "lektor"],
    },
  },
} as const
