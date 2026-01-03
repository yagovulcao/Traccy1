import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { ImportType } from "@/lib/normalize/normalizeRow";

// Okta-like rules (display/official counts)
// - Exclude "no activity" agents (GCI=0 AND TX=0)
// - Exclude expired FLQA (if Expires exists and already passed)
// These rules are applied at read-time to match the Okta dashboard,
// without changing your stored snapshot schema yet.

function num(v: any): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ImportType;

  if (type !== "FLA" && type !== "FLQA") {
    return NextResponse.json(
      { error: "type must be FLA or FLQA" },
      { status: 400 }
    );
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

  if (snapErr) return NextResponse.json({ error: snapErr.message }, { status: 500 });
  if (!snap) return NextResponse.json({ snapshot: null });

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

  const r = (rows ?? []).map((x: any) => {
    const gci = num(x.gci_6m);
    const tx = num(x.tx_6m);

    const hasActivity = gci > 0 || tx > 0;

    const dte =
      x.days_to_expire === null || x.days_to_expire === undefined
        ? null
        : num(x.days_to_expire);

    // Okta-like: if expires exists, FLQA is only "counted" when not expired
    const notExpiredIfHasExpires = dte === null ? true : dte >= 0;

    const okta_flqa_total = hasActivity && !!x.eligible_now && notExpiredIfHasExpires;
    const okta_fla_total = hasActivity && !okta_flqa_total;

    const okta_at_risk =
      okta_flqa_total && dte !== null && dte >= 0 && dte <= 30;

    const okta_almost =
      okta_fla_total && x.status === "ALMOST_FLQA";

    return {
      ...x,
      __okta: {
        hasActivity,
        notExpiredIfHasExpires,
        okta_flqa_total,
        okta_fla_total,
        okta_at_risk,
        okta_almost,
      },
    };
  });

  // "Official" KPIs (Okta-like)
  const kpis = {
    fla_total: r.filter((x: any) => x.__okta.okta_fla_total).length,
    flqa_total: r.filter((x: any) => x.__okta.okta_flqa_total).length,
    flqa_at_risk: r.filter((x: any) => x.__okta.okta_at_risk).length,
    almost_flqa: r.filter((x: any) => x.__okta.okta_almost).length,
  };

  // Debug KPIs (raw) - helps verify why Okta differs from CSV
  const raw_kpis = {
    total_rows: r.length,
    raw_eligible: r.filter((x: any) => x.eligible_now).length,
    raw_active_status: r.filter((x: any) => x.status === "FLQA_ACTIVE").length,
    raw_at_risk_status: r.filter((x: any) => x.status === "FLQA_AT_RISK").length,
    raw_almost_status: r.filter((x: any) => x.status === "ALMOST_FLQA").length,
    excluded_no_activity: r.filter((x: any) => !x.__okta.hasActivity).length,
    excluded_expired: r.filter(
      (x: any) => x.__okta.hasActivity && x.eligible_now && !x.__okta.notExpiredIfHasExpires
    ).length,
  };

  return NextResponse.json({
    snapshot: snap,
    kpis,       // ✅ Okta-like official numbers
    raw_kpis,   // 🔎 debug for reconciliation
    rows: r,
    alerts: alerts ?? [],
  });
}
