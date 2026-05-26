/**
 * services/evmRpcClient.ts
 * Lightweight EVM balance fetcher — no ethers.js dependency.
 * Uses raw eth_getBalance JSON-RPC calls against public endpoints.
 * These endpoints have CORS headers enabled, so plain fetch() works fine.
 */

export interface EvmBalance {
  wei: bigint;
  sys: string;   // formatted to 6 decimal places
  raw: string;   // full 18-decimal string
}

// ── Public RPC endpoints ──────────────────────────────────────────────────────

import { ethers } from "ethers";

export const DEFAULT_EVM_RPC: Record<string, { nevm: string; rollux: string; zksys: string }> = {
  MAINNET: {
    nevm:   "https://rpc.syscoin.org",
    rollux: "https://rpc.rollux.com",
    zksys:  "",
  },
  TESTNET: {
    nevm:   "https://rpc.tanenbaum.io",
    rollux: "",
    zksys:  "https://rpc-zk.tanenbaum.io/",
  },
  REGTEST:  { nevm: "", rollux: "", zksys: "" },
  DEVNET:   { nevm: "", rollux: "", zksys: "" },
};

// ── Configuration Getter ────────────────────────────────────────────────────────

export function getEvmRpcEndpoints(network: string): { nevm: string; rollux: string; zksys: string } {
  const defaults = DEFAULT_EVM_RPC[network] ?? DEFAULT_EVM_RPC.MAINNET;
  if (typeof window === "undefined" || !window.localStorage) {
    return defaults;
  }
  try {
    const saved = localStorage.getItem(`nexsys_rpc_config_${network}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      return { ...defaults, ...parsed };
    }
  } catch (e) {
    console.error("Failed to parse custom RPC config:", e);
  }
  return defaults;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert hex wei string (e.g. "0x1a2b...") to a human-readable SYS string. */
function weiHexToSys(hex: string): EvmBalance {
  const wei = BigInt(hex);
  // 1 SYS = 10^18 wei
  const whole   = wei / BigInt(1e18);
  const frac    = wei % BigInt(1e18);
  // 6 decimal places
  const fracStr = frac.toString().padStart(18, "0").slice(0, 6);
  // Remove trailing zeros
  const fracTrimmed = fracStr.replace(/0+$/, "") || "0";
  const raw = `${whole}.${frac.toString().padStart(18, "0")}`;
  const sys = fracTrimmed === "0" ? `${whole}` : `${whole}.${fracTrimmed}`;
  return { wei, sys, raw };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchEvmBalance(
  rpcUrl: string,
  address: string,
  signal?: AbortSignal
): Promise<EvmBalance> {
  if (!rpcUrl) throw new Error("No RPC URL configured for this network.");
  if (!address.startsWith("0x") || address.length !== 42) {
    throw new Error("Invalid 0x address.");
  }

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "eth_getBalance",
    params: [address, "latest"],
  });

  let fetchUrl = rpcUrl;
  const isBrowserDev = typeof window !== "undefined" && !(window as any).__TAURI__;
  if (isBrowserDev) {
    fetchUrl = `${window.location.origin}/rpc-proxy?target=${encodeURIComponent(rpcUrl)}`;
  }

  const res = await fetch(fetchUrl, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "EVM RPC error");

  return weiHexToSys(json.result);
}

/** Fetch NEVM + Rollux balances in parallel. Returns null on failure. */
export async function fetchAllEvmBalances(
  network: string,
  address: string,
  signal?: AbortSignal
): Promise<{ nevm: EvmBalance | null; rollux: EvmBalance | null; zksys: EvmBalance | null; errors: string[] }> {
  const endpoints = getEvmRpcEndpoints(network);
  const errors: string[] = [];

  const [nevmResult, rolluxResult, zksysResult] = await Promise.allSettled([
    endpoints.nevm   ? fetchEvmBalance(endpoints.nevm,   address, signal) : Promise.reject(new Error("No NEVM endpoint")),
    endpoints.rollux ? fetchEvmBalance(endpoints.rollux, address, signal) : Promise.reject(new Error("No Rollux endpoint")),
    endpoints.zksys  ? fetchEvmBalance(endpoints.zksys,  address, signal) : Promise.reject(new Error("No zkSYS endpoint")),
  ]);

  const nevm   = nevmResult.status   === "fulfilled" ? nevmResult.value   : (errors.push(`NEVM: ${nevmResult.reason?.message}`),   null);
  const rollux = rolluxResult.status === "fulfilled" ? rolluxResult.value : (errors.push(`Rollux: ${rolluxResult.reason?.message}`), null);
  const zksys  = zksysResult.status  === "fulfilled" ? zksysResult.value  : (errors.push(`zkSYS: ${zksysResult.reason?.message}`), null);

  return { nevm, rollux, zksys, errors };
}

/**
 * Sends a native SYS (ETH-equivalent) transaction on the specified EVM chain.
 * Uses ethers.js internally.
 */
export async function sendEvmTransaction(
  network: string,
  chain: "SYSCOIN_NEVM" | "ROLLUX" | "ZKSYS",
  toAddress: string,
  amountInSys: string,
  privateKey: string
): Promise<string> {
  const endpoints = getEvmRpcEndpoints(network);
  let rpcUrl = "";
  if (chain === "SYSCOIN_NEVM") rpcUrl = endpoints.nevm;
  else if (chain === "ROLLUX") rpcUrl = endpoints.rollux;
  else if (chain === "ZKSYS") rpcUrl = endpoints.zksys;

  if (!rpcUrl) {
    throw new Error(`No RPC URL configured for ${chain} on ${network}`);
  }

  let finalUrl = rpcUrl;
  const isBrowserDev = typeof window !== "undefined" && !(window as any).__TAURI__;
  if (isBrowserDev) {
    finalUrl = `${window.location.origin}/rpc-proxy?target=${encodeURIComponent(rpcUrl)}`;
  }

  let networkData: ethers.Networkish | undefined;
  if (network === "TESTNET") {
    if (chain === "ROLLUX") networkData = { name: "rollux-testnet", chainId: 57000 };
    else if (chain === "ZKSYS") networkData = { name: "zksys-testnet", chainId: 57057 };
    else if (chain === "SYSCOIN_NEVM") networkData = { name: "nevm-testnet", chainId: 5700 };
  } else if (network === "MAINNET") {
    if (chain === "ROLLUX") networkData = { name: "rollux-mainnet", chainId: 570 };
    else if (chain === "ZKSYS") networkData = { name: "zksys-mainnet", chainId: 57057 }; // Placeholder for future mainnet
    else if (chain === "SYSCOIN_NEVM") networkData = { name: "nevm-mainnet", chainId: 57 };
  }

  const provider = new ethers.JsonRpcProvider(finalUrl, networkData, { staticNetwork: true });
  
  // Ensure the private key is properly formatted
  const formattedKey = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
  const wallet = new ethers.Wallet(formattedKey, provider);

  const amountWei = ethers.parseEther(amountInSys);

  try {
    const tx = await wallet.sendTransaction({
      to: toAddress,
      value: amountWei,
    });
    return tx.hash;
  } catch (err: any) {
    if (err.message && err.message.includes("Failed to fetch")) {
      throw new Error(
        "Network connection failed. This can happen if the RPC node is offline, or if you don't have enough extra SYS to cover the gas fee (which causes the node to reject the transaction)."
      );
    }
    // Also catch typical insufficient funds from ethers
    if (err.code === "INSUFFICIENT_FUNDS") {
      throw new Error("Insufficient funds to cover the amount + gas fee.");
    }
    throw err;
  }
}
