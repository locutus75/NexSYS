/**
 * syscoinRpcClient.ts
 * Thin, typed JSON-RPC wrapper for Syscoin Core.
 *
 * In Tauri: all calls are proxied through Rust via invoke("rpc_call").
 * This bypasses the browser's CORS restrictions entirely — Syscoin Core
 * does not send CORS headers, so fetch() from the webview would be blocked.
 *
 * In browser / test environments: falls back to direct fetch() (useful for
 * local nodes accessible without CORS, or for Vitest mocking).
 *
 * Never hard-codes credentials. Never logs passwords.
 */

import type { RpcConfig } from "../types/network";

// -----------------------------------------------------------------------
// Tauri detection + invoke bootstrap
// -----------------------------------------------------------------------

// Lazily-resolved invoke function from @tauri-apps/api/core.
// Set to `false` after first failed import to avoid retrying.
let _invoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null | false = null;

async function getInvoke(): Promise<((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | false> {
  if (_invoke !== null) return _invoke;
  try {
    const { invoke, isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      console.log("[RPC] Running inside Tauri webview — using native invoke");
      _invoke = invoke;
    } else {
      console.log("[RPC] Not in Tauri webview — using browser fetch fallback");
      _invoke = false;
    }
  } catch (e) {
    console.warn("[RPC] @tauri-apps/api/core import failed:", e);
    _invoke = false;
  }
  return _invoke;
}

/** True when running inside the Tauri native window (not a regular browser). */
async function isInTauri(): Promise<boolean> {
  const fn = await getInvoke();
  return fn !== false;
}

// -----------------------------------------------------------------------
// Error types
// -----------------------------------------------------------------------

export class RpcError extends Error {
  public code: number;
  public data?: unknown;

  constructor(message: string, code: number, data?: unknown) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    this.data = data;
  }
}

export class RpcConnectionError extends Error {
  public cause?: unknown;

  constructor(host: string, port: number, cause?: unknown) {
    super(`Cannot connect to Syscoin Core RPC at ${host}:${port}`);
    this.name = "RpcConnectionError";
    this.cause = cause;
  }
}

// -----------------------------------------------------------------------
// Result type
// -----------------------------------------------------------------------

export type RpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RpcError | RpcConnectionError | Error };

// -----------------------------------------------------------------------
// Raw RPC call
// -----------------------------------------------------------------------

// -----------------------------------------------------------------------
// Raw RPC call — routes through Rust in Tauri, falls back to fetch
// -----------------------------------------------------------------------

interface TauriRpcResponse {
  ok: boolean;
  result?: unknown;
  error?: string;
}

