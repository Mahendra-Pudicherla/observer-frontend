"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  Building2,
  Camera,
  FileText,
  Mail,
  Shield,
  Users,
  Zap,
  ArrowRight,
  CheckCircle2,
  Play,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { COLORS, PRICING_TIERS } from "@/lib/constants";

const features = [
  { icon: Camera, title: "Multi-camera live view", desc: "Monitor every node from one unified dashboard in real time.", color: "#2563EB" },
  { icon: Zap, title: "Pre-buffer auto-clipping", desc: "15 seconds before every incident, saved automatically — no scrubbing.", color: "#7C3AED" },
  { icon: Shield, title: "AI anomaly detection", desc: "Fight, fall, loitering, and crowd surge rules powered by YOLOv8.", color: "#0891B2" },
  { icon: Mail, title: "Instant email alerts", desc: "Notify admins the moment an incident fires, with clip links.", color: "#D97706" },
  { icon: FileText, title: "PDF incident reports", desc: "Export unreviewed incidents as formatted PDF reports in one click.", color: "#16A34A" },
  { icon: Users, title: "Multi-tenant orgs", desc: "Police departments and private businesses — fully isolated data.", color: "#DC2626" },
];

const segments = [
  { icon: Shield, title: "Police departments", desc: "District-wide CCTV intelligence at your fingertips.", gradient: "from-blue-600 to-blue-800" },
  { icon: Building2, title: "Malls & retail", desc: "Crowd and incident awareness across your premises.", gradient: "from-purple-600 to-purple-800" },
  { icon: Users, title: "Gated communities", desc: "Perimeter and entry monitoring, 24/7.", gradient: "from-teal-600 to-teal-800" },
  { icon: Building2, title: "Schools & colleges", desc: "Campus safety oversight with instant alerts.", gradient: "from-orange-600 to-orange-800" },
];

const steps = [
  { num: "01", title: "Connect cameras", desc: "Open a browser URL on any phone or webcam — it becomes a live streaming node instantly." },
  { num: "02", title: "AI detects incidents", desc: "YOLOv8 analyzes every frame. Fights, falls, loitering, and crowd surges are flagged in real time." },
  { num: "03", title: "Dashboard alerts", desc: "Pre-buffer clips are saved automatically and alert banners appear on the dashboard instantly." },
];

