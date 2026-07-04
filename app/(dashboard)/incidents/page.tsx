"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BACKEND_API_URL,
  COLORS,
  formatAnomalyType,
  type AnomalyType,
  type Camera,
  type Incident,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase";
import {
  Filter,
  CheckCircle2,
  Clock,
  Video,
  ChevronDown,
  MapPin,
  Activity,
} from "lucide-react";

const ANOMALY_TYPES: AnomalyType[] = [
  "FIGHT_DETECTED",
  "LOITERING_DETECTED",
  "PERSON_FALLEN",
  "CROWD_SURGE",
];

const BADGE_STYLES: Record<AnomalyType, { bg: string; text: string; border: string }> = {
  FIGHT_DETECTED: { bg: "#fee2e2", text: "#dc2626", border: "#fecaca" },
  LOITERING_DETECTED: { bg: "#fef3c7", text: "#d97706", border: "#fde68a" },
  PERSON_FALLEN: { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" },
  CROWD_SURGE: { bg: "#fff7ed", text: "#ea580c", border: "#fed7aa" },
};

function IncidentTypeBadge({ type }: { type: AnomalyType }) {
  const s = BADGE_STYLES[type];
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
      style={{ backgroundColor: s.bg, color: s.text, borderColor: s.border }}
    >
      {formatAnomalyType(type)}
    </span>
  );
}

