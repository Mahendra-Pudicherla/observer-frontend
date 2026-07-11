"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { BACKEND_WS_URL, COLORS, type Camera } from "@/lib/constants";
import { createClient } from "@/lib/supabase";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

const MAX_SEND_WIDTH = 480;
const JPEG_QUALITY = 0.4;
const FRAME_INTERVAL_MS = 500;
const CLIENT_PING_MS = 12000;

function buildWsUrl(orgId: string, cameraId: string): string {
  const base = BACKEND_WS_URL.replace(/\/$/, "");
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
  const connIdRef = useRef(0);
  const aliveRef = useRef(true);

  const [camera, setCamera] = useState<Camera | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [wsError, setWsError] = useState<string | null>(null);
  const [camError, setCamError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [frameCount, setFrameCount] = useState(0);
  const [videoSource, setVideoSource] = useState<"webcam" | "file">("webcam");
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [serverReady, setServerReady] = useState(false);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

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
      if (aliveRef.current) setCamera(data as Camera | null);
    })();
  }, [orgId, cameraId, supabase]);

  const disconnectWs = useCallback((scheduleRetry: boolean) => {
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close(1000, "client disconnect");
        }
      } catch {
        // ignore
      }
    }

    if (!scheduleRetry || !aliveRef.current || !orgId) return;

    const attempt = retryRef.current + 1;
    retryRef.current = attempt;
    // Longer backoff for 1006 / mobile networks
    const delay = Math.min(1500 * 2 ** Math.min(attempt - 1, 4), 25000);
    setStatus("disconnected");
    setServerReady(false);
    setWsError(`Connection lost. Retrying… (attempt ${attempt})`);

    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = setTimeout(() => {
      if (aliveRef.current) connectWebSocket();
    }, delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const connectWebSocket = useCallback(() => {
    if (!orgId || !aliveRef.current) return;

    // Already connected / connecting — do not open a second socket
    const existing = wsRef.current;
    if (
      existing &&
      (existing.readyState === WebSocket.OPEN ||
        existing.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    const myId = ++connIdRef.current;
    setStatus("connecting");
    setServerReady(false);

    const wsUrl = buildWsUrl(orgId, cameraId);
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl);
    } catch {
      setStatus("disconnected");
      setWsError(`Invalid WebSocket URL: ${wsUrl}`);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      if (!aliveRef.current || myId !== connIdRef.current) return;
      setStatus("connected");
      setWsError(null);
      retryRef.current = 0;
    };

    ws.onmessage = (event) => {
      if (!aliveRef.current || myId !== connIdRef.current) return;
      try {
        const data = JSON.parse(String(event.data)) as { type?: string };
        if (data.type === "ready" || data.type === "ping") {
          setServerReady(true);
          setStatus("connected");
          setWsError(null);
        }
      } catch {
        // ignore non-JSON
      }
    };

    ws.onerror = () => {
      // onclose handles retry; keep first-error hint
      if (!aliveRef.current || myId !== connIdRef.current) return;
      if (retryRef.current === 0) {
        setWsError(
          `WebSocket error. Check Railway is online. URL: ${wsUrl}`
        );
      }
    };

    ws.onclose = (ev) => {
      if (myId !== connIdRef.current) return;
      if (!aliveRef.current) return;

      // Normal close from our own disconnectWs(false) during unmount
      if (ev.code === 1000) {
        setStatus("disconnected");
        return;
      }

      setWsError(
        `Connection lost (code ${ev.code || 1006}). Retrying… (attempt ${retryRef.current + 1})`
      );
      disconnectWs(true);
    };
  }, [orgId, cameraId, disconnectWs]);

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
          videoRef.current?.play().catch(() => undefined);
        };
      }
      return;
    }

    await new Promise((r) => setTimeout(r, 250));

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
  }, [facingMode, videoSource, videoFileUrl]);

  // Frames + ping — only after socket is open
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
      let w = Math.max(2, Math.round(video.videoWidth * scale));
      let h = Math.max(2, Math.round(video.videoHeight * scale));
      w -= w % 2;
      h -= h % 2;
      canvas.width = w;
      canvas.height = h;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      if (dataUrl.length > 220_000) return;

      try {
        ws.send(JSON.stringify({ frame: dataUrl }));
        setFrameCount((c) => c + 1);
      } catch {
        // onclose will retry
      }
    }, FRAME_INTERVAL_MS);

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

  // Connect once per org/camera — avoid Strict Mode double-close races
  useEffect(() => {
    if (!orgId) return;
    aliveRef.current = true;
    retryRef.current = 0;
    connectWebSocket();

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const ws = wsRef.current;
      if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
        retryRef.current = 0;
        connectWebSocket();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      // Bump conn id so in-flight handlers ignore events
      connIdRef.current += 1;
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        try {
          ws.close(1000, "unmount");
        } catch {
          // ignore
        }
      }
    };
  }, [orgId, cameraId, connectWebSocket]);

  const toggleCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setVideoFileUrl(URL.createObjectURL(file));
      setVideoSource("file");
    }
  };

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

  const wsTarget = orgId ? buildWsUrl(orgId, cameraId) : "(missing orgId)";

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
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted autoPlay />
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
              <input type="file" accept="video/*" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>

          <button
            type="button"
            onClick={() => {
              retryRef.current = 0;
              disconnectWs(false);
              connectWebSocket();
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
              {frameCount} frames sent{serverReady ? " · server ready" : ""}
            </p>
          )}

          <p className="text-[10px] text-white/30 break-all max-w-sm mx-auto px-2">{wsTarget}</p>
        </div>
      </main>
    </div>
  );
}