function AnimatedSection({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function CameraNodeMockup() {
  const [alerting, setAlerting] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setAlerting((a) => !a), 3000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative w-full max-w-md mx-auto">
      {/* Main camera tile */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          backgroundColor: COLORS.midnight,
          outline: alerting ? `2px solid ${COLORS.alertRed}` : "2px solid rgba(255,255,255,0.08)",
          transition: "outline-color 0.3s",
          boxShadow: alerting
            ? "0 0 40px rgba(220,38,38,0.3), 0 20px 60px rgba(0,0,0,0.6)"
            : "0 20px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Scan-line overlay */}
        <div className="scanlines absolute inset-0 z-10 pointer-events-none" />

        {/* Dark gradient body */}
        <div className="aspect-video flex items-center justify-center relative">
          <div
            className="absolute inset-0 opacity-30"
            style={{
              background: `radial-gradient(ellipse at 30% 40%, rgba(37,99,235,0.3) 0%, transparent 60%),
                          radial-gradient(ellipse at 70% 60%, rgba(15,25,35,0.8) 0%, transparent 50%)`,
            }}
          />
          {/* Simulated person silhouette */}
          <svg width="60" height="100" viewBox="0 0 60 100" fill="none" opacity="0.25">
            <ellipse cx="30" cy="16" rx="10" ry="10" fill="white" />
            <rect x="18" y="28" width="24" height="36" rx="4" fill="white" />
            <rect x="14" y="28" width="8" height="28" rx="3" fill="white" />
            <rect x="38" y="28" width="8" height="28" rx="3" fill="white" />
            <rect x="20" y="62" width="8" height="30" rx="3" fill="white" />
            <rect x="32" y="62" width="8" height="30" rx="3" fill="white" />
          </svg>
          {/* Bounding box overlay */}
          <div
            className="absolute"
            style={{
              border: `1.5px solid ${alerting ? COLORS.alertRed : COLORS.safeGreen}`,
              width: 80,
              height: 120,
              borderRadius: 4,
              transition: "border-color 0.3s",
            }}
          />
        </div>

        {/* ALERT badge */}
        <AnimatePresence>
          {alerting && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute top-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-md z-20"
              style={{ backgroundColor: COLORS.alertRed }}
            >
              ALERT
            </motion.div>
          )}
        </AnimatePresence>

        {/* LIVE badge */}
        <div
          className="absolute top-3 right-3 text-white text-xs font-bold px-2.5 py-1 rounded-md z-20 flex items-center gap-1.5"
          style={{ backgroundColor: "rgba(22,163,74,0.9)" }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          LIVE
        </div>

        {/* Bottom label */}
        <div className="absolute bottom-0 left-0 right-0 p-3 z-20" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.8), transparent)" }}>
          <p className="text-white text-sm font-semibold">CAM-001 · Ongole Bus Stand</p>
          <p className="text-white/60 text-xs">Main Gate · AI Active</p>
        </div>
      </div>

      {/* Floating stat cards */}
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-4 -right-4 glass rounded-xl px-3 py-2 text-xs font-semibold text-white"
        style={{ background: "rgba(37,99,235,0.9)", backdropFilter: "blur(12px)" }}
      >
        <span className="text-blue-200">Confidence: </span>91%
      </motion.div>
      <motion.div
        animate={{ y: [0, 6, 0] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
        className="absolute -bottom-4 -left-4 glass rounded-xl px-3 py-2 text-xs font-semibold text-white"
        style={{ background: "rgba(22,163,74,0.9)", backdropFilter: "blur(12px)" }}
      >
        <span className="text-green-200">3 cameras </span>online
      </motion.div>
    </div>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.surface, fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* ── Sticky Header ── */}
      <header
        className="sticky top-0 z-50 transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.98)",
          backdropFilter: scrolled ? "blur(16px)" : "none",
          borderBottom: scrolled ? "1px solid rgba(0,0,0,0.08)" : "1px solid transparent",
          boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.06)" : "none",
        }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="md" />
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium" style={{ color: COLORS.slate }}>
            <Link href="#features" className="hover:text-gray-900 transition-colors">Features</Link>
            <Link href="#who" className="hover:text-gray-900 transition-colors">Who it&apos;s for</Link>
            <Link href="/pricing" className="hover:text-gray-900 transition-colors">Pricing</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild className="text-sm font-medium hidden sm:flex">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              className="text-sm font-semibold text-white rounded-xl px-5"
              style={{ background: `linear-gradient(135deg, #2563eb, #1d4ed8)`, boxShadow: "0 4px 14px rgba(37,99,235,0.4)" }}
            >
              <Link href="/signup">
                Get Started Free <ChevronRight className="h-4 w-4 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{
          background: `linear-gradient(170deg, ${COLORS.midnight} 0%, #0d2137 55%, #0f1923 100%)`,
          minHeight: "92vh",
        }}
      >
        {/* Background glow orbs */}
        <div className="hero-glow" style={{ top: "10%", left: "50%", transform: "translateX(-50%)" }} />
        <div
          className="absolute"
          style={{
            width: 400,
            height: 400,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)",
            bottom: "5%",
            right: "5%",
            pointerEvents: "none",
          }}
        />

        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 grid lg:grid-cols-2 gap-16 items-center relative z-10">
          {/* Left column — text */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6"
              style={{ backgroundColor: "rgba(37,99,235,0.15)", color: "#60a5fa", border: "1px solid rgba(37,99,235,0.25)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              Powered by YOLOv8 · Real-time AI
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-6xl font-extrabold leading-[1.08] tracking-tight mb-6 text-white"
            >
              AI-powered{" "}
              <span className="gradient-text">surveillance</span>{" "}
              for every organisation
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg leading-relaxed mb-10"
              style={{ color: "rgba(255,255,255,0.6)" }}
            >
              Real-time anomaly detection with auto-clipped incident video — so
              security reviewers never scrub hours of footage again. Connect any
              phone as a camera node in seconds.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Button
                size="lg"
                asChild
                className="font-semibold text-white rounded-xl px-8 h-12"
                style={{
                  background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                  boxShadow: "0 8px 24px rgba(37,99,235,0.45)",
                }}
              >
                <Link href="/signup">
                  Get Started Free <ArrowRight className="h-4 w-4 ml-2" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="font-semibold rounded-xl px-8 h-12"
                style={{ borderColor: "rgba(255,255,255,0.2)", color: "white", backgroundColor: "rgba(255,255,255,0.06)" }}
              >
                <Link href="/dashboard">
                  <Play className="h-4 w-4 mr-2 fill-current" /> View Demo
                </Link>
              </Button>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap items-center gap-6 mt-10 text-sm"
              style={{ color: "rgba(255,255,255,0.4)" }}
            >
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-400" /> No payment required</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-400" /> Any device camera</span>
              <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4 text-green-400" /> Live in 60 seconds</span>
            </motion.div>
          </div>

          {/* Right column — animated camera mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <CameraNodeMockup />
          </motion.div>
        </div>

        {/* Bottom wave */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none">
          <svg viewBox="0 0 1440 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M0 80L1440 80L1440 30C1200 80 960 0 720 30C480 60 240 10 0 30L0 80Z" fill={COLORS.surface} />
          </svg>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-7xl mx-auto px-6 py-24">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: COLORS.signalBlue }}>Simple by design</p>
          <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: COLORS.midnight }}>How Observer works</h2>
        </AnimatedSection>

        <div className="grid md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-12 left-1/3 right-1/3 h-px" style={{ background: "linear-gradient(90deg, transparent, #2563eb44, transparent)" }} />

          {steps.map((step, i) => (
            <AnimatedSection key={step.num}>
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                className="relative text-center group"
              >
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 font-black text-2xl text-white transition-transform duration-300 group-hover:-translate-y-1"
                  style={{
                    background: `linear-gradient(135deg, #2563eb, #1d4ed8)`,
                    boxShadow: "0 8px 24px rgba(37,99,235,0.35)",
                  }}
                >
                  {step.num}
                </div>
                <h3 className="text-xl font-bold mb-3" style={{ color: COLORS.midnight }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{step.desc}</p>
              </motion.div>
            </AnimatedSection>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24" style={{ background: `linear-gradient(180deg, ${COLORS.surface} 0%, #eef2ff 100%)` }}>
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection className="text-center mb-16">
            <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: COLORS.signalBlue }}>Everything you need</p>
            <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: COLORS.midnight }}>Powerful features, zero complexity</h2>
            <p className="mt-4 text-lg max-w-2xl mx-auto" style={{ color: COLORS.slate }}>
              From live streaming to automated PDF reports — Observer handles the entire surveillance workflow.
            </p>
          </AnimatedSection>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc, color }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="bg-white rounded-2xl p-6 float-shadow transition-all duration-300 group cursor-default"
                style={{ border: "1px solid rgba(0,0,0,0.05)" }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110"
                  style={{ backgroundColor: `${color}15` }}
                >
                  <Icon className="h-6 w-6" style={{ color }} />
                </div>
                <h3 className="font-bold text-base mb-2" style={{ color: COLORS.midnight }}>{title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: COLORS.slate }}>{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Who it's for ── */}
      <section id="who" className="max-w-7xl mx-auto px-6 py-24">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: COLORS.signalBlue }}>Built for</p>
          <h2 className="text-4xl font-extrabold tracking-tight" style={{ color: COLORS.midnight }}>Who uses Observer</h2>
        </AnimatedSection>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {segments.map(({ icon: Icon, title, desc, gradient }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="group"
            >
              <div
                className="rounded-2xl p-6 text-white h-full float-shadow transition-all duration-300 group-hover:-translate-y-1"
                style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              >
                <div
                  className={`bg-gradient-to-br ${gradient} rounded-2xl p-6 text-white h-full float-shadow transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl`}
                >
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: "rgba(255,255,255,0.15)" }}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-bold text-base mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "rgba(255,255,255,0.75)" }}>{desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Pricing teaser ── */}
      <section className="py-24" style={{ background: `linear-gradient(180deg, ${COLORS.surface} 0%, #dbeafe 100%)` }}>
        <div className="max-w-5xl mx-auto px-6">
          <AnimatedSection>
            <div
              className="rounded-3xl p-12 text-center relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${COLORS.midnight} 0%, #1e3a5f 100%)`,
                boxShadow: "0 40px 80px rgba(15,25,35,0.4)",
              }}
            >
              <div className="hero-glow" style={{ top: "50%", left: "50%", transform: "translate(-50%,-50%)", opacity: 0.6 }} />
              <div className="relative z-10">
                <p className="text-sm font-semibold uppercase tracking-widest mb-3" style={{ color: "#60a5fa" }}>Transparent pricing</p>
                <h2 className="text-4xl font-extrabold text-white mb-4">Starter, Growth &amp; Enterprise</h2>
                <p className="text-lg mb-8" style={{ color: "rgba(255,255,255,0.6)" }}>
                  {Object.keys(PRICING_TIERS).length} tiers — unlimited cameras on every plan. No payment processor at launch.
                </p>
                <Button
                  asChild
                  size="lg"
                  className="font-semibold text-white rounded-xl px-10 h-12"
                  style={{
                    background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                    boxShadow: "0 8px 24px rgba(37,99,235,0.5)",
                  }}
                >
                  <Link href="/pricing">
                    View pricing plans <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ backgroundColor: COLORS.midnight }}>
        <div className="max-w-7xl mx-auto px-6 py-16">
          <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
            <div>
              <Logo size="md" dark />
              <p className="mt-3 text-sm max-w-xs leading-relaxed" style={{ color: "rgba(255,255,255,0.45)" }}>
                Live monitoring with clarity — helping organisations respond before incidents escalate.
              </p>
            </div>
            <div className="flex gap-16">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>Product</p>
                <ul className="space-y-3 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <li><Link href="#features" className="hover:text-white transition-colors">Features</Link></li>
                  <li><Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link></li>
                  <li><Link href="/dashboard" className="hover:text-white transition-colors">Demo</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "rgba(255,255,255,0.35)" }}>Account</p>
                <ul className="space-y-3 text-sm" style={{ color: "rgba(255,255,255,0.55)" }}>
                  <li><Link href="/signup" className="hover:text-white transition-colors">Sign up</Link></li>
                  <li><Link href="/login" className="hover:text-white transition-colors">Login</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ borderColor: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.3)" }}>
            <p>© {new Date().getFullYear()} Observer. All rights reserved.</p>
            <p>AI-powered surveillance platform</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

