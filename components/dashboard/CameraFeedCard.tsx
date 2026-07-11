"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useCameraFeed } from "@/hooks/useCameraFeed";
import { COLORS, type Camera } from "@/lib/constants";
import { StatusBadge } from "@/components/dashboard/StatusBadge";

export function CameraFeedCard({
  camera,
  orgId,
  isAlerting,
  index,
  onLiveChange,
  statusLabel,
  peopleCount,
}: {
  camera: Camera;
  orgId: string;
  isAlerting: boolean;
  index: number;
  onLiveChange?: (cameraId: string, isLive: boolean) => void;
  statusLabel?: string;
  peopleCount?: number;
}) {
  const { frame, live } = useCameraFeed(orgId, camera.id);
  const imgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    onLiveChange?.(camera.id, live);
  }, [live, camera.id, onLiveChange]);

  // Update <img> directly — avoids React re-render lag on every JPEG
  useEffect(() => {
    if (!imgRef.current) return;
    if (frame) {
      imgRef.current.src = frame;
    } else {
      imgRef.current.removeAttribute("src");
    }
  }, [frame]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: COLORS.panel,
        border: `1px solid ${isAlerting ? COLORS.alertRed : COLORS.border}`,
        boxShadow: isAlerting ? "0 0 24px rgba(239,68,68,0.2)" : undefined,
      }}
    >
      <div
        className="relative aspect-video scanlines"
        style={{ backgroundColor: COLORS.midnight }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          alt={`Live feed from ${camera.name}`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: frame ? "block" : "none" }}
        />
        {!frame && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(59,130,246,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.08) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            <p className="relative z-10 text-xs" style={{ color: COLORS.textMuted }}>
              Waiting for stream…
            </p>
            <p className="relative z-10 text-[10px]" style={{ color: COLORS.textMuted }}>
              {camera.id}
            </p>
          </div>
        )}

        <div className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1.5">
          <StatusBadge
            label={live ? "ONLINE" : "OFFLINE"}
            tone={live ? "online" : "offline"}
          />
          {live && peopleCount !== undefined && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-md"
              style={{ backgroundColor: "rgba(0,0,0,0.65)", color: "#fff" }}
            >
              {peopleCount} {peopleCount === 1 ? "person" : "people"}
            </span>
          )}
        </div>

        {isAlerting && (
          <div
            className="absolute top-2.5 right-2.5 text-white text-[10px] font-bold px-2 py-1 rounded-md z-20 flex items-center gap-1"
            style={{ backgroundColor: COLORS.alertRed }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
            ALERT
          </div>
        )}
      </div>

      <div className="p-3.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: COLORS.text }}>
            {camera.id}
          </p>
          <p className="text-xs mt-0.5 truncate" style={{ color: COLORS.textMuted }}>
            {camera.location || camera.name}
          </p>
        </div>
        {statusLabel && (
          <StatusBadge
            label={statusLabel}
            tone={
              statusLabel === "Normal"
                ? "normal"
                : statusLabel.toLowerCase().includes("fight") ||
                    statusLabel.toLowerCase().includes("panic")
                  ? "critical"
                  : statusLabel.toLowerCase().includes("crowd") ||
                      statusLabel.toLowerCase().includes("density")
                    ? "high"
                    : "medium"
            }
          />
        )}
      </div>
    </motion.div>
  );
}
