"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_WS_URL, type AlertPayload } from "@/lib/constants";

interface UseAlertSocketResult {
  activeAlert: AlertPayload | null;
  allAlerts: AlertPayload[];
  clearAlert: () => void;
}

function isClipUpdate(prev: AlertPayload, next: AlertPayload): boolean {
  return (
    prev.camera_id === next.camera_id &&
    prev.type === next.type &&
    !prev.clip_url &&
    Boolean(next.clip_url)
  );
}

function mergeAlertList(prev: AlertPayload[], incoming: AlertPayload): AlertPayload[] {
  const idx = prev.findIndex(
    (a) =>
      a.camera_id === incoming.camera_id &&
      a.type === incoming.type &&
      !a.incident_id &&
      incoming.incident_id
  );
  if (idx >= 0) {
    const updated = [...prev];
    updated[idx] = { ...updated[idx], ...incoming };
    return updated;
  }
  return [incoming, ...prev].slice(0, 20);
}

export function useAlertSocket(orgId: string | null): UseAlertSocketResult {
  const [activeAlert, setActiveAlert] = useState<AlertPayload | null>(null);
  const [allAlerts, setAllAlerts] = useState<AlertPayload[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const connect = () => {
      const wsUrl = `${BACKEND_WS_URL.replace(/^http/, "ws")}/ws/alerts/${orgId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as Record<string, unknown>;
          if (parsed.type === "ping") return;
          const alert = parsed as unknown as AlertPayload;

          setActiveAlert((prev) => {
            if (prev && isClipUpdate(prev, alert)) {
              return { ...prev, ...alert };
            }
            return alert;
          });
          setAllAlerts((prev) => mergeAlertList(prev, alert));
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
        retryRef.current += 1;
        retryTimer.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [orgId]);

  return {
    activeAlert,
    allAlerts,
    clearAlert: () => setActiveAlert(null),
  };
}
