"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_WS_URL } from "@/lib/constants";

function normalizeFrame(frame: string): string {
  if (!frame) return frame;
  if (frame.startsWith("data:") || frame.startsWith("blob:") || frame.startsWith("http")) {
    return frame;
  }
  return `data:image/jpeg;base64,${frame}`;
}

/**
 * Connects to /ws/feed/{orgId}/{cameraId} and returns the latest
 * JPEG frame as a data-URL string that can be used as an <img> src.
 */
export function useCameraFeed(orgId: string | null, cameraId: string | null) {
  const [frame, setFrame] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    if (!orgId || !cameraId) return;

    let stopped = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const clearIdle = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };

    const goOffline = () => {
      setLive(false);
      setFrame(null);
      clearIdle();
    };

    const connect = () => {
      if (stopped) return;

      const wsUrl = `${BACKEND_WS_URL.replace(/\/$/, "").replace(/^http/i, "ws")}/ws/feed/${encodeURIComponent(orgId)}/${encodeURIComponent(cameraId)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            type?: string;
            frame?: string;
            status?: string;
          };
          if (data.type === "frame" && data.frame) {
            const src = normalizeFrame(data.frame);
            setFrame(src);
            setLive(true);
            clearIdle();
            // No new frames → treat as stopped (clear image + OFFLINE)
            timeoutRef.current = setTimeout(goOffline, 3500);
          } else if (data.type === "status") {
            if (data.status === "offline" || data.status === "waiting") {
              goOffline();
            }
          }
        } catch {
          // ignore non-JSON
        }
      };

      ws.onclose = () => {
        goOffline();
        if (stopped) return;
        const attempt = retryRef.current + 1;
        retryRef.current = attempt;
        const delay = Math.min(1000 * attempt, 8000);
        retryTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      clearIdle();
      if (retryTimer) clearTimeout(retryTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [orgId, cameraId]);

  return { frame, live };
}
