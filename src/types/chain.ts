/**
 * chain.ts
 * Core chain and network environment types for NexSYS.
 * All wallet logic must be scoped to a ChainEnvironment + NetworkEnvironment pair.
 */

/** Which Syscoin chain layer a balance, address, or operation belongs to. */
export type ChainEnvironment =
  | "SYSCOIN_NATIVE_UTXO"
  | "SYSCOIN_NEVM"
  | "ROLLUX"
  | "ZKSYS"
  | "UNKNOWN";

/** Which network deployment is active. Must never be mixed silently. */
export type NetworkEnvironment =
  | "MAINNET"
  | "TESTNET"
  | "REGTEST"
  | "DEVNET"
  | "UNKNOWN";

/** Classified address format detected from an address string. */
export type AddressType =
  | "UTXO_LEGACY"      // P2PKH — starts with S (mainnet) or T (testnet)
  | "UTXO_SEGWIT"      // P2SH-P2WPKH — starts with 3 / testnet equiv
  | "UTXO_BECH32"      // Native SegWit bech32 — sys1... / tsys1...
  | "UTXO_TAPROOT"     // Taproot bech32m — sys1p...
  | "EVM_0X"           // 0x-prefixed Ethereum-compatible address
  | "UNKNOWN"
  | "INVALID";

/** Human-readable label for each chain environment. */
export const CHAIN_LABELS: Record<ChainEnvironment, string> = {
  SYSCOIN_NATIVE_UTXO: "Syscoin Native (UTXO)",
  SYSCOIN_NEVM: "Syscoin NEVM",
  ROLLUX: "Rollux",
  ZKSYS: "zkSYS",
  UNKNOWN: "Unknown Chain",
};

/** Human-readable label for each network environment. */
export const NETWORK_LABELS: Record<NetworkEnvironment, string> = {
  MAINNET: "Mainnet",
  TESTNET: "Testnet",
  REGTEST: "Regtest",
  DEVNET: "Devnet",
  UNKNOWN: "Unknown Network",
};

/** Badge colour class per network — drives the visual network badge in the UI. */
export const NETWORK_BADGE_VARIANT: Record<NetworkEnvironment, "mainnet" | "testnet" | "regtest" | "devnet" | "unknown"> = {
  MAINNET: "mainnet",
  TESTNET: "testnet",
  REGTEST: "regtest",
  DEVNET: "devnet",
  UNKNOWN: "unknown",
};
