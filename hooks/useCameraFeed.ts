"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_WS_URL } from "@/lib/constants";

/**
 * Connects to /ws/feed/{orgId}/{cameraId} and returns the latest
 * JPEG frame as a data-URL string that can be used as an <img> src.
 */
export function useCameraFeed(orgId: string | null, cameraId: string | null) {
  const [frame, setFrame] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orgId || !cameraId) return;

    const wsUrl = `${BACKEND_WS_URL.replace(/^http/, "ws")}/ws/feed/${orgId}/${cameraId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "frame" && data.frame) {
          setFrame(data.frame);
          setLive(true);

          // Mark as offline if no frame received for 3 seconds
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = setTimeout(() => setLive(false), 3000);
        } else if (data.type === "status") {
          if (data.status === "offline") {
            setLive(false);
            setFrame(null);
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
          }
          // "online" status is handled implicitly when frames start arriving
        }
      } catch {
        // ignore non-JSON messages
      }
    };

    ws.onclose = () => setLive(false);
    ws.onerror = () => setLive(false);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, [orgId, cameraId]);

  return { frame, live };
}
