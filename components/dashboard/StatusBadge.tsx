import { COLORS } from "@/lib/constants";

const SEVERITY: Record<string, { bg: string; color: string }> = {
  critical: { bg: "rgba(239,68,68,0.15)", color: "#F87171" },
  high: { bg: "rgba(245,158,11,0.15)", color: "#FBBF24" },
  medium: { bg: "rgba(59,130,246,0.15)", color: "#60A5FA" },
  low: { bg: "rgba(148,163,184,0.15)", color: "#94A3B8" },
  open: { bg: "rgba(239,68,68,0.12)", color: "#F87171" },
  assigned: { bg: "rgba(59,130,246,0.12)", color: "#60A5FA" },
  resolved: { bg: "rgba(34,197,94,0.12)", color: "#4ADE80" },
  online: { bg: "rgba(34,197,94,0.15)", color: "#4ADE80" },
  offline: { bg: "rgba(239,68,68,0.15)", color: "#F87171" },
  normal: { bg: "rgba(34,197,94,0.15)", color: "#4ADE80" },
  active: { bg: "rgba(34,197,94,0.15)", color: "#4ADE80" },
  invited: { bg: "rgba(59,130,246,0.15)", color: "#60A5FA" },
  suspended: { bg: "rgba(239,68,68,0.15)", color: "#F87171" },
  ready: { bg: "rgba(34,197,94,0.15)", color: "#4ADE80" },
  generating: { bg: "rgba(59,130,246,0.15)", color: "#60A5FA" },
};

export function StatusBadge({
  label,
  tone = "low",
}: {
  label: string;
  tone?: keyof typeof SEVERITY | string;
}) {
  const s = SEVERITY[tone] ?? SEVERITY.low;
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold capitalize"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      {label}
    </span>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl ${className}`}
      style={{
        backgroundColor: COLORS.panel,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      {children}
    </div>
  );
}
