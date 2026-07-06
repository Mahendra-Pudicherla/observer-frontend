"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useSession } from "@/components/SessionProvider";
import { useAlertSocket } from "@/hooks/useAlertSocket";
import { useCameraFeed } from "@/hooks/useCameraFeed";
import { DEMO_FLAG } from "@/components/SessionProvider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  COLORS,
  formatAnomalyType,
  type Camera,
  type Incident,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase";
import { exportIncidentReport } from "@/lib/export-report";
import { AlertTriangle, Video, X, Activity, Camera as CameraIcon, TrendingUp, Clock, FileDown } from "lucide-react";

/* ── Animated count-up number ── */
function CountUp({ to, color }: { to: number; color: string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    if (to === 0) { setDisplay(0); return; }
    const duration = 600;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * to));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [to, inView]);

  return (
    <span ref={ref} className="stat-number text-3xl font-extrabold" style={{ color }}>
      {display}
    </span>
  );
}

/* ── Stat card ── */
function StatCard({
  label,
  value,
  accent,
  highlight,
  icon: Icon,
  suffix = "",
}: {
  label: string;
  value: number | string;
  accent: string;
  highlight?: boolean;
  icon: React.ElementType;
  suffix?: string;
}) {
  const isNumeric = typeof value === "number";
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-white rounded-2xl p-5 relative overflow-hidden transition-all duration-300 hover:-translate-y-0.5"
      style={{
        backgroundColor: highlight ? "#fff5f5" : "white",
        border: `1px solid ${highlight ? "#fecaca" : "rgba(0,0,0,0.05)"}`,
        boxShadow: highlight
          ? "0 4px 20px rgba(220,38,38,0.1)"
          : "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* Top color bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 rounded-t-2xl"
        style={{ backgroundColor: accent }}
      />

      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.slate }}>
          {label}
        </p>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accent}15` }}
        >
          <Icon className="h-4 w-4" style={{ color: accent }} />
        </div>
      </div>

      <div className="flex items-end gap-1">
        {isNumeric ? (
          <CountUp to={value as number} color={accent} />
        ) : (
          <span className="stat-number text-3xl font-extrabold" style={{ color: accent }}>
            {value}
          </span>
        )}
        {suffix && <span className="text-sm font-semibold mb-1" style={{ color: accent }}>{suffix}</span>}
      </div>
    </motion.div>
  );
}

/* ── Incident type badge ── */
function IncidentBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    FIGHT_DETECTED: "badge-fight",
    LOITERING_DETECTED: "badge-loitering",
    PERSON_FALLEN: "badge-fallen",
    CROWD_SURGE: "badge-crowd",
  };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${map[type] ?? ""}`}
    >
      {formatAnomalyType(type as Parameters<typeof formatAnomalyType>[0])}
    </span>
  );
}

