import { COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function FilterPills({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all",
              active ? "text-white" : "hover:bg-white/5"
            )}
            style={{
              backgroundColor: active ? COLORS.signalBlue : COLORS.panelElevated,
              color: active ? "#fff" : COLORS.textMuted,
              border: `1px solid ${active ? COLORS.signalBlue : COLORS.border}`,
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
