"use client";

import { useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { useAlertSocket } from "@/hooks/useAlertSocket";
import { useOrgIncidents } from "@/hooks/useOrgData";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { FilterPills } from "@/components/dashboard/FilterPills";
import { Panel, StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  BACKEND_API_URL,
  COLORS,
  anomalySeverity,
  formatAnomalyType,
  type AlertPayload,
  type Incident,
} from "@/lib/constants";
import { createClient } from "@/lib/supabase";
import { Check, UserPlus, Search } from "lucide-react";

type AlertCard = {
  id: string;
  title: string;
  location: string;
  time: string;
  severity: "critical" | "high" | "medium" | "low";
  status: "open" | "assigned" | "resolved";
  assignee: string;
  incidentId?: string;
};

function timeAgo(iso?: string | null) {
  if (!iso) return "just now";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.max(0, Math.floor(ms / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AlertsPage() {
  const { org } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const { incidents, reload } = useOrgIncidents(40);
  const { allAlerts } = useAlertSocket(org?.id ?? null);
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [assignees, setAssignees] = useState<Record<string, string>>({});
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const fromLive: AlertCard[] = allAlerts.map((a: AlertPayload, i) => ({
    id: a.incident_id ?? `live-${a.camera_id}-${i}`,
    title: formatAnomalyType(a.type),
    location: a.location || a.camera_id,
    time: timeAgo(a.timestamp),
    severity: anomalySeverity(a.type),
    status: resolved.has(a.incident_id ?? `live-${a.camera_id}-${i}`)
      ? "resolved"
      : assignees[a.incident_id ?? `live-${a.camera_id}-${i}`]
        ? "assigned"
        : "open",
    assignee: assignees[a.incident_id ?? `live-${a.camera_id}-${i}`] ?? "Unassigned",
    incidentId: a.incident_id ?? undefined,
  }));

  const fromIncidents: AlertCard[] = incidents.map((inc: Incident) => {
    const id = inc.id;
    const isResolved = resolved.has(id) || inc.reviewed;
    return {
      id,
      title: formatAnomalyType(inc.type),
      location: inc.camera_id,
      time: timeAgo(inc.created_at),
      severity: anomalySeverity(inc.type),
      status: (isResolved ? "resolved" : assignees[id] ? "assigned" : "open") as AlertCard["status"],
      assignee: assignees[id] ?? "Unassigned",
      incidentId: id,
    };
  });

  const seen = new Set<string>();
  const cards = [...fromLive, ...fromIncidents].filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  const filtered = cards.filter((c) => {
    if (severity !== "all" && c.severity !== severity) return false;
    if (status !== "all" && c.status !== status) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !c.location.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const assign = (id: string) => {
    setAssignees((prev) => ({ ...prev, [id]: "You" }));
  };

  const resolve = async (card: AlertCard) => {
    setResolved((prev) => new Set(prev).add(card.id));
    if (!card.incidentId || !org?.id) return;
    try {
      await fetch(`${BACKEND_API_URL}/incidents/${org.id}/${card.incidentId}/review`, {
        method: "PATCH",
      });
      await supabase.from("incidents").update({ reviewed: true }).eq("id", card.incidentId);
      await reload();
    } catch (e) {
      console.error("Resolve failed:", e);
    }
  };

  return (
    <div>
      <PageHeader title="Alerts" description="Live and historical detection alerts" />

      <div className="flex flex-col gap-3 mb-6">
        <div
          className="flex items-center gap-2 rounded-xl px-3 h-10"
          style={{ backgroundColor: COLORS.panel, border: `1px solid ${COLORS.border}` }}
        >
          <Search className="h-4 w-4" style={{ color: COLORS.textMuted }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search alerts..."
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: COLORS.text }}
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <FilterPills
            value={severity}
            onChange={setSeverity}
            options={[
              { id: "all", label: "All" },
              { id: "critical", label: "Critical" },
              { id: "high", label: "High" },
              { id: "medium", label: "Medium" },
              { id: "low", label: "Low" },
            ]}
          />
          <FilterPills
            value={status}
            onChange={setStatus}
            options={[
              { id: "all", label: "All" },
              { id: "open", label: "Open" },
              { id: "assigned", label: "Assigned" },
              { id: "resolved", label: "Resolved" },
            ]}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((card) => (
          <Panel key={card.id} className="p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium" style={{ color: COLORS.textMuted }}>
                {card.id.slice(0, 10).toUpperCase()}
              </span>
              <StatusBadge label={card.severity} tone={card.severity} />
            </div>
            <div>
              <p className="text-base font-bold" style={{ color: COLORS.text }}>
                {card.title}
              </p>
              <p className="text-xs mt-1" style={{ color: COLORS.textMuted }}>
                {card.location} · {card.time}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <StatusBadge label={card.status} tone={card.status} />
              <span className="text-xs" style={{ color: COLORS.textMuted }}>
                {card.assignee}
              </span>
            </div>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => assign(card.id)}
                disabled={card.status === "resolved"}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold disabled:opacity-40"
                style={{
                  border: `1px solid ${COLORS.border}`,
                  color: COLORS.text,
                  backgroundColor: COLORS.panelElevated,
                }}
              >
                <UserPlus className="h-3.5 w-3.5" /> Assign
              </button>
              <button
                type="button"
                onClick={() => void resolve(card)}
                disabled={card.status === "resolved"}
                className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold text-white disabled:opacity-40"
                style={{ backgroundColor: COLORS.signalBlue }}
              >
                <Check className="h-3.5 w-3.5" /> Resolve
              </button>
            </div>
          </Panel>
        ))}
        {filtered.length === 0 && (
          <div
            className="col-span-full py-16 text-center rounded-2xl text-sm"
            style={{
              color: COLORS.textMuted,
              backgroundColor: COLORS.panel,
              border: `1px dashed ${COLORS.border}`,
            }}
          >
            No alerts match your filters
          </div>
        )}
      </div>
    </div>
  );
}
