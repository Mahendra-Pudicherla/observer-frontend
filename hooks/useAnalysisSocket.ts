"use client";

import { useEffect, useRef, useState } from "react";
import { BACKEND_API_URL, BACKEND_WS_URL, type AnalysisSnapshot } from "@/lib/constants";

const EMPTY_GRID = Array.from({ length: 8 }, () => Array.from({ length: 12 }, () => 0));

const EMPTY_SNAPSHOT: AnalysisSnapshot = {
  org_id: "",
  timestamp: "",
  grid_cols: 12,
  grid_rows: 8,
  grid: EMPTY_GRID,
  total_people: 0,
  movement: { eastbound: 0, southbound: 0, reverse: 0 },
  peak_density: 0,
  cameras_reporting: 0,
};

export function useAnalysisSocket(orgId: string | null) {
  const [snapshot, setSnapshot] = useState<AnalysisSnapshot>(EMPTY_SNAPSHOT);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const fetchInitial = async () => {
      try {
        const res = await fetch(`${BACKEND_API_URL}/analysis/${orgId}`);
        if (res.ok) {
          const data = (await res.json()) as AnalysisSnapshot;
          setSnapshot(data);
        }
      } catch {
        // WebSocket will provide updates when available
      }
    };
    void fetchInitial();

    const connect = () => {
      const wsUrl = `${BACKEND_WS_URL.replace(/^http/, "ws")}/ws/analysis/${orgId}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryRef.current = 0;
        setConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as Record<string, unknown>;
          if (parsed.type === "ping") return;
          if (parsed.type === "analysis") {
            setSnapshot(parsed as unknown as AnalysisSnapshot);
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        setConnected(false);
        const delay = Math.min(1000 * 2 ** retryRef.current, 30000);
        retryRef.current += 1;
        retryTimer.current = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
      setConnected(false);
    };
  }, [orgId]);

  return { snapshot, connected };
}
