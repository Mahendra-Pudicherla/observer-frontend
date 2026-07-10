"use client";

import { useSession } from "@/components/SessionProvider";
import { useAnalysisSocket } from "@/hooks/useAnalysisSocket";
import { useOrgCameras, useOrgIncidents } from "@/hooks/useOrgData";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, StatusBadge } from "@/components/dashboard/StatusBadge";
import { COLORS, formatAnomalyType } from "@/lib/constants";
import { Flame, Users, ArrowUpRight, ArrowDown, Radio } from "lucide-react";

function densityLevel(value: number): number {
  if (value <= 0.05) return 0;
  if (value <= 0.2) return 1;
  if (value <= 0.4) return 2;
  if (value <= 0.65) return 3;
  return 4;
}

const DENSITY_COLORS = ["#14532d", "#166534", "#ca8a04", "#ea580c", "#dc2626"];

function RiskGauge({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(100, score));
  const color =
    clamped >= 70 ? COLORS.alertRed : clamped >= 40 ? COLORS.cautionAmber : COLORS.safeGreen;
  const label = clamped >= 70 ? "Elevated" : clamped >= 40 ? "Moderate" : "Stable";
  const angle = (clamped / 100) * 180;

  return (
    <Panel className="p-5 flex flex-col items-center justify-center min-h-[220px]">
      <div className="w-full flex items-start justify-between mb-2">
        <div>
          <p className="text-sm font-bold" style={{ color: COLORS.text }}>
            Composite risk score
          </p>
          <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
            Live density + incident signals
          </p>
        </div>
      </div>
      <div className="relative w-44 h-24 mt-4">
        <svg viewBox="0 0 200 110" className="w-full h-full">
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="14"
            strokeLinecap="round"
          />
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={`${(angle / 180) * 251} 251`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-1">
          <span className="text-4xl font-extrabold" style={{ color: COLORS.text }}>
            {clamped}
          </span>
          <span className="text-xs font-semibold" style={{ color }}>
            {label}
          </span>
        </div>
      </div>
    </Panel>
  );
}

export default function AiAnalysisPage() {
  const { org } = useSession();
  const { cameras } = useOrgCameras(false);
  const { incidents } = useOrgIncidents(20);
  const { snapshot, connected } = useAnalysisSocket(org?.id ?? null);

  const recentCritical = incidents.filter(
    (i) => i.type === "FIGHT_DETECTED" || i.type === "CROWD_SURGE"
  );
  const openCount = incidents.filter((i) => !i.reviewed).length;
  const risk = Math.min(
    95,
    Math.round(
      15 +
        snapshot.total_people * 4 +
        snapshot.peak_density * 45 +
        openCount * 8 +
        recentCritical.length * 6
    )
  );

  const movement = snapshot.movement;
  const hasMovement =
    movement.eastbound + movement.southbound + movement.reverse > 0;

  return (
    <div>
      <PageHeader
        title="AI Analysis"
        description="Live crowd density and movement from active camera detections"
        actions={
          <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: COLORS.textMuted }}>
            <Radio
              className="h-3.5 w-3.5"
              style={{ color: connected ? COLORS.safeGreen : COLORS.textMuted }}
            />
            {connected ? "Live" : "Connecting…"}
            {snapshot.cameras_reporting > 0 && (
              <span>· {snapshot.cameras_reporting} camera(s) reporting</span>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <RiskGauge score={risk} />

        <Panel className="p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-bold" style={{ color: COLORS.text }}>
              Panic / fight signals
            </p>
            {recentCritical.length > 0 && <StatusBadge label="Alert" tone="critical" />}
          </div>
          <p className="text-3xl font-extrabold mb-1" style={{ color: COLORS.text }}>
            {recentCritical.length} events
          </p>
          <p className="text-xs mb-4" style={{ color: COLORS.textMuted }}>
            across {new Set(recentCritical.map((i) => i.camera_id)).size || 0} cameras
          </p>
          <div className="space-y-3">
            {recentCritical.slice(0, 3).map((inc) => {
              const conf = Math.round((inc.confidence ?? 0.5) * 100);
              return (
                <div key={inc.id} className="flex items-center gap-3">
                  <Flame className="h-4 w-4 shrink-0" style={{ color: COLORS.alertRed }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between gap-2 text-xs mb-1">
                      <span className="font-semibold truncate" style={{ color: COLORS.text }}>
                        {inc.camera_id}
                      </span>
                      <span style={{ color: COLORS.textMuted }}>
                        {formatAnomalyType(inc.type)}
                      </span>
                    </div>
                    <div
                      className="h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${conf}%`, backgroundColor: COLORS.cautionAmber }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
            {recentCritical.length === 0 && (
              <p className="text-xs" style={{ color: COLORS.textMuted }}>
                No critical signals in recent history
              </p>
            )}
          </div>
        </Panel>

        <Panel className="p-5">
          <p className="text-sm font-bold mb-4" style={{ color: COLORS.text }}>
            Movement direction
          </p>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: "Eastbound", value: `${movement.eastbound}%`, icon: ArrowUpRight },
              { label: "Southbound", value: `${movement.southbound}%`, icon: ArrowDown },
              { label: "Reverse", value: `${movement.reverse}%`, icon: ArrowUpRight },
            ].map((m) => (
              <div
                key={m.label}
                className="rounded-xl p-3 text-center"
                style={{ backgroundColor: COLORS.panelElevated }}
              >
                <m.icon className="h-3.5 w-3.5 mx-auto mb-1" style={{ color: COLORS.signalBlue }} />
                <p className="text-sm font-bold" style={{ color: COLORS.text }}>
                  {hasMovement ? m.value : "—"}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: COLORS.textMuted }}>
                  {m.label}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-sm" style={{ color: COLORS.textMuted }}>
            <Users className="h-4 w-4" />
            <span>
              People detected now{" "}
              <strong style={{ color: COLORS.text }}>{snapshot.total_people}</strong>
              {" · "}
              {cameras.length} cameras registered
            </span>
          </div>
        </Panel>
      </div>

      <Panel className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <p className="text-sm font-bold" style={{ color: COLORS.text }}>
              Density heatmap
            </p>
            <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
              Live · {snapshot.grid_cols}×{snapshot.grid_rows} grid from person detections
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: COLORS.textMuted }}>
            <span>Low</span>
            <div className="flex gap-0.5">
              {DENSITY_COLORS.map((c) => (
                <span key={c} className="h-2.5 w-4 rounded-sm" style={{ backgroundColor: c }} />
              ))}
            </div>
            <span>High</span>
          </div>
        </div>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${snapshot.grid_cols}, minmax(0, 1fr))` }}
        >
          {snapshot.grid.flatMap((row, ri) =>
            row.map((cell, ci) => (
              <div
                key={`${ri}-${ci}`}
                className="aspect-square rounded-lg transition-colors duration-500"
                style={{ backgroundColor: DENSITY_COLORS[densityLevel(cell)] }}
                title={`${Math.round(cell * 100)}% density`}
              />
            ))
          )}
        </div>
        {snapshot.total_people === 0 && snapshot.peak_density < 0.05 && (
          <p className="text-xs mt-4 text-center" style={{ color: COLORS.textMuted }}>
            Start a camera node stream to populate the live heatmap
          </p>
        )}
      </Panel>
    </div>
  );
}
