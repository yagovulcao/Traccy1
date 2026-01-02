import type { SnapshotAgentRow } from "./snapshots.types";

export type DiffEvent =
  | "BECAME_ELIGIBLE"
  | "LOST_ELIGIBLE"
  | "STATUS_CHANGED";

export function diffSnapshots(prev: SnapshotAgentRow[], next: SnapshotAgentRow[]) {
  const prevMap = new Map(prev.map((r) => [r.agent_key, r]));
  const events: Array<{ agent_key: string; event: DiffEvent; prev?: any; next?: any }> = [];

  for (const n of next) {
    const p = prevMap.get(n.agent_key);

    if (!p) continue;

    if (!p.eligible_now && n.eligible_now) {
      events.push({ agent_key: n.agent_key, event: "BECAME_ELIGIBLE", prev: p, next: n });
      continue;
    }
    if (p.eligible_now && !n.eligible_now) {
      events.push({ agent_key: n.agent_key, event: "LOST_ELIGIBLE", prev: p, next: n });
      continue;
    }
    if (p.status !== n.status) {
      events.push({ agent_key: n.agent_key, event: "STATUS_CHANGED", prev: p, next: n });
    }
  }

  return events;
}