export default function IncidentsPage() {
  const { org } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [filterCamera, setFilterCamera] = useState("");
  const [filterType, setFilterType] = useState<AnomalyType | "">("");
  const [filterReviewed, setFilterReviewed] = useState<"" | "true" | "false">("");
  const [selected, setSelected] = useState<Incident | null>(null);

  const load = async () => {
    if (!org?.id) return;
    let query = supabase.from("incidents").select("*").eq("org_id", org.id);
    if (filterCamera) query = query.eq("camera_id", filterCamera);
    if (filterType) query = query.eq("type", filterType);
    if (filterReviewed !== "") query = query.eq("reviewed", filterReviewed === "true");
    const { data } = await query.order("created_at", { ascending: false });
    setIncidents((data as Incident[]) ?? []);
    const { data: cameraRows } = await supabase.from("cameras").select("*").eq("org_id", org.id);
    setCameras((cameraRows as Camera[]) ?? []);
  };

  useEffect(() => { void load(); }, [org?.id, filterCamera, filterType, filterReviewed]);

  const markReviewed = async (incident: Incident) => {
    if (!org?.id) return;
    await fetch(`${BACKEND_API_URL}/incidents/${org.id}/${incident.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed: true }),
    });
    await supabase.from("incidents").update({ reviewed: true })
      .eq("id", incident.id).eq("org_id", org.id);
    setSelected(null);
    await load();
  };

  const cameraLocation = (id: string) => cameras.find((c) => c.id === id)?.location ?? "—";

  const unreviewedCount = incidents.filter((i) => !i.reviewed).length;

  return (
    <div className="space-y-6" style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: COLORS.midnight }}>Incidents</h1>
          <p className="text-sm mt-0.5" style={{ color: COLORS.slate }}>
            {unreviewedCount > 0 ? (
              <span>
                <span className="font-semibold" style={{ color: COLORS.alertRed }}>{unreviewedCount} unreviewed</span>
                {" "}&middot; {incidents.length} total
              </span>
            ) : (
              <span>{incidents.length} incidents</span>
            )}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div
        className="flex flex-wrap items-center gap-3 p-4 rounded-2xl"
        style={{ backgroundColor: "white", border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold mr-1" style={{ color: COLORS.slate }}>
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>

        {/* Camera filter */}
        <div className="relative">
          <select
            className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
            style={{
              borderColor: filterCamera ? COLORS.signalBlue : "#e2e8f0",
              backgroundColor: filterCamera ? COLORS.blueTint : "white",
              color: filterCamera ? COLORS.signalBlue : COLORS.slate,
            }}
            value={filterCamera}
            onChange={(e) => setFilterCamera(e.target.value)}
          >
            <option value="">All cameras</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>{c.id}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none" style={{ color: filterCamera ? COLORS.signalBlue : COLORS.slate }} />
        </div>

        {/* Type filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType("")}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              backgroundColor: filterType === "" ? COLORS.midnight : "white",
              color: filterType === "" ? "white" : COLORS.slate,
              border: `1px solid ${filterType === "" ? COLORS.midnight : "#e2e8f0"}`,
            }}
          >
            All types
          </button>
          {ANOMALY_TYPES.map((t) => {
            const s = BADGE_STYLES[t];
            const active = filterType === t;
            return (
              <button
                key={t}
                onClick={() => setFilterType(active ? "" : t)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                style={{
                  backgroundColor: active ? s.bg : "white",
                  color: active ? s.text : COLORS.slate,
                  borderColor: active ? s.border : "#e2e8f0",
                }}
              >
                {formatAnomalyType(t)}
              </button>
            );
          })}
        </div>

        {/* Reviewed filter */}
        <div className="flex gap-1.5 ml-auto">
          {(["", "false", "true"] as const).map((v) => {
            const labels = { "": "All", false: "Unreviewed", true: "Reviewed" };
            const active = filterReviewed === v;
            return (
              <button
                key={v}
                onClick={() => setFilterReviewed(v)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border"
                style={{
                  backgroundColor: active ? COLORS.midnight : "white",
                  color: active ? "white" : COLORS.slate,
                  borderColor: active ? COLORS.midnight : "#e2e8f0",
                }}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Incidents table */}
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: "1px solid rgba(0,0,0,0.05)", boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      >
        {incidents.length === 0 ? (
          <div className="py-20 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3" style={{ color: "#e2e8f0" }} />
            <p className="font-bold text-sm" style={{ color: COLORS.slate }}>No incidents found</p>
            <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>Adjust filters or wait for AI to detect an event</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  {["Type", "Camera", "Location", "Time", "Confidence", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                      style={{ color: COLORS.slate }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {incidents.map((incident, i) => (
                    <motion.tr
                      key={incident.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80 group"
                      style={{ borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                      onClick={() => setSelected(incident)}
                    >
                      {/* Left-border accent by type */}
                      <td className="px-4 py-3 relative">
                        <div
                          className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ backgroundColor: BADGE_STYLES[incident.type]?.text ?? COLORS.signalBlue }}
                        />
                        <IncidentTypeBadge type={incident.type} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs" style={{ color: COLORS.midnight }}>
                        {incident.camera_id}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: COLORS.slate }}>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {cameraLocation(incident.camera_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: COLORS.slate }}>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {incident.created_at ? new Date(incident.created_at).toLocaleString() : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {incident.confidence != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#f1f5f9" }}>
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(incident.confidence * 100)}%`,
                                  backgroundColor: BADGE_STYLES[incident.type]?.text ?? COLORS.signalBlue,
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: COLORS.midnight }}>
                              {Math.round(incident.confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: COLORS.slate }}>—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{
                            backgroundColor: incident.reviewed ? "#f0fdf4" : "#fef3c7",
                            color: incident.reviewed ? COLORS.safeGreen : "#d97706",
                          }}
                        >
                          {incident.reviewed ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                          )}
                          {incident.reviewed ? "Reviewed" : "Pending"}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg rounded-2xl overflow-hidden p-0">
          {selected && (
            <>
              {/* Dark modal header */}
              <div
                className="px-6 py-5"
                style={{ background: `linear-gradient(135deg, ${COLORS.midnight}, #1e3a5f)` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <DialogHeader>
                      <DialogTitle className="font-bold text-white text-base">
                        {formatAnomalyType(selected.type)}
                      </DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <IncidentTypeBadge type={selected.type} />
                      <span className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                        {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.surface }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.slate }}>Camera</p>
                    <p className="text-sm font-bold" style={{ color: COLORS.midnight }}>{selected.camera_id}</p>
                  </div>
                  <div className="rounded-xl p-3" style={{ backgroundColor: COLORS.surface }}>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.slate }}>Location</p>
                    <p className="text-sm font-bold" style={{ color: COLORS.midnight }}>{cameraLocation(selected.camera_id)}</p>
                  </div>
                </div>

                {selected.confidence != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold" style={{ color: COLORS.slate }}>Confidence</p>
                      <p className="text-sm font-bold" style={{ color: BADGE_STYLES[selected.type]?.text }}>
                        {Math.round(selected.confidence * 100)}%
                      </p>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#f1f5f9" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${Math.round(selected.confidence * 100)}%`,
                          backgroundColor: BADGE_STYLES[selected.type]?.text ?? COLORS.signalBlue,
                        }}
                      />
                    </div>
                  </div>
                )}

                {selected.clip_url && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: COLORS.slate }}>Incident Clip</p>
                    <video
                      src={selected.clip_url}
                      controls
                      className="w-full rounded-xl"
                      style={{ backgroundColor: COLORS.midnight }}
                    />
                    <a
                      href={selected.clip_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-2 text-xs font-semibold"
                      style={{ color: COLORS.signalBlue }}
                    >
                      <Video className="h-3 w-3" /> Open full clip
                    </a>
                  </div>
                )}

                {!selected.reviewed && (
                  <Button
                    className="w-full h-10 font-semibold text-white rounded-xl"
                    style={{
                      background: "linear-gradient(135deg, #16a34a, #15803d)",
                      boxShadow: "0 4px 14px rgba(22,163,74,0.35)",
                    }}
                    onClick={() => markReviewed(selected)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" /> Mark as Reviewed
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

