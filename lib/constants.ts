/** Observer design tokens — locked per .cursorrules Section 7 */

export const COLORS = {
  midnight: "#0F1923",
  signalBlue: "#2563EB",
  alertRed: "#DC2626",
  safeGreen: "#16A34A",
  cautionAmber: "#F59E0B",
  surface: "#F8FAFC",
  slate: "#64748B",
  alertBg: "#FFF5F5",
  blueTint: "#EFF6FF",
} as const;

export const BACKEND_WS_URL =
  process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? "ws://localhost:8000";

export const BACKEND_API_URL =
  process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:8000";

/** LAN URL for phone camera nodes — set to http://YOUR_LAPTOP_IP:3000 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ?? "";

export function getCameraNodeUrl(cameraId: string, orgId: string): string {
  const base =
    APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
  return `${base}/camera-node/${encodeURIComponent(cameraId)}?orgId=${encodeURIComponent(orgId)}`;
}

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const PRICING_TIERS = {
  starter: {
    name: "Starter",
    features: [
      "Up to 3 camera nodes",
      "Live multi-camera dashboard",
      "AI anomaly detection (fight, fall, loitering, crowd surge)",
      "Pre-buffer incident auto-clipping",
      "7-day incident clip storage",
      "Email alerts (1 recipient)",
    ],
  },
  growth: {
    name: "Growth",
    recommended: true,
    features: [
      "Up to 15 camera nodes",
      "Everything in Starter, plus:",
      "30-day incident clip storage",
      "Email alerts (up to 10 recipients)",
      "Auto-generated PDF incident reports",
      "Up to 5 dashboard users with roles",
    ],
  },
  enterprise: {
    name: "Enterprise",
    features: [
      "Unlimited camera nodes",
      "Everything in Growth, plus:",
      "1-year incident clip storage",
      "Unlimited dashboard users",
      "Priority alert escalation (SMS/call) — UI only",
      "Dedicated control room integration — UI only",
      "API access — UI only",
    ],
  },
} as const;

export type AnomalyType =
  | "FIGHT_DETECTED"
  | "LOITERING_DETECTED"
  | "PERSON_FALLEN"
  | "CROWD_SURGE";

export interface AlertPayload {
  type: AnomalyType;
  camera_id: string;
  org_id: string;
  confidence: number;
  message: string;
  location?: string | null;
  clip_url?: string | null;
  incident_id?: string | null;
  timestamp?: string;
}

export interface Camera {
  id: string;
  org_id: string;
  name: string;
  location: string;
  address?: string | null;
  is_active: boolean;
  created_at?: string;
}

export interface Incident {
  id: string;
  org_id: string;
  camera_id: string;
  type: AnomalyType;
  confidence: number | null;
  clip_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  reviewed: boolean;
  created_at?: string;
}

export interface Organization {
  id: string;
  name: string;
  org_type: "government" | "private";
  plan: "starter" | "growth" | "enterprise";
}

export function formatAnomalyType(type: AnomalyType): string {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
