/**
 * bridge.ts
 * Bridge operation types for NexSYS.
 * Covers UTXO ↔ NEVM ↔ Rollux ↔ zkSYS bridge states.
 */

import type { ChainEnvironment, NetworkEnvironment } from "./chain";

export type BridgeStatus =
  | "DRAFT"
  | "AWAITING_SIGNING"
  | "SUBMITTED"
  | "CONFIRMING_SOURCE"
  | "PROCESSING"
  | "RELEASED"
  | "COMPLETED"
  | "FAILED"
  | "NEEDS_REVIEW";

export interface BridgeOperation {
  id: string;
  network: NetworkEnvironment;
  sourceChain: ChainEnvironment;
  destinationChain: ChainEnvironment;
  asset: string;           // e.g. "SYS"
  amount: string;          // decimal string
  sourceAddress?: string;
  destinationAddress?: string;
  sourceTxid?: string;
  destinationTxid?: string;
  estimatedFee?: string;
  estimatedTimeSeconds?: number;
  status: BridgeStatus;
  createdAt: number;       // Unix epoch seconds
  updatedAt: number;
  errorMessage?: string;
}

/** Human-readable label for each bridge status. */
export const BRIDGE_STATUS_LABELS: Record<BridgeStatus, string> = {
  DRAFT: "Draft",
  AWAITING_SIGNING: "Awaiting signing",
  SUBMITTED: "Submitted",
  CONFIRMING_SOURCE: "Confirming on source chain",
  PROCESSING: "Bridge processing",
  RELEASED: "Released on destination",
  COMPLETED: "Completed",
  FAILED: "Failed",
  NEEDS_REVIEW: "Needs manual review",
};
