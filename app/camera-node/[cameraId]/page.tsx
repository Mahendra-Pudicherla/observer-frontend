"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { BACKEND_WS_URL, COLORS, type Camera } from "@/lib/constants";
import { createClient } from "@/lib/supabase";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

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
  const streamRef = useRef<MediaStream | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [camera, setCamera] = useState<Camera | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [frameCount, setFrameCount] = useState(0);

  // Load camera metadata
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

  // Connect WebSocket with retry logic
  const connectWebSocket = useCallback(() => {
    if (!orgId) return;

    // Clean up any existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null; // prevent retry loop from old close handler
      wsRef.current.close();
      wsRef.current = null;
    }

    setStatus("connecting");
    const wsUrl = `${BACKEND_WS_URL.replace(/^http/, "ws")}/ws/stream/${orgId}/${cameraId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      setError(null);
      retryRef.current = 0; // reset backoff on success
    };

    ws.onclose = () => {
      setStatus("disconnected");
      // Schedule reconnect with exponential backoff
      const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
      retryRef.current += 1;
      retryTimerRef.current = setTimeout(() => {
        connectWebSocket();
      }, delay);
    };

    ws.onerror = () => {
      // onerror is always followed by onclose, so reconnect happens there
      setError(
        retryRef.current === 0
          ? `WebSocket connection error. Target URL: ${wsUrl}. Verify backend deployment and configuration.`
          : `Connection lost. Retrying... (attempt ${retryRef.current + 1})`
      );
    };

    ws.onmessage = () => {
      // Ignore server pings — we only send frames, not receive
    };
  }, [orgId, cameraId]);

  // Start camera hardware
  const startCamera = useCallback(async () => {
    setError(null);

    // Stop any existing stream to release camera hardware
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    // Give hardware some time to release
    await new Promise((resolve) => setTimeout(resolve, 300));

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn("Auto-play failed, browser might require user interaction:", playErr);
        }
      }

      // Keep screen awake
      if ("wakeLock" in navigator) {
        try {
          await (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<unknown> } }).wakeLock.request("screen");
        } catch {
          // optional
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera access denied");
    }
  }, [facingMode]);

  // Frame sending interval — runs independently of WebSocket state
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    // Send frames at ~3 FPS when WebSocket is connected
    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ws = wsRef.current;
      if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      ws.send(JSON.stringify({ frame: dataUrl }));
      setFrameCount((c) => c + 1);
    }, 300);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Start camera and WebSocket on mount; restart camera on facingMode change
  useEffect(() => {
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  // Manage WebSocket lifecycle separately
  useEffect(() => {
    connectWebSocket();
    return () => {
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent retry on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  // Toggle between front and back camera
  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const statusLabel =
    status === "connected"
      ? "● Streaming"
      : status === "connecting"
        ? "Reconnecting…"
        : "Disconnected";

  const statusColor =
    status === "connected"
      ? COLORS.safeGreen
      : status === "connecting"
        ? COLORS.cautionAmber
        : COLORS.alertRed;

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
            backgroundColor: statusColor,
            color: "white",
          }}
        >
          {statusLabel}
        </span>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        {error && (
          <p className="text-center text-sm" style={{ color: COLORS.alertRed }}>
            {error}
          </p>
        )}
        <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden bg-black relative">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        {/* Camera info + controls */}
        <div className="text-center text-white space-y-3">
          <div>
            <p className="font-medium text-lg">{camera?.name ?? cameraId}</p>
            <p className="text-sm text-white/70">{camera?.location ?? "Loading…"}</p>
          </div>

          {/* Toggle camera button */}
          <button
            onClick={toggleCamera}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95"
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              color: "white",
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            🔄 Switch to {facingMode === "environment" ? "Front" : "Back"} Camera
          </button>

          {/* Frame counter */}
          {status === "connected" && (
            <p className="text-xs text-white/40">
              {frameCount} frames sent
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

