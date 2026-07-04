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
    if (!user) {
      setOrg(null);
      return;
    }

    const { data: membership } = await supabase
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!membership?.org_id) {
      setOrg(null);
      return;
    }

    const { data: organization } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", membership.org_id)
      .maybeSingle();

    setOrg(organization as Organization | null);
  };

  useEffect(() => {
    const init = async () => {
      // Check demo mode first
      if (typeof window !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1") {
        setIsDemo(true);
        setUserId("demo-user-001");
        setOrg(DEMO_ORG);
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
      if (session?.user) {
        await refreshOrg();
      }
      setLoading(false);
    };

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      // Don't interfere with demo mode
      if (typeof window !== "undefined" && localStorage.getItem(DEMO_FLAG) === "1") return;
      setUserId(session?.user?.id ?? null);
      if (session?.user) {
        void refreshOrg();
      } else {
        setOrg(null);
      }
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
