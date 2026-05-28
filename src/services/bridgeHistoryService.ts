/**
 * services/bridgeHistoryService.ts
 * Local bridge history — persisted in localStorage per network.
 * Tracks status of all bridge attempts initiated from NexSYS.
 */

import type { ChainEnvironment, NetworkEnvironment } from "../types/chain";

// ── Types ─────────────────────────────────────────────────────────────────────

export type BridgeStatus =
  | "draft"
  | "awaiting_signing"
  | "submitted"
  | "confirming_source"
  | "waiting_bridge"
  | "waiting_spv"
  | "stopped_polling"
  | "released"
  | "completed"
  | "failed"
  | "needs_review";

export interface BridgeRecord {
  id: string;
  timestamp: number;           // unix ms
  network: NetworkEnvironment;
  sourceChain: ChainEnvironment;
  destChain: ChainEnvironment;
  amount: string;              // SYS amount as string
  destAddress: string;
  txid?: string;               // source chain txid
  destTxid?: string;           // destination chain txid
  status: BridgeStatus;
  statusMessage?: string;
  externalLink?: string;       // link to external tracker
  isConversion?: boolean;      // whether this is a conversion step (SYS -> SYSX)
}

// ── Status display helpers ────────────────────────────────────────────────────

export const BRIDGE_STATUS_LABELS: Record<BridgeStatus, string> = {
  draft:            "Draft",
  awaiting_signing: "Awaiting Signing",
  submitted:        "Submitted",
  confirming_source:"Confirming (source chain)",
  waiting_bridge:   "Waiting for Bridge",
  waiting_spv:      "In progress...",
  stopped_polling:  "Polling Stopped",
  released:         "Released on Destination",
  completed:        "Completed ✓",
  failed:           "Failed",
  needs_review:     "Needs Manual Review",
};

export const BRIDGE_STATUS_COLOR: Record<BridgeStatus, string> = {
  draft:            "muted",
  awaiting_signing: "warn",
  submitted:        "warn",
  confirming_source:"warn",
  waiting_bridge:   "warn",
  waiting_spv:      "warn",
  stopped_polling:  "muted",
  released:         "success",
  completed:        "success",
  failed:           "danger",
  needs_review:     "danger",
};

// ── Persistence ───────────────────────────────────────────────────────────────

function storageKey(network: NetworkEnvironment) {
  return `nexsys_bridge_history_${network}`;
}

export function loadBridgeHistory(network: NetworkEnvironment): BridgeRecord[] {
  try {
    const records: BridgeRecord[] = JSON.parse(localStorage.getItem(storageKey(network)) ?? "[]");
    return records.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

function saveBridgeHistory(network: NetworkEnvironment, records: BridgeRecord[]) {
  localStorage.setItem(storageKey(network), JSON.stringify(records));
}

export function addBridgeRecord(network: NetworkEnvironment, record: BridgeRecord): void {
  const existing = loadBridgeHistory(network);
  saveBridgeHistory(network, [record, ...existing]);
}

export function updateBridgeRecord(
  network: NetworkEnvironment,
  id: string,
  patch: Partial<BridgeRecord>
): void {
  const records = loadBridgeHistory(network);
  const updated = records.map(r => r.id === id ? { ...r, ...patch } : r);
  saveBridgeHistory(network, updated);
}

export function deleteBridgeRecord(network: NetworkEnvironment, id: string): void {
  const records = loadBridgeHistory(network).filter(r => r.id !== id);
  saveBridgeHistory(network, records);
}

/** Generate a short unique ID for a bridge record. */
export function makeBridgeId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}
