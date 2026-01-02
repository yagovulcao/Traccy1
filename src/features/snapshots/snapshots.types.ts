export type SnapshotAgentRow = {
  agent_key: string;
  status: string;
  eligible_now: boolean;
  gci_6m: number | null;
  tx_6m: number | null;
};
