"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "@/components/SessionProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { useOrgCameras } from "@/hooks/useOrgData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BACKEND_API_URL, COLORS, getCameraNodeUrl } from "@/lib/constants";
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
  const { cameras, reload } = useOrgCameras(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ id: "", name: "", location: "", address: "" });
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
      await reload();
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
      await reload();
    } catch (e) {
      console.error("Deactivate error:", e);
    }
  };

  const cameraNodeUrl = (cameraId: string) =>
    org?.id ? getCameraNodeUrl(cameraId, org.id) : "";

  const copyUrl = async (cameraId: string) => {
    const url = cameraNodeUrl(cameraId);
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(cameraId);
    setTimeout(() => setCopied(null), 2000);
  };

  const onlineCount = cameras.filter((c) => c.is_active).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cameras"
        description={`${onlineCount} of ${cameras.length} cameras online`}
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                className="font-semibold text-white rounded-xl h-10 px-5"
                style={{ backgroundColor: COLORS.signalBlue }}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Add Camera
              </Button>
            </DialogTrigger>
            <DialogContent
              className="rounded-2xl max-w-sm border"
              style={{ backgroundColor: COLORS.panel, borderColor: COLORS.border, color: COLORS.text }}
            >
              <DialogHeader>
                <DialogTitle className="font-bold text-base" style={{ color: COLORS.text }}>
                  Register camera
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-1">
                {[
                  { icon: Hash, placeholder: "Camera ID (e.g. CAM-001)", key: "id" as const },
                  { icon: CameraIcon, placeholder: "Display name", key: "name" as const },
                  { icon: MapPin, placeholder: "Location (e.g. Gate 2)", key: "location" as const },
                  { icon: FileText, placeholder: "Address (optional)", key: "address" as const },
                ].map(({ icon: Icon, placeholder, key }) => (
                  <div key={key} className="relative">
                    <Icon
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                      style={{ color: COLORS.textMuted }}
                    />
                    <Input
                      placeholder={placeholder}
                      value={form[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      className="pl-9 h-10 rounded-xl text-sm border"
                      style={{
                        backgroundColor: COLORS.panelElevated,
                        borderColor: COLORS.border,
                        color: COLORS.text,
                      }}
                    />
                  </div>
                ))}
                {error && (
                  <p
                    className="text-xs font-medium px-3 py-2 rounded-xl"
                    style={{ backgroundColor: "rgba(239,68,68,0.15)", color: COLORS.alertRed }}
                  >
                    {error}
                  </p>
                )}
                <Button
                  className="w-full h-10 font-semibold text-white rounded-xl"
                  style={{ backgroundColor: COLORS.signalBlue }}
                  onClick={onAdd}
                >
                  Save camera
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      {cameras.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 rounded-2xl"
          style={{ backgroundColor: COLORS.panel, border: `1px dashed ${COLORS.border}` }}
        >
          <CameraIcon className="h-12 w-12 mb-4" style={{ color: COLORS.textMuted }} />
          <p className="font-bold text-sm" style={{ color: COLORS.text }}>
            No cameras yet
          </p>
          <p className="text-xs mt-1 mb-5" style={{ color: COLORS.textMuted }}>
            Add your first camera to start monitoring
          </p>
          <Button
            onClick={() => setOpen(true)}
            className="font-semibold text-white rounded-xl h-9 px-5 text-sm"
            style={{ backgroundColor: COLORS.signalBlue }}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Camera
          </Button>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {cameras.map((camera, i) => {
              const nodeUrl = cameraNodeUrl(camera.id);
              return (
                <motion.div
                  key={camera.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.35, delay: i * 0.06 }}
                  className="rounded-2xl overflow-hidden"
                  style={{
                    backgroundColor: COLORS.panel,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div
                    className="px-4 py-3 flex items-center justify-between"
                    style={{ backgroundColor: COLORS.panelElevated }}
                  >
                    <span
                      className="text-xs font-bold px-2 py-1 rounded-lg tracking-wide"
                      style={{ backgroundColor: "rgba(255,255,255,0.08)", color: COLORS.text }}
                    >
                      {camera.id}
                    </span>
                    <span
                      className="flex items-center gap-1.5 text-xs font-semibold"
                      style={{ color: camera.is_active ? COLORS.safeGreen : COLORS.textMuted }}
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

                  <div className="px-4 py-3">
                    <p className="font-bold text-sm mb-0.5" style={{ color: COLORS.text }}>
                      {camera.name}
                    </p>
                    <p className="text-xs flex items-center gap-1" style={{ color: COLORS.textMuted }}>
                      <MapPin className="h-3 w-3 shrink-0" /> {camera.location}
                    </p>
                    {camera.address && (
                      <p className="text-xs mt-0.5" style={{ color: COLORS.textMuted }}>
                        {camera.address}
                      </p>
                    )}
                    {nodeUrl && (
                      <p
                        className="text-[11px] mt-2 break-all rounded-lg px-2 py-1.5 font-mono"
                        style={{
                          backgroundColor: COLORS.panelElevated,
                          color: COLORS.textMuted,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        {nodeUrl}
                      </p>
                    )}
                  </div>

                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    <a
                      href={nodeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: COLORS.signalBlue, color: COLORS.signalBlue }}
                    >
                      <ExternalLink className="h-3 w-3" /> Open node
                    </a>
                    <button
                      onClick={() => copyUrl(camera.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                      style={{ borderColor: COLORS.border, color: COLORS.textMuted }}
                    >
                      {copied === camera.id ? (
                        <>
                          <CheckCircle2 className="h-3 w-3" style={{ color: COLORS.safeGreen }} /> Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" /> Copy URL
                        </>
                      )}
                    </button>
                    {camera.is_active && (
                      <button
                        onClick={() => deactivate(camera.id)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border"
                        style={{ borderColor: "rgba(239,68,68,0.35)", color: COLORS.alertRed }}
                      >
                        <PowerOff className="h-3 w-3" /> Deactivate
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
