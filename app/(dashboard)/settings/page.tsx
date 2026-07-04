"use client";

import { useSession } from "@/components/SessionProvider";
import { COLORS } from "@/lib/constants";
import { Building2, Shield, Crown, User, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const planConfig: Record<string, { color: string; bg: string; icon: React.ElementType; label: string }> = {
  starter: { color: COLORS.slate, bg: "#f1f5f9", icon: User, label: "Starter" },
  growth: { color: COLORS.signalBlue, bg: COLORS.blueTint, icon: Building2, label: "Growth" },
  enterprise: { color: "#7c3aed", bg: "#f5f3ff", icon: Crown, label: "Enterprise" },
};

export default function SettingsPage() {
  const { org } = useSession();
  const router = useRouter();
  const supabase = createClient();

  const plan = org?.plan ?? "starter";
  const planCfg = planConfig[plan] ?? planConfig.starter;
  const PlanIcon = planCfg.icon;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="max-w-xl space-y-6" style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* Header */}
      <div>
        <h1 className="text-xl font-extrabold" style={{ color: COLORS.midnight }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: COLORS.slate }}>Manage your organisation details</p>
      </div>

      {/* Organisation card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      >
        {/* Card header */}
        <div
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{ borderColor: "rgba(0,0,0,0.05)" }}
        >
          <Building2 className="h-4 w-4" style={{ color: COLORS.signalBlue }} />
          <p className="text-sm font-bold" style={{ color: COLORS.midnight }}>Organisation</p>
        </div>

        <div className="p-5 space-y-4">
          {/* Name */}
          <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.slate }}>Name</p>
            <p className="text-sm font-bold" style={{ color: COLORS.midnight }}>{org?.name ?? "—"}</p>
          </div>

          {/* Type */}
          <div className="flex items-center justify-between py-3 border-b" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.slate }}>Type</p>
            <div className="flex items-center gap-1.5">
              {org?.org_type === "government" ? (
                <Shield className="h-3.5 w-3.5" style={{ color: COLORS.signalBlue }} />
              ) : (
                <Building2 className="h-3.5 w-3.5" style={{ color: COLORS.signalBlue }} />
              )}
              <p className="text-sm font-semibold capitalize" style={{ color: COLORS.midnight }}>
                {org?.org_type ?? "—"}
              </p>
            </div>
          </div>

          {/* Plan */}
          <div className="flex items-center justify-between py-3">
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: COLORS.slate }}>Plan</p>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold"
              style={{ backgroundColor: planCfg.bg, color: planCfg.color }}
            >
              <PlanIcon className="h-3 w-3" />
              {planCfg.label}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Danger zone */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid #fecaca", boxShadow: "0 2px 12px rgba(220,38,38,0.06)" }}
      >
        <div
          className="px-5 py-4 border-b flex items-center gap-2"
          style={{ borderColor: "#fecaca", backgroundColor: "#fff5f5" }}
        >
          <LogOut className="h-4 w-4" style={{ color: COLORS.alertRed }} />
          <p className="text-sm font-bold" style={{ color: COLORS.alertRed }}>Account</p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold" style={{ color: COLORS.midnight }}>Sign out</p>
              <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>You will be redirected to the login page</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:bg-red-100"
              style={{ backgroundColor: "#fee2e2", color: COLORS.alertRed }}
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

