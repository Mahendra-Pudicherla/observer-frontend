"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Panel, StatusBadge } from "@/components/dashboard/StatusBadge";
import { COLORS } from "@/lib/constants";
import { createClient } from "@/lib/supabase";
import { Shield, UserPlus } from "lucide-react";

type MemberRow = {
  id: string;
  user_id: string;
  role: string;
  email?: string;
  name?: string;
};

export default function UsersPage() {
  const { org, userId } = useSession();
  const supabase = useMemo(() => createClient(), []);
  const [members, setMembers] = useState<MemberRow[]>([]);

  useEffect(() => {
    if (!org?.id) return;
    const load = async () => {
      const { data } = await supabase
        .from("org_members")
        .select("id, user_id, role")
        .eq("org_id", org.id);
      const rows = (data as MemberRow[]) ?? [];
      setMembers(
        rows.map((m) => ({
          ...m,
          name: m.user_id === userId ? "You" : `Member ${m.user_id.slice(0, 6)}`,
          email: m.user_id === userId ? "Signed-in account" : m.user_id,
        }))
      );
    };
    void load();
  }, [org?.id, userId, supabase]);

  return (
    <div>
      <PageHeader
        title="Team"
        description={`Officers & operators · ${org?.name ?? "Organisation"}`}
        actions={
          <button
            type="button"
            onClick={() => alert("Invite flow coming soon — no backend yet.")}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: COLORS.signalBlue }}
          >
            <UserPlus className="h-4 w-4" /> Invite
          </button>
        }
      />

      <Panel>
        {members.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm" style={{ color: COLORS.textMuted }}>
            No org members found for this organisation
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: COLORS.textMuted }}>
                  {["User", "Role", "Status", ""].map((h) => (
                    <th key={h || "actions"} className="text-left font-medium px-4 py-3 text-xs">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((u) => {
                  const initials = (u.name ?? "U")
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase();
                  return (
                    <tr key={u.id} style={{ borderTop: `1px solid ${COLORS.border}` }}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span
                            className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: COLORS.signalBlue }}
                          >
                            {initials}
                          </span>
                          <div>
                            <p className="font-semibold" style={{ color: COLORS.text }}>
                              {u.name}
                            </p>
                            <p className="text-xs" style={{ color: COLORS.textMuted }}>
                              {u.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 capitalize"
                          style={{ color: COLORS.text }}
                        >
                          <Shield className="h-3.5 w-3.5" style={{ color: COLORS.textMuted }} />
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label="active" tone="active" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-xs" style={{ color: COLORS.textMuted }}>
                          —
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
