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

export const EVM_RPC: Record<string, { nevm: string; rollux: string }> = {
  MAINNET: {
    nevm:   "https://rpc.syscoin.org",
    rollux: "https://rpc.rollux.com",
  },
  TESTNET: {
    nevm:   "https://rpc.tanenbaum.io",
    rollux: "https://rpc-tanenbaum.rollux.com",
  },
  REGTEST:  { nevm: "", rollux: "" },
  DEVNET:   { nevm: "", rollux: "" },
};

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

  const res = await fetch(rpcUrl, {
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
): Promise<{ nevm: EvmBalance | null; rollux: EvmBalance | null; errors: string[] }> {
  const endpoints = EVM_RPC[network] ?? EVM_RPC.MAINNET;
  const errors: string[] = [];

  const [nevmResult, rolluxResult] = await Promise.allSettled([
    endpoints.nevm   ? fetchEvmBalance(endpoints.nevm,   address, signal) : Promise.reject(new Error("No NEVM endpoint")),
    endpoints.rollux ? fetchEvmBalance(endpoints.rollux, address, signal) : Promise.reject(new Error("No Rollux endpoint")),
  ]);

  const nevm   = nevmResult.status   === "fulfilled" ? nevmResult.value   : (errors.push(`NEVM: ${nevmResult.reason?.message}`),   null);
  const rollux = rolluxResult.status === "fulfilled" ? rolluxResult.value : (errors.push(`Rollux: ${rolluxResult.reason?.message}`), null);

  return { nevm, rollux, errors };
}
