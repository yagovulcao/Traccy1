import type { FlqaComputed, FlqaStatus } from "./flqa.types";

const GCI_MIN = 5000;
const TX_MIN = 2;

// UI/product thresholds (not the official rule)
const ALMOST_GCI_HINT = 3500;
const RISK_DAYS = 30;

function daysBetween(today: Date, dateStr: string): number | null {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - today.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function computeFlqa(
  gci6m: number | null,
  tx6m: number | null,
  flqaExpires: string | null,
  today = new Date()
): FlqaComputed {
  const gci = gci6m ?? 0;
  const tx = tx6m ?? 0;

  const eligible_now = gci >= GCI_MIN || tx >= TX_MIN;

  const missing_gci = Math.max(0, GCI_MIN - gci);
  const missing_tx = Math.max(0, TX_MIN - tx);

  const dte = flqaExpires ? daysBetween(today, flqaExpires) : null;

  let status: FlqaStatus = "FLA_ONLY";

  if (eligible_now) {
    // If you want "ACTIVE" strictly by rule, keep it as FLQA_ELIGIBLE only.
    // If you want to use expires as "active until", keep ACTIVE when expires exists & not past.
    const stillActiveByExpires = dte != null && dte >= 0;

    status = stillActiveByExpires ? "FLQA_ACTIVE" : "FLQA_ELIGIBLE";

    if (stillActiveByExpires && dte <= RISK_DAYS) {
      status = "FLQA_AT_RISK";
    }
  } else {
    const almost = tx === 1 || gci >= ALMOST_GCI_HINT;
    if (almost) status = "ALMOST_FLQA";
  }

  return {
    eligible_now,
    status,
    missing_gci,
    missing_tx,
    days_to_expire: dte,
  };
}
