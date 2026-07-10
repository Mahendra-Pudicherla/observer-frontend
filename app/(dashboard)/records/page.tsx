"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { FilterPills } from "@/components/dashboard/FilterPills";
import { Panel, StatusBadge } from "@/components/dashboard/StatusBadge";
import { BACKEND_API_URL, COLORS, formatAnomalyType } from "@/lib/constants";
import { Film, Trash2, ExternalLink, RefreshCw } from "lucide-react";

type RecordClip = {
  id: string;
  org_id: string;
  camera_id: string;
  type: string;
  label: string;
  confidence: number | null;
  clip_url: string | null;
  created_at?: string | null;
  started_at?: string | null;
  ended_at?: string | null;
};

function isImageClip(url: string) {
  return /\.(jpe?g|png|webp)(\?|$)/i.test(url) || url.includes("snapshot");
}

function toneFor(type: string): "critical" | "high" | "medium" | "low" {
  if (type.includes("VIOLENCE") || type.includes("FIGHT") || type.includes("WEAPON")) {
    return "critical";
  }
  if (type.includes("FACE")) return "high";
  if (type.includes("CROWD")) return "medium";
  return "low";
}

export default function RecordsPage() {
  const { org } = useSession();
  const [kind, setKind] = useState("all");
  const [clips, setClips] = useState<RecordClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!org?.id) return;
    setLoading(true);
    setError(null);
    try {
      const qs = kind && kind !== "all" ? `?kind=${kind}` : "";
      const res = await fetch(`${BACKEND_API_URL}/records/${org.id}${qs}`);
      if (!res.ok) throw new Error(`Failed to load records (${res.status})`);
      setClips(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load records");
      setClips([]);
    } finally {
      setLoading(false);
    }
  }, [org?.id, kind]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (clip: RecordClip) => {
    if (!org?.id) return;
    const ok = window.confirm(
      `Delete this ${clip.label} recording from camera ${clip.camera_id}? This removes the file from storage and the database.`
    );
    if (!ok) return;

    setDeleting(clip.id);
    try {
      const res = await fetch(`${BACKEND_API_URL}/records/${org.id}/${clip.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || `Delete failed (${res.status})`);
      }
      setClips((prev) => prev.filter((c) => c.id !== clip.id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Records"
        description="Stored fight and face-match recordings from live cameras"
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold"
            style={{
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              backgroundColor: COLORS.panelElevated,
            }}
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        }
      />

      <FilterPills
        value={kind}
        onChange={setKind}
        options={[
          { id: "all", label: "All clips" },
          { id: "fight", label: "Fight / Violence" },
          { id: "face", label: "Face match" },
          { id: "weapon", label: "Weapon" },
          { id: "crowd", label: "Crowd" },
        ]}
      />

      {error && (
        <p
          className="text-sm px-4 py-3 rounded-xl"
          style={{ backgroundColor: "rgba(239,68,68,0.12)", color: COLORS.alertRed }}
        >
          {error}
        </p>
      )}

      {loading ? (
        <Panel className="p-10 text-center text-sm" style={{ color: COLORS.textMuted }}>
          Loading recordings…
        </Panel>
      ) : clips.length === 0 ? (
        <Panel className="p-12 text-center">
          <Film className="h-10 w-10 mx-auto mb-3" style={{ color: COLORS.textMuted }} />
          <p className="font-semibold" style={{ color: COLORS.text }}>
            No recordings yet
          </p>
          <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
            Fight and face-match clips appear here after an alert is finalized
          </p>
        </Panel>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {clips.map((clip) => (
            <Panel key={clip.id} className="overflow-hidden flex flex-col">
              <div
                className="relative aspect-video"
                style={{ backgroundColor: COLORS.midnight }}
              >
                {clip.clip_url ? (
                  isImageClip(clip.clip_url) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clip.clip_url}
                      alt={clip.label}
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  ) : (
                    <video
                      src={clip.clip_url}
                      controls
                      className="absolute inset-0 w-full h-full object-contain"
                    />
                  )
                ) : (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-sm"
                    style={{ color: COLORS.textMuted }}
                  >
                    No media
                  </div>
                )}
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold truncate" style={{ color: COLORS.text }}>
                      {clip.label || formatAnomalyType(clip.type as never)}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                      {clip.camera_id}
                      {clip.created_at
                        ? ` · ${new Date(clip.created_at).toLocaleString()}`
                        : ""}
                    </p>
                  </div>
                  <StatusBadge label={clip.label.split(" ")[0]} tone={toneFor(clip.type)} />
                </div>

                {clip.confidence != null && (
                  <p className="text-xs" style={{ color: COLORS.textMuted }}>
                    Confidence {Math.round(clip.confidence * 100)}%
                  </p>
                )}

                <div className="flex gap-2 mt-auto">
                  {clip.clip_url && (
                    <a
                      href={clip.clip_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold"
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.signalBlue,
                        backgroundColor: COLORS.panelElevated,
                      }}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> Open
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void onDelete(clip)}
                    disabled={deleting === clip.id}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
                    style={{ backgroundColor: COLORS.alertRed }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {deleting === clip.id ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
