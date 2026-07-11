"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { BACKEND_WS_URL, COLORS, type Camera } from "@/lib/constants";
import { createClient } from "@/lib/supabase";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const MAX_SEND_WIDTH = 640;
const JPEG_QUALITY = 0.45;
const FRAME_INTERVAL_MS = 450;
const CLIENT_PING_MS = 15000;

function buildWsUrl(orgId: string, cameraId: string): string {
  const base = BACKEND_WS_URL.replace(/\/$/, "");
  // https://… → wss://…  |  http://… → ws://…
  const wsBase = base.replace(/^http/i, "ws");
  return `${wsBase}/ws/stream/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;
}

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
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intentionalCloseRef = useRef(false);
  const mountedRef = useRef(true);

  const [camera, setCamera] = useState<Camera | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [wsError, setWsError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [frameCount, setFrameCount] = useState(0);
  const [videoSource, setVideoSource] = useState<"webcam" | "file">("webcam");
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!orgId || !cameraId) {
      setCamError("Missing orgId query parameter.");
      return;
    }
    const loadCamera = async () => {
      const { data } = await supabase
        .from("cameras")
        .select("*")
        .eq("org_id", orgId)
        .eq("id", cameraId)
        .maybeSingle();
      if (mountedRef.current) setCamera(data as Camera | null);
    };
    void loadCamera();
  }, [orgId, cameraId, supabase]);

  const connectWebSocket = useCallback(() => {
    if (!orgId || !mountedRef.current) return;

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (wsRef.current) {
      intentionalCloseRef.current = true;
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      try {
        wsRef.current.close();
      } catch {
        // ignore
      }
      wsRef.current = null;
      intentionalCloseRef.current = false;
    }

    setStatus("connecting");
    const wsUrl = buildWsUrl(orgId, cameraId);
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      setStatus("disconnected");
      setWsError(
        `Invalid WebSocket URL. Check NEXT_PUBLIC_BACKEND_WS_URL on Vercel. (${wsUrl})`
      );
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setStatus("connected");
      setWsError(null);
      retryRef.current = 0;
    };

    ws.onclose = (ev) => {
      if (!mountedRef.current) return;
      setStatus("disconnected");
      if (intentionalCloseRef.current) return;

      const attempt = retryRef.current + 1;
      retryRef.current = attempt;
      const delay = Math.min(1000 * 2 ** Math.min(attempt - 1, 4), 20000);

      setWsError(
        `Connection lost${ev.code ? ` (code ${ev.code})` : ""}. Retrying… (attempt ${attempt})`
      );

      retryTimerRef.current = setTimeout(() => {
        if (mountedRef.current) connectWebSocket();
      }, delay);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      // onclose will fire after this; keep message useful on first failure
      if (retryRef.current === 0) {
        setWsError(
          `WebSocket error. Target: ${wsUrl}. Confirm Railway is up and Vercel has NEXT_PUBLIC_BACKEND_WS_URL=wss://your-railway-host`
        );
      }
    };

    ws.onmessage = () => {
      // Server keepalive pings — ignore
    };
  }, [orgId, cameraId]);

  const startCamera = useCallback(async () => {
    setCamError(null);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = "";
    }

    if (videoSource === "file" && videoFileUrl) {
      if (videoRef.current) {
        videoRef.current.src = videoFileUrl;
        videoRef.current.loop = true;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch((playErr) => console.warn("Play failed:", playErr));
        };
      }
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 300));

    // Cap capture resolution — full HD frames drop mobile WebSockets
    const constraintAttempts: MediaStreamConstraints[] = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 640, max: 960 },
          height: { ideal: 480, max: 720 },
          frameRate: { ideal: 10, max: 15 },
        },
        audio: false,
      },
      { video: { facingMode: { ideal: facingMode } }, audio: false },
      { video: true, audio: false },
    ];

    let stream: MediaStream | null = null;
    for (const constraints of constraintAttempts) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        break;
      } catch {
        // try next
      }
    }

    if (!stream) {
      setCamError("Camera access denied. Allow camera permissions and reload.");
      return;
    }

    streamRef.current = stream;

    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().catch((playErr) => {
          console.warn("Auto-play failed:", playErr);
        });
      };
    }

    if ("wakeLock" in navigator) {
      try {
        await (
          navigator as Navigator & {
            wakeLock: { request: (t: string) => Promise<unknown> };
          }
        ).wakeLock.request("screen");
      } catch {
        // optional
      }
    }
  }, [facingMode, videoSource, videoFileUrl]);

  // Send downscaled JPEG frames + client keepalive pings
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (pingRef.current) clearInterval(pingRef.current);

    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ws = wsRef.current;
      if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
      if (!video.videoWidth || !video.videoHeight) return;

      const scale = Math.min(1, MAX_SEND_WIDTH / video.videoWidth);
      const w = Math.max(2, Math.round(video.videoWidth * scale));
      const h = Math.max(2, Math.round(video.videoHeight * scale));
      // Even dims help downstream H.264 encode
      canvas.width = w - (w % 2);
      canvas.height = h - (h % 2);

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);

      try {
        // Skip if still huge (rare) — prevents proxy disconnects
        if (dataUrl.length > 350_000) return;
        ws.send(JSON.stringify({ frame: dataUrl }));
        setFrameCount((c) => c + 1);
      } catch {
        // send failed — onclose will reconnect
      }
    }, FRAME_INTERVAL_MS);

    // Keep mobile NATs from killing the socket when frames briefly pause
    pingRef.current = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        // ignore
      }
    }, CLIENT_PING_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
    };
  }, []);

  useEffect(() => {
    void startCamera();
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startCamera]);

  useEffect(() => {
    intentionalCloseRef.current = false;
    connectWebSocket();
    return () => {
      intentionalCloseRef.current = true;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connectWebSocket]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setVideoFileUrl(url);
      setVideoSource("file");
    }
  };

  const switchToWebcam = () => {
    setVideoSource("webcam");
  };

  const displayError = camError || wsError;

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

  const wsTarget = orgId ? buildWsUrl(orgId, cameraId) : "(missing orgId)";

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
        {displayError && (
          <p className="text-center text-sm max-w-lg px-2" style={{ color: COLORS.alertRed }}>
            {displayError}
          </p>
        )}
        <div className="w-full max-w-lg aspect-video rounded-xl overflow-hidden bg-black relative">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="text-center text-white space-y-3">
          <div>
            <p className="font-medium text-lg">{camera?.name ?? cameraId}</p>
            <p className="text-sm text-white/70">{camera?.location ?? "Loading…"}</p>
          </div>

          {videoSource === "webcam" ? (
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
          ) : (
            <button
              onClick={switchToWebcam}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-95"
              style={{
                backgroundColor: "rgba(255,255,255,0.12)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              📹 Back to Webcam
            </button>
          )}

          <div className="pt-2">
            <label
              className="cursor-pointer px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 inline-block active:scale-95"
              style={{
                backgroundColor: COLORS.signalBlue,
                color: "white",
                boxShadow: "0 4px 14px rgba(37,99,235,0.4)",
              }}
            >
              📁 Test with Video File
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>

          {status === "connected" && (
            <p className="text-xs text-white/40">{frameCount} frames sent</p>
          )}

          <p className="text-[10px] text-white/30 break-all max-w-sm mx-auto px-2">
            {wsTarget}
          </p>
        </div>
      </main>
    </div>
  );
}
