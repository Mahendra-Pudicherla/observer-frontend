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

const MAX_SEND_WIDTH = 360;
const JPEG_QUALITY = 0.35;
const FRAME_INTERVAL_MS = 700;

function buildWsUrl(orgId: string, cameraId: string): string {
  const base = BACKEND_WS_URL.replace(/\/$/, "");
  const wsBase = base.replace(/^http/i, "ws");
  return `${wsBase}/ws/stream/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;
}

/** Same-origin proxy — avoids mobile cross-origin "Failed to fetch" to Railway. */
function buildIngestUrl(orgId: string, cameraId: string): string {
  return `/api/ingest/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;
}

function canvasToJpegBlob(
  canvas: HTMLCanvasElement,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

/**
 * Camera uplink uses same-origin HTTP POST (Vercel → Railway proxy).
 * WebSocket is optional when the carrier allows it.
 */
function useCameraStream(orgId: string | undefined, cameraId: string) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [wsError, setWsError] = useState<string | null>(null);
  const [transport, setTransport] = useState<Transport>("none");
  const [frameCount, setFrameCount] = useState(0);
  const [lastCloseCode, setLastCloseCode] = useState<number | null>(null);
  const [lastHttpDetail, setLastHttpDetail] = useState<string>("");

  const wsRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transportRef = useRef<Transport>("none");
  const inflightRef = useRef(false);
  const failStreakRef = useRef(0);

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

    // Probe same-origin proxy with a tiny JPEG
    void (async () => {
      try {
        // 1x1 pixel jpeg
        const tiny = Uint8Array.from(atob(
          "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z"
        ), (c) => c.charCodeAt(0));
        const res = await fetch(ingestUrl, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: tiny,
          cache: "no-store",
        });
        const text = await res.text();
        if (!res.ok) {
          throw new Error(`probe HTTP ${res.status}: ${text.slice(0, 120)}`);
        }
        if (!stopped) {
          setLastHttpDetail("probe ok");
          setStatus("connecting");
          setWsError(null);
        }
      } catch (err) {
        if (stopped) return;
        setLastHttpDetail(err instanceof Error ? err.message : "probe failed");
        setWsError(
          `Upload probe failed. ${err instanceof Error ? err.message : ""}`
        );
      }
    })();

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
        const delay = Math.min(3000 * Math.min(wsAttempts, 6), 20000);
        wsRetryTimer = setTimeout(openWs, delay);
      };
    };

    openWs();

    const sendFrameHttp = async (blob: Blob) => {
      if (inflightRef.current) return;
      inflightRef.current = true;
      try {
        const res = await fetch(ingestUrl, {
          method: "POST",
          headers: { "Content-Type": "image/jpeg" },
          body: blob,
          cache: "no-store",
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`HTTP ${res.status} ${text.slice(0, 80)}`);
        }
        failStreakRef.current = 0;
        if (transportRef.current !== "ws") {
          transportRef.current = "http";
          setTransport("http");
        }
        setStatus("connected");
        setWsError(null);
        setLastHttpDetail(`ok ${blob.size}b`);
        setFrameCount((c) => c + 1);
      } catch (err) {
        failStreakRef.current += 1;
        const msg = err instanceof Error ? err.message : "network error";
        setLastHttpDetail(msg);
        if (failStreakRef.current >= 3 && transportRef.current !== "ws") {
          setStatus("disconnected");
          setWsError(`Frame upload failed (${failStreakRef.current}x). ${msg}`);
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

      // Webcam often needs an explicit play kick on mobile
      if (video.paused && video.srcObject) {
        void video.play().catch(() => undefined);
      }

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

      void (async () => {
        const blob = await canvasToJpegBlob(canvas, JPEG_QUALITY);
        if (!blob || blob.size > 120_000) return;

        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            // WS still uses compact data URL when available
            const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
            if (dataUrl.length <= 200_000) {
              ws.send(JSON.stringify({ frame: dataUrl }));
              setFrameCount((c) => c + 1);
              transportRef.current = "ws";
              setTransport("ws");
              setStatus("connected");
              setWsError(null);
              return;
            }
          } catch {
            // fall through
          }
        }

        await sendFrameHttp(blob);
      })();
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
    window.location.reload();
  };

  return {
    status,
    wsError,
    transport,
    frameCount,
    lastCloseCode,
    lastHttpDetail,
    videoRef,
    canvasRef,
    reconnectNow,
    wsTarget: orgId ? buildWsUrl(orgId, cameraId) : "(missing orgId)",
    httpTarget: orgId ? buildIngestUrl(orgId, cameraId) : "(missing orgId)",
    apiTarget: BACKEND_API_URL,
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
    lastHttpDetail,
    videoRef,
    canvasRef,
    reconnectNow,
    wsTarget,
    httpTarget,
    apiTarget,
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

    const resetVideoElement = (el: HTMLVideoElement) => {
      try {
        el.pause();
      } catch {
        // ignore
      }
      el.onloadedmetadata = null;
      el.onloadeddata = null;
      el.onerror = null;
      el.removeAttribute("src");
      el.srcObject = null;
      // Critical on mobile Chrome after blob/file playback
      try {
        el.load();
      } catch {
        // ignore
      }
    };

    const start = async () => {
      setCamError(null);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }

      const el = videoRef.current;
      if (!el) {
        setCamError("Video element not ready. Tap Reconnect.");
        return;
      }

      resetVideoElement(el);
      el.muted = true;
      el.defaultMuted = true;
      el.playsInline = true;
      el.setAttribute("playsinline", "true");
      el.setAttribute("webkit-playsinline", "true");
      el.autoplay = true;

      // ── File / uploaded video ──────────────────────────────────
      if (videoSource === "file" && videoFileUrl) {
        el.loop = true;
        el.src = videoFileUrl;
        const playFile = () => {
          el.play().catch((err) => {
            if (!cancelled) {
              setCamError(`Video file play failed: ${String(err)}`);
            }
          });
        };
        el.onloadedmetadata = playFile;
        if (el.readyState >= 1) playFile();
        return;
      }

      // ── Webcam ────────────────────────────────────────────────
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamError("This browser does not support camera access (getUserMedia).");
        return;
      }

      // Secure context required (https) — should already be true on Vercel
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setCamError("Camera requires HTTPS. Open the cctvobserver.vercel.app link.");
        return;
      }

      await new Promise((r) => setTimeout(r, 150));
      if (cancelled) return;

      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 640, max: 1280 },
            height: { ideal: 480, max: 720 },
          },
          audio: false,
        },
        { video: { facingMode }, audio: false },
        { video: { facingMode: { exact: facingMode } }, audio: false },
        { video: true, audio: false },
      ];

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      // Last resort: pick any videoinput deviceId
      if (!stream) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cams = devices.filter((d) => d.kind === "videoinput");
          for (const cam of cams) {
            if (!cam.deviceId) continue;
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: cam.deviceId } },
                audio: false,
              });
              break;
            } catch (err) {
              lastErr = err;
            }
          }
        } catch (err) {
          lastErr = err;
        }
      }

      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop());
        return;
      }

      if (!stream) {
        const name =
          lastErr && typeof lastErr === "object" && "name" in lastErr
            ? String((lastErr as { name: string }).name)
            : "UnknownError";
        const msg =
          lastErr && typeof lastErr === "object" && "message" in lastErr
            ? String((lastErr as { message: string }).message)
            : String(lastErr ?? "");
        setCamError(
          `Webcam failed (${name}). ${msg || "Allow camera permission and tap Back to Webcam."}`
        );
        return;
      }

      streamRef.current = stream;
      el.srcObject = stream;

      const playCam = async () => {
        try {
          await el.play();
        } catch (err) {
          // Autoplay blocked — still may work after user tap; show hint
          if (!cancelled) {
            setCamError(
              `Camera opened but playback blocked. Tap the video area. (${String(err)})`
            );
          }
        }
      };

      el.onloadedmetadata = () => {
        void playCam();
      };
      // Metadata often already available for live streams — don't wait forever
      if (el.readyState >= 1) {
        void playCam();
      } else {
        // Fallback play after a short delay
        setTimeout(() => {
          if (!cancelled && el.paused) void playCam();
        }, 500);
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
            onClick={() => {
              const el = videoRef.current;
              if (el && el.paused) {
                void el.play().then(() => setCamError(null)).catch(() => undefined);
              }
            }}
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="text-center text-white space-y-3">
          <div>
            <p className="font-medium text-lg">{camera?.name ?? cameraId}</p>
            <p className="text-sm text-white/70">{camera?.location ?? "Loading…"}</p>
            <p className="text-xs text-white/40 pt-1">
              Source: {videoSource === "file" ? "Uploaded video" : `Webcam (${facingMode})`}
            </p>
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
              onClick={() => {
                if (videoFileUrl) {
                  URL.revokeObjectURL(videoFileUrl);
                  setVideoFileUrl(null);
                }
                setVideoSource("webcam");
                setCamError(null);
              }}
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
                    if (videoFileUrl) URL.revokeObjectURL(videoFileUrl);
                    setVideoFileUrl(URL.createObjectURL(file));
                    setVideoSource("file");
                    setCamError(null);
                  }
                  // allow re-selecting same file later
                  e.target.value = "";
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
              {frameCount} frames sent · via {transport.toUpperCase()}
            </p>
          )}

          <p className="text-[10px] text-white/30 break-all max-w-sm mx-auto px-2">
            Upload: {httpTarget}
            {lastHttpDetail ? ` · ${lastHttpDetail}` : ""}
          </p>
          <p className="text-[10px] text-white/20 break-all max-w-sm mx-auto px-2">
            API: {apiTarget}
          </p>
          <p className="text-[10px] text-white/20 break-all max-w-sm mx-auto px-2">
            WS: {wsTarget}
            {lastCloseCode != null ? ` · last close ${lastCloseCode}` : ""}
          </p>
        </div>
      </main>
    </div>
  );
}
