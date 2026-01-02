export function agentKeyFromRow(row: Record<string, any>) {
  // prefer Agent ID if present
  const agentId =
    row.agent_id ?? row.agentId ?? row["Agent ID"] ?? row["agent id"] ?? null;

  if (agentId) return String(agentId).trim();

  // fallback email
  const email = row.email ?? row.Email ?? row["E-mail"] ?? null;
  if (email) return `email:${String(email).trim().toLowerCase()}`;

  // last-resort: name + market (can collide; ok for MVP demo)
  const name = row.full_name ?? row.name ?? row["Full Name"] ?? row["Name"] ?? "";
  const market = row.market ?? row.office ?? row["Market"] ?? row["Office"] ?? "";
  const key = `${String(name).trim().toLowerCase()}|${String(market).trim().toLowerCase()}`;
  return `nm:${key}`;
}
