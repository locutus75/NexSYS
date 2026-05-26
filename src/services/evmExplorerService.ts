/**
 * services/evmExplorerService.ts
 * Fetches transaction history for EVM chains (NEVM, Rollux) via Blockscout API.
 */

import type { NetworkEnvironment } from "../types/chain";
import { EVM_EXPLORERS } from "../types/network";

export interface EvmTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  confirmations: string;
  isError: string;
  txreceipt_status: string;
  methodId?: string;
  functionName?: string;
  gasUsed: string;
  gasPrice: string;
}

export type EvmChainIdentifier = "SYSCOIN_NEVM" | "ROLLUX" | "ZKSYS";

export async function fetchEvmTransactions(
  chain: EvmChainIdentifier,
  network: NetworkEnvironment,
  address: string,
  page: number = 1,
  offset: number = 50
): Promise<{ ok: boolean; data?: EvmTransaction[]; error?: string }> {
  if (!address) return { ok: false, error: "No EVM address provided" };
  if (chain === "ZKSYS") return { ok: false, error: "zkSYS explorer not available yet" };

  const key = `${chain}_${network}` as keyof typeof EVM_EXPLORERS;
  const baseUrl = EVM_EXPLORERS[key];
  if (!baseUrl) {
    return { ok: false, error: `No explorer URL configured for ${chain} on ${network}` };
  }

  // Blockscout API / Etherscan compatible
  // ?module=account&action=txlist&address={address}&startblock=0&endblock=99999999&page={page}&offset={offset}&sort=desc
  const url = `${baseUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=${offset}&sort=desc`;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`HTTP error ${res.status}`);
    }

    const data = await res.json();
    if (data.status === "1" && Array.isArray(data.result)) {
      return { ok: true, data: data.result as EvmTransaction[] };
    } else if (data.status === "0" && data.message === "No transactions found") {
      return { ok: true, data: [] }; // Not an error, just empty
    } else {
      return { ok: false, error: data.result || data.message || "Unknown explorer error" };
    }
  } catch (err: any) {
    return { ok: false, error: err.message || "Failed to fetch EVM transactions" };
  }
}
