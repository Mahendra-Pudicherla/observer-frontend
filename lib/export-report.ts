import type { Camera, Incident } from "@/lib/constants";
import { formatAnomalyType } from "@/lib/constants";

export function exportIncidentReport(orgName: string, incidents: Incident[]) {
  const generated = new Date().toLocaleString();
  const lines: string[] = [
    "OBSERVER — INCIDENT REPORT",
    "══════════════════════════",
    `Organisation : ${orgName}`,
    `Generated    : ${generated}`,
    `Incidents    : ${incidents.length}`,
    "",
  ];

  if (incidents.length === 0) {
    lines.push("No incidents to export.");
  }

  for (const incident of incidents) {
    lines.push(
      `Camera ID    : ${incident.camera_id}`,
      `Type         : ${formatAnomalyType(incident.type)}`,
      `Confidence   : ${incident.confidence != null ? Math.round(incident.confidence * 100) + "%" : "—"}`,
      `Time         : ${incident.created_at ? new Date(incident.created_at).toLocaleString() : "—"}`,
      `Clip URL     : ${incident.clip_url ?? "—"}`,
      `Status       : ${incident.reviewed ? "Reviewed" : "Unreviewed"}`,
      "──────────────────────────",
    );
  }

  lines.push("══════════════════════════");

  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `observer-incident-report-${Date.now()}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export type { Camera, Incident };
