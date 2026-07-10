"use client";

import { useSession, exitDemoMode } from "@/components/SessionProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/StatusBadge";
import { COLORS } from "@/lib/constants";
import { Building2, Shield, Crown, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";

const planConfig: Record<
  string,
  { color: string; bg: string; icon: React.ElementType; label: string }
> = {
  starter: {
    color: COLORS.textMuted,
    bg: "rgba(148,163,184,0.15)",
    icon: User,
    label: "Starter",
  },
  growth: {
    color: COLORS.signalBlue,
    bg: "rgba(59,130,246,0.15)",
    icon: Building2,
    label: "Growth",
  },
  enterprise: {
    color: "#A78BFA",
    bg: "rgba(167,139,250,0.15)",
    icon: Crown,
    label: "Enterprise",
  },
};

export default function SettingsPage() {
  const { org } = useSession();
  const router = useRouter();
  const supabase = createClient();

  const plan = org?.plan ?? "starter";
  const planCfg = planConfig[plan] ?? planConfig.starter;
  const PlanIcon = planCfg.icon;

  const handleSignOut = async () => {
    exitDemoMode();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" description="Manage your organisation details" />

      <Panel>
        <div
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{ borderColor: COLORS.border }}
        >
          <Building2 className="h-4 w-4" style={{ color: COLORS.signalBlue }} />
          <p className="text-sm font-bold" style={{ color: COLORS.text }}>
            Organisation
          </p>
        </div>

        <div className="p-5 space-y-1">
          <div
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: COLORS.border }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
              Name
            </p>
            <p className="text-sm font-bold" style={{ color: COLORS.text }}>
              {org?.name ?? "—"}
            </p>
          </div>

          <div
            className="flex items-center justify-between py-3 border-b"
            style={{ borderColor: COLORS.border }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
              Type
            </p>
            <div className="flex items-center gap-1.5">
              {org?.org_type === "government" ? (
                <Shield className="h-3.5 w-3.5" style={{ color: COLORS.signalBlue }} />
              ) : (
                <Building2 className="h-3.5 w-3.5" style={{ color: COLORS.signalBlue }} />
              )}
              <p className="text-sm font-semibold capitalize" style={{ color: COLORS.text }}>
                {org?.org_type ?? "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between py-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.textMuted }}>
              Plan
            </p>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: planCfg.bg, color: planCfg.color }}
            >
              <PlanIcon className="h-3 w-3" />
              {planCfg.label}
            </span>
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden" >
        <div
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{
            borderColor: "rgba(239,68,68,0.3)",
            backgroundColor: "rgba(239,68,68,0.08)",
          }}
        >
          <LogOut className="h-4 w-4" style={{ color: COLORS.alertRed }} />
          <p className="text-sm font-bold" style={{ color: COLORS.alertRed }}>
            Account
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold" style={{ color: COLORS.text }}>
                Sign out
              </p>
              <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                You will be redirected to the login page
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold shrink-0"
              style={{ backgroundColor: "rgba(239,68,68,0.15)", color: COLORS.alertRed }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </Panel>
    </div>
  );
}
