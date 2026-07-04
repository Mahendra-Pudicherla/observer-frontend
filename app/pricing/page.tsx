"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ArrowRight, Zap, ChevronLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { COLORS, PRICING_TIERS } from "@/lib/constants";

const tierColors: Record<string, { accent: string; bg: string; glow: string }> = {
  starter: { accent: COLORS.slate, bg: "white", glow: "none" },
  growth: { accent: COLORS.signalBlue, bg: COLORS.blueTint, glow: "0 0 40px rgba(37,99,235,0.2), 0 20px 60px rgba(37,99,235,0.1)" },
  enterprise: { accent: "#7c3aed", bg: "#f5f3ff", glow: "none" },
};

export default function PricingPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.surface, fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b bg-white"
        style={{ borderColor: "rgba(0,0,0,0.06)", boxShadow: "0 1px 8px rgba(0,0,0,0.05)" }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ color: COLORS.slate }}>
            <ChevronLeft className="h-4 w-4" /> Back
          </Link>
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-sm font-medium hidden sm:flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="text-sm font-semibold text-white rounded-xl px-5"
              style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 4px 14px rgba(37,99,235,0.4)" }}
            >
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section
        className="text-center py-20 px-6 relative overflow-hidden"
        style={{ background: `linear-gradient(170deg, ${COLORS.midnight} 0%, #0d2137 70%, ${COLORS.surface} 100%)` }}
      >
        <div
          className="absolute"
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.15) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        />
        <div className="relative z-10 max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#60a5fa" }}>
              Simple &amp; transparent
            </p>
            <h1 className="text-5xl font-extrabold tracking-tight text-white mb-4">
              Pricing that scales with you
            </h1>
            <p className="text-lg leading-relaxed" style={{ color: "rgba(255,255,255,0.55)" }}>
              Every plan includes full platform access. No payment processor required at launch — pick your tier and start monitoring.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Pricing cards */}
      <main className="max-w-5xl mx-auto px-6 -mt-8 pb-24">
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {Object.entries(PRICING_TIERS).map(([key, tier], i) => {
            const recommended = "recommended" in tier && tier.recommended;
            const tc = tierColors[key] ?? tierColors.starter;

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-white rounded-2xl overflow-hidden relative"
                style={{
                  border: recommended ? `2px solid ${COLORS.signalBlue}` : "1px solid rgba(0,0,0,0.07)",
                  boxShadow: recommended ? tc.glow : "0 4px 20px rgba(0,0,0,0.06)",
                  transform: recommended ? "scale(1.03)" : "scale(1)",
                }}
              >
                {/* Recommended badge */}
                {recommended && (
                  <div className="absolute top-0 left-0 right-0 flex justify-center -translate-y-1/2 z-10">
                    <span
                      className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full text-xs font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 4px 14px rgba(37,99,235,0.4)" }}
                    >
                      <Zap className="h-3 w-3" /> Most Popular
                    </span>
                  </div>
                )}

                {/* Top accent bar */}
                <div
                  className="h-1"
                  style={{ background: recommended ? "linear-gradient(90deg, #2563eb, #60a5fa)" : tc.accent === COLORS.slate ? "#f1f5f9" : `linear-gradient(90deg, ${tc.accent}, ${tc.accent}88)` }}
                />

                {/* Header */}
                <div className="px-6 pt-7 pb-5 border-b" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
                  <p
                    className="text-xl font-extrabold mb-1"
                    style={{ color: recommended ? COLORS.signalBlue : COLORS.midnight }}
                  >
                    {tier.name}
                  </p>
                  <p className="text-xs" style={{ color: COLORS.slate }}>
                    {key === "starter" && "For small teams getting started"}
                    {key === "growth" && "For growing operations"}
                    {key === "enterprise" && "For large-scale deployments"}
                  </p>
                </div>

                {/* Features */}
                <div className="px-6 py-5">
                  <ul className="space-y-3">
                    {tier.features.map((feature) => {
                      const isCross = feature.startsWith("—") || feature.includes("UI only");
                      return (
                        <li key={feature} className="flex items-start gap-2.5 text-sm">
                          {isCross ? (
                            <XCircle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "#cbd5e1" }} />
                          ) : (
                            <CheckCircle2
                              className="h-4 w-4 shrink-0 mt-0.5"
                              style={{ color: recommended ? COLORS.signalBlue : COLORS.safeGreen }}
                            />
                          )}
                          <span style={{ color: isCross ? COLORS.slate : COLORS.midnight }}>
                            {feature}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {/* CTA */}
                <div className="px-6 pb-6">
                  <Button
                    asChild
                    className="w-full h-11 font-bold text-sm rounded-xl"
                    style={
                      recommended
                        ? {
                            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                            color: "white",
                            boxShadow: "0 6px 20px rgba(37,99,235,0.4)",
                          }
                        : {
                            backgroundColor: "white",
                            color: COLORS.midnight,
                            border: `1.5px solid ${COLORS.midnight}22`,
                          }
                    }
                  >
                    <Link href="/signup">
                      Get Started <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center text-xs mt-10"
          style={{ color: COLORS.slate }}
        >
          No credit card required · No payment processor · Full platform access during launch period
        </motion.p>
      </main>
    </div>
  );
}

