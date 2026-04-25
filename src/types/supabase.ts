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
      activities: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          created_by: string | null
          google_maps_url: string | null
          google_place_id: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          slug: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          slug: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          google_maps_url?: string | null
          google_place_id?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          slug?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_completions: {
        Row: {
          activity_id: string
          completed_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          completed_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          completed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_completions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_image_comments: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          image_id: string
          parent_comment_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_id: string
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          image_id?: string
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_image_comments_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "activity_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_image_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "activity_image_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_image_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_image_likes: {
        Row: {
          created_at: string
          image_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          image_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          image_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_image_likes_image_id_fkey"
            columns: ["image_id"]
            isOneToOne: false
            referencedRelation: "activity_images"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_image_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_images: {
        Row: {
          activity_id: string
          created_at: string
          height: number | null
          id: string
          storage_path: string
          thumbhash: string | null
          uploaded_by: string
          width: number | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          height?: number | null
          id?: string
          storage_path: string
          thumbhash?: string | null
          uploaded_by: string
          width?: number | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          height?: number | null
          id?: string
          storage_path?: string
          thumbhash?: string | null
          uploaded_by?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_images_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_images_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_votes: {
        Row: {
          activity_id: string
          created_at: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          activity_id: string
          created_at?: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          activity_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_votes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          current_trip_id: string | null
          display_name: string | null
          email: string | null
          id: string
          influence: number
          onboarded_at: string | null
          theme: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          current_trip_id?: string | null
          display_name?: string | null
          email?: string | null
          id: string
          influence?: number
          onboarded_at?: string | null
          theme?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          current_trip_id?: string | null
          display_name?: string | null
          email?: string | null
          id?: string
          influence?: number
          onboarded_at?: string | null
          theme?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_current_trip_id_fkey"
            columns: ["current_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_activities: {
        Row: {
          best_time: string | null
          category: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          db_activity_id: string | null
          description: string | null
          destination_id: string | null
          difficulty: string | null
          duration: string | null
          estimated_cost: string | null
          google_place_id: string | null
          id: string
          location: string | null
          name: string
          saved_by_ids: string[]
          tips: string | null
          trip_id: string
        }
        Insert: {
          best_time?: string | null
          category?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          db_activity_id?: string | null
          description?: string | null
          destination_id?: string | null
          difficulty?: string | null
          duration?: string | null
          estimated_cost?: string | null
          google_place_id?: string | null
          id?: string
          location?: string | null
          name: string
          saved_by_ids?: string[]
          tips?: string | null
          trip_id: string
        }
        Update: {
          best_time?: string | null
          category?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          db_activity_id?: string | null
          description?: string | null
          destination_id?: string | null
          difficulty?: string | null
          duration?: string | null
          estimated_cost?: string | null
          google_place_id?: string | null
          id?: string
          location?: string | null
          name?: string
          saved_by_ids?: string[]
          tips?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_activities_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activities_db_activity_id_fkey"
            columns: ["db_activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_emergency_contacts: {
        Row: {
          city_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          destination_id: string | null
          id: string
          name: string
          number: string
          trip_id: string
          type: string | null
        }
        Insert: {
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_id?: string | null
          id?: string
          name: string
          number: string
          trip_id: string
          type?: string | null
        }
        Update: {
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          destination_id?: string | null
          id?: string
          name?: string
          number?: string
          trip_id?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_emergency_contacts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_emergency_contacts_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          joined_at: string
          role: string
          trip_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          trip_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_translations: {
        Row: {
          category: string | null
          city_id: string | null
          created_at: string
          created_by: string | null
          destination_id: string | null
          english: string
          id: string
          local: string
          pronunciation: string | null
          trip_id: string
        }
        Insert: {
          category?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          destination_id?: string | null
          english: string
          id?: string
          local: string
          pronunciation?: string | null
          trip_id: string
        }
        Update: {
          category?: string | null
          city_id?: string | null
          created_at?: string
          created_by?: string | null
          destination_id?: string | null
          english?: string
          id?: string
          local?: string
          pronunciation?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_translations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_translations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          cities: string[] | null
          cover_image_path: string | null
          created_at: string
          end_date: string | null
          id: string
          owner_id: string
          plan: Json
          share_token: string | null
          start_date: string | null
          title: string
          updated_at: string
          visibility: string
        }
        Insert: {
          cities?: string[] | null
          cover_image_path?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          owner_id: string
          plan?: Json
          share_token?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          cities?: string[] | null
          cover_image_path?: string | null
          created_at?: string
          end_date?: string | null
          id?: string
          owner_id?: string
          plan?: Json
          share_token?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      activity_vote_scores: {
        Row: {
          activity_id: string | null
          downvotes: number | null
          score: number | null
          upvotes: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_votes_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      gen_share_token: { Args: never; Returns: string }
      is_trip_member: { Args: { t: string }; Returns: boolean }
      join_trip: { Args: { p_token: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const

