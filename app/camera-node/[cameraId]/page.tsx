"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { BACKEND_WS_URL, COLORS, type Camera } from "@/lib/constants";
import { createClient } from "@/lib/supabase";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const MAX_SEND_WIDTH = 480;
const JPEG_QUALITY = 0.4;
const FRAME_INTERVAL_MS = 500;
const CLIENT_PING_MS = 10000;

function buildWsUrl(orgId: string, cameraId: string): string {
  const base = BACKEND_WS_URL.replace(/\/$/, "");
  const wsBase = base.replace(/^http/i, "ws");
  return `${wsBase}/ws/stream/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;
}

/**
 * Camera node WebSocket manager — intentionally NOT tied to React effect
 * identity changes (those were causing mobile 1006 disconnect loops).
 */
function useCameraStream(orgId: string | undefined, cameraId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [wsError, setWsError] = useState<string | null>(null);
  const [serverReady, setServerReady] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const orgIdRef = useRef(orgId);
  const cameraIdRef = useRef(cameraId);
  const reconnectFnRef = useRef<(() => void) | null>(null);

  orgIdRef.current = orgId;
  cameraIdRef.current = cameraId;

  useEffect(() => {
    stoppedRef.current = false;

    const clearRetry = () => {
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };

    const closeSocket = () => {
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

    const scheduleReconnect = () => {
      if (stoppedRef.current) return;
      clearRetry();
      const attempt = retryRef.current + 1;
      retryRef.current = attempt;
      const delay = Math.min(2000 * Math.min(attempt, 8), 20000);
      setStatus("disconnected");
      setServerReady(false);
      setWsError(`Connection lost. Retrying… (attempt ${attempt})`);
      retryTimerRef.current = setTimeout(() => {
        if (!stoppedRef.current) openSocket();
      }, delay);
    };

    const openSocket = () => {
      if (stoppedRef.current) return;
      const oid = orgIdRef.current;
      const cid = cameraIdRef.current;
      if (!oid) {
        setWsError("Missing orgId in URL");
        setStatus("disconnected");
        return;
      }

      const existing = wsRef.current;
      if (
        existing &&
        (existing.readyState === WebSocket.OPEN ||
          existing.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      clearRetry();
      closeSocket();
      setStatus("connecting");

      const wsUrl = buildWsUrl(oid, cid);
      let ws: WebSocket;
      try {
        ws = new WebSocket(wsUrl);
      } catch {
        setStatus("disconnected");
        setWsError(`Invalid WebSocket URL: ${wsUrl}`);
        scheduleReconnect();
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        if (stoppedRef.current || wsRef.current !== ws) return;
        setStatus("connected");
        setWsError(null);
        retryRef.current = 0;
      };

      ws.onmessage = (event) => {
        if (stoppedRef.current || wsRef.current !== ws) return;
        try {
          const data = JSON.parse(String(event.data)) as { type?: string };
          if (data.type === "ready" || data.type === "ping") {
            setServerReady(true);
            setStatus("connected");
            setWsError(null);
          }
        } catch {
          // ignore
        }
      };

      ws.onerror = () => {
        if (stoppedRef.current || wsRef.current !== ws) return;
        // onclose will reconnect
      };

      ws.onclose = (ev) => {
        if (stoppedRef.current) return;
        if (wsRef.current === ws) wsRef.current = null;
        if (ev.code === 1000) {
          setStatus("disconnected");
          return;
        }
        setWsError(`Connection lost (code ${ev.code || 1006}). Retrying…`);
        scheduleReconnect();
      };
    };

    openSocket();

    const onVisible = () => {
      if (document.visibilityState !== "visible" || stoppedRef.current) return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        retryRef.current = 0;
        openSocket();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    // Frame sender — reads latest video/canvas refs
    const frameTimer = setInterval(() => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ws = wsRef.current;
      if (!video || !canvas || !ws || ws.readyState !== WebSocket.OPEN) return;
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

      try {
        ws.send(JSON.stringify({ frame: dataUrl }));
        setFrameCount((c) => c + 1);
      } catch {
        // onclose retries
      }
    }, FRAME_INTERVAL_MS);

    const pingTimer = setInterval(() => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return;
      try {
        ws.send(JSON.stringify({ type: "ping" }));
      } catch {
        // ignore
      }
    }, CLIENT_PING_MS);

    const reconnectNow = () => {
      retryRef.current = 0;
      clearRetry();
      closeSocket();
      openSocket();
    };
    reconnectFnRef.current = reconnectNow;

    return () => {
      stoppedRef.current = true;
      reconnectFnRef.current = null;
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(frameTimer);
      clearInterval(pingTimer);
      clearRetry();
      closeSocket();
    };
    // Only re-run when the stream target changes — NOT on every callback identity change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, cameraId]);

  const reconnectNow = () => {
    reconnectFnRef.current?.();
  };

  return {
    status,
    wsError,
    serverReady,
    frameCount,
    videoRef,
    canvasRef,
    reconnectNow,
    wsTarget: orgId ? buildWsUrl(orgId, cameraId) : "(missing orgId)",
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
    serverReady,
    frameCount,
    videoRef,
    canvasRef,
    reconnectNow,
    wsTarget,
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
      ? serverReady
        ? "● Streaming"
        : "● Connected"
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
            onClick={reconnectNow}
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
              {frameCount} frames sent{serverReady ? " · server ready" : ""}
            </p>
          )}

          <p className="text-[10px] text-white/30 break-all max-w-sm mx-auto px-2">{wsTarget}</p>
        </div>
      </main>
    </div>
  );
}
