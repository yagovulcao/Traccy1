import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { ImportType } from "@/lib/normalize/normalizeRow";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ImportType;

  if (type !== "FLA" && type !== "FLQA") {
    return NextResponse.json({ error: "type must be FLA or FLQA" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // latest snapshot
  const { data: snap, error: snapErr } = await supabase
    .from("snapshots")
    .select("id, import_id, type, created_at")
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapErr) {
    return NextResponse.json({ error: snapErr.message }, { status: 500 });
  }
  if (!snap) {
    return NextResponse.json({ snapshot: null });
  }

  const { data: rows, error: rowsErr } = await supabase
    .from("snapshot_agents")
    .select(
      "agent_key, gci_6m, tx_6m, flqa_expires, in_fla, in_flqa, eligible_now, status, missing_gci, missing_tx, days_to_expire"
    )
    .eq("snapshot_id", snap.id)
    .limit(5000);

  if (rowsErr) return NextResponse.json({ error: rowsErr.message }, { status: 500 });

  const { data: alerts, error: alertsErr } = await supabase
    .from("alerts")
    .select("id, agent_key, event_type, payload, created_at")
    .eq("snapshot_id", snap.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (alertsErr) return NextResponse.json({ error: alertsErr.message }, { status: 500 });

  // KPIs
  const r = rows ?? [];
  const kpis = {
    total: r.length,
    eligible: r.filter((x) => x.eligible_now).length,
    active: r.filter((x) => x.status === "FLQA_ACTIVE").length,
    at_risk: r.filter((x) => x.status === "FLQA_AT_RISK").length,
    almost: r.filter((x) => x.status === "ALMOST_FLQA").length,
    in_flqa_file: r.filter((x) => x.in_flqa).length,
    qualifies_not_in_flqa: r.filter((x) => x.eligible_now && !x.in_flqa).length,
    in_flqa_not_qualify: r.filter((x) => !x.eligible_now && x.in_flqa).length,
  };

  return NextResponse.json({
    snapshot: snap,
    kpis,
    rows: r,
    alerts: alerts ?? [],
  });
}
