"use client";

import { useEffect, useMemo, useState } from "react";

type ImportType = "FLA" | "FLQA";

export default function DashboardClient({ type }: { type: ImportType }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("ALL");
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await fetch(`/api/snapshots/latest?type=${type}`);
      const json = await res.json();
      if (!cancelled) {
        setData(json);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const rows = data?.rows ?? [];
  const filtered = useMemo(() => {
    let r = rows;

    if (filter !== "ALL") r = r.filter((x: any) => x.status === filter);

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      r = r.filter((x: any) => String(x.agent_key).toLowerCase().includes(needle));
    }

    return r.slice(0, 300);
  }, [rows, filter, q]);

  if (loading) return <p>Carregando…</p>;
  if (data?.error) return <pre className="border p-3 rounded">{data.error}</pre>;
  if (!data?.snapshot) return <p>Nenhum snapshot ainda. Faça um upload e processe.</p>;

  const k = data.kpis;

  return (
    <section className="space-y-4">
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
        <Kpi title="Total" value={k.total} />
        <Kpi title="Eligible" value={k.eligible} />
        <Kpi title="Active" value={k.active} />
        <Kpi title="At risk" value={k.at_risk} />
        <Kpi title="Almost" value={k.almost} />
        <Kpi title="In FLQA file" value={k.in_flqa_file} />
        <Kpi title="Qualifies not in FLQA" value={k.qualifies_not_in_flqa} />
        <Kpi title="In FLQA not qualify" value={k.in_flqa_not_qualify} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select className="border rounded px-2 py-1" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">ALL</option>
          <option value="FLA_ONLY">FLA_ONLY</option>
          <option value="FLQA_ELIGIBLE">FLQA_ELIGIBLE</option>
          <option value="FLQA_ACTIVE">FLQA_ACTIVE</option>
          <option value="FLQA_AT_RISK">FLQA_AT_RISK</option>
          <option value="ALMOST_FLQA">ALMOST_FLQA</option>
        </select>

        <input
          className="border rounded px-2 py-1"
          placeholder="search agent_key…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left p-2">agent_key</th>
              <th className="text-left p-2">status</th>
              <th className="text-left p-2">eligible</th>
              <th className="text-left p-2">gci_6m</th>
              <th className="text-left p-2">tx_6m</th>
              <th className="text-left p-2">expires</th>
              <th className="text-left p-2">days</th>
              <th className="text-left p-2">in_fla</th>
              <th className="text-left p-2">in_flqa</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
              <tr key={r.agent_key} className="border-b">
                <td className="p-2 font-mono">{r.agent_key}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.eligible_now ? "yes" : "no"}</td>
                <td className="p-2">{r.gci_6m ?? ""}</td>
                <td className="p-2">{r.tx_6m ?? ""}</td>
                <td className="p-2">{r.flqa_expires ?? ""}</td>
                <td className="p-2">{r.days_to_expire ?? ""}</td>
                <td className="p-2">{r.in_fla ? "yes" : "no"}</td>
                <td className="p-2">{r.in_flqa ? "yes" : "no"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="border rounded p-3">
        <summary className="cursor-pointer">Ver alerts ({(data.alerts ?? []).length})</summary>
        <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(data.alerts ?? [], null, 2)}</pre>
      </details>
    </section>
  );
}

function Kpi({ title, value }: { title: string; value: any }) {
  return (
    <div className="border rounded p-3">
      <div className="text-xs opacity-70">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
