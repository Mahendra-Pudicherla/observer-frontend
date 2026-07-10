"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { createClient } from "@/lib/supabase";
import { BACKEND_API_URL, type Camera, type Incident } from "@/lib/constants";

/** Load cameras for the signed-in org from Supabase (source of truth). */
export function useOrgCameras(activeOnly = false) {
  const { org } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!org?.id) {
      setCameras([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from("cameras").select("*").eq("org_id", org.id);
      if (activeOnly) query = query.eq("is_active", true);
      const { data, error: qErr } = await query.order("created_at", { ascending: true });
      if (qErr) throw qErr;
      setCameras((data as Camera[]) ?? []);
    } catch (e) {
      console.error("Load cameras error:", e);
      setError(e instanceof Error ? e.message : "Failed to load cameras");
      // Fallback to backend API
      try {
        const res = await fetch(`${BACKEND_API_URL}/cameras/${org.id}`);
        if (res.ok) {
          const data: Camera[] = await res.json();
          setCameras(activeOnly ? data.filter((c) => c.is_active) : data);
          setError(null);
        }
      } catch {
        setCameras([]);
      }
    } finally {
      setLoading(false);
    }
  }, [org?.id, supabase, activeOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { cameras, loading, error, reload, orgId: org?.id ?? null };
}

/** Load incidents for the signed-in org from Supabase. */
export function useOrgIncidents(limit = 50) {
  const { org } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!org?.id) {
      setIncidents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("incidents")
        .select("*")
        .eq("org_id", org.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      if (data && data.length > 0) {
        setIncidents(data as Incident[]);
        return;
      }
      // Fallback to backend API (service role) if RLS returns empty
      const res = await fetch(`${BACKEND_API_URL}/incidents/${org.id}`);
      if (res.ok) {
        const rows = (await res.json()) as Incident[];
        setIncidents(rows.slice(0, limit));
      } else {
        setIncidents((data as Incident[]) ?? []);
      }
    } catch (e) {
      console.error("Load incidents error:", e);
      try {
        const res = await fetch(`${BACKEND_API_URL}/incidents/${org.id}`);
        if (res.ok) {
          setIncidents(((await res.json()) as Incident[]).slice(0, limit));
        } else {
          setIncidents([]);
        }
      } catch {
        setIncidents([]);
      }
    } finally {
      setLoading(false);
    }
  }, [org?.id, supabase, limit]);

  useEffect(() => {
    void reload();
    const interval = setInterval(() => void reload(), 15000);
    return () => clearInterval(interval);
  }, [reload]);

  return { incidents, loading, reload, orgId: org?.id ?? null };
}
