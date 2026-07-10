"use client";

import { useState } from "react";
import { useOrgCameras, useOrgIncidents } from "@/hooks/useOrgData";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { FilterPills } from "@/components/dashboard/FilterPills";
import { Panel } from "@/components/dashboard/StatusBadge";
import { COLORS } from "@/lib/constants";
import { Camera as CameraIcon, Siren, MapPin, Route } from "lucide-react";

export default function MapsPage() {
  const { cameras } = useOrgCameras(false);
  const { incidents } = useOrgIncidents(20);
  const [layer, setLayer] = useState("all");

  const openIncidents = incidents.filter((i) => !i.reviewed);
  const online = cameras.filter((c) => c.is_active).length;

  const markers = cameras.map((c, i) => {
    const hasIncident = openIncidents.some((inc) => inc.camera_id === c.id);
    return {
      id: c.id,
      name: c.name,
      location: c.location,
      x: 18 + ((i * 23) % 64),
      y: 22 + ((i * 31) % 52),
      kind: hasIncident ? "incident" : "camera",
    };
  });

  const visible = markers.filter((m) => {
    if (layer === "cameras") return m.kind === "camera";
    if (layer === "incidents") return m.kind === "incident";
    return true;
  });

  const stats = [
    { label: "Cameras online", value: online, icon: CameraIcon, color: COLORS.signalBlue },
    { label: "Active incidents", value: openIncidents.length, icon: Siren, color: COLORS.alertRed },
    { label: "Coverage zones", value: Math.max(cameras.length, 0), icon: MapPin, color: COLORS.safeGreen },
    { label: "Routes", value: Math.max(1, Math.ceil(cameras.length / 2)), icon: Route, color: COLORS.signalBlue },
  ];

  return (
    <div>
      <PageHeader title="Maps" description="Operational map of cameras and active incidents" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {stats.map((s) => (
          <Panel key={s.label} className="p-4 flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${s.color}22` }}
            >
              <s.icon className="h-5 w-5" style={{ color: s.color }} />
            </div>
            <div>
              <p className="text-xl font-extrabold" style={{ color: COLORS.text }}>
                {s.value}
              </p>
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                {s.label}
              </p>
            </div>
          </Panel>
        ))}
      </div>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-bold" style={{ color: COLORS.text }}>
              Operational map
            </p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
              Cameras · Incidents · Coverage
            </p>
          </div>
          <FilterPills
            value={layer}
            onChange={setLayer}
            options={[
              { id: "all", label: "All" },
              { id: "cameras", label: "Cameras" },
              { id: "incidents", label: "Incidents" },
              { id: "zones", label: "Safe zones" },
            ]}
          />
        </div>

        <div
          className="relative w-full h-[420px] rounded-2xl overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at 30% 20%, #1e293b 0%, #0b0e14 55%), linear-gradient(135deg, #0f172a, #020617)",
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <svg className="absolute inset-0 w-full h-full opacity-30">
            {Array.from({ length: 8 }).map((_, i) => (
              <line
                key={`h-${i}`}
                x1="0"
                y1={`${(i + 1) * 12}%`}
                x2="100%"
                y2={`${(i + 1) * 12}%`}
                stroke="#64748b"
                strokeWidth="1"
              />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <line
                key={`v-${i}`}
                x1={`${(i + 1) * 9}%`}
                y1="0"
                x2={`${(i + 1) * 9}%`}
                y2="100%"
                stroke="#64748b"
                strokeWidth="1"
              />
            ))}
          </svg>

          {(layer === "all" || layer === "zones") && cameras[0] && (
            <div
              className="absolute rounded-full border-2"
              style={{
                left: "42%",
                top: "38%",
                width: 120,
                height: 120,
                borderColor: "rgba(34,197,94,0.5)",
                backgroundColor: "rgba(34,197,94,0.08)",
                transform: "translate(-50%, -50%)",
              }}
            />
          )}

          {visible.map((m) => (
            <div
              key={m.id}
              className="absolute flex flex-col items-center"
              style={{ left: `${m.x}%`, top: `${m.y}%`, transform: "translate(-50%, -50%)" }}
              title={`${m.name} — ${m.location}`}
            >
              <span
                className="h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-lg"
                style={{
                  backgroundColor:
                    m.kind === "incident" ? COLORS.alertRed : COLORS.signalBlue,
                }}
              >
                {m.kind === "incident" ? "!" : "C"}
              </span>
              <span
                className="mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded"
                style={{ backgroundColor: "rgba(0,0,0,0.65)", color: COLORS.text }}
              >
                {m.id}
              </span>
            </div>
          ))}

          {cameras.length === 0 && (
            <div
              className="absolute inset-0 flex items-center justify-center text-sm"
              style={{ color: COLORS.textMuted }}
            >
              Add cameras to plot coverage
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
