"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import {
  BACKEND_API_URL,
  BACKEND_WS_URL,
  COLORS,
  type Camera,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase";

type ConnectionStatus = "disconnected" | "connecting" | "connected";
type Transport = "http" | "ws" | "none";

const MAX_SEND_WIDTH = 480;
const JPEG_QUALITY = 0.4;
const FRAME_INTERVAL_MS = 500;

function buildWsUrl(orgId: string, cameraId: string): string {
  const base = BACKEND_WS_URL.replace(/\/$/, "");
  const wsBase = base.replace(/^http/i, "ws");
  return `${wsBase}/ws/stream/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;
}

function buildIngestUrl(orgId: string, cameraId: string): string {
  const base = BACKEND_API_URL.replace(/\/$/, "");
  return `${base}/ingest/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;
}

/**
 * Camera uplink prefers HTTP POST (/ingest) — works on mobile carriers and
 * in-app browsers that drop WebSockets. WebSocket is used when it stays open.
 */
function useCameraStream(orgId: string | undefined, cameraId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [wsError, setWsError] = useState<string | null>(null);
  const [transport, setTransport] = useState<Transport>("none");
  const [frameCount, setFrameCount] = useState(0);
  const [lastCloseCode, setLastCloseCode] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orgIdRef = useRef(orgId);
  const cameraIdRef = useRef(cameraId);
  const transportRef = useRef<Transport>("none");
  const inflightRef = useRef(false);
  const failStreakRef = useRef(0);

  orgIdRef.current = orgId;
  cameraIdRef.current = cameraId;

  useEffect(() => {
    let stopped = false;
    transportRef.current = "none";
    setTransport("none");
    setStatus("connecting");
    setWsError(null);
    failStreakRef.current = 0;

    const oid = orgId;
    if (!oid) {
      setWsError("Missing orgId in URL");
      setStatus("disconnected");
      return;
    }

    const ingestUrl = buildIngestUrl(oid, cameraId);
    const wsUrl = buildWsUrl(oid, cameraId);

    // Probe HTTP API first — if this fails, nothing will work
    void (async () => {
      try {
        const healthBase = BACKEND_API_URL.replace(/\/$/, "");
        const res = await fetch(`${healthBase}/health`, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        if (!stopped) {
          setStatus("connecting");
          setWsError(null);
        }
      } catch (err) {
        if (stopped) return;
        setStatus("disconnected");
        setWsError(
          `Cannot reach backend API (${BACKEND_API_URL}). Check NEXT_PUBLIC_BACKEND_API_URL. ${
            err instanceof Error ? err.message : ""
          }`
        );
      }
    })();

    // Optional WebSocket — nice when it works, not required
    let wsRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let wsAttempts = 0;

    const closeWs = () => {
      const ws = wsRef.current;
      wsRef.current = null;
      if (!ws) return;
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      try {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, "stop");
        }
      } catch {
        // ignore
      }
    };

    const openWs = () => {
      if (stopped) return;
      closeWs();
      wsAttempts += 1;
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (stopped || wsRef.current !== ws) return;
        // Prefer WS when open
        transportRef.current = "ws";
        setTransport("ws");
        setStatus("connected");
        setWsError(null);
        failStreakRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (stopped || wsRef.current !== ws) return;
        try {
          const data = JSON.parse(String(event.data)) as { type?: string };
          if (data.type === "ready" || data.type === "ping") {
            transportRef.current = "ws";
            setTransport("ws");
            setStatus("connected");
            setWsError(null);
          }
        } catch {
          // ignore
        }
      };

      ws.onclose = (ev) => {
        if (wsRef.current === ws) wsRef.current = null;
        setLastCloseCode(ev.code || 1006);
        if (transportRef.current === "ws") {
          transportRef.current = "http";
          setTransport("http");
        }
        if (stopped) return;
        // Keep retrying WS in background; HTTP carries frames
        const delay = Math.min(3000 * Math.min(wsAttempts, 6), 20000);
        wsRetryTimer = setTimeout(openWs, delay);
      };
    };

    openWs();

    const sendFrameHttp = async (dataUrl: string) => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const res = await fetch(ingestUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ frame: dataUrl }),
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error(`ingest HTTP ${res.status}`);
        }
        failStreakRef.current = 0;
        if (transportRef.current !== "ws") {
          transportRef.current = "http";
          setTransport("http");
        }
        setStatus("connected");
        setWsError(null);
        setFrameCount((c) => c + 1);
      } catch (err) {
        failStreakRef.current += 1;
        if (failStreakRef.current >= 3 && transportRef.current !== "ws") {
          setStatus("disconnected");
          setWsError(
            `Frame upload failed (${failStreakRef.current}x). ${
              err instanceof Error ? err.message : "network error"
            }`
          );
          setTransport("none");
          transportRef.current = "none";
        }
      } finally {
        inflightRef.current = false;
      }
    };

    const frameTimer = setInterval(() => {
      if (stopped) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) return;
      if (!video.videoWidth || !video.videoHeight) return;

      const scale = Math.min(1, MAX_SEND_WIDTH / video.videoWidth);
      let w = Math.max(2, Math.round(video.videoWidth * scale));
      let h = Math.max(2, Math.round(video.videoHeight * scale));
      w -= w % 2;
      h -= h % 2;
      if (canvas.width !== w) canvas.width = w;
      if (canvas.height !== h) canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      if (dataUrl.length > 200_000) return;

      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ frame: dataUrl }));
          setFrameCount((c) => c + 1);
          transportRef.current = "ws";
          setTransport("ws");
          setStatus("connected");
          setWsError(null);
          return;
        } catch {
          // fall through to HTTP
        }
      }

      void sendFrameHttp(dataUrl);
    }, FRAME_INTERVAL_MS);

    const onVisible = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        openWs();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(frameTimer);
      if (wsRetryTimer) clearTimeout(wsRetryTimer);
      closeWs();
    };
  }, [orgId, cameraId]);

  const reconnectNow = () => {
    // Force a new effect cycle by toggling via location reload is heavy;
    // instead poke HTTP health and reopen WS.
    failStreakRef.current = 0;
    setStatus("connecting");
    setWsError(null);
    const ws = wsRef.current;
    if (ws) {
      try {
        ws.close(1000, "reconnect");
      } catch {
        // ignore
      }
    }
  };

  return {
    status,
    wsError,
    transport,
    frameCount,
    lastCloseCode,
    videoRef,
    canvasRef,
    reconnectNow,
    wsTarget: orgId ? buildWsUrl(orgId, cameraId) : "(missing orgId)",
    httpTarget: orgId ? buildIngestUrl(orgId, cameraId) : "(missing orgId)",
  };
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

  const streamRef = useRef<MediaStream | null>(null);
  const [camera, setCamera] = useState<Camera | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [videoSource, setVideoSource] = useState<"webcam" | "file">("webcam");
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);

  const {
    status,
    wsError,
    transport,
    frameCount,
    lastCloseCode,
    videoRef,
    canvasRef,
    reconnectNow,
    wsTarget,
    httpTarget,
  } = useCameraStream(orgId, cameraId);

  useEffect(() => {
    if (!orgId || !cameraId) {
      setCamError("Missing orgId query parameter.");
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("cameras")
        .select("*")
        .eq("org_id", orgId)
        .eq("id", cameraId)
        .maybeSingle();
      setCamera(data as Camera | null);
    })();
  }, [orgId, cameraId, supabase]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      setCamError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      const el = videoRef.current;
      if (el) {
        el.srcObject = null;
        el.src = "";
      }

      if (videoSource === "file" && videoFileUrl) {
        if (el) {
          el.src = videoFileUrl;
          el.loop = true;
          el.onloadedmetadata = () => {
            el.play().catch(() => undefined);
          };
        }
        return;
      }

      await new Promise((r) => setTimeout(r, 200));
      if (cancelled) return;

      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 480, max: 640 },
            height: { ideal: 360, max: 480 },
            frameRate: { ideal: 8, max: 12 },
          },
          audio: false,
        },
        { video: { facingMode: { ideal: facingMode } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch {
          // next
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!stream) {
        setCamError("Camera access denied. Allow camera permissions and reload.");
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => undefined);
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
    };

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [facingMode, videoSource, videoFileUrl, videoRef]);

  const displayError = camError || wsError;
  const statusLabel =
    status === "connected"
      ? transport === "http"
        ? "● Streaming (HTTP)"
        : "● Streaming"
      : status === "connecting"
        ? "Connecting…"
        : "Disconnected";
  const statusColor =
    status === "connected"
      ? COLORS.safeGreen
      : status === "connecting"
        ? COLORS.cautionAmber
        : COLORS.alertRed;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: COLORS.midnight }}>
      <header className="p-4 flex items-center justify-between">
        <Logo size="sm" />
        <span
          className="text-sm font-medium px-3 py-1.5 rounded-full"
          style={{ backgroundColor: statusColor, color: "white" }}
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
              onClick={() =>
                setFacingMode((prev) => (prev === "environment" ? "user" : "environment"))
              }
              className="px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
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
              onClick={() => setVideoSource("webcam")}
              className="px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
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
              className="cursor-pointer px-5 py-2.5 rounded-xl text-sm font-semibold inline-block active:scale-95"
              style={{ backgroundColor: COLORS.signalBlue, color: "white" }}
            >
              📁 Test with Video File
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setVideoFileUrl(URL.createObjectURL(file));
                    setVideoSource("file");
                  }
                }}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              reconnectNow();
              window.location.reload();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold"
            style={{
              border: "1px solid rgba(255,255,255,0.2)",
              color: "white",
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          >
            Reconnect now
          </button>

          {status === "connected" && (
            <p className="text-xs text-white/40">
              {frameCount} frames sent · via {transport.toUpperCase()}
            </p>
          )}

          <p className="text-[10px] text-white/30 break-all max-w-sm mx-auto px-2">
            HTTP: {httpTarget}
          </p>
          <p className="text-[10px] text-white/20 break-all max-w-sm mx-auto px-2">
            WS: {wsTarget}
            {lastCloseCode != null ? ` · last close ${lastCloseCode}` : ""}
          </p>
          <p className="text-[10px] text-white/25 max-w-sm mx-auto px-2">
            Tip: open this page in Chrome (not WhatsApp/Instagram browser).
          </p>
        </div>
      </main>
    </div>
  );
}
