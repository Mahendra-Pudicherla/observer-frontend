"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import type { Organization } from "@/lib/constants";

// ── Demo mode constants ────────────────────────────────────────
export const DEMO_FLAG = "observer_demo_mode";

export const DEMO_ORG: Organization = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Ongole Police Department",
  org_type: "government",
  plan: "growth",
};

// ── Context ─────────────────────────────────────────────────────
interface SessionContextValue {
  userId: string | null;
  org: Organization | null;
  loading: boolean;
  isDemo: boolean;
  refreshOrg: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  userId: null,
  org: null,
  loading: true,
  isDemo: false,
  refreshOrg: async () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const refreshOrg = async () => {
    // In demo mode, org is already set — do nothing
    if (typeof window !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1") return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("[Observer] refreshOrg — user:", user?.id ?? "null");
    if (!user) {
      setOrg(null);
      return;
    }

    const { data: membership, error: memberErr } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    console.log("[Observer] refreshOrg — membership:", membership, "error:", memberErr);

    if (!membership?.org_id) {
      setOrg(null);
      return;
    }

    const { data: organization, error: orgErr } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.org_id)
      .maybeSingle();

    console.log("[Observer] refreshOrg — org:", organization, "error:", orgErr);
    setOrg(organization as Organization | null);
  };

  useEffect(() => {
    const init = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Prefer a real signed-in session over leftover demo mode
      if (session?.user) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(DEMO_FLAG);
        }
        setIsDemo(false);
        setUserId(session.user.id);
        await refreshOrg();
        setLoading(false);
        return;
      }

      if (typeof window !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1") {
        setIsDemo(true);
        setUserId("demo-user-001");
        setOrg(DEMO_ORG);
        setLoading(false);
        return;
      }

      setUserId(null);
      setLoading(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        if (typeof window !== "undefined") {
          localStorage.removeItem(DEMO_FLAG);
        }
        setIsDemo(false);
        setUserId(session.user.id);
        void refreshOrg();
        return;
      }

      if (typeof window !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1") {
        setIsDemo(true);
        setUserId("demo-user-001");
        setOrg(DEMO_ORG);
        return;
      }

      setUserId(null);
      setOrg(null);
      setIsDemo(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <SessionContext.Provider value={{ userId, org, loading, isDemo, refreshOrg }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

export function useRequireAuth() {
  const router = useRouter();
  const { userId, loading, isDemo } = useSession();

  useEffect(() => {
    // Demo mode is always authenticated
    if (isDemo) return;
    if (!loading && !userId) {
      router.replace("/login");
    }
  }, [loading, userId, isDemo, router]);

  return { userId, loading };
}

/** Call this to enter demo mode and navigate to dashboard */
export function enterDemoMode(router: ReturnType<typeof useRouter>) {
  if (typeof window !== "undefined") {
    localStorage.setItem(DEMO_FLAG, "1");
  }
  router.push("/dashboard");
}

/** Call this to exit demo mode (e.g. on sign-out) */
export function exitDemoMode() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(DEMO_FLAG);
  }
}
