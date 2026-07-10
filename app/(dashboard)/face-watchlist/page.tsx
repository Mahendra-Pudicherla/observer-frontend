"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BACKEND_API_URL, COLORS } from "@/lib/constants";
import { ScanFace, Trash2, Upload, User } from "lucide-react";

type WatchlistFace = {
  id: string;
  org_id: string;
  name: string;
  image_url: string | null;
  created_at?: string;
};

export default function FaceWatchlistPage() {
  const { org } = useSession();
  const [faces, setFaces] = useState<WatchlistFace[]>([]);
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadFaces = async () => {
    if (!org?.id) return;
    try {
      const res = await fetch(`${BACKEND_API_URL}/faces/${org.id}`);
      if (!res.ok) throw new Error(`Failed to load watchlist (${res.status})`);
      setFaces(await res.json());
    } catch (e) {
      console.error(e);
      setFaces([]);
    }
  };

  useEffect(() => {
    void loadFaces();
  }, [org?.id]);

  const onEnroll = async () => {
    if (!org?.id || !file || !name.trim()) {
      setError("Name and photo are required");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      form.append("name", name.trim());
      form.append("image", file);
      const res = await fetch(`${BACKEND_API_URL}/faces/${org.id}`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.detail || `Enroll failed (${res.status})`);
      }
      setName("");
      setFile(null);
      await loadFaces();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enroll failed");
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async (faceId: string) => {
    if (!org?.id) return;
    await fetch(`${BACKEND_API_URL}/faces/${org.id}/${faceId}`, { method: "DELETE" });
    await loadFaces();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Face Watchlist"
        description="Upload a reference photo — the AI will alert when that person appears on any camera"
      />

      <Panel className="p-5">
        <p className="text-sm font-bold mb-4" style={{ color: COLORS.text }}>
          Enroll person
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
          <Input
            placeholder="Person name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-xl border"
            style={{
              backgroundColor: COLORS.panelElevated,
              borderColor: COLORS.border,
              color: COLORS.text,
            }}
          />
          <label
            className="flex items-center gap-2 h-10 px-3 rounded-xl cursor-pointer border text-sm"
            style={{
              backgroundColor: COLORS.panelElevated,
              borderColor: COLORS.border,
              color: COLORS.textMuted,
            }}
          >
            <Upload className="h-4 w-4" />
            {file ? file.name : "Choose photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <Button
            onClick={onEnroll}
            disabled={loading}
            className="h-10 rounded-xl text-white font-semibold"
            style={{ backgroundColor: COLORS.signalBlue }}
          >
            <ScanFace className="h-4 w-4 mr-2" />
            {loading ? "Processing…" : "Add to watchlist"}
          </Button>
        </div>
        {error && (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: "rgba(239,68,68,0.15)", color: COLORS.alertRed }}>
            {error}
          </p>
        )}
        <p className="text-xs mt-3" style={{ color: COLORS.textMuted }}>
          Use a clear front-facing photo. Matching runs on live camera streams via InsightFace.
        </p>
      </Panel>

      <Panel>
        <div className="px-4 py-3 border-b" style={{ borderColor: COLORS.border }}>
          <p className="text-sm font-bold" style={{ color: COLORS.text }}>
            Enrolled faces ({faces.length})
          </p>
        </div>
        {faces.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm" style={{ color: COLORS.textMuted }}>
            No faces enrolled yet
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: COLORS.border }}>
            {faces.map((face) => (
              <div key={face.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {face.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={face.image_url}
                      alt={face.name}
                      className="h-12 w-12 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span
                      className="h-12 w-12 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: COLORS.panelElevated }}
                    >
                      <User className="h-5 w-5" style={{ color: COLORS.textMuted }} />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold truncate" style={{ color: COLORS.text }}>
                      {face.name}
                    </p>
                    <p className="text-xs truncate" style={{ color: COLORS.textMuted }}>
                      {face.created_at ? new Date(face.created_at).toLocaleString() : "—"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onDelete(face.id)}
                  className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-white/5 shrink-0"
                  style={{ color: COLORS.alertRed }}
                  title="Remove"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
