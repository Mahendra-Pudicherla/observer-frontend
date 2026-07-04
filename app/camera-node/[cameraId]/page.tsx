"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { BACKEND_WS_URL, COLORS, type Camera } from "@/lib/constants";
import { createClient } from "@/lib/supabase";

export default function CameraNodePage({
  params,
  searchParams,
}: {
  params: Promise<{ cameraId: string }>;
  searchParams: Promise<{ orgId?: string }>;
}) {
  const { cameraId } = use(params);
  const { orgId } = use(searchParams);
  const supabase = useMemo(() => createClient(), []);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [camera, setCamera] = useState<Camera | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !cameraId) {
      setError("Missing orgId query parameter.");
      return;
    }

    const loadCamera = async () => {
      const { data } = await supabase
        .from("cameras")
        .select("*")
        .eq("org_id", orgId)
        .eq("id", cameraId)
        .maybeSingle();
      setCamera(data as Camera | null);
    };

    void loadCamera();
  }, [orgId, cameraId, supabase]);

  useEffect(() => {
    if (!orgId) return;

    const startStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        if ("wakeLock" in navigator) {
          try {
            await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } }).wakeLock.request("screen");
          } catch {
            // optional
          }
        }

        const wsUrl = `${BACKEND_WS_URL.replace(/^http/, "ws")}/ws/stream/${orgId}/${cameraId}`;
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => setConnected(true);
        ws.onclose = () => setConnected(false);
        ws.onerror = () => setConnected(false);

        intervalRef.current = setInterval(() => {
          const video = videoRef.current;
          const canvas = canvasRef.current;
          if (!video || !canvas || ws.readyState !== WebSocket.OPEN) return;

          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.drawImage(video, 0, 0);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
          ws.send(JSON.stringify({ frame: dataUrl }));
        }, 300);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Camera access denied");
      }
    };

    void startStream();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      wsRef.current?.close();
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [orgId, cameraId]);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: COLORS.midnight }}
    >
      <header className="p-4 flex items-center justify-between">
        <Logo size="sm" />
        <span
          className="text-sm font-medium px-3 py-1.5 rounded-full"
          style={{
            backgroundColor: connected ? COLORS.safeGreen : COLORS.alertRed,
            color: "white",
          }}
        >
          {connected ? "Streaming" : "Disconnected"}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {error && (
          <p className="text-white text-center text-sm" style={{ color: COLORS.alertRed }}>
            {error}
          </p>
        )}
        <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden bg-black">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="text-center text-white">
          <p className="font-medium text-lg">{camera?.name ?? cameraId}</p>
          <p className="text-sm text-white/70">{camera?.location ?? "Loading…"}</p>
        </div>
      </main>
    </div>
  );
}
