import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { ImportType } from "@/lib/normalize/normalizeRow";

function num(v: any): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function GET(req: Request) {
  // "type" aqui é só a aba/view; os KPIs são unificados (Okta-like)
  const url = new URL(req.url);
  const view = (url.searchParams.get("type") === "FLQA" ? "FLQA" : "FLA") as ImportType;

  const supabase = supabaseServer();

  // latest snapshot FLA e FLQA (sempre)
  const [{ data: snapFla, error: errFla }, { data: snapFlqa, error: errFlqa }] =
    await Promise.all([
      supabase
        .from("snapshots")
        .select("id, import_id, type, created_at")
        .eq("type", "FLA")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("snapshots")
        .select("id, import_id, type, created_at")
        .eq("type", "FLQA")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (errFla) return NextResponse.json({ error: errFla.message }, { status: 500 });
  if (errFlqa) return NextResponse.json({ error: errFlqa.message }, { status: 500 });

  // Sem snapshot FLA não existe "universo" para o dashboard
  if (!snapFla) return NextResponse.json({ snapshot: null });

  // Universo base = snapshot FLA (inclui in_fla)
  const { data: flaRows, error: flaRowsErr } = await supabase
    .from("snapshot_agents")
    .select(
      `
      snapshot_id,
      agent_key,
      in_fla,
      gci_6m,
      tx_6m,
      eligible_now,
      status,
      missing_gci,
      missing_tx,
      agents:agents (
        agent_id,
        full_name,
        email,
        market
      )
    `
    )
    .eq("snapshot_id", snapFla.id)
    .limit(20000);

  if (flaRowsErr) return NextResponse.json({ error: flaRowsErr.message }, { status: 500 });

  // Mapa FLQA = snapshot FLQA (membership + expires/days)
  const flqaMap = new Map<
    string,
    { in_flqa: boolean; flqa_expires: string | null; days_to_expire: number | null }
  >();

  if (snapFlqa) {
    const { data: flqaRows, error: flqaRowsErr } = await supabase
      .from("snapshot_agents")
      .select("agent_key, in_flqa, flqa_expires, days_to_expire")
      .eq("snapshot_id", snapFlqa.id)
      .limit(20000);

    if (flqaRowsErr) return NextResponse.json({ error: flqaRowsErr.message }, { status: 500 });

    for (const r of flqaRows ?? []) {
      flqaMap.set(r.agent_key, {
        in_flqa: !!r.in_flqa,
        flqa_expires: r.flqa_expires ?? null,
        days_to_expire:
          r.days_to_expire === null || r.days_to_expire === undefined
            ? null
            : num(r.days_to_expire),
      });
    }
  }

  // Alerts: mantém como estava (alerts do snapshot "em view")
  const snapshotForAlerts = view === "FLQA" ? snapFlqa : snapFla;

  const { data: alerts, error: alertsErr } = snapshotForAlerts
    ? await supabase
        .from("alerts")
        .select("id, agent_key, event_type, payload, created_at")
        .eq("snapshot_id", snapshotForAlerts.id)
        .order("created_at", { ascending: false })
        .limit(1000)
    : { data: [], error: null };

  if (alertsErr) return NextResponse.json({ error: alertsErr.message }, { status: 500 });

  // thresholds (Almost)
  const ALMOST_MISSING_GCI_THRESHOLD = 1500; // faltam <= 1500 para chegar em 5000

  const rows = (flaRows ?? []).map((x: any) => {
    const gci = num(x.gci_6m);
    const tx = num(x.tx_6m);

    // Atividade mínima (Okta usa isso para FLQA; NÃO para FLA)
    const hasActivity = gci > 0 || tx > 0;

    const flqa = flqaMap.get(x.agent_key);
    const in_flqa = flqa?.in_flqa ?? false;
    const flqa_expires = flqa?.flqa_expires ?? null;
    const days_to_expire = flqa?.days_to_expire ?? null;

    // Se existe expires, só conta FLQA se não expirou; se não existe, considera "não expirado"
    const notExpiredIfHasExpires = days_to_expire === null ? true : days_to_expire >= 0;

    // ✅ Okta-like:
    // FLQA total = está no arquivo FLQA, tem atividade e não expirou
    const okta_flqa_total = in_flqa && hasActivity && notExpiredIfHasExpires;

    // ✅ FLA total = está no arquivo FLA e NÃO está no FLQA válido
    // (NÃO usa hasActivity aqui — senão derruba o FLA)
    const in_fla = !!x.in_fla;
    const okta_fla_total = in_fla && !okta_flqa_total;

    const okta_at_risk =
      okta_flqa_total &&
      days_to_expire !== null &&
      days_to_expire >= 0 &&
      days_to_expire <= 30;

    // Almost (dentro do FLA válido)
    const missing_gci = Math.max(0, 5000 - gci);
    const okta_almost =
      okta_fla_total && (tx === 1 || missing_gci <= ALMOST_MISSING_GCI_THRESHOLD);

    return {
      agent_key: x.agent_key,
      agent_id: x.agents?.agent_id ?? null,
      full_name: x.agents?.full_name ?? null,
      email: x.agents?.email ?? null,
      market: x.agents?.market ?? null,

      // base metrics
      gci_6m: x.gci_6m ?? null,
      tx_6m: x.tx_6m ?? null,

      // membership + expires
      in_fla,
      in_flqa,
      flqa_expires,
      days_to_expire,

      // keep for debugging
      eligible_now: !!x.eligible_now,
      status: x.status,
      missing_gci: x.missing_gci ?? null,
      missing_tx: x.missing_tx ?? null,

      __okta: {
        hasActivity,
        notExpiredIfHasExpires,
        okta_fla_total,
        okta_flqa_total,
        okta_at_risk,
        okta_almost,
      },
    };
  });

  const kpis = {
    fla_total: rows.filter((r: any) => r.__okta.okta_fla_total).length,
    flqa_total: rows.filter((r: any) => r.__okta.okta_flqa_total).length,
    flqa_at_risk: rows.filter((r: any) => r.__okta.okta_at_risk).length,
    almost_flqa: rows.filter((r: any) => r.__okta.okta_almost).length,
  };

  const raw_kpis = {
    fla_snapshot_rows: rows.length,
    has_flqa_snapshot: !!snapFlqa,
    flqa_membership_count: rows.filter((r: any) => r.in_flqa).length,
    flqa_excluded_no_activity: rows.filter(
      (r: any) => r.in_flqa && !r.__okta.hasActivity
    ).length,
    flqa_excluded_expired: rows.filter(
      (r: any) => r.in_flqa && r.__okta.hasActivity && !r.__okta.notExpiredIfHasExpires
    ).length,
  };

  return NextResponse.json({
    snapshot: {
      fla: snapFla,
      flqa: snapFlqa ?? null,
      view,
    },
    kpis,
    raw_kpis,
    rows,
    alerts: alerts ?? [],
  });
}