async function rpcCall<T>(
  config: RpcConfig,
  method: string,
  params: unknown[] = []
): Promise<RpcResult<T>> {
  const protocol = config.useSsl ? "https" : "http";
  const url = `${protocol}://${config.host}:${config.port}/`;

  const inTauri = await isInTauri();
  console.log(`[RPC] ${method} → ${url} (Tauri: ${inTauri})`);

  // ── Tauri path (CORS-free via Rust reqwest) ─────────────────────────
  if (inTauri) {
    const invoke = await getInvoke() as (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    try {
      console.log("[RPC] Calling invoke rpc_call:", { url, username: config.username, method, params });
      const resp = await invoke("rpc_call", {
        req: {
          url,
          username: config.username,
          password: config.password,
          method,
          params,
          wallet_name: config.walletName ?? null,
          timeout_ms: config.timeoutMs ?? 10000,
        },
      }) as TauriRpcResponse;

      console.log("[RPC] Rust response:", resp);

      if (!resp.ok) {
        console.warn("[RPC] Rust returned error:", resp.error);
        const errMsg = resp.error ?? "Unknown RPC error";
        if (errMsg.startsWith("Connection error") || errMsg.startsWith("HTTP client build") || errMsg.startsWith("JSON parse error")) {
          return { ok: false, error: new RpcConnectionError(config.host, config.port, new Error(errMsg)) };
        }
        return { ok: false, error: new RpcError(errMsg, -1) };
      }
      return { ok: true, value: resp.result as T };
    } catch (err) {
      console.error("[RPC] invoke threw:", err);
      return { ok: false, error: new RpcConnectionError(config.host, config.port, err) };
    }
  }

  // ── Browser fallback: use Vite dev proxy (/rpc-proxy) ──────────────────
  // Vite proxies /rpc-proxy → http://<node-host>:<port>/ server-side,
  // so there are no CORS issues even in browser dev mode.
  const walletPath = config.walletName ? `/wallet/${encodeURIComponent(config.walletName)}` : "";
  const fetchUrl = `/rpc-proxy${walletPath}?target=${encodeURIComponent(url)}`;
  console.log(`[RPC] Browser fallback — fetching via Vite proxy: ${fetchUrl}`);
  console.warn("[RPC] ⚠️ You are NOT in the Tauri window. For full functionality launch the app with: pnpm tauri dev");
  const body = JSON.stringify({
    jsonrpc: "1.0",
    id: Date.now(),
    method,
    params,
  });
  const auth = btoa(`${config.username}:${config.password}`);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? 10000);

    let response: Response;
    try {
      response = await fetch(fetchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${auth}`,
        },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const json = await response.json();
    if (json.error) {
      return {
        ok: false,
        error: new RpcError(json.error.message, json.error.code, json.error.data),
      };
    }
    return { ok: true, value: json.result as T };
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        error: new RpcConnectionError(
          config.host,
          config.port,
          new Error(`RPC call timed out after ${config.timeoutMs}ms`)
        ),
      };
    }
    return {
      ok: false,
      error: new RpcConnectionError(config.host, config.port, err),
    };
  }
}

// -----------------------------------------------------------------------
// Typed RPC methods
// -----------------------------------------------------------------------

/** Raw types from Syscoin Core JSON-RPC — minimal, extend as needed. */
export interface RawBlockchainInfo {
  chain: string;
  blocks: number;
  headers: number;
  bestblockhash: string;
  difficulty: number;
  verificationprogress: number;
  pruned: boolean;
  warnings: string;
}

export interface RawNetworkInfo {
  version: number;
  subversion: string;
  protocolversion: number;
  connections: number;
  warnings: string;
}

export interface RawWalletInfo {
  walletname: string;
  walletversion: number;
  format: string;
  balance: number;
  unconfirmed_balance: number;
  immature_balance: number;
  txcount: number;
  keypoolsize: number;
  unlocked_until?: number;
  paytxfee: number;
}

export interface RawBalances {
  mine: {
    trusted: number;
    untrusted_pending: number;
    immature: number;
  };
  watchonly?: {
    trusted: number;
    untrusted_pending: number;
    immature: number;
  };
}

export interface RawTransaction {
  txid: string;
  address?: string;
  category: "send" | "receive" | "immature" | "generate";
  amount: number;
  fee?: number;
  confirmations: number;
  time: number;
  timereceived: number;
  blockhash?: string;
  blockheight?: number;
  label?: string;
  comment?: string;
}

export interface RawUtxo {
  txid: string;
  vout: number;
  address?: string;
  label?: string;
  scriptPubKey: string;
  amount: number;
  confirmations: number;
  spendable: boolean;
  solvable: boolean;
  safe: boolean;
  locked?: boolean;
}

export interface RawReceivedAddress {
  address: string;
  amount: number;
  confirmations: number;
  label: string;
  txids: string[];
}

export interface RawMempoolInfo {
  loaded: boolean;
  size: number;
  bytes: number;
  usage: number;
  mempoolminfee: number;
  minrelaytxfee: number;
}

export interface RawFeeEstimate {
  feerate?: number;  // BTC/kB (same unit as SYS/kB)
  errors?: string[];
  blocks: number;    // how many blocks the estimate is for
}

export interface RawWalletInfoFull extends RawWalletInfo {
  /** Present when wallet is encrypted. 0 = locked, >0 = unlocked until unix ts. */
  unlocked_until?: number;
  /** HD seed present */
  hdseedid?: string;
  /** Descriptor wallet vs legacy */
  descriptors?: boolean;
  keypoolsize_hd_internal?: number;
}

/** State detail inside masternode status response. */
export interface RawMasternodeDmnState {
  registeredHeight?: number;
  lastPaidHeight?: number;
  nextPaymentHeight?: number;
  operatorReward?: number;
  service?: string;
  ownerAddress?: string;
  votingAddress?: string;
  payoutAddress?: string;
  confirmedHash?: string;
}

/** Response from `masternode status`. */
export interface RawMasternodeStatus {
  outpoint?: string;           // "txid-vout"
  service?: string;            // "ip:port"
  proTxHash?: string;
  collateralHash?: string;
  collateralIndex?: number;
  dmnState?: RawMasternodeDmnState;
  state?: string;              // "READY", "WAITING_FOR_PROTX", etc.
  status?: string;             // human-readable
}

/** Response from `mnsync status`. */
export interface RawMnSyncStatus {
  AssetID: number;
  AssetName: string;          // "MASTERNODE_SYNC_FINISHED" etc.
  AssetStartTime: number;
  Attempt: number;
  IsBlockchainSynced: boolean;
  IsSynced: boolean;
}

/** Response from `masternode count`. */
export interface RawMasternodeCount {
  total: number;
  enabled: number;
  qualify?: number;
}

// -----------------------------------------------------------------------
// Public client class
// -----------------------------------------------------------------------

export class SyscoinRpcClient {
  private config: RpcConfig;

  constructor(config: RpcConfig) {
    this.config = config;
  }

  /** Update RPC config at runtime (e.g. after user changes settings). */
  updateConfig(config: Partial<RpcConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Generic RPC call for methods not strongly typed yet. */
  call<T>(method: string, params: unknown[] = []): Promise<RpcResult<T>> {
    return rpcCall<T>(this.config, method, params);
  }


  getBlockchainInfo(): Promise<RpcResult<RawBlockchainInfo>> {
    return rpcCall<RawBlockchainInfo>(this.config, "getblockchaininfo");
  }

  getNetworkInfo(): Promise<RpcResult<RawNetworkInfo>> {
    return rpcCall<RawNetworkInfo>(this.config, "getnetworkinfo");
  }

  getWalletInfo(): Promise<RpcResult<RawWalletInfo>> {
    return rpcCall<RawWalletInfo>(this.config, "getwalletinfo");
  }

  async getBalances(): Promise<RpcResult<RawBalances>> {
    const res = await rpcCall<RawBalances>(this.config, "getbalances");
    if (!res.ok && res.error && (res.error as RpcError).code === -32601) {
      // "Method not found" (-32601) - older Syscoin nodes might not support getbalances.
      // Fallback to getwalletinfo which provides the same balances.
      const infoRes = await this.getWalletInfo();
      if (infoRes.ok) {
        return {
          ok: true,
          value: {
            mine: {
              trusted: infoRes.value.balance,
              untrusted_pending: infoRes.value.unconfirmed_balance,
              immature: infoRes.value.immature_balance,
            }
          }
        };
      }
      return infoRes as unknown as RpcResult<RawBalances>;
    }
    return res;
  }

  getMempoolInfo(): Promise<RpcResult<RawMempoolInfo>> {
    return rpcCall<RawMempoolInfo>(this.config, "getmempoolinfo");
  }

  /** Estimate smart fee for the given confirmation target (in blocks). */
  estimateSmartFee(confTarget = 6): Promise<RpcResult<RawFeeEstimate>> {
    return rpcCall<RawFeeEstimate>(this.config, "estimatesmartfee", [confTarget]);
  }

  /** Full wallet info including encryption/lock status. */
  getWalletInfoFull(): Promise<RpcResult<RawWalletInfoFull>> {
    return rpcCall<RawWalletInfoFull>(this.config, "getwalletinfo");
  }

  listTransactions(
    label = "*",
    count = 50,
    skip = 0,
    includeWatchOnly = false
  ): Promise<RpcResult<RawTransaction[]>> {
    return rpcCall<RawTransaction[]>(this.config, "listtransactions", [
      label,
      count,
      skip,
      includeWatchOnly,
    ]);
  }

  listUnspent(
    minConf = 0,
    maxConf = 9999999,
    addresses: string[] = []
  ): Promise<RpcResult<RawUtxo[]>> {
    return rpcCall<RawUtxo[]>(this.config, "listunspent", [minConf, maxConf, addresses]);
  }

  lockUnspent(
    unlock: boolean,
    outputs: { txid: string; vout: number }[]
  ): Promise<RpcResult<boolean>> {
    return rpcCall<boolean>(this.config, "lockunspent", [unlock, outputs]);
  }

  listLockUnspent(): Promise<RpcResult<{ txid: string; vout: number }[]>> {
    return rpcCall<{ txid: string; vout: number }[]>(this.config, "listlockunspent");
  }

  async getLockedUtxos(): Promise<RawUtxo[]> {
    const res = await this.listLockUnspent();
    if (!res.ok || res.value.length === 0) return [];
    
    const utxos: RawUtxo[] = [];
    for (const locked of res.value) {
      const outRes = await this.getTxOut(locked.txid, locked.vout);
      if (outRes.ok && outRes.value) {
        utxos.push({
          txid: locked.txid,
          vout: locked.vout,
          amount: outRes.value.value,
          scriptPubKey: outRes.value.scriptPubKey?.hex || "",
          address: outRes.value.scriptPubKey?.addresses?.[0] || outRes.value.scriptPubKey?.address || "",
          confirmations: outRes.value.confirmations,
          spendable: false,
          solvable: true,
          safe: true,
          locked: true,
        });
      }
    }
    return utxos;
  }

  getTxOut(txid: string, vout: number): Promise<RpcResult<any>> {
    return rpcCall<any>(this.config, "gettxout", [txid, vout]);
  }

  listReceivedByAddress(
    minConf = 0,
    includeEmpty = true,
    includeWatchOnly = true
  ): Promise<RpcResult<RawReceivedAddress[]>> {
    return rpcCall<RawReceivedAddress[]>(this.config, "listreceivedbyaddress", [
      minConf,
      includeEmpty,
      includeWatchOnly,
    ]);
  }

  setLabel(address: string, label: string): Promise<RpcResult<null>> {
    return rpcCall<null>(this.config, "setlabel", [address, label]);
  }

  getNewAddress(label = ""): Promise<RpcResult<string>> {
    return rpcCall<string>(this.config, "getnewaddress", [label]);
  }

  createRawTransaction(
    inputs: { txid: string; vout: number }[],
    outputs: Record<string, number>
  ): Promise<RpcResult<string>> {
    return rpcCall<string>(this.config, "createrawtransaction", [inputs, outputs]);
  }

  fundRawTransaction(
    hexstring: string,
    options: Record<string, unknown> = {}
  ): Promise<RpcResult<{ hex: string; fee: number; changepos: number }>> {
    return rpcCall(this.config, "fundrawtransaction", [hexstring, options]);
  }

  signRawTransactionWithWallet(
    hexstring: string
  ): Promise<RpcResult<{ hex: string; complete: boolean }>> {
    return rpcCall(this.config, "signrawtransactionwithwallet", [hexstring]);
  }

  sendRawTransaction(hexstring: string): Promise<RpcResult<string>> {
    return rpcCall<string>(this.config, "sendrawtransaction", [hexstring]);
  }

  /** Test connectivity — used by the settings screen. */
  async ping(): Promise<boolean> {
    const result = await rpcCall<null>(this.config, "ping");
    // ping returns null on success
    return result.ok || (result as { ok: false; error: Error }).error instanceof RpcError;
  }

  /**
   * Like ping() but returns the full error message for display in the UI.
   * Also tries getblockchaininfo as a fallback since some nodes return
   * an error for `ping` but are otherwise reachable.
   */
  async pingWithError(): Promise<{ ok: true } | { ok: false; error: string }> {
    // First try ping (silent success — returns null result)
    const pingResult = await rpcCall<null>(this.config, "ping");
    console.log("[RPC] pingWithError — ping result:", pingResult);

    if (pingResult.ok) return { ok: true };

    // ping can return a valid RpcError ("Method not found" on some builds)
    // which still means we ARE connected. Only RpcConnectionError means unreachable.
    const err = (pingResult as { ok: false; error: Error }).error;
    if (err instanceof RpcError) {
      // Got an RPC-level error = node is reachable, just disagreed on method
      return { ok: true };
    }

    // Try getblockchaininfo as a second probe
    const chainResult = await rpcCall<unknown>(this.config, "getblockchaininfo");
    console.log("[RPC] pingWithError — getblockchaininfo result:", chainResult);

    if (chainResult.ok) return { ok: true };

    const chainErr = (chainResult as { ok: false; error: Error }).error;
    return {
      ok: false,
      error: chainErr.message ?? "Unknown connection error",
    };
  }

  // ── Sentry Node / Masternode RPC ─────────────────────────────────────────

  /** Status of the local masternode/sentry node. */
  masternodeStatus(): Promise<RpcResult<RawMasternodeStatus>> {
    return rpcCall<RawMasternodeStatus>(this.config, "masternode", ["status"]);
  }

  /** Masternode sync status from the local node. */
  mnSyncStatus(): Promise<RpcResult<RawMnSyncStatus>> {
    return rpcCall<RawMnSyncStatus>(this.config, "mnsync", ["status"]);
  }

  /** Network-wide masternode / sentry node counts. */
  masternodeCount(): Promise<RpcResult<RawMasternodeCount>> {
    return rpcCall<RawMasternodeCount>(this.config, "masternode", ["count"]);
  }

  /**
   * Check TCP port reachability via the Tauri Rust layer.
   * Falls back to false in browser mode (no TCP available).
   */
  async checkPort(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
    try {
      const invoke = await getInvoke();
      if (!invoke) return false;
      return (await invoke("check_port", { host, port, timeoutMs })) as boolean;
    } catch {
      return false;
    }
  }

  // ── Bridge RPC ────────────────────────────────────────────────────────────

  /**
   * Burn UTXO SYS and bridge to Syscoin NEVM (EVM address).
   * Syscoin Core 5.x: assetallocationburn
   *   assetguid = 0 for native SYS
   *   address   = source UTXO address (leave blank to let core pick)
   *   amount    = SYS amount as float
   *   ethaddress = destination 0x address on NEVM
   */
  bridgeUtxoToNevm(
    amount: number,
    ethAddress: string,
    sourceAddress: string = ""
  ): Promise<RpcResult<string>> {
    // Returns txid
    return rpcCall<string>(this.config, "assetallocationburn", [
      0,             // assetguid — 0 = native SYS
      sourceAddress, // source address (empty = wallet picks UTXOs)
      amount,
      ethAddress,
    ]);
  }

  /**
   * Convert between Syscoin UTXO and EVM address formats.
   * Returns { v1address, eth_address } for a given address.
   */
  convertAddress(address: string): Promise<RpcResult<{ v1address: string; eth_address: string }>> {
    return rpcCall(this.config, "convertaddress", [address]);
  }

  // ── Wallet Management ───────────────────────────────────────────────────────

  listWallets(): Promise<RpcResult<string[]>> {
    return rpcCall<string[]>(this.config, "listwallets");
  }

  listWalletDir(): Promise<RpcResult<{ wallets: { name: string }[] }>> {
    return rpcCall<{ wallets: { name: string }[] }>(this.config, "listwalletdir");
  }

  loadWallet(walletName: string): Promise<RpcResult<{ name: string; warning: string }>> {
    return rpcCall<{ name: string; warning: string }>(this.config, "loadwallet", [walletName]);
  }

  createWallet(walletName: string, disablePrivateKeys = false, blank = false): Promise<RpcResult<{ name: string; warning: string }>> {
    return rpcCall<{ name: string; warning: string }>(this.config, "createwallet", [
      walletName,
      disablePrivateKeys,
      blank
    ]);
  }
}
