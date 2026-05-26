/**
 * network.ts
 * Node status and network-level types for NexSYS.
 */

import type { NetworkEnvironment } from "./chain";

/** Full node status from getblockchaininfo + getnetworkinfo. */
export interface NodeStatus {
  running: boolean;
  version: string;
  protocolVersion: number;
  network: NetworkEnvironment;
  chain: string;             // raw chain string from RPC (e.g. "main", "test", "regtest")
  blocks: number;
  headers: number;
  syncProgress: number;      // 0.0 – 1.0
  peers: number;
  mempoolSize: number;
  diskUsageBytes?: number;
  pruned: boolean;
  warnings: string;
  lastBlockTime?: number;    // Unix epoch
  rpcAvailable: boolean;
}

/** zkSYS chain environment status. */
export type ZkSysAvailabilityStatus =
  | "NOT_CONFIGURED"
  | "AVAILABLE"
  | "SYNCING"
  | "PROVING"
  | "DEGRADED"
  | "UNKNOWN";

export interface ZkSysStatus {
  network: NetworkEnvironment;
  available: boolean;
  status: ZkSysAvailabilityStatus;
  lastUpdated?: string;
  notes?: string[];
}

/** RPC connection configuration. Supports local and remote nodes. */
export interface RpcConfig {
  host: string;       // e.g. "127.0.0.1" or remote IP/hostname
  port: number;       // default 8370 mainnet, 18370 testnet
  username: string;
  password: string;   // never logged, never exposed via API
  useSsl: boolean;
  walletName?: string; // optional named wallet
  timeoutMs: number;
}

/** Default RPC configs per network. User can override any field. */
export const DEFAULT_RPC_CONFIGS: Record<string, Partial<RpcConfig>> = {
  MAINNET: { host: "127.0.0.1", port: 8370, useSsl: false, timeoutMs: 10000 },
  TESTNET: { host: "127.0.0.1", port: 18370, useSsl: false, timeoutMs: 10000 },
  REGTEST: { host: "127.0.0.1", port: 18443, useSsl: false, timeoutMs: 5000 },
};

/** EVM public RPC endpoints. Read-only for balance queries. */
export const EVM_PUBLIC_RPCS = {
  SYSCOIN_NEVM_MAINNET: "https://rpc.syscoin.org",
  SYSCOIN_NEVM_TESTNET: "https://rpc.tanenbaum.io",
  ROLLUX_MAINNET: "https://rpc.rollux.com",
  ROLLUX_TESTNET: "",
} as const;

/** EVM Blockscout Explorer APIs for transaction history */
export const EVM_EXPLORERS = {
  SYSCOIN_NEVM_MAINNET: "https://explorer.syscoin.org/api",
  SYSCOIN_NEVM_TESTNET: "https://explorer.tanenbaum.io/api",
  ROLLUX_MAINNET: "https://explorer.rollux.com/api",
  ROLLUX_TESTNET: "https://rollux.tanenbaum.io/api",
} as const;
