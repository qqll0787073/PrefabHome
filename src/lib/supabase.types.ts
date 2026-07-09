export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: "buyer" | "manufacturer" | "admin";
          full_name: string | null;
          email: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: "buyer" | "manufacturer" | "admin";
          full_name?: string | null;
          email: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
      };
      buyers: {
        Row: {
          id: string;
          profile_id: string;
          preferred_state: string | null;
          budget_min: number | null;
          budget_max: number | null;
          project_timeline: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          preferred_state?: string | null;
          budget_min?: number | null;
          budget_max?: number | null;
          project_timeline?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["buyers"]["Insert"]>;
      };
      manufacturers: {
        Row: {
          id: string;
          owner_id: string;
          company_name: string;
          country: string;
          province: string | null;
          city: string | null;
          website: string | null;
          verification_status: string;
          factory_profile: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          company_name: string;
          country?: string;
          province?: string | null;
          city?: string | null;
          website?: string | null;
          verification_status?: string;
          factory_profile?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["manufacturers"]["Insert"]>;
      };
      products: {
        Row: {
          id: string;
          manufacturer_id: string;
          name: string;
          category: string;
          description: string | null;
          base_price: number | null;
          size_sqft: number | null;
          lead_time_weeks: number | null;
          status: string;
          specifications: Json;
          compliance_notes: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          manufacturer_id: string;
          name: string;
          category: string;
          description?: string | null;
          base_price?: number | null;
          size_sqft?: number | null;
          lead_time_weeks?: number | null;
          status?: string;
          specifications?: Json;
          compliance_notes?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["products"]["Insert"]>;
      };
      quote_requests: {
        Row: {
          id: string;
          buyer_id: string;
          product_id: string;
          manufacturer_id: string;
          status: string;
          budget: number | null;
          destination_state: string | null;
          destination_zip: string | null;
          customization: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          product_id: string;
          manufacturer_id: string;
          status?: string;
          budget?: number | null;
          destination_state?: string | null;
          destination_zip?: string | null;
          customization?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["quote_requests"]["Insert"]>;
      };
      messages: {
        Row: {
          id: string;
          quote_request_id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          created_at: string;
          read_at: string | null;
        };
        Insert: {
          id?: string;
          quote_request_id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          created_at?: string;
          read_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["messages"]["Insert"]>;
      };
      saved_products: {
        Row: {
          buyer_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          buyer_id: string;
          product_id: string;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["saved_products"]["Insert"]>;
      };
      manufacturer_outreach: {
        Row: {
          id: string;
          manufacturer_id: string;
          contact_name: string | null;
          contact_email: string | null;
          company_name: string;
          stage: string;
          last_contacted_at: string | null;
          notes: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          manufacturer_id: string;
          contact_name?: string | null;
          contact_email?: string | null;
          company_name: string;
          stage?: string;
          last_contacted_at?: string | null;
          notes?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<
          Database["public"]["Tables"]["manufacturer_outreach"]["Insert"]
        >;
      };
      import_documents: {
        Row: {
          id: string;
          owner_id: string;
          quote_request_id: string | null;
          document_type: string;
          storage_path: string;
          status: string;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          quote_request_id?: string | null;
          document_type: string;
          storage_path: string;
          status?: string;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_documents"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
