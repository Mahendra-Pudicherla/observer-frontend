"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/components/SessionProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
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
  "VIOLENCE_DETECTED",
  "WEAPON_DETECTED",
  "FACE_MATCHED",
  "CROWD_SURGE",
];

const BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  VIOLENCE_DETECTED: { bg: "rgba(239,68,68,0.15)", text: "#F87171", border: "rgba(239,68,68,0.3)" },
  WEAPON_DETECTED: { bg: "rgba(220,38,38,0.2)", text: "#FCA5A5", border: "rgba(220,38,38,0.35)" },
  FACE_MATCHED: { bg: "rgba(168,85,247,0.15)", text: "#C084FC", border: "rgba(168,85,247,0.3)" },
  CROWD_SURGE: { bg: "rgba(249,115,22,0.15)", text: "#FB923C", border: "rgba(249,115,22,0.3)" },
  FIGHT_DETECTED: { bg: "rgba(239,68,68,0.15)", text: "#F87171", border: "rgba(239,68,68,0.3)" },
  LOITERING_DETECTED: { bg: "rgba(245,158,11,0.15)", text: "#FBBF24", border: "rgba(245,158,11,0.3)" },
  PERSON_FALLEN: { bg: "rgba(59,130,246,0.15)", text: "#60A5FA", border: "rgba(59,130,246,0.3)" },
};

