/**
 * wallet.ts
 * Wallet-level data structures for NexSYS.
 */

import type { ChainEnvironment, NetworkEnvironment } from "./chain";

/** Balance for a specific chain + network pair. All amounts are string-formatted SYS. */
export interface WalletBalance {
  chain: ChainEnvironment;
  network: NetworkEnvironment;
  /** Confirmed spendable balance (SYS as decimal string) */
  confirmed: string;
  /** Unconfirmed / mempool balance */
  unconfirmed: string;
  /** Locked/frozen balance (node collateral, frozen UTXOs) */
  locked?: string;
  /** Net spendable = confirmed - locked */
  spendable?: string;
}

/** A single unspent transaction output. */
export interface UtxoEntry {
  txid: string;
  vout: number;
  amount: string;          // SYS decimal string
  confirmations: number;
  address?: string;
  label?: string;
  frozen?: boolean;
  reservedForNode?: boolean;
  scriptPubKey?: string;
}

/** General wallet metadata returned by getwalletinfo. */
export interface WalletInfo {
  walletName: string;
  walletVersion: number;
  format: string;
  balance: string;
  unconfirmedBalance: string;
  immatureBalance: string;
  txCount: number;
  keypoolSize: number;
  encrypted: boolean;
  unlocked: boolean;
  network: NetworkEnvironment;
}

/** Backup and security status. */
export interface SecurityStatus {
  encrypted: boolean;
  unlocked: boolean;
  backupExists: boolean;
  lastBackupDate?: string;
  watchOnly: boolean;
  hardwareWallet: boolean;
  apiPermissionsEnabled: boolean;
  warnings: string[];
}
