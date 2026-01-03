"use client";

import { useEffect, useMemo, useState } from "react";

type ImportType = "FLA" | "FLQA";
type FilterType = "ALL" | "FLA" | "FLQA" | "AT_RISK" | "ALMOST";

export default function DashboardClient({ type }: { type: ImportType }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("ALL");
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

    switch (filter) {
      case "FLA":
        r = r.filter((x: any) => x.__okta?.okta_fla_total);
        break;
      case "FLQA":
        r = r.filter((x: any) => x.__okta?.okta_flqa_total);
        break;
      case "AT_RISK":
        r = r.filter((x: any) => x.__okta?.okta_at_risk);
        break;
      case "ALMOST":
        r = r.filter((x: any) => x.__okta?.okta_almost);
        break;
      case "ALL":
      default:
        r = r.filter(
          (x: any) =>
            x.__okta?.okta_fla_total ||
            x.__okta?.okta_flqa_total ||
            x.__okta?.okta_at_risk ||
            x.__okta?.okta_almost
        );
    }

    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      r = r.filter((x: any) => {
        const hay = [
          x.full_name,
          x.agent_id,
          x.email,
          x.market,
          x.agent_key,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return hay.includes(needle);
      });
    }

    return r.slice(0, 300);
  }, [rows, filter, q]);

  if (loading) return <p>Carregando…</p>;
  if (data?.error) return <pre className="border p-3 rounded">{data.error}</pre>;
  if (!data?.snapshot) return <p>Nenhum snapshot ainda. Faça um upload e processe.</p>;

  const k = data.kpis;

  return (
    <section className="space-y-4">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}
      >
        <Kpi title="FLA Total" value={k.fla_total} />
        <Kpi title="FLQA Total" value={k.flqa_total} />
        <Kpi title="FLQA At Risk" value={k.flqa_at_risk} />
        <Kpi title="Almost FLQA" value={k.almost_flqa} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          className="border rounded px-2 py-1"
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
        >
          <option value="ALL">All</option>
          <option value="FLA">FLA</option>
          <option value="FLQA">FLQA</option>
          <option value="AT_RISK">At Risk</option>
          <option value="ALMOST">Almost FLQA</option>
        </select>

        <input
          className="border rounded px-2 py-1"
          placeholder="search name, id, email, market…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="border rounded overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b">
            <tr>
              <th className="text-left p-2">Nome</th>
              <th className="text-left p-2">Agent ID</th>
              <th className="text-left p-2">Status</th>
              <th className="text-left p-2">GCI (6M)</th>
              <th className="text-left p-2">TX (6M)</th>
              <th className="text-left p-2">Expires</th>
              <th className="text-left p-2">Days</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
              <tr key={r.agent_key} className="border-b">
                <td className="p-2">
                  <div className="font-medium">{r.full_name ?? "—"}</div>
                  <div className="text-xs opacity-70 font-mono">{r.agent_key}</div>
                </td>
                <td className="p-2 font-mono">{r.agent_id ?? "—"}</td>
                <td className="p-2">
                  {r.__okta?.okta_at_risk
                    ? "FLQA • At Risk"
                    : r.__okta?.okta_flqa_total
                    ? "FLQA"
                    : r.__okta?.okta_almost
                    ? "FLA • Almost"
                    : "FLA"}
                </td>
                <td className="p-2">{r.gci_6m ?? ""}</td>
                <td className="p-2">{r.tx_6m ?? ""}</td>
                <td className="p-2">{r.flqa_expires ?? ""}</td>
                <td className="p-2">{r.days_to_expire ?? ""}</td>
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
