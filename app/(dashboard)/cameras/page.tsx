"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/components/SessionProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BACKEND_API_URL, COLORS, type Camera } from "@/lib/constants";
import {
  Plus,
  Camera as CameraIcon,
  MapPin,
  Hash,
  FileText,
  ExternalLink,
  Copy,
  PowerOff,
  CheckCircle2,
  WifiOff,
} from "lucide-react";

export default function CamerasPage() {
  const { org } = useSession();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", location: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const loadCameras = async () => {
    if (!org?.id) return;
    try {
      const res = await fetch(`${BACKEND_API_URL}/cameras/${org.id}`);
      if (!res.ok) throw new Error(`Failed to load cameras (${res.status})`);
      const data: Camera[] = await res.json();
      setCameras(data);
    } catch (e) {
      console.error("Load cameras error:", e);
      setCameras([]);
    }
  };

  useEffect(() => { void loadCameras(); }, [org?.id]);

  const onAdd = async () => {
    if (!org?.id) return;
    setError(null);
    try {
      const res = await fetch(`${BACKEND_API_URL}/cameras/${org.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          name: form.name,
          location: form.location,
          address: form.address || null,
          is_active: true,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setError(detail?.detail || `Save failed (${res.status})`);
        return;
      }
      setOpen(false);
      setForm({ id: "", name: "", location: "", address: "" });
      await loadCameras();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  };

  const deactivate = async (cameraId: string) => {
    if (!org?.id) return;
    try {
      await fetch(`${BACKEND_API_URL}/cameras/${org.id}/${cameraId}`, {
        method: "DELETE",
      });
      await loadCameras();
    } catch (e) {
      console.error("Deactivate error:", e);
    }
  };

  const cameraNodeUrl = (cameraId: string) =>
    typeof window !== "undefined"
      ? `${window.location.origin}/camera-node/${cameraId}?orgId=${org?.id}`
      : `/camera-node/${cameraId}?orgId=${org?.id}`;

  const copyUrl = async (cameraId: string) => {
    await navigator.clipboard.writeText(cameraNodeUrl(cameraId));
    setCopied(cameraId);
    setTimeout(() => setCopied(null), 2000);
  };

  const onlineCount = cameras.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6" style={{ fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: COLORS.midnight }}>Cameras</h1>
          <p className="text-sm mt-0.5" style={{ color: COLORS.slate }}>
            {onlineCount} of {cameras.length} cameras online
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              className="font-semibold text-white rounded-xl h-10 px-5 shrink-0"
              style={{
                background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
                boxShadow: "0 6px 20px rgba(37,99,235,0.35)",
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> Add Camera
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-bold text-base" style={{ color: COLORS.midnight }}>Register camera</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1">
              {[
                { icon: Hash, placeholder: "Camera ID (e.g. CAM-001)", key: "id" as const },
                { icon: CameraIcon, placeholder: "Display name", key: "name" as const },
                { icon: MapPin, placeholder: "Location (e.g. Gate 2)", key: "location" as const },
                { icon: FileText, placeholder: "Address (optional)", key: "address" as const },
              ].map(({ icon: Icon, placeholder, key }) => (
                <div key={key} className="relative">
                  <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: COLORS.slate }} />
                  <Input
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    className="pl-9 h-10 rounded-xl text-sm"
                    style={{ borderColor: "#e2e8f0" }}
                  />
                </div>
              ))}
              {error && (
                <p className="text-xs font-medium px-3 py-2 rounded-xl" style={{ backgroundColor: "#fee2e2", color: COLORS.alertRed }}>
                  {error}
                </p>
              )}
              <Button
                className="w-full h-10 font-semibold text-white rounded-xl"
                style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)", boxShadow: "0 4px 14px rgba(37,99,235,0.35)" }}
                onClick={onAdd}
              >
                Save camera
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Camera cards grid */}
      {cameras.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ backgroundColor: "white", border: "1px dashed #cbd5e1" }}
        >
          <CameraIcon className="h-12 w-12 mb-4" style={{ color: "#e2e8f0" }} />
          <p className="font-bold text-sm" style={{ color: COLORS.slate }}>No cameras yet</p>
          <p className="text-xs mt-1 mb-5" style={{ color: "#94a3b8" }}>Add your first camera to start monitoring</p>
          <Button
            onClick={() => setOpen(true)}
            className="font-semibold text-white rounded-xl h-9 px-5 text-sm"
            style={{ background: "linear-gradient(135deg, #2563eb, #1d4ed8)" }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Camera
          </Button>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {cameras.map((camera, i) => (
              <motion.div
                key={camera.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: i * 0.06 }}
                className="bg-white rounded-2xl overflow-hidden group transition-all duration-300 hover:-translate-y-0.5"
                style={{
                  border: `1px solid ${camera.is_active ? "rgba(0,0,0,0.05)" : "#f1f5f9"}`,
                  boxShadow: camera.is_active
                    ? "0 4px 20px rgba(0,0,0,0.06)"
                    : "0 2px 8px rgba(0,0,0,0.04)",
                }}
              >
                {/* Card header — dark strip */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    background: camera.is_active
                      ? `linear-gradient(135deg, ${COLORS.midnight}, #1e3a5f)`
                      : "#f8fafc",
                  }}
                >
                  <span
                    className="text-xs font-bold px-2 py-1 rounded-lg tracking-wide"
                    style={{
                      backgroundColor: camera.is_active ? "rgba(255,255,255,0.12)" : "#e2e8f0",
                      color: camera.is_active ? "white" : COLORS.slate,
                    }}
                  >
                    {camera.id}
                  </span>
                  <span
                    className="flex items-center gap-1.5 text-xs font-semibold"
                    style={{ color: camera.is_active ? "#4ade80" : COLORS.slate }}
                  >
                    {camera.is_active ? (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        Online
                      </>
                    ) : (
                      <>
                        <WifiOff className="h-3 w-3" />
                        Offline
                      </>
                    )}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-4 py-3">
                  <p className="font-bold text-sm mb-0.5" style={{ color: COLORS.midnight }}>{camera.name}</p>
                  <p className="text-xs flex items-center gap-1" style={{ color: COLORS.slate }}>
                    <MapPin className="h-3 w-3 shrink-0" /> {camera.location}
                  </p>
                  {camera.address && (
                    <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>{camera.address}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  <a
                    href={cameraNodeUrl(camera.id)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-blue-50"
                    style={{ borderColor: COLORS.signalBlue, color: COLORS.signalBlue }}
                  >
                    <ExternalLink className="h-3 w-3" /> Open node
                  </a>
                  <button
                    onClick={() => copyUrl(camera.id)}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-slate-50"
                    style={{ borderColor: "#e2e8f0", color: COLORS.slate }}
                  >
                    {copied === camera.id ? (
                      <><CheckCircle2 className="h-3 w-3 text-green-500" /> Copied!</>
                    ) : (
                      <><Copy className="h-3 w-3" /> Copy URL</>
                    )}
                  </button>
                  {camera.is_active && (
                    <button
                      onClick={() => deactivate(camera.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors hover:bg-red-50"
                      style={{ borderColor: "#fecaca", color: COLORS.alertRed }}
                    >
                      <PowerOff className="h-3 w-3" /> Deactivate
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

