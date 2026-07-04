import { COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

const sizes = {
  sm: { icon: 28, text: "text-sm", wordWeight: "font-semibold" },
  md: { icon: 36, text: "text-base", wordWeight: "font-bold" },
  lg: { icon: 44, text: "text-lg", wordWeight: "font-bold" },
} as const;

interface LogoProps {
  size?: keyof typeof sizes;
  showWordmark?: boolean;
  className?: string;
  /** Set to true when on a dark background — inverts the wordmark color */
  dark?: boolean;
}

export function Logo({ size = "md", showWordmark = true, className, dark = false }: LogoProps) {
  const s = sizes[size];
  const box = s.icon + 8;

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className="flex items-center justify-center rounded-xl shrink-0"
        style={{
          width: box,
          height: box,
          background: `linear-gradient(135deg, ${COLORS.midnight} 0%, #1e3a5f 100%)`,
          boxShadow: "0 2px 8px rgba(37,99,235,0.25)",
        }}
      >
        <svg
          width={s.icon}
          height={s.icon}
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden
        >
          {/* Outer circle */}
          <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="1.5" opacity="0.9" />
          {/* Inner glow ring */}
          <circle cx="16" cy="16" r="6" stroke="rgba(96,165,250,0.4)" strokeWidth="1" />
          {/* Center dot */}
          <circle cx="16" cy="16" r="2.5" fill="white" />
          {/* N/S/E/W tick marks */}
          <line x1="16" y1="4" x2="16" y2="8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="16" y1="24" x2="16" y2="28" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="16" x2="8" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="24" y1="16" x2="28" y2="16" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      {showWordmark && (
        <span
          className={cn("tracking-tight leading-none", s.text, s.wordWeight)}
          style={{ color: dark ? "white" : COLORS.midnight }}
        >
          Observer
          <span style={{ color: COLORS.signalBlue }}>.</span>
        </span>
      )}
    </div>
  );
}

