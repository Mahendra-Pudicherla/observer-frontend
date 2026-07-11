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
  const [facingMode, setFacingMode] = useState<"environment" | "user">("user");
  const [videoSource, setVideoSource] = useState<"webcam" | "file">("webcam");
  const [videoFileUrl, setVideoFileUrl] = useState<string | null>(null);
  const [webcamLive, setWebcamLive] = useState(false);
  const [webcamBusy, setWebcamBusy] = useState(false);
  const [activeCamLabel, setActiveCamLabel] = useState("");

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

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const resetVideoElement = (el: HTMLVideoElement) => {
    try {
      el.pause();
    } catch {
      // ignore
    }
    el.onloadedmetadata = null;
    el.removeAttribute("src");
    el.srcObject = null;
    try {
      el.load();
    } catch {
      // ignore
    }
    el.muted = true;
    el.defaultMuted = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "true");
    el.setAttribute("webkit-playsinline", "true");
    el.autoplay = true;
  };

  /**
   * Pick a camera deviceId by label / facing.
   * IMPORTANT: do not match bare "face" — it matches the word "facing" and
   * mis-classifies "camera2 0, facing back" as a front camera.
   */
  const findCameraDeviceId = async (
    facing: "environment" | "user"
  ): Promise<string | null> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
      if (!cams.length) return null;

      const isBack = (label: string) =>
        /facing\s*back|\bback\b|\brear\b|\benvironment\b|\bworld\b/i.test(label);
      const isFront = (label: string) =>
        /facing\s*front|\bfront\b|\buser\b|\bselfie\b/i.test(label);

      if (facing === "environment") {
        const labeled = cams.find((c) => isBack(c.label) && !isFront(c.label));
        if (labeled) return labeled.deviceId;
        // Android often lists back camera first when labels are empty
        if (cams.length >= 2) return cams[0]!.deviceId;
        return cams[0]?.deviceId ?? null;
      }

      const labeled = cams.find((c) => isFront(c.label) && !isBack(c.label));
      if (labeled) return labeled.deviceId;
      if (cams.length >= 2) return cams[1]!.deviceId;
      return cams[0]?.deviceId ?? null;
    } catch {
      return null;
    }
  };

  const listVideoDeviceIds = async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === "videoinput" && d.deviceId);
    } catch {
      return [];
    }
  };

  const trackFacing = (stream: MediaStream): string | undefined => {
    const track = stream.getVideoTracks()[0];
    if (!track) return undefined;
    const settings = track.getSettings?.() ?? {};
    return settings.facingMode;
  };

  const trackLabel = (stream: MediaStream): string => {
    const track = stream.getVideoTracks()[0];
    return track?.label || track?.getSettings?.().deviceId || "unknown";
  };

  /**
   * Open a specific camera. When switching to back, never fall back to
   * `video: true` (that silently re-opens the front camera).
   */
  const startWebcam = async (facing: "environment" | "user") => {
    if (webcamBusy) return;
    setWebcamBusy(true);
    setCamError(null);
    setVideoSource("webcam");
    setFacingMode(facing);

    if (videoFileUrl) {
      URL.revokeObjectURL(videoFileUrl);
      setVideoFileUrl(null);
    }

    const el = videoRef.current;
    if (!el) {
      setCamError("Video element not ready. Reload the page.");
      setWebcamBusy(false);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setCamError("This browser does not support camera access.");
      setWebcamBusy(false);
      return;
    }
    if (!window.isSecureContext) {
      setCamError("Camera requires HTTPS (use https://cctvobserver.vercel.app).");
      setWebcamBusy(false);
      return;
    }

    const wasLive = !!streamRef.current;
    // Remember current device so we can open a *different* one for back cam
    const previousDeviceId =
      streamRef.current?.getVideoTracks()[0]?.getSettings?.().deviceId ?? null;

    stopTracks();
    resetVideoElement(el);
    setWebcamLive(false);

    // Delay only when releasing an already-open camera (switch path).
    if (wasLive) {
      await new Promise((r) => setTimeout(r, 400));
    }

    let stream: MediaStream | null = null;
    let lastErr: unknown = null;
    const triedIds = new Set<string>();

    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`Camera timeout after ${ms}ms`)), ms)
        ),
      ]);

    const tryOpen = async (constraints: MediaTrackConstraints): Promise<boolean> => {
      try {
        const s = await withTimeout(
          navigator.mediaDevices.getUserMedia({ video: constraints, audio: false }),
          12000
        );
        stream = s;
        return true;
      } catch (err) {
        lastErr = err;
        return false;
      }
    };

    try {
      // After front cam has been used, device labels are available — prefer deviceId.
      const preferredId = wasLive ? await findCameraDeviceId(facing) : null;

      if (preferredId) {
        triedIds.add(preferredId);
        await tryOpen({ deviceId: { exact: preferredId } });
        if (!stream) await tryOpen({ deviceId: { ideal: preferredId } });
      }

      // facingMode (first open, or deviceId failed)
      if (!stream) {
        await tryOpen({ facingMode: { ideal: facing } });
      }
      if (!stream) {
        await tryOpen({ facingMode: facing });
      }

      // Back camera: try every other video device (wide / ultra / tele) except previous
      if (!stream && facing === "environment") {
        const cams = await listVideoDeviceIds();
        for (const cam of cams) {
          if (triedIds.has(cam.deviceId)) continue;
          if (previousDeviceId && cam.deviceId === previousDeviceId) continue;
          // Skip obvious front cameras by label
          if (/facing\s*front|\bfront\b|\bselfie\b/i.test(cam.label)) continue;
          triedIds.add(cam.deviceId);
          if (await tryOpen({ deviceId: { exact: cam.deviceId } })) break;
        }
      }

      // Front camera only: last-resort any camera. NEVER do this for back —
      // it overrides back requests with the front lens.
      if (!stream && facing === "user") {
        try {
          stream = await withTimeout(
            navigator.mediaDevices.getUserMedia({ video: true, audio: false }),
            12000
          );
        } catch (err) {
          lastErr = err;
        }
      }

      // If we got a stream but asked for back and clearly got front, keep trying others
      if (stream && facing === "environment") {
        const actual = trackFacing(stream);
        const label = trackLabel(stream).toLowerCase();
        const looksFront =
          actual === "user" || /facing\s*front|\bfront\b|\bselfie\b/.test(label);
        if (looksFront) {
          const currentId = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
          const cams = await listVideoDeviceIds();
          let swapped = false;
          for (const cam of cams) {
            if (cam.deviceId === currentId) continue;
            if (/facing\s*front|\bfront\b|\bselfie\b/i.test(cam.label)) continue;
            try {
              const alt = await navigator.mediaDevices.getUserMedia({
                video: { deviceId: { exact: cam.deviceId } },
                audio: false,
              });
              stream.getTracks().forEach((t) => t.stop());
              stream = alt;
              swapped = true;
              break;
            } catch (err) {
              lastErr = err;
            }
          }
          if (!swapped) {
            stream.getTracks().forEach((t) => t.stop());
            stream = null;
            setCamError(
              "Back camera is busy or blocked. Close Instagram/WhatsApp/Camera apps, then tap Switch to Back Camera again."
            );
            return;
          }
        }
      }

      if (!stream) {
        const name =
          lastErr && typeof lastErr === "object" && "name" in lastErr
            ? String((lastErr as { name: string }).name)
            : "Error";
        const msg =
          lastErr instanceof Error
            ? lastErr.message
            : lastErr && typeof lastErr === "object" && "message" in lastErr
              ? String((lastErr as { message: string }).message)
              : String(lastErr ?? "");
        const which = facing === "environment" ? "back" : "front";
        setCamError(
          `Could not open ${which} camera (${name}). ${
            msg ||
            (facing === "environment"
              ? "Close other apps using the camera, then retry."
              : "Allow camera permission and retry.")
          }`
        );
        return;
      }

      streamRef.current = stream;
      el.srcObject = stream;
      setActiveCamLabel(trackLabel(stream));

      try {
        await el.play();
      } catch {
        // user can tap video
      }
      setWebcamLive(true);

      const opened = trackFacing(stream);
      const label = trackLabel(stream);
      if (facing === "environment" && opened === "user") {
        setCamError(`Opened front instead of back (${label}). Try Switch again.`);
      } else {
        setCamError(null);
      }
    } catch (err) {
      setCamError(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
      stopTracks();
      setWebcamLive(false);
    } finally {
      setWebcamBusy(false);
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

  const startFile = (file: File) => {
    stopTracks();
    setWebcamLive(false);
    setCamError(null);

    const el = videoRef.current;
    if (videoFileUrl) URL.revokeObjectURL(videoFileUrl);
    const url = URL.createObjectURL(file);
    setVideoFileUrl(url);
    setVideoSource("file");

    if (!el) return;
    resetVideoElement(el);
    el.loop = true;
    el.src = url;
    const playFile = () => {
      void el.play().catch((err) => setCamError(`Video file play failed: ${String(err)}`));
    };
    el.onloadedmetadata = playFile;
    if (el.readyState >= 1) playFile();
  };

  // Cleanup only on unmount — do NOT auto-start webcam in an effect
  useEffect(() => {
    return () => {
      stopTracks();
      if (videoFileUrl) URL.revokeObjectURL(videoFileUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              if (!el) return;
              void el.play().then(() => setCamError(null)).catch(() => undefined);
            }}
          />
          {videoSource === "webcam" && !webcamLive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 px-4">
              <p className="text-white text-sm text-center">
                Mobile browsers require a tap to open the camera.
              </p>
              <button
                type="button"
                disabled={webcamBusy}
                onClick={() => void startWebcam(facingMode)}
                className="px-6 py-3 rounded-xl text-sm font-bold active:scale-95"
                style={{ backgroundColor: COLORS.safeGreen, color: "white" }}
              >
                {webcamBusy ? "Opening camera…" : "📷 Start Webcam"}
              </button>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} className="hidden" />

        <div className="text-center text-white space-y-3">
          <div>
            <p className="font-medium text-lg">{camera?.name ?? cameraId}</p>
            <p className="text-sm text-white/70">{camera?.location ?? "Loading…"}</p>
            <p className="text-xs text-white/40 pt-1">
              Source:{" "}
              {videoSource === "file"
                ? "Uploaded video"
                : webcamLive
                  ? `Webcam (${facingMode === "environment" ? "back" : "front"}${
                      activeCamLabel ? ` · ${activeCamLabel}` : ""
                    })`
                  : "Webcam (not started)"}
            </p>
          </div>

          {videoSource === "webcam" ? (
            <>
              <button
                type="button"
                disabled={webcamBusy}
                onClick={() => void startWebcam(facingMode)}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
                style={{
                  backgroundColor: COLORS.safeGreen,
                  color: "white",
                }}
              >
                {webcamBusy ? "Opening…" : webcamLive ? "🔄 Restart Webcam" : "📷 Start Webcam"}
              </button>
              <button
                type="button"
                disabled={webcamBusy}
                onClick={() => {
                  const next = facingMode === "environment" ? "user" : "environment";
                  void startWebcam(next);
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold active:scale-95"
                style={{
                  backgroundColor: "rgba(255,255,255,0.12)",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.2)",
                }}
              >
                {facingMode === "environment"
                  ? "🔄 Switch to Front Camera"
                  : "🔄 Switch to Back Camera"}
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={webcamBusy}
              onClick={() => void startWebcam(facingMode)}
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
                  if (file) startFile(file);
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
