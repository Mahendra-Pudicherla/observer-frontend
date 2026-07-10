"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { useOrgIncidents } from "@/hooks/useOrgData";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, StatusBadge } from "@/components/dashboard/StatusBadge";
import { COLORS, formatAnomalyType, type Incident } from "@/lib/constants";
import { exportIncidentReport } from "@/lib/export-report";
import { FileText, FileSpreadsheet, Download, Search, Calendar } from "lucide-react";

type ReportRow = {
  id: string;
  title: string;
  type: "TXT";
  date: string;
  size: string;
  status: "ready";
  incidentId?: string;
  source: "incident" | "export";
};

function reportsStorageKey(orgId: string) {
  return `observer_reports_${orgId}`;
}

function incidentToReport(inc: Incident): ReportRow {
  const date = inc.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
  return {
    id: `INC-${inc.id.slice(0, 8).toUpperCase()}`,
    title: `${formatAnomalyType(inc.type)} · ${inc.camera_id}`,
    type: "TXT",
    date,
    size: inc.clip_url ? "2.4 MB" : "18 KB",
    status: "ready",
    incidentId: inc.id,
    source: "incident",
  };
}

function filterIncidentsByDate(incidents: Incident[], from: string, to: string) {
  if (!from && !to) return incidents;
  return incidents.filter((inc) => {
    if (!inc.created_at) return true;
    const d = inc.created_at.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  });
}

export default function ReportsPage() {
  const { org } = useSession();
  const { incidents } = useOrgIncidents(200);
  const [exports, setExports] = useState<ReportRow[]>([]);
  const [query, setQuery] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    if (!org?.id || typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(reportsStorageKey(org.id));
      if (raw) setExports(JSON.parse(raw) as ReportRow[]);
    } catch {
      setExports([]);
    }
  }, [org?.id]);

  const incidentReports = useMemo(
    () => filterIncidentsByDate(incidents, from, to).map(incidentToReport),
    [incidents, from, to]
  );

  const allReports = useMemo(() => {
    const seen = new Set<string>();
    return [...exports, ...incidentReports]
      .filter((r) => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      })
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [exports, incidentReports]);

  const filtered = allReports.filter(
    (r) =>
      !query ||
      r.title.toLowerCase().includes(query.toLowerCase()) ||
      r.id.toLowerCase().includes(query.toLowerCase())
  );

  const persistExport = (row: ReportRow) => {
    if (!org?.id) return;
    setExports((prev) => {
      const next = [row, ...prev.filter((r) => r.id !== row.id)].slice(0, 50);
      localStorage.setItem(reportsStorageKey(org.id), JSON.stringify(next));
      return next;
    });
  };

  const generate = () => {
    const scoped = filterIncidentsByDate(incidents, from, to);
    exportIncidentReport(org?.name ?? "Organisation", scoped);
    const unreviewed = scoped.filter((i) => !i.reviewed).length;
    const row: ReportRow = {
      id: `RPT-${String(Math.floor(Math.random() * 9000) + 1000)}`,
      title: from || to ? `Incident export (${from || "…"} → ${to || "…"})` : "Incident export",
      type: "TXT",
      date: new Date().toISOString().slice(0, 10),
      size: `${Math.max(4, unreviewed * 2 + scoped.length)} KB`,
      status: "ready",
      source: "export",
    };
    persistExport(row);
  };

  const downloadRow = (row: ReportRow) => {
    if (row.source === "export") {
      generate();
      return;
    }
    const inc = incidents.find((i) => i.id === row.incidentId);
    if (inc) {
      exportIncidentReport(org?.name ?? "Organisation", [inc]);
    }
  };

  return (
    <div>
      <PageHeader
        title="Reports"
        description={`${allReports.length} reports from incidents and exports`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Panel className="p-5">
          <p className="text-sm font-bold mb-3" style={{ color: COLORS.text }}>
            Generate public-safety report
          </p>
          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: COLORS.signalBlue }}
          >
            <FileText className="h-4 w-4" /> Generate report
          </button>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm font-bold mb-3" style={{ color: COLORS.text }}>
            Export analytics
          </p>
          <button
            type="button"
            onClick={generate}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold"
            style={{
              border: `1px solid ${COLORS.border}`,
              color: COLORS.text,
              backgroundColor: COLORS.panelElevated,
            }}
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel / TXT
          </button>
        </Panel>
        <Panel className="p-5">
          <p className="text-sm font-bold mb-3" style={{ color: COLORS.text }}>
            Date filter
          </p>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-1.5 flex-1 h-10 px-2 rounded-xl text-xs"
              style={{ backgroundColor: COLORS.panelElevated, border: `1px solid ${COLORS.border}` }}
            >
              <Calendar className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} />
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-transparent outline-none w-full"
                style={{ color: COLORS.text }}
              />
            </div>
            <span style={{ color: COLORS.textMuted }}>—</span>
            <div
              className="flex items-center gap-1.5 flex-1 h-10 px-2 rounded-xl text-xs"
              style={{ backgroundColor: COLORS.panelElevated, border: `1px solid ${COLORS.border}` }}
            >
              <Calendar className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} />
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-transparent outline-none w-full"
                style={{ color: COLORS.text }}
              />
            </div>
          </div>
        </Panel>
      </div>

      <Panel>
        <div
          className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-3"
          style={{ borderColor: COLORS.border }}
        >
          <p className="text-sm font-bold" style={{ color: COLORS.text }}>
            Recent reports
          </p>
          <div
            className="flex items-center gap-2 rounded-xl px-3 h-9 w-full sm:w-64"
            style={{ backgroundColor: COLORS.panelElevated, border: `1px solid ${COLORS.border}` }}
          >
            <Search className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: COLORS.text }}
            />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm" style={{ color: COLORS.textMuted }}>
            No reports yet — incidents will appear here automatically once recorded
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.textMuted }}>
                  {["ID", "Title", "Type", "Date", "Size", "Status", ""].map((h) => (
                    <th key={h || "a"} className="text-left font-medium px-4 py-3 text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                    <td className="px-4 py-3 font-medium" style={{ color: COLORS.textMuted }}>
                      {r.id}
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: COLORS.text }}>
                      {r.title}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={r.type} tone="low" />
                    </td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMuted }}>
                      {r.date}
                    </td>
                    <td className="px-4 py-3" style={{ color: COLORS.textMuted }}>
                      {r.size}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge label={r.status} tone={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => downloadRow(r)}
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-white/5"
                        style={{ color: COLORS.textMuted }}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
