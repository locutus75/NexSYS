/**
 * transaction.ts
 * Transaction history types for NexSYS.
 */

import type { ChainEnvironment, NetworkEnvironment } from "./chain";

export type TxDirection = "SENT" | "RECEIVED" | "BRIDGED" | "INTERNAL" | "UNKNOWN";
export type TxStatus = "PENDING" | "CONFIRMED" | "FAILED";

export interface TransactionEntry {
  txid: string;
  direction: TxDirection;
  status: TxStatus;
  chain: ChainEnvironment;
  network: NetworkEnvironment;
  amount: string;          // SYS decimal string (always positive)
  fee?: string;            // SYS decimal string
  confirmations: number;
  timestamp?: number;      // Unix epoch seconds
  blockHeight?: number;
  address?: string;        // counterparty address
  label?: string;
  bridgeRef?: string;      // bridge operation ID if this is a bridge tx
  comment?: string;
}

/** Filter state for the transaction list. */
export interface TxFilter {
  direction?: TxDirection;
  status?: TxStatus;
  chain?: ChainEnvironment;
  label?: string;
  address?: string;
  fromDate?: number;
  toDate?: number;
}
