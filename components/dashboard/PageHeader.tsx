import { COLORS } from "@/lib/constants";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
      <div>
        {eyebrow && (
          <p className="text-xs font-medium mb-1" style={{ color: COLORS.textMuted }}>
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: COLORS.text }}>
          {title}
        </h1>
        {description && (
          <p className="text-sm mt-1" style={{ color: COLORS.textMuted }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
