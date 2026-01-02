import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { parseCsvToObjects } from "@/lib/csv/parseCsv";
import { normalizeRow, type ImportType } from "@/lib/normalize/normalizeRow";
import { agentKeyFromRow } from "@/lib/keys/agentKey";
import { applyFlqaToNormalizedRow } from "@/features/flqa/flqa.engine";
import { diffSnapshots } from "@/features/snapshots/snapshots.diff";

export async function POST(req: Request) {
  const url = new URL(req.url);
  const type = url.searchParams.get("type") as ImportType;

  if (type !== "FLA" && type !== "FLQA") {
    return NextResponse.json({ error: "type must be FLA or FLQA" }, { status: 400 });
  }

  const supabase = supabaseServer();

  // 1) latest import for that type
  const { data: imp, error: impErr } = await supabase
    .from("imports")
    .select("*")
    .eq("type", type)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (impErr || !imp) {
    return NextResponse.json({ error: "no import found for type" }, { status: 404 });
  }

  // 2) download file from storage
  const { data: dl, error: dlErr } = await supabase.storage
    .from("imports")
    .download(imp.storage_path);

  if (dlErr || !dl) {
    await supabase.from("imports").update({ status: "FAILED", error: dlErr?.message ?? "download failed" }).eq("id", imp.id);
    return NextResponse.json({ error: "download failed" }, { status: 500 });
  }

  const csvText = await dl.text();
  const rawRows = parseCsvToObjects(csvText);

  // 3) normalize + upsert agents + accumulate snapshot rows
  const normalized = rawRows.map((r) => normalizeRow(type, r));

  // create snapshot
  const { data: snap, error: snapErr } = await supabase
    .from("snapshots")
    .insert({ import_id: imp.id, type })
    .select("*")
    .single();

  if (snapErr || !snap) {
    return NextResponse.json({ error: snapErr?.message ?? "snapshot create failed" }, { status: 500 });
  }

  const snapshotAgentsRows: any[] = [];

  for (const n of normalized) {
    const agent_key = agentKeyFromRow({
      agent_id: n.agent_id,
      email: n.email,
      full_name: n.full_name,
      market: n.market,
    });

    // upsert agent
    await supabase
      .from("agents")
      .upsert(
        {
          agent_key,
          agent_id: n.agent_id,
          email: n.email,
          full_name: n.full_name,
          market: n.market,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "agent_key" }
      );

    const computed = applyFlqaToNormalizedRow({
      gci_6m: n.gci_6m,
      tx_6m: n.tx_6m,
      flqa_expires: n.flqa_expires,
    });

    snapshotAgentsRows.push({
      snapshot_id: snap.id,
      agent_key,
      gci_6m: n.gci_6m,
      tx_6m: n.tx_6m,
      flqa_expires: n.flqa_expires,
      in_fla: type === "FLA",
      in_flqa: type === "FLQA",
      eligible_now: computed.eligible_now,
      status: computed.status,
      missing_gci: computed.missing_gci,
      missing_tx: computed.missing_tx,
      days_to_expire: computed.days_to_expire,
    });
  }

  // insert snapshot_agents in bulk
  if (snapshotAgentsRows.length > 0) {
    const { error: insErr } = await supabase.from("snapshot_agents").insert(snapshotAgentsRows);
    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
  }

  // mark import processed
  await supabase.from("imports").update({ status: "PROCESSED", processed_at: new Date().toISOString() }).eq("id", imp.id);

  // 4) diff vs previous snapshot (same type)
  const { data: prevSnap } = await supabase
    .from("snapshots")
    .select("*")
    .eq("type", type)
    .neq("id", snap.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let diffEvents: any[] = [];

  if (prevSnap) {
    const { data: prevRows } = await supabase
      .from("snapshot_agents")
      .select("agent_key,status,eligible_now,gci_6m,tx_6m")
      .eq("snapshot_id", prevSnap.id);

    const { data: nextRows } = await supabase
      .from("snapshot_agents")
      .select("agent_key,status,eligible_now,gci_6m,tx_6m")
      .eq("snapshot_id", snap.id);

    diffEvents = diffSnapshots((prevRows ?? []) as any, (nextRows ?? []) as any);

    // save alerts
    if (diffEvents.length > 0) {
      await supabase.from("alerts").insert(
        diffEvents.map((e) => ({
          snapshot_id: snap.id,
          agent_key: e.agent_key,
          event_type: e.event,
          payload: { prev: e.prev, next: e.next },
        }))
      );
    }
  }

  return NextResponse.json({
    import_id: imp.id,
    snapshot_id: snap.id,
    type,
    rows: snapshotAgentsRows.length,
    diff_events: diffEvents.length,
  });
}