export type ImportType = "FLA" | "FLQA";

function toNumber(v: any): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[$,]/g, "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toInt(v: any): number | null {
  const n = toNumber(v);
  if (n == null) return null;
  return Math.trunc(n);
}

function toDate(v: any): string | null {
  if (!v) return null;
  const s = String(v).trim();
  if (!s) return null;
  // accept YYYY-MM-DD; otherwise return as-is (MVP)
  return s;
}

export function normalizeRow(type: ImportType, row: Record<string, string>) {
  // Adjust these mappings to your real headers (we keep broad aliases)
  const agent_id =
    row["Agent ID"] || row["agent_id"] || row["AgentId"] || row["ID"] || null;

  const email = row["Email"] || row["email"] || row["E-mail"] || null;
  const full_name =
    row["Full Name"] || row["Name"] || row["full_name"] || row["Agent Name"] || null;

  const market =
    row["Market"] || row["Office"] || row["Region"] || row["market"] || null;

  const gci_6m =
    toNumber(row["GCI Sum (6 Month)"]) ??
    toNumber(row["GCI 6M"]) ??
    toNumber(row["gci_6m"]);

  const tx_6m =
    toInt(row["Transaction Count (6 Month)"]) ??
    toInt(row["Transactions 6M"]) ??
    toInt(row["tx_6m"]);

  const flqa_expires =
    toDate(row["FLQA Expires"]) ??
    toDate(row["flqa_expires"]);

  return {
    type,
    agent_id,
    email,
    full_name,
    market,
    gci_6m,
    tx_6m,
    flqa_expires,
    raw: row,
  };
}