function IncidentTypeBadge({ type }: { type: AnomalyType }) {
  const s = BADGE_STYLES[type] ?? BADGE_STYLES.VIOLENCE_DETECTED;
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

  useEffect(() => {
    void load();
  }, [org?.id, filterCamera, filterType, filterReviewed]);

  const markReviewed = async (incident: Incident) => {
    if (!org?.id) return;
    await fetch(`${BACKEND_API_URL}/incidents/${org.id}/${incident.id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed: true }),
    });
    await supabase
      .from("incidents")
      .update({ reviewed: true })
      .eq("id", incident.id)
      .eq("org_id", org.id);
    setSelected(null);
    await load();
  };

  const cameraLocation = (id: string) => cameras.find((c) => c.id === id)?.location ?? "—";
  const unreviewedCount = incidents.filter((i) => !i.reviewed).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description={
          unreviewedCount > 0
            ? `${unreviewedCount} unreviewed · ${incidents.length} total`
            : `${incidents.length} incidents`
        }
      />

      <div
        className="flex flex-wrap items-center gap-3 p-4 rounded-2xl"
        style={{ backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}` }}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold mr-1" style={{ color: COLORS.textMuted }}>
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>

        <div className="relative">
          <select
            className="appearance-none pl-3 pr-7 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer"
            style={{
              borderColor: filterCamera ? COLORS.signalBlue : COLORS.border,
              backgroundColor: COLORS.panelElevated,
              color: filterCamera ? COLORS.signalBlue : COLORS.textMuted,
            }}
            value={filterCamera}
            onChange={(e) => setFilterCamera(e.target.value)}
          >
            <option value="">All cameras</option>
            {cameras.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id}
              </option>
            ))}
          </select>
          <ChevronDown
            className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none"
            style={{ color: COLORS.textMuted }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterType("")}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
            style={{
              backgroundColor: filterType === "" ? COLORS.signalBlue : COLORS.panelElevated,
              color: filterType === "" ? "#fff" : COLORS.textMuted,
              borderColor: filterType === "" ? COLORS.signalBlue : COLORS.border,
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
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
                style={{
                  backgroundColor: active ? s.bg : COLORS.panelElevated,
                  color: active ? s.text : COLORS.textMuted,
                  borderColor: active ? s.border : COLORS.border,
                }}
              >
                {formatAnomalyType(t)}
              </button>
            );
          })}
        </div>

        <div className="flex gap-1.5 ml-auto">
          {(["", "false", "true"] as const).map((v) => {
            const labels = { "": "All", false: "Unreviewed", true: "Reviewed" };
            const active = filterReviewed === v;
            return (
              <button
                key={v}
                onClick={() => setFilterReviewed(v)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border"
                style={{
                  backgroundColor: active ? COLORS.signalBlue : COLORS.panelElevated,
                  color: active ? "#fff" : COLORS.textMuted,
                  borderColor: active ? COLORS.signalBlue : COLORS.border,
                }}
              >
                {labels[v]}
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}` }}
      >
        {incidents.length === 0 ? (
          <div className="py-20 text-center">
            <Activity className="h-10 w-10 mx-auto mb-3" style={{ color: COLORS.textMuted }} />
            <p className="font-bold text-sm" style={{ color: COLORS.text }}>
              No incidents found
            </p>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
              Adjust filters or wait for AI to detect an event
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                  {["Type", "Camera", "Location", "Time", "Confidence", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wider"
                      style={{ color: COLORS.textMuted }}
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
                      className="cursor-pointer transition-colors hover:bg-white/[0.03]"
                      style={{ borderBottom: `1px solid ${COLORS.border}` }}
                      onClick={() => setSelected(incident)}
                    >
                      <td className="px-4 py-3">
                        <IncidentTypeBadge type={incident.type} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-xs" style={{ color: COLORS.text }}>
                        {incident.camera_id}
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: COLORS.textMuted }}>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {cameraLocation(incident.camera_id)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs" style={{ color: COLORS.textMuted }}>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          {incident.created_at
                            ? new Date(incident.created_at).toLocaleString()
                            : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {incident.confidence != null ? (
                          <div className="flex items-center gap-2">
                            <div
                              className="w-16 h-1.5 rounded-full overflow-hidden"
                              style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                            >
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.round(incident.confidence * 100)}%`,
                                  backgroundColor: BADGE_STYLES[incident.type]?.text,
                                }}
                              />
                            </div>
                            <span className="text-xs font-semibold" style={{ color: COLORS.text }}>
                              {Math.round(incident.confidence * 100)}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs" style={{ color: COLORS.textMuted }}>
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-lg"
                          style={{
                            backgroundColor: incident.reviewed
                              ? "rgba(34,197,94,0.15)"
                              : "rgba(245,158,11,0.15)",
                            color: incident.reviewed ? COLORS.safeGreen : COLORS.cautionAmber,
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

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent
          className="max-w-lg rounded-2xl overflow-hidden p-0 border"
          style={{ backgroundColor: COLORS.panel, borderColor: COLORS.border }}
        >
          {selected && (
            <>
              <div className="px-6 py-5" style={{ backgroundColor: COLORS.panelElevated }}>
                <DialogHeader>
                  <DialogTitle className="font-bold text-base" style={{ color: COLORS.text }}>
                    {formatAnomalyType(selected.type)}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <IncidentTypeBadge type={selected.type} />
                  <span className="text-xs" style={{ color: COLORS.textMuted }}>
                    {selected.created_at ? new Date(selected.created_at).toLocaleString() : "—"}
                  </span>
                </div>
              </div>

              <div className="px-6 py-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div
                    className="rounded-xl p-3"
                    style={{ backgroundColor: COLORS.panelElevated }}
                  >
                    <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.textMuted }}>
                      Camera
                    </p>
                    <p className="text-sm font-bold" style={{ color: COLORS.text }}>
                      {selected.camera_id}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-3"
                    style={{ backgroundColor: COLORS.panelElevated }}
                  >
                    <p className="text-xs font-semibold mb-0.5" style={{ color: COLORS.textMuted }}>
                      Location
                    </p>
                    <p className="text-sm font-bold" style={{ color: COLORS.text }}>
                      {cameraLocation(selected.camera_id)}
                    </p>
                  </div>
                </div>

                {selected.confidence != null && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-semibold" style={{ color: COLORS.textMuted }}>
                        Confidence
                      </p>
                      <p
                        className="text-sm font-bold"
                        style={{ color: BADGE_STYLES[selected.type]?.text }}
                      >
                        {Math.round(selected.confidence * 100)}%
                      </p>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.round(selected.confidence * 100)}%`,
                          backgroundColor: BADGE_STYLES[selected.type]?.text,
                        }}
                      />
                    </div>
                  </div>
                )}

                {selected.clip_url && (
                  <div>
                    <p className="text-xs font-semibold mb-2" style={{ color: COLORS.textMuted }}>
                      Incident Clip
                    </p>
                    {/\.(jpe?g|png|webp)(\?|$)/i.test(selected.clip_url) ||
                    selected.clip_url.includes("snapshot") ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={selected.clip_url}
                        alt="Incident snapshot"
                        className="w-full rounded-xl object-contain"
                        style={{ backgroundColor: COLORS.midnight, maxHeight: 360 }}
                      />
                    ) : (
                      <video
                        src={selected.clip_url}
                        controls
                        className="w-full rounded-xl"
                        style={{ backgroundColor: COLORS.midnight }}
                      />
                    )}
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
                    style={{ backgroundColor: COLORS.safeGreen }}
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
