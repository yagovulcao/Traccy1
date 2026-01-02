import { computeFlqa } from "./flqa.rules";

export function applyFlqaToNormalizedRow(row: {
  gci_6m: number | null;
  tx_6m: number | null;
  flqa_expires: string | null;
}) {
  return computeFlqa(row.gci_6m, row.tx_6m, row.flqa_expires);
}
