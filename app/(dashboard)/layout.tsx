"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  FileText,
  LayoutDashboard,
  Settings,
  LogOut,
  MonitorPlay,
  Brain,
  Siren,
  Map,
  FileBarChart2,
  Users,
  ScanFace,
  Film,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  SessionProvider,
  useRequireAuth,
  useSession,
  exitDemoMode,
} from "@/components/SessionProvider";
import { COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/live", label: "Live Monitoring", icon: MonitorPlay },
  { href: "/ai-analysis", label: "AI Analysis", icon: Brain },
  { href: "/alerts", label: "Alerts", icon: Siren },
  { href: "/incidents", label: "Incidents", icon: FileText },
  { href: "/records", label: "Records", icon: Film },
  { href: "/cameras", label: "Cameras", icon: Camera },
  { href: "/face-watchlist", label: "Face Watchlist", icon: ScanFace },
  { href: "/maps", label: "Maps", icon: Map },
  { href: "/reports", label: "Reports", icon: FileBarChart2 },
  { href: "/users", label: "Users", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading } = useRequireAuth();
  const { org, isDemo } = useSession();
  const supabase = createClient();
  const [collapsed, setCollapsed] = useState(false);

  const handleSignOut = async () => {
    exitDemoMode();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const activeLabel =
    navItems.find((n) => pathname === n.href || pathname.startsWith(`${n.href}/`))
      ?.label ?? "Dashboard";

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.bg }}
      >
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl animate-pulse"
            style={{ background: "linear-gradient(135deg, #1a1f2e, #2563eb55)" }}
          />
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex"
      style={{
        backgroundColor: COLORS.bg,
        fontFamily: "Plus Jakarta Sans, system-ui, sans-serif",
        color: COLORS.text,
      }}
    >
      <aside
        className={cn(
          "flex flex-col py-4 shrink-0 relative z-20 transition-all duration-300",
          collapsed ? "w-[72px] px-2" : "w-56 px-3"
        )}
        style={{
          backgroundColor: COLORS.panel,
          borderRight: `1px solid ${COLORS.border}`,
        }}
      >
        <div className={cn("mb-6 mt-1", collapsed ? "flex justify-center" : "px-2")}>
          <Logo size="sm" showWordmark={!collapsed} dark />
        </div>

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl transition-all duration-200",
                  collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 px-3"
                )}
                style={{
                  backgroundColor: active ? "rgba(59,130,246,0.15)" : undefined,
                  color: active ? COLORS.signalBlue : COLORS.textMuted,
                }}
              >
                {active && !collapsed && (
                  <span
                    className="absolute right-2 h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: COLORS.signalBlue }}
                  />
                )}
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {!collapsed && (
                  <span className="text-sm font-medium truncate">{label}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 space-y-1">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex items-center gap-3 rounded-xl transition-all w-full",
              collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 px-3"
            )}
            style={{ color: COLORS.textMuted }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? (
              <PanelLeft className="h-[18px] w-[18px]" />
            ) : (
              <>
                <PanelLeftClose className="h-[18px] w-[18px]" />
                <span className="text-sm font-medium">Collapse</span>
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className={cn(
              "flex items-center gap-3 rounded-xl transition-all w-full hover:bg-red-500/10",
              collapsed ? "h-10 w-10 justify-center mx-auto" : "h-10 px-3"
            )}
            style={{ color: COLORS.textMuted }}
            title="Sign out"
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && <span className="text-sm font-medium">Sign out</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header
          className="h-14 flex items-center justify-between px-6 shrink-0"
          style={{
            backgroundColor: COLORS.panel,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <p className="font-bold text-sm leading-tight" style={{ color: COLORS.text }}>
                {org?.name ?? "Organisation"}
              </p>
              <p className="text-xs capitalize" style={{ color: COLORS.textMuted }}>
                {org?.plan ?? "starter"} plan · {activeLabel}
              </p>
            </div>
            {isDemo && (
              <span
                className="hidden sm:inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: "rgba(245,158,11,0.15)",
                  color: COLORS.cautionAmber,
                }}
              >
                DEMO
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: "rgba(34,197,94,0.12)",
                color: COLORS.safeGreen,
              }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: COLORS.safeGreen }}
                />
                <span
                  className="relative inline-flex rounded-full h-1.5 w-1.5"
                  style={{ backgroundColor: COLORS.safeGreen }}
                />
              </span>
              Live
            </span>

            <Link
              href="/alerts"
              className="relative h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
              style={{ color: COLORS.textMuted }}
            >
              <Bell className="h-4 w-4" />
            </Link>

            <Link
              href="/settings"
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
              style={{ color: COLORS.textMuted }}
            >
              <Settings className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <DashboardChrome>{children}</DashboardChrome>
    </SessionProvider>
  );
}
