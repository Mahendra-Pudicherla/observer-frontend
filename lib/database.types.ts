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
      organizations: {
        Row: {
          id: string;
          name: string;
          org_type: "government" | "private";
          plan: "starter" | "growth" | "enterprise";
          created_at: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          org_type: "government" | "private";
          plan?: "starter" | "growth" | "enterprise";
          created_at?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          org_type?: "government" | "private";
          plan?: "starter" | "growth" | "enterprise";
          created_at?: string | null;
        };
        Relationships: [];
      };
      org_members: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role: "admin" | "operator" | "viewer";
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role?: "admin" | "operator" | "viewer";
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          role?: "admin" | "operator" | "viewer";
          created_at?: string | null;
        };
        Relationships: [];
      };
      cameras: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          location: string;
          address: string | null;
          is_active: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id: string;
          org_id: string;
          name: string;
          location: string;
          address?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          location?: string;
          address?: string | null;
          is_active?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
      incidents: {
        Row: {
          id: string;
          org_id: string;
          camera_id: string;
          type:
            | "FIGHT_DETECTED"
            | "LOITERING_DETECTED"
            | "PERSON_FALLEN"
            | "CROWD_SURGE";
          confidence: number | null;
          clip_url: string | null;
          started_at: string | null;
          ended_at: string | null;
          reviewed: boolean | null;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          org_id: string;
          camera_id: string;
          type:
            | "FIGHT_DETECTED"
            | "LOITERING_DETECTED"
            | "PERSON_FALLEN"
            | "CROWD_SURGE";
          confidence?: number | null;
          clip_url?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          reviewed?: boolean | null;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          org_id?: string;
          camera_id?: string;
          type?:
            | "FIGHT_DETECTED"
            | "LOITERING_DETECTED"
            | "PERSON_FALLEN"
            | "CROWD_SURGE";
          confidence?: number | null;
          clip_url?: string | null;
          started_at?: string | null;
          ended_at?: string | null;
          reviewed?: boolean | null;
          created_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
