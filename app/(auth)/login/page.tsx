"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { motion } from "framer-motion";
import { Eye, EyeOff, ArrowRight, Camera, Shield, Zap, Play } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COLORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase";
import { enterDemoMode } from "@/components/SessionProvider";

const highlights = [
  { icon: Camera, text: "Connect any phone as a camera node" },
  { icon: Shield, text: "AI detects fights, falls, loitering & crowds" },
  { icon: Zap, text: "Pre-buffer clips saved automatically" },
];

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
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
            top: "20%",
            left: "30%",
            transform: "translate(-50%,-50%)",
            pointerEvents: "none",
          }}
        />

        <Logo size="lg" dark />

        <div className="relative z-10">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl font-extrabold text-white leading-tight mb-4"
          >
            Security intelligence,{" "}
            <span className="gradient-text">not complexity.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-base mb-10 leading-relaxed"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            Real-time AI surveillance for police departments, malls, and organisations of all sizes.
          </motion.p>
          <div className="space-y-4">
            {highlights.map(({ icon: Icon, text }, i) => (
              <motion.div
                key={text}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.1 }}
                className="flex items-center gap-3"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ backgroundColor: "rgba(37,99,235,0.2)", border: "1px solid rgba(37,99,235,0.3)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "#60a5fa" }} />
                </div>
                <span className="text-sm" style={{ color: "rgba(255,255,255,0.65)" }}>{text}</span>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-xs relative z-10" style={{ color: "rgba(255,255,255,0.25)" }}>
          © {new Date().getFullYear()} Observer — AI Surveillance Platform
        </p>
      </div>

      {/* ── Right panel — form ── */}
      <div className="flex-1 flex items-center justify-center p-8" style={{ backgroundColor: COLORS.surface }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Logo size="md" />
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-extrabold mb-2" style={{ color: COLORS.midnight }}>
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: COLORS.slate }}>
              Sign in to your Observer dashboard
            </p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
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
                style={{ borderColor: "#e2e8f0", outline: "none" }}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: COLORS.midnight }}>
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              className="w-full h-11 font-semibold text-white rounded-xl mt-2"
              style={{
                background: loading ? "#93c5fd" : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                boxShadow: loading ? "none" : "0 6px 20px rgba(37,99,235,0.4)",
                transition: "all 0.2s",
              }}
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          {/* ── Demo mode divider ── */}
          <div className="mt-6 flex items-center gap-3">
            <div className="flex-1 h-px" style={{ backgroundColor: "#e2e8f0" }} />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "#94a3b8" }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: "#e2e8f0" }} />
          </div>

          <button
            type="button"
            onClick={() => enterDemoMode(router)}
            className="mt-4 w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:scale-[1.01]"
            style={{
              backgroundColor: COLORS.midnight,
              color: "white",
              boxShadow: "0 4px 14px rgba(15,25,35,0.3)",
            }}
          >
            <Play className="h-4 w-4 fill-current" />
            Try Demo Dashboard
          </button>
          <p className="mt-2 text-center text-xs" style={{ color: "#94a3b8" }}>
            No sign-up needed · Uses mock data · Ongole Police Department
          </p>

          <p className="mt-5 text-sm text-center" style={{ color: COLORS.slate }}>
            No account yet?{" "}
            <Link
              href="/signup"
              className="font-semibold hover:underline"
              style={{ color: COLORS.signalBlue }}
            >
              Create your organisation
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

