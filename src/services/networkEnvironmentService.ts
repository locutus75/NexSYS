/**
 * networkEnvironmentService.ts
 * Manages the active NetworkEnvironment.
 *
 * - Persists to localStorage per-app (keyed by environment to prevent mixing)
 * - Guards all balance/tx/bridge data behind the active network key
 * - Emits change events via Zustand store (see store/networkStore.ts)
 */

import type { NetworkEnvironment } from "../types/chain";
import type { RpcConfig } from "../types/network";
import { DEFAULT_RPC_CONFIGS } from "../types/network";

const STORAGE_KEY = "nexsys:activeNetwork";

/**
 * Retrieve the last-saved active network from localStorage.
 * Defaults to MAINNET if not set or if stored value is invalid.
 */
export function loadSavedNetwork(): NetworkEnvironment {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isValidNetwork(raw)) {
      return raw as NetworkEnvironment;
    }
  } catch {
    // localStorage unavailable — ignore
  }
  return "MAINNET";
}

/** Persist the active network selection. */
export function saveActiveNetwork(network: NetworkEnvironment): void {
  try {
    localStorage.setItem(STORAGE_KEY, network);
  } catch {
    // ignore
  }
}

const VALID_NETWORKS: NetworkEnvironment[] = ["MAINNET", "TESTNET", "REGTEST", "DEVNET"];

export function isValidNetwork(value: unknown): value is NetworkEnvironment {
  return VALID_NETWORKS.includes(value as NetworkEnvironment);
}

/**
 * Returns the namespaced localStorage key for storing environment-specific data.
 * This prevents any accidental cross-network data leakage.
 *
 * @example
 *   networkKey("MAINNET", "txHistory") // => "nexsys:MAINNET:txHistory"
 */
export function networkKey(network: NetworkEnvironment, subKey: string): string {
  return `nexsys:${network}:${subKey}`;
}

/**
 * Returns the default RPC config for the given network.
 * The user should override username/password in the settings screen.
 */
export function getDefaultRpcConfig(network: NetworkEnvironment): RpcConfig {
  const defaults = DEFAULT_RPC_CONFIGS[network] ?? DEFAULT_RPC_CONFIGS["MAINNET"];
  return {
    host: defaults.host ?? "127.0.0.1",
    port: defaults.port ?? 8370,
    username: "",
    password: "",
    useSsl: defaults.useSsl ?? false,
    walletName: undefined,
    timeoutMs: defaults.timeoutMs ?? 10000,
  };
}

/**
 * Retrieves a persisted RPC config for a specific network from localStorage.
 * Falls back to defaults if nothing is saved.
 * Passwords are stored in localStorage — acceptable for a local desktop app,
 * but we never log or transmit them.
 */
export function loadRpcConfig(network: NetworkEnvironment): RpcConfig {
  try {
    const raw = localStorage.getItem(networkKey(network, "rpcConfig"));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RpcConfig>;
      return { ...getDefaultRpcConfig(network), ...parsed };
    }
  } catch {
    // ignore
  }
  return getDefaultRpcConfig(network);
}

/** Save RPC config for a specific network. */
export function saveRpcConfig(network: NetworkEnvironment, config: RpcConfig): void {
  try {
    // Never log the password field
    localStorage.setItem(networkKey(network, "rpcConfig"), JSON.stringify(config));
  } catch {
    // ignore
  }
}