/* ── Live Camera Feed Card ── */
function CameraFeedCard({
  camera,
  orgId,
  isAlerting,
  index,
  onLiveChange,
}: {
  camera: Camera;
  orgId: string;
  isAlerting: boolean;
  index: number;
  onLiveChange?: (cameraId: string, isLive: boolean) => void;
}) {
  const { frame, live } = useCameraFeed(orgId, camera.id);

  // Notify parent when live status changes
  useEffect(() => {
    onLiveChange?.(camera.id, live);
  }, [live, camera.id, onLiveChange]);

  return (
    <motion.div
      key={camera.id}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className="relative aspect-video rounded-2xl overflow-hidden scanlines"
      style={{
        backgroundColor: COLORS.midnight,
        outline: isAlerting
          ? `2px solid ${COLORS.alertRed}`
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: isAlerting
          ? "0 0 24px rgba(220,38,38,0.25), 0 8px 24px rgba(0,0,0,0.3)"
          : "0 8px 24px rgba(0,0,0,0.15)",
        transition: "all 0.3s",
      }}
    >
      {/* Live video frame */}
      {frame && (
        <img
          src={frame}
          alt={`Live feed from ${camera.name}`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}

      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: frame
            ? "none"
            : "radial-gradient(ellipse at 30% 30%, rgba(37,99,235,0.08) 0%, transparent 60%)",
        }}
      />

      {/* ALERT badge */}
      {isAlerting && (
        <div
          className="absolute top-2.5 left-2.5 text-white text-xs font-bold px-2 py-1 rounded-lg z-20 flex items-center gap-1"
          style={{ backgroundColor: COLORS.alertRed }}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
          ALERT
        </div>
      )}

      {/* LIVE / OFFLINE badge */}
      <div
        className="absolute top-2.5 right-2.5 text-white text-xs font-bold px-2 py-1 rounded-lg z-20 flex items-center gap-1.5"
        style={{
          backgroundColor: live
            ? "rgba(22,163,74,0.85)"
            : "rgba(100,116,139,0.85)",
          backdropFilter: "blur(4px)",
        }}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${live ? "bg-white animate-pulse" : "bg-white/50"}`}
        />
        {live ? "LIVE" : "OFFLINE"}
      </div>

      {/* Bottom gradient overlay with label */}
      <div
        className="absolute bottom-0 left-0 right-0 p-3 z-20"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
      >
        <p className="text-white text-sm font-bold leading-tight">{camera.name}</p>
        <p className="text-white/60 text-xs mt-0.5">{camera.location}</p>
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { org } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const { activeAlert, clearAlert } = useAlertSocket(org?.id ?? null);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alertingCameras, setAlertingCameras] = useState<Set<string>>(new Set());
  const [liveCameras, setLiveCameras] = useState<Set<string>>(new Set());

  const handleLiveChange = useCallback((cameraId: string, isLive: boolean) => {
    setLiveCameras((prev) => {
      const next = new Set(prev);
      if (isLive) next.add(cameraId);
      else next.delete(cameraId);
      return next;
    });
  }, []);

  useEffect(() => {
    // ── Demo mode: seed with realistic mock data ──────────────
    if (typeof window !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1") {
      setCameras([
        { id: "CAM-001", org_id: "demo-org-001", name: "Main Gate Camera", location: "Ongole Bus Stand, Main Gate", is_active: true, created_at: new Date().toISOString() },
        { id: "CAM-002", org_id: "demo-org-001", name: "Junction Camera", location: "Kurnool Road Junction, Signal Point", is_active: true, created_at: new Date().toISOString() },
        { id: "CAM-003", org_id: "demo-org-001", name: "Market Entry Camera", location: "Muthukur Market, Entry Gate", is_active: false, created_at: new Date().toISOString() },
      ]);
      const now = new Date();
      const ago = (m: number) => new Date(now.getTime() - m * 60000).toISOString();
      setIncidents([
        { id: "inc-1", org_id: "demo-org-001", camera_id: "CAM-001", type: "FIGHT_DETECTED", confidence: 0.91, clip_url: null, started_at: ago(5), ended_at: ago(3), reviewed: false, created_at: ago(5) },
        { id: "inc-2", org_id: "demo-org-001", camera_id: "CAM-002", type: "LOITERING_DETECTED", confidence: 0.78, clip_url: null, started_at: ago(32), ended_at: ago(28), reviewed: false, created_at: ago(32) },
        { id: "inc-3", org_id: "demo-org-001", camera_id: "CAM-003", type: "CROWD_SURGE", confidence: 0.85, clip_url: null, started_at: ago(120), ended_at: ago(115), reviewed: true, created_at: ago(120) },
        { id: "inc-4", org_id: "demo-org-001", camera_id: "CAM-001", type: "PERSON_FALLEN", confidence: 0.72, clip_url: null, started_at: ago(480), ended_at: ago(475), reviewed: true, created_at: ago(480) },
      ]);
      return;
    }
    // ── Real mode: load from Supabase ─────────────────────────
    if (!org?.id) return;
    const load = async () => {
      const { data: cameraRows } = await supabase
        .from("cameras").select("*").eq("org_id", org.id).eq("is_active", true);
      const { data: incidentRows } = await supabase
        .from("incidents").select("*").eq("org_id", org.id)
        .order("created_at", { ascending: false }).limit(10);
      setCameras((cameraRows as Camera[]) ?? []);
      setIncidents((incidentRows as Incident[]) ?? []);
    };
    void load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [org?.id, supabase]);

  useEffect(() => {
    if (activeAlert?.camera_id) {
      setAlertingCameras((prev) => new Set(prev).add(activeAlert.camera_id));
    }
  }, [activeAlert]);

  const onlineCount = liveCameras.size;
  const todayCount = incidents.filter((i) => {
    if (!i.created_at) return false;
    return new Date(i.created_at).toDateString() === new Date().toDateString();
  }).length;
  const activeAlerts = alertingCameras.size;

  const cameraLocation = (id: string) =>
    cameras.find((c) => c.id === id)?.location ?? activeAlert?.location ?? "Unknown";

  return (
    <div className="flex gap-6 flex-col xl:flex-row" style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* ── Main column ── */}
      <div className="flex-1 space-y-6 min-w-0">

        {/* Page title */}
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: COLORS.midnight }}>Live Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: COLORS.slate }}>Real-time monitoring across all camera nodes</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Cameras Online" value={onlineCount} accent={COLORS.safeGreen} icon={CameraIcon} />
          <StatCard label="Active Alerts" value={activeAlerts} accent={COLORS.alertRed} highlight={activeAlerts > 0} icon={AlertTriangle} />
          <StatCard label="Today's Incidents" value={todayCount} accent={COLORS.signalBlue} icon={Activity} />
          <StatCard label="Uptime" value="99" accent={COLORS.safeGreen} icon={TrendingUp} suffix="%" />
        </div>

        {/* Alert banner */}
        <AnimatePresence>
          {activeAlert && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.98 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-2xl overflow-hidden"
              style={{
                border: `1.5px solid ${COLORS.alertRed}`,
                boxShadow: "0 8px 32px rgba(220,38,38,0.15)",
              }}
            >
              <div
                className="px-5 py-4 flex flex-wrap items-center justify-between gap-4"
                style={{ backgroundColor: "#fff5f5" }}
              >
                <div className="flex items-start gap-3">
                  {/* Pulsing alert icon */}
                  <div className="relative shrink-0 mt-0.5">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-xl"
                      style={{ backgroundColor: COLORS.alertRed }}
                    >
                      <AlertTriangle className="h-4 w-4 text-white" />
                    </span>
                    <span
                      className="absolute inset-0 rounded-xl animate-ping opacity-40"
                      style={{ backgroundColor: COLORS.alertRed }}
                    />
                  </div>
                  <div>
                    <p className="font-bold text-sm" style={{ color: COLORS.midnight }}>
                      {formatAnomalyType(activeAlert.type)} detected
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.slate }}>
                      <span className="font-semibold" style={{ color: COLORS.midnight }}>{activeAlert.camera_id}</span>
                      {" · "}
                      {cameraLocation(activeAlert.camera_id)}
                      {" · "}
                      <span className="font-semibold" style={{ color: COLORS.alertRed }}>
                        {Math.round(activeAlert.confidence * 100)}% confidence
                      </span>
                    </p>
                    {/* Confidence bar */}
                    <div className="mt-2 h-1.5 w-40 rounded-full overflow-hidden" style={{ backgroundColor: "#fecaca" }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round(activeAlert.confidence * 100)}%`, backgroundColor: COLORS.alertRed }}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {activeAlert.clip_url && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="text-xs font-semibold rounded-xl h-8"
                      style={{ borderColor: COLORS.alertRed, color: COLORS.alertRed }}
                    >
                      <a href={activeAlert.clip_url} target="_blank" rel="noreferrer">
                        <Video className="h-3 w-3 mr-1" /> View Clip
                      </a>
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAlert}
                    className="rounded-xl h-8 w-8 p-0"
                    style={{ color: COLORS.slate }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Camera feed grid */}
        <div>
          <h2 className="text-sm font-bold mb-3 uppercase tracking-wide" style={{ color: COLORS.slate }}>
            Camera feeds
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {cameras.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full flex flex-col items-center justify-center py-16 rounded-2xl"
                style={{ backgroundColor: "white", border: "1px dashed #cbd5e1" }}
              >
                <CameraIcon className="h-10 w-10 mb-3" style={{ color: "#cbd5e1" }} />
                <p className="font-semibold text-sm" style={{ color: COLORS.slate }}>No cameras registered yet</p>
                <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Add one from the Cameras page to start monitoring</p>
              </motion.div>
            ) : (
              cameras.map((camera, i) => (
                <CameraFeedCard
                  key={camera.id}
                  camera={camera}
                  orgId={org?.id ?? ""}
                  isAlerting={alertingCameras.has(camera.id)}
                  index={i}
                  onLiveChange={handleLiveChange}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <aside className="w-full xl:w-72 space-y-4 shrink-0">
        {/* Recent Incidents */}
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            <p className="text-sm font-bold" style={{ color: COLORS.midnight }}>Recent Incidents</p>
            <Clock className="h-4 w-4" style={{ color: COLORS.slate }} />
          </div>
          <div className="divide-y" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
            {incidents.slice(0, 5).map((incident) => (
              <div key={incident.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <IncidentBadge type={incident.type} />
                  {!incident.reviewed && (
                    <span className="text-xs font-semibold px-1.5 py-0.5 rounded-md" style={{ backgroundColor: "#fef3c7", color: "#d97706" }}>
                      New
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1" style={{ color: COLORS.slate }}>
                  <span className="font-semibold" style={{ color: COLORS.midnight }}>{incident.camera_id}</span>
                  {" · "}
                  {incident.created_at ? new Date(incident.created_at).toLocaleString() : "—"}
                </p>
              </div>
            ))}
            {incidents.length === 0 && (
              <div className="px-4 py-6 text-center">
                <p className="text-xs" style={{ color: COLORS.slate }}>No incidents yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Camera Status */}
        <div
          className="bg-white rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
        >
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "rgba(0,0,0,0.05)" }}>
            <p className="text-sm font-bold" style={{ color: COLORS.midnight }}>Camera Status</p>
            <CameraIcon className="h-4 w-4" style={{ color: COLORS.slate }} />
          </div>
          <div className="divide-y px-4" style={{ borderColor: "rgba(0,0,0,0.04)" }}>
            {cameras.map((camera) => {
              const isLive = liveCameras.has(camera.id);
              return (
              <div key={camera.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-xs font-semibold" style={{ color: COLORS.midnight }}>{camera.id}</p>
                  <p className="text-xs" style={{ color: COLORS.slate }}>{camera.location}</p>
                </div>
                <span
                  className="flex items-center gap-1.5 text-xs font-semibold"
                  style={{ color: isLive ? COLORS.safeGreen : COLORS.slate }}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${isLive ? "animate-pulse-slow" : ""}`}
                    style={{ backgroundColor: isLive ? COLORS.safeGreen : "#cbd5e1" }}
                  />
                  {isLive ? "Live" : "Offline"}
                </span>
              </div>
              );
            })}
            {cameras.length === 0 && (
              <div className="py-6 text-center">
                <p className="text-xs" style={{ color: COLORS.slate }}>No cameras yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Export button */}
        <Button
          className="w-full h-11 font-semibold text-white rounded-2xl"
          style={{
            background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
            boxShadow: "0 6px 20px rgba(37,99,235,0.35)",
          }}
          onClick={() => exportIncidentReport(org?.name ?? "Organisation", incidents)}
        >
          <FileDown className="h-4 w-4 mr-2" />
          Export Incident Report
        </Button>
      </aside>
    </div>
  );
}

