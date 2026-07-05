"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Shield, Building2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BACKEND_API_URL, COLORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase";

type Stage = "account" | "organisation";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [stage, setStage] = useState<Stage>("account");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState<"government" | "private">("government");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Store the signed-up user so Step 2 doesn't rely on an active session
  // (Supabase requires email confirmation by default, so getUser() returns null)
  const [signedUpUserId, setSignedUpUserId] = useState<string | null>(null);

  const onAccountSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error: signUpError } = await supabase.auth.signUp({ email, password });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Capture user ID from signUp response — works even if email confirmation
    // is required (Supabase won't have an active session yet in that case,
    // so calling getUser() on step 2 would return null and show "Session expired").
    if (!data.user) {
      setError("Could not create account. Please try again.");
      setLoading(false);
      return;
    }

    setSignedUpUserId(data.user.id);
    setStage("organisation");
    setLoading(false);
  };

  const onOrgSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Prefer the session user (email confirmation disabled) but fall back to
    // the ID we captured at sign-up time (email confirmation enabled).
    const {
      data: { user: sessionUser },
    } = await supabase.auth.getUser();

    const userId = sessionUser?.id ?? signedUpUserId;

    if (!userId) {
      setError("Session expired — please sign up again.");
      setStage("account");
      setLoading(false);
      return;
    }

    // Route through backend API (service-role key bypasses RLS)
    try {
      const res = await fetch(`${BACKEND_API_URL}/onboarding/setup-org`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          org_name: orgName,
          org_type: orgType,
          plan: "starter",
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.detail || `Setup failed (${res.status})`);
        setLoading(false);
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* ── Left panel — dark branding ── */}
      <div
        className="hidden lg:flex lg:w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: `linear-gradient(160deg, ${COLORS.midnight} 0%, #0d2137 60%, #111827 100%)` }}
      >
        {/* Background glow */}
        <div
          className="absolute"
          style={{
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.12) 0%, transparent 70%)",
            top: "30%",
            left: "40%",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        />

        <Logo size="lg" dark />

        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-4xl font-extrabold text-white leading-tight mb-4"
          >
            Your organisation&apos;s{" "}
            <span className="gradient-text">command centre</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-base leading-relaxed mb-6"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Set up in under 60 seconds. Connect your first camera and start monitoring immediately.
          </motion.p>

          {/* Step progress indicator */}
          <div className="flex items-center gap-3 mt-8">
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300"
              style={{
                backgroundColor: stage === "account" ? "rgba(37,99,235,0.3)" : "rgba(22,163,74,0.2)",
                color: stage === "account" ? "#60a5fa" : "#4ade80",
                border: `1px solid ${stage === "account" ? "rgba(37,99,235,0.4)" : "rgba(22,163,74,0.3)"}`,
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: stage === "account" ? "#2563eb" : "#16a34a" }}
              >
                {stage === "account" ? "1" : "✓"}
              </span>
              Create account
            </div>
            <div className="w-8 h-px" style={{ backgroundColor: "rgba(255,255,255,0.15)" }} />
            <div
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300"
              style={{
                backgroundColor: stage === "organisation" ? "rgba(37,99,235,0.3)" : "rgba(255,255,255,0.05)",
                color: stage === "organisation" ? "#60a5fa" : "rgba(255,255,255,0.35)",
                border: `1px solid ${stage === "organisation" ? "rgba(37,99,235,0.4)" : "rgba(255,255,255,0.1)"}`,
              }}
            >
              <span
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: stage === "organisation" ? "#2563eb" : "rgba(255,255,255,0.15)" }}
              >
                2
              </span>
              Your organisation
            </div>
          </div>
        </div>

        <p className="text-xs relative z-10" style={{ color: "rgba(255,255,255,0.25)" }}>
          © {new Date().getFullYear()} Observer — AI Surveillance Platform
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: COLORS.surface }}>
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Logo size="md" />
          </div>

          <AnimatePresence mode="wait">
            {stage === "account" ? (
              <motion.div
                key="account"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35 }}
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-extrabold mb-2" style={{ color: COLORS.midnight }}>
                    Create your account
                  </h1>
                  <p className="text-sm" style={{ color: COLORS.slate }}>
                    Step 1 of 2 — Account credentials
                  </p>
                </div>

                <form onSubmit={onAccountSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: COLORS.midnight }}>
                      Work email
                    </label>
                    <Input
                      type="email"
                      placeholder="you@organisation.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11 rounded-xl text-sm"
                      style={{ borderColor: "#e2e8f0" }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: COLORS.midnight }}>
                      Password
                    </label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 6 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        minLength={6}
                        required
                        className="h-11 rounded-xl text-sm pr-10"
                        style={{ borderColor: "#e2e8f0" }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                        style={{ color: COLORS.slate }}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
                      style={{ backgroundColor: "#fee2e2", color: COLORS.alertRed }}
                    >
                      <span className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold shrink-0">!</span>
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold text-white rounded-xl"
                    style={{
                      background: loading ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                      boxShadow: loading ? "none" : "0 6px 20px rgba(37,99,235,0.4)",
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Creating account…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Continue <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>

                <p className="mt-6 text-sm text-center" style={{ color: COLORS.slate }}>
                  Already have an account?{" "}
                  <Link href="/login" className="font-semibold hover:underline" style={{ color: COLORS.signalBlue }}>
                    Sign in
                  </Link>
                </p>
              </motion.div>
            ) : (
              <motion.div
                key="org"
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35 }}
              >
                <div className="mb-8">
                  <h1 className="text-2xl font-extrabold mb-2" style={{ color: COLORS.midnight }}>
                    Create your organisation
                  </h1>
                  <p className="text-sm" style={{ color: COLORS.slate }}>
                    Step 2 of 2 — Organisation details
                  </p>
                </div>

                <form onSubmit={onOrgSubmit} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5" style={{ color: COLORS.midnight }}>
                      Organisation name
                    </label>
                    <Input
                      placeholder="e.g. Ongole Police Department"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      required
                      className="h-11 rounded-xl text-sm"
                      style={{ borderColor: "#e2e8f0" }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: COLORS.midnight }}>
                      Organisation type
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {([
                        { value: "government", icon: Shield, label: "Government" },
                        { value: "private", icon: Building2, label: "Private" },
                      ] as const).map(({ value, icon: Icon, label }) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setOrgType(value)}
                          className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-sm font-semibold transition-all duration-200"
                          style={{
                            borderColor: orgType === value ? COLORS.signalBlue : "#e2e8f0",
                            backgroundColor: orgType === value ? COLORS.blueTint : "white",
                            color: orgType === value ? COLORS.signalBlue : COLORS.slate,
                            boxShadow: orgType === value ? "0 0 0 3px rgba(37,99,235,0.1)" : "none",
                          }}
                        >
                          <Icon className="h-5 w-5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
                      style={{ backgroundColor: "#fee2e2", color: COLORS.alertRed }}
                    >
                      <span className="w-4 h-4 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold shrink-0">!</span>
                      {error}
                    </motion.div>
                  )}

                  <Button
                    type="submit"
                    className="w-full h-11 font-semibold text-white rounded-xl"
                    style={{
                      background: loading ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                      boxShadow: loading ? "none" : "0 6px 20px rgba(37,99,235,0.4)",
                    }}
                    disabled={loading}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                        Setting up…
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        Launch dashboard <ArrowRight className="h-4 w-4" />
                      </span>
                    )}
                  </Button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

