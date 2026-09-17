import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = (typeof import.meta !== "undefined" &&
  (import.meta as any).env?.VITE_SUPABASE_URL) ||
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.SUPABASE_URL) ||
  (typeof process !== "undefined" &&
    (process as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  "";
const supabaseAnonKey = (typeof import.meta !== "undefined" &&
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== "undefined" &&
    (import.meta as any).env?.SUPABASE_ANON_KEY) ||
  (typeof process !== "undefined" &&
    (process as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  "";

// Basic type mapping for Supabase tables.
// You might want to generate more specific types from your database schema.
export interface Database {
  public: {
    Tables: {
      participants: {
        Row: {
          id: string;
          created_at: string;
          full_name: string;
          email: string;
          phone: string;
          birth_date: string;
          terms_accepted_at: string | null;
          terms_version: string | null;
          org_id: string | null;
          preferences: Record<string, any> | null;
        };
        Insert: {
          full_name: string;
          email: string;
          phone: string;
          birth_date: string;
          terms_accepted_at?: string | null;
          terms_version?: string | null;
          org_id?: string | null;
          preferences?: Record<string, any> | null;
        };
        Update: Partial<Database["public"]["Tables"]["participants"]["Insert"]>;
        Relationships: [];
      };
      feature_flags: {
        Row: {
          key: string;
          enabled: boolean;
          org_id: string | null;
          created_at: string;
        };
        Insert: {
          key: string;
          enabled?: boolean;
          org_id?: string | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["feature_flags"]["Insert"]
        >;
        Relationships: [];
      };
      spins: {
        Row: {
          id: string;
          created_at: string;
          participant_id: string;
          prize_id: string;
          redeemed: boolean;
          org_id: string | null;
          expires_at: string | null;
        };
        Insert: {
          participant_id: string;
          prize_id: string;
          redeemed?: boolean;
          org_id?: string | null;
          expires_at?: string | null;
        };
        Update: {
          redeemed?: boolean;
        };
        Relationships: [];
      };
      user_interactions: {
        Row: {
          id: string;
          created_at: string;
          participant_id: string | null;
          event_type: string;
          metadata: Record<string, any> | null;
        };
        Insert: {
          participant_id?: string | null;
          event_type: string;
          metadata?: Record<string, any> | null;
        };
        Update: {};
        Relationships: [
          {
            foreignKeyName: "user_interactions_participant_id_fkey";
            columns: ["participant_id"];
            isOneToOne: false;
            referencedRelation: "participants";
            referencedColumns: ["id"];
          }
        ];
      };
      whatsapp_messages: {
        Row: {
          id: string;
          created_at: string;
          phone_number: string;
          sender: "user" | "agent";
          message_content: string;
          sender_name: string | null;
        };
        Insert: {
          phone_number: string;
          sender: "user" | "agent";
          message_content: string;
          sender_name?: string | null;
        };
        Update: {};
        Relationships: [];
      };
      whatsapp_conversations: {
        Row: {
          id: string;
          timestamp: string;
          phone_number: string;
          sender_type: "user" | "agent" | "assistant";
          message_content: string;
          sender_name: string | null;
        };
        Insert: {
          timestamp?: string;
          phone_number: string;
          sender_type: "user" | "agent" | "assistant";
          message_content: string;
          sender_name?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["whatsapp_conversations"]["Insert"]>;
        Relationships: [];
      };
      whatsapp_daily_metrics: {
        Row: {
          total_messages: number;
          inbound_messages: number;
          outbound_messages: number;
          unique_customers: number;
          date: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      reservations: {
        Row: {
          id: string;
          created_at: string;
          updated_at: string;
          phone_number: string;
          customer_name: string | null;
          reservation_time: string | null;
          party_size: number | null;
          status: "pending" | "confirmed" | "cancelled";
          notes: string | null;
          source: "text" | "voice" | "whatsapp";
        };
        Insert: {
          phone_number: string;
          customer_name?: string | null;
          reservation_time?: string | null;
          party_size?: number | null;
          status?: "pending" | "confirmed" | "cancelled";
          notes?: string | null;
          source?: "text" | "voice" | "whatsapp";
        };
        Update: Partial<Database["public"]["Tables"]["reservations"]["Insert"]>;
        Relationships: [];
      };
      restaurant_settings: {
        Row: {
          id: string;
          updated_at: string;
          restaurant_name: string | null;
          restaurant_address: string | null;
          restaurant_phone: string | null;
          restaurant_email: string | null;
          opening_hours: string | null;
          menu_highlights: string[] | null;
          about_restaurant: string | null;
          evolution_api_url: string | null;
          evolution_api_key: string | null;
          n8n_webhook_url: string | null;
          n8n_config: Record<string, any> | null;
        };
        Insert: {
          id?: string;
          restaurant_name?: string | null;
          restaurant_address?: string | null;
          restaurant_phone?: string | null;
          restaurant_email?: string | null;
          opening_hours?: string | null;
          menu_highlights?: string[] | null;
          about_restaurant?: string | null;
          evolution_api_url?: string | null;
          evolution_api_key?: string | null;
          n8n_webhook_url?: string | null;
          n8n_config?: Record<string, any> | null;
        };
        Update: Partial<
          Database["public"]["Tables"]["restaurant_settings"]["Insert"]
        >;
        Relationships: [];
      };
      admin_users: {
        Row: {
          id: string;
          user_id: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          role?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_users"]["Insert"]>;
        Relationships: [];
      };
      menu_items: {
        Row: {
          id: string;
          created_at: string;
          name: string;
          description: string | null;
          price: number;
          category: string;
          is_available: boolean;
          pairing_notes: string | null;
        };
        Insert: {
          name: string;
          description?: string | null;
          price: number;
          category: string;
          is_available?: boolean;
          pairing_notes?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["menu_items"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export const isSupabaseConfigured = !!supabaseUrl &&
  !!supabaseAnonKey &&
  !String(supabaseUrl).includes("YOUR_SUPABASE_URL") &&
  !String(supabaseAnonKey).includes("YOUR_SUPABASE_ANON_KEY");

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : null;
