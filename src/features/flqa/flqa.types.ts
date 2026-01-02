export type FlqaStatus =
  | "FLA_ONLY"
  | "FLQA_ELIGIBLE"
  | "FLQA_ACTIVE"
  | "FLQA_AT_RISK"
  | "ALMOST_FLQA";

export type FlqaComputed = {
  eligible_now: boolean;
  status: FlqaStatus;
  missing_gci: number;
  missing_tx: number;
  days_to_expire: number | null;
};
