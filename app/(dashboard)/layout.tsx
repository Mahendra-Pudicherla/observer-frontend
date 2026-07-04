"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  Camera,
  FileText,
  LayoutDashboard,
  Settings,
  CreditCard,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { SessionProvider, useRequireAuth, useSession, exitDemoMode } from "@/components/SessionProvider";
import { COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/cameras", label: "Cameras", icon: Camera },
  { href: "/incidents", label: "Incidents", icon: FileText },
  { href: "/billing", label: "Billing", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

function DashboardChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading } = useRequireAuth();
  const { org, isDemo } = useSession();
  const supabase = createClient();

  const handleSignOut = async () => {
    exitDemoMode();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: COLORS.surface }}
      >
        {/* Skeleton shimmer */}
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl animate-pulse"
            style={{ background: "linear-gradient(135deg, #0f1923, #1e3a5f)" }}
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
    <div className="min-h-screen flex" style={{ backgroundColor: COLORS.surface, fontFamily: "Plus Jakarta Sans, system-ui, sans-serif" }}>
      {/* ── Sidebar ── */}
      <aside
        className="w-16 flex flex-col items-center py-4 gap-1 shrink-0 relative z-20"
        style={{
          backgroundColor: "white",
          borderRight: "1px solid rgba(0,0,0,0.06)",
          boxShadow: "2px 0 12px rgba(0,0,0,0.04)",
        }}
      >
        {/* Logo icon only */}
        <div className="mb-5 mt-1">
          <Logo size="sm" showWordmark={false} />
        </div>

        {/* Nav items */}
        <div className="flex flex-col items-center gap-1 flex-1 w-full px-2">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200",
                  active ? "shadow-sm" : "hover:bg-slate-50"
                )}
                style={{
                  backgroundColor: active ? COLORS.blueTint : undefined,
                  color: active ? COLORS.signalBlue : COLORS.slate,
                }}
              >
                {/* Active indicator bar */}
                {active && (
                  <span
                    className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full"
                    style={{ backgroundColor: COLORS.signalBlue }}
                  />
                )}
                <Icon className="h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-110" />

                {/* Tooltip */}
                <span
                  className="absolute left-14 px-2 py-1 rounded-lg text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 translate-x-1 group-hover:translate-x-0 z-50"
                  style={{ backgroundColor: COLORS.midnight }}
                >
                  {label}
                  <span
                    className="absolute -left-1 top-1/2 -translate-y-1/2 w-2 h-2 rotate-45"
                    style={{ backgroundColor: COLORS.midnight }}
                  />
                </span>
              </Link>
            );
          })}
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          title="Sign out"
          className="group relative flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-200 hover:bg-red-50 mb-1"
          style={{ color: "#94a3b8" }}
        >
          <LogOut className="h-[18px] w-[18px] transition-all duration-200 group-hover:text-red-500" />
          <span
            className="absolute left-14 px-2 py-1 rounded-lg text-xs font-semibold text-white whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50"
            style={{ backgroundColor: COLORS.midnight }}
          >
            Sign out
          </span>
        </button>
      </aside>

      {/* ── Main area ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header
          className="h-14 flex items-center justify-between px-6 shrink-0"
          style={{
            backgroundColor: "white",
            borderBottom: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 1px 8px rgba(0,0,0,0.04)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <p className="font-bold text-sm leading-tight" style={{ color: COLORS.midnight }}>
                {org?.name ?? "Organisation"}
              </p>
              <p className="text-xs capitalize" style={{ color: COLORS.slate }}>
                {org?.plan ?? "starter"} plan
              </p>
            </div>
            {isDemo && (
              <span
                className="hidden sm:inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: "#fef3c7", color: "#d97706", border: "1px solid #fde68a" }}
              >
                DEMO
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Breadcrumb */}
            <div className="hidden md:flex items-center gap-1 text-xs" style={{ color: COLORS.slate }}>
              <span>Observer</span>
              <ChevronRight className="h-3 w-3" />
              <span className="font-semibold capitalize" style={{ color: COLORS.midnight }}>
                {pathname.replace("/", "") || "Dashboard"}
              </span>
            </div>

            <div className="w-px h-5 mx-1 hidden md:block" style={{ backgroundColor: "#e2e8f0" }} />

            {/* Live badge */}
            <span
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ backgroundColor: "#f0fdf4", color: COLORS.safeGreen }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: COLORS.safeGreen }} />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: COLORS.safeGreen }} />
              </span>
              Live
            </span>

            {/* Bell */}
            <button
              className="relative h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-50"
              style={{ color: COLORS.slate }}
            >
              <Bell className="h-4 w-4" />
            </button>

            {/* Settings shortcut */}
            <Link
              href="/settings"
              className="h-8 w-8 flex items-center justify-center rounded-lg transition-colors hover:bg-slate-50"
              style={{ color: COLORS.slate }}
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

