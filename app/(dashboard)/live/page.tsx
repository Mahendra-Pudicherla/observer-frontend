"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { useAlertSocket } from "@/hooks/useAlertSocket";
import { useAnalysisSocket } from "@/hooks/useAnalysisSocket";
import { useOrgCameras } from "@/hooks/useOrgData";
import { CameraFeedCard } from "@/components/dashboard/CameraFeedCard";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { FilterPills } from "@/components/dashboard/FilterPills";
import { COLORS, formatAnomalyType } from "@/lib/constants";
import { Camera as CameraIcon } from "lucide-react";

export default function LiveMonitoringPage() {
  const { org } = useSession();
  const { cameras } = useOrgCameras(true);
  const { activeAlert } = useAlertSocket(org?.id ?? null);
  const { snapshot } = useAnalysisSocket(org?.id ?? null);
  const [liveCameras, setLiveCameras] = useState<Set<string>>(new Set());
  const [alertingCameras, setAlertingCameras] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("all");

  const handleLiveChange = useCallback((cameraId: string, isLive: boolean) => {
    setLiveCameras((prev) => {
      const next = new Set(prev);
      if (isLive) next.add(cameraId);
      else next.delete(cameraId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (activeAlert?.camera_id) {
      setAlertingCameras((prev) => new Set(prev).add(activeAlert.camera_id));
    }
  }, [activeAlert]);

  const filtered = cameras.filter((c) => {
    if (filter === "online") return liveCameras.has(c.id);
    if (filter === "offline") return !liveCameras.has(c.id);
    if (filter === "alert") return alertingCameras.has(c.id);
    return true;
  });

  const statusFor = (cameraId: string) => {
    if (alertingCameras.has(cameraId) && activeAlert?.camera_id === cameraId) {
      return formatAnomalyType(activeAlert.type);
    }
    if (alertingCameras.has(cameraId)) return "Alert";
    return "Normal";
  };

  return (
    <div>
      <PageHeader
        eyebrow={`Grid view · ${filtered.length} of ${cameras.length} cameras`}
        title="Live feeds"
        description="Real-time JPEG streams from active camera nodes"
        actions={
          <FilterPills
            value={filter}
            onChange={setFilter}
            options={[
              { id: "all", label: "All" },
              { id: "online", label: "Online" },
              { id: "offline", label: "Offline" },
              { id: "alert", label: "Alert" },
            ]}
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {filtered.length === 0 ? (
          <div
            className="col-span-full flex flex-col items-center justify-center py-20 rounded-2xl"
            style={{
              backgroundColor: COLORS.panel,
              border: `1px dashed ${COLORS.border}`,
            }}
          >
            <CameraIcon className="h-10 w-10 mb-3" style={{ color: COLORS.textMuted }} />
            <p className="font-semibold text-sm" style={{ color: COLORS.text }}>
              No cameras to show
            </p>
            <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
              Add cameras from the Cameras page, or adjust filters
            </p>
          </div>
        ) : (
          filtered.map((camera, i) => (
            <CameraFeedCard
              key={camera.id}
              camera={camera}
              orgId={org?.id ?? ""}
              isAlerting={alertingCameras.has(camera.id)}
              index={i}
              onLiveChange={handleLiveChange}
              statusLabel={statusFor(camera.id)}
              peopleCount={snapshot.camera_counts?.[camera.id]}
            />
          ))
        )}
      </div>
    </div>
  );
}
