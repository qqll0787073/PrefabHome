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
          company_legal_name: string | null;
          company_display_name: string | null;
          contact_person: string | null;
          contact_title: string | null;
          email: string | null;
          phone: string | null;
          country: string;
          province: string | null;
          city: string | null;
          street_address: string | null;
          postal_code: string | null;
          year_established: number | null;
          export_experience: string | null;
          product_categories: string[];
          certifications: string[];
          company_description: string | null;
          website: string | null;
          verification_status: string;
          application_status: string;
          review_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          submitted_at: string | null;
          factory_profile: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          company_name: string;
          company_legal_name?: string | null;
          company_display_name?: string | null;
          contact_person?: string | null;
          contact_title?: string | null;
          email?: string | null;
          phone?: string | null;
          country?: string;
          province?: string | null;
          city?: string | null;
          street_address?: string | null;
          postal_code?: string | null;
          year_established?: number | null;
          export_experience?: string | null;
          product_categories?: string[];
          certifications?: string[];
          company_description?: string | null;
          website?: string | null;
          verification_status?: string;
          application_status?: string;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string | null;
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
          sku: string | null;
          model_name: string | null;
          slug: string | null;
          category: string;
          short_description: string | null;
          description: string | null;
          tags: string[];
          intended_uses: string[];
          floor_area_sq_ft: number | null;
          bedrooms: number | null;
          bathrooms: number | null;
          stories: number | null;
          length_ft: number | null;
          width_ft: number | null;
          height_ft: number | null;
          structure_material: string | null;
          exterior_finish: string | null;
          roof_type: string | null;
          insulation: string | null;
          electrical_standard: string | null;
          plumbing_standard: string | null;
          wind_rating: string | null;
          snow_load_psf: number | null;
          currency: string;
          fob_price: number | null;
          price_unit: string | null;
          minimum_order_quantity: number | null;
          production_lead_time_weeks: number | null;
          port_of_loading: string | null;
          hs_code: string | null;
          certifications: string[];
          target_markets: string[];
          notes: string | null;
          review_notes: string | null;
          reviewed_by: string | null;
          reviewed_at: string | null;
          submitted_at: string | null;
          published_at: string | null;
          archived_at: string | null;
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
          sku?: string | null;
          model_name?: string | null;
          slug?: string | null;
          category: string;
          short_description?: string | null;
          description?: string | null;
          tags?: string[];
          intended_uses?: string[];
          floor_area_sq_ft?: number | null;
          bedrooms?: number | null;
          bathrooms?: number | null;
          stories?: number | null;
          length_ft?: number | null;
          width_ft?: number | null;
          height_ft?: number | null;
          structure_material?: string | null;
          exterior_finish?: string | null;
          roof_type?: string | null;
          insulation?: string | null;
          electrical_standard?: string | null;
          plumbing_standard?: string | null;
          wind_rating?: string | null;
          snow_load_psf?: number | null;
          currency?: string;
          fob_price?: number | null;
          price_unit?: string | null;
          minimum_order_quantity?: number | null;
          production_lead_time_weeks?: number | null;
          port_of_loading?: string | null;
          hs_code?: string | null;
          certifications?: string[];
          target_markets?: string[];
          notes?: string | null;
          review_notes?: string | null;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          submitted_at?: string | null;
          published_at?: string | null;
          archived_at?: string | null;
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
      product_media: {
        Row: {
          id: string;
          product_id: string;
          media_type:
            | "exterior_image"
            | "interior_image"
            | "floor_plan"
            | "rendering"
            | "factory_photo"
            | "specification_sheet"
            | "catalog"
            | "installation_manual"
            | "certification"
            | "other_document";
          storage_bucket: string;
          storage_path: string;
          original_filename: string | null;
          mime_type: string | null;
          file_size_bytes: number | null;
          title: string | null;
          alt_text: string | null;
          sort_order: number;
          is_primary: boolean;
          visibility: "public" | "private";
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          media_type:
            | "exterior_image"
            | "interior_image"
            | "floor_plan"
            | "rendering"
            | "factory_photo"
            | "specification_sheet"
            | "catalog"
            | "installation_manual"
            | "certification"
            | "other_document";
          storage_bucket: string;
          storage_path: string;
          original_filename?: string | null;
          mime_type?: string | null;
          file_size_bytes?: number | null;
          title?: string | null;
          alt_text?: string | null;
          sort_order?: number;
          is_primary?: boolean;
          visibility?: "public" | "private";
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["product_media"]["Insert"]>;
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
    Views: {
      published_products: {
        Row: Omit<
          Database["public"]["Tables"]["products"]["Row"],
          | "notes"
          | "review_notes"
          | "reviewed_by"
          | "reviewed_at"
          | "submitted_at"
          | "archived_at"
          | "base_price"
          | "size_sqft"
          | "lead_time_weeks"
          | "specifications"
          | "compliance_notes"
        >;
        Insert: never;
        Update: never;
      };
      published_product_media: {
        Row: Omit<
          Database["public"]["Tables"]["product_media"]["Row"],
          "created_by" | "updated_at"
        >;
        Insert: never;
        Update: never;
      };
    };
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
