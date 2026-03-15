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
      classes: {
        Row: {
          access_code: string | null
          access_code_active: boolean
          archived: boolean
          created_at: string
          description: string
          field_of_study: string
          id: string
          name: string
          school: string
          updated_at: string
          year: number | null
        }
        Insert: {
          access_code?: string | null
          access_code_active?: boolean
          archived?: boolean
          created_at?: string
          description?: string
          field_of_study?: string
          id?: string
          name: string
          school?: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          access_code?: string | null
          access_code_active?: boolean
          archived?: boolean
          created_at?: string
          description?: string
          field_of_study?: string
          id?: string
          name?: string
          school?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
      game_players: {
        Row: {
          created_at: string
          id: string
          nickname: string
          session_id: string
          total_score: number
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          nickname: string
          session_id: string
          total_score?: number
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          nickname?: string
          session_id?: string
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
            foreignKeyName: "game_players_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
            foreignKeyName: "game_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "game_sessions"
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
          title: string
          updated_at: string
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
          title?: string
          updated_at?: string
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
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      lesson_placements: {
        Row: {
          class_id: string | null
          created_at: string
          grade_number: number
          id: string
          lesson_id: string
          subject_slug: string
          topic_id: string | null
        }
        Insert: {
          class_id?: string | null
          created_at?: string
          grade_number: number
          id?: string
          lesson_id: string
          subject_slug: string
          topic_id?: string | null
        }
        Update: {
          class_id?: string | null
          created_at?: string
          grade_number?: number
          id?: string
          lesson_id?: string
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
      lesson_plans: {
        Row: {
          created_at: string
          grade_band: string
          id: string
          input_data: Json
          lesson_id: string
          slides: Json
          subject: string
          teacher_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_band?: string
          id?: string
          input_data?: Json
          lesson_id: string
          slides?: Json
          subject?: string
          teacher_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_band?: string
          id?: string
          input_data?: Json
          lesson_id?: string
          slides?: Json
          subject?: string
          teacher_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lesson_plans_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "textbook_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      lesson_topic_assignments: {
        Row: {
          created_at: string
          id: string
          lesson_id: string
          sort_order: number
          topic_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          lesson_id: string
          sort_order?: number
          topic_id: string
        }
        Update: {
          created_at?: string
          id?: string
          lesson_id?: string
          sort_order?: number
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
      profiles: {
        Row: {
          created_at: string
          email: string
          field_of_study: string
          first_name: string
          id: string
          last_name: string
          school: string
          status: Database["public"]["Enums"]["account_status"]
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          email?: string
          field_of_study?: string
          first_name?: string
          id: string
          last_name?: string
          school?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          email?: string
          field_of_study?: string
          first_name?: string
          id?: string
          last_name?: string
          school?: string
          status?: Database["public"]["Enums"]["account_status"]
          updated_at?: string
          year?: number | null
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
        ]
      }
      teacher_textbook_lessons: {
        Row: {
          blocks: Json
          created_at: string
          id: string
          sort_order: number
          status: string
          textbook_id: string
          title: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          id?: string
          sort_order?: number
          status?: string
          textbook_id: string
          title: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          id?: string
          sort_order?: number
          status?: string
          textbook_id?: string
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
        ]
      }
      teacher_textbooks: {
        Row: {
          access_code: string
          created_at: string
          description: string
          id: string
          subject: string
          teacher_id: string
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          access_code: string
          created_at?: string
          description?: string
          id?: string
          subject?: string
          teacher_id: string
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          access_code?: string
          created_at?: string
          description?: string
          id?: string
          subject?: string
          teacher_id?: string
          title?: string
          updated_at?: string
          visibility?: string
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
          sort_order: number
          status: string
          title: string
          topic_id: string
          updated_at: string
        }
        Insert: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          id?: string
          sort_order?: number
          status?: string
          title: string
          topic_id: string
          updated_at?: string
        }
        Update: {
          blocks?: Json
          created_at?: string
          hero_image_url?: string | null
          id?: string
          sort_order?: number
          status?: string
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
          description?: string | null
          id?: string
          label?: string
          slug?: string
          sort_order?: number | null
          updated_at?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_textbooks: { Args: { _user_id: string }; Returns: boolean }
      enroll_by_textbook_code: {
        Args: { _code: string; _student_id: string }
        Returns: string
      }
      generate_game_code: { Args: never; Returns: string }
      is_admin: { Args: never; Returns: boolean }
      is_admin_or_teacher: { Args: never; Returns: boolean }
      is_enrolled_in_textbook: {
        Args: { _student_id: string; _textbook_id: string }
        Returns: boolean
      }
      join_class_by_code: {
        Args: { _code: string; _user_id: string }
        Returns: string
      }
      owns_textbook: {
        Args: { _teacher_id: string; _textbook_id: string }
        Returns: boolean
      }
    }
    Enums: {
      account_status: "pending" | "approved" | "blocked"
      app_role: "admin" | "user" | "teacher"
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
      app_role: ["admin", "user", "teacher"],
    },
  },
} as const
