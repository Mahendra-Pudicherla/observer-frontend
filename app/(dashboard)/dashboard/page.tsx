"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/components/SessionProvider";
import { useAlertSocket } from "@/hooks/useAlertSocket";
import { useOrgCameras, useOrgIncidents } from "@/hooks/useOrgData";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, StatusBadge } from "@/components/dashboard/StatusBadge";
import { COLORS, formatAnomalyType } from "@/lib/constants";
import {
  AlertTriangle,
  Camera as CameraIcon,
  Activity,
  ArrowRight,
  X,
  Video,
} from "lucide-react";

export default function DashboardPage() {
  const { org } = useSession();
  const { cameras } = useOrgCameras(false);
  const { incidents } = useOrgIncidents(10);
  const { activeAlert, clearAlert } = useAlertSocket(org?.id ?? null);

  const activeCameras = cameras.filter((c) => c.is_active).length;
  const todayCount = incidents.filter((i) => {
    if (!i.created_at) return false;
    return new Date(i.created_at).toDateString() === new Date().toDateString();
  }).length;
  const openIncidents = incidents.filter((i) => !i.reviewed).length;

  const stats = [
    { label: "Active cameras", value: activeCameras, color: COLORS.safeGreen, icon: CameraIcon },
    { label: "Open incidents", value: openIncidents, color: COLORS.alertRed, icon: AlertTriangle },
    { label: "Today", value: todayCount, color: COLORS.signalBlue, icon: Activity },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Operational overview across your camera network"
        actions={
          <Link
            href="/live"
            className="inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl"
            style={{ backgroundColor: COLORS.signalBlue, color: "#fff" }}
          >
            Open live feeds <ArrowRight className="h-4 w-4" />
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {stats.map((s) => (
          <Panel key={s.label} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: COLORS.textMuted }}>
                {s.label}
              </p>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${s.color}22` }}
              >
                <s.icon className="h-4 w-4" style={{ color: s.color }} />
              </div>
            </div>
            <p className="text-3xl font-extrabold" style={{ color: s.color }}>
              {s.value}
            </p>
          </Panel>
        ))}
      </div>

      <AnimatePresence>
        {activeAlert && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="rounded-2xl mb-6 overflow-hidden"
            style={{ border: `1px solid ${COLORS.alertRed}` }}
          >
            <div
              className="px-5 py-4 flex flex-wrap items-center justify-between gap-4"
              style={{ backgroundColor: "rgba(239,68,68,0.1)" }}
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-xl shrink-0"
                  style={{ backgroundColor: COLORS.alertRed }}
                >
                  <AlertTriangle className="h-4 w-4 text-white" />
                </span>
                <div>
                  <p className="font-bold text-sm" style={{ color: COLORS.text }}>
                    {formatAnomalyType(activeAlert.type)} detected
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                    {activeAlert.camera_id}
                    {activeAlert.location ? ` · ${activeAlert.location}` : ""}
                    {" · "}
                    {Math.round(activeAlert.confidence * 100)}% confidence
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeAlert.clip_url && (
                  <a
                    href={activeAlert.clip_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ border: `1px solid ${COLORS.alertRed}`, color: COLORS.alertRed }}
                  >
                    <Video className="h-3 w-3" /> View clip
                  </a>
                )}
                <button
                  type="button"
                  onClick={clearAlert}
                  className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5"
                  style={{ color: COLORS.textMuted }}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: COLORS.border }}>
            <p className="text-sm font-bold" style={{ color: COLORS.text }}>Recent incidents</p>
            <Link href="/incidents" className="text-xs font-semibold" style={{ color: COLORS.signalBlue }}>
              View all
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {incidents.slice(0, 5).map((incident) => (
              <div key={incident.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold" style={{ color: COLORS.text }}>
                    {formatAnomalyType(incident.type)}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                    {incident.camera_id}
                    {" · "}
                    {incident.created_at ? new Date(incident.created_at).toLocaleString() : "—"}
                  </p>
                </div>
                <StatusBadge
                  label={incident.reviewed ? "resolved" : "open"}
                  tone={incident.reviewed ? "resolved" : "open"}
                />
              </div>
            ))}
            {incidents.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: COLORS.textMuted }}>
                No incidents yet
              </div>
            )}
          </div>
        </Panel>

        <Panel>
          <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: COLORS.border }}>
            <p className="text-sm font-bold" style={{ color: COLORS.text }}>Camera status</p>
            <Link href="/cameras" className="text-xs font-semibold" style={{ color: COLORS.signalBlue }}>
              Manage
            </Link>
          </div>
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {cameras.map((camera) => (
              <div key={camera.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: COLORS.text }}>
                    {camera.name}
                  </p>
                  <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.textMuted }}>
                    {camera.location}
                  </p>
                </div>
                <StatusBadge
                  label={camera.is_active ? "active" : "offline"}
                  tone={camera.is_active ? "online" : "offline"}
                />
              </div>
            ))}
            {cameras.length === 0 && (
              <div className="px-4 py-8 text-center text-sm" style={{ color: COLORS.textMuted }}>
                No cameras registered
              </div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
