/**
 * features/overview/OverviewPage.tsx
 * Main wallet dashboard — "Where is my SYS?" summary at a glance.
 * Fetches live data from Syscoin Core RPC + public ethers.js EVM endpoints.
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { BalanceCard } from "../../components/BalanceCard";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import { fetchAllEvmBalances } from "../../services/evmRpcClient";
import type { NodeStatus } from "../../types/network";
import "./OverviewPage.css";



function formatSys(raw: number | string): string {
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  if (isNaN(n)) return "—";
  return n.toFixed(8).replace(/\.?0+$/, "") || "0";
}

function syncPercent(progress: number): string {
  return `${(progress * 100).toFixed(1)}%`;
}



export function OverviewPage() {
  const { rpcClient, activeNetwork, evmAddress } = useNetworkStore();
  const [utxoBalance, setUtxoBalance] = useState<string | null>(null);
  const [utxoUnconfirmed, setUtxoUnconfirmed] = useState<string>("0");
  const [nodeStatus, setNodeStatus] = useState<NodeStatus | null>(null);
  const [utxoError, setUtxoError] = useState<string | null>(null);
  const [nodeError, setNodeError] = useState<string | null>(null);
  const [utxoLoading, setUtxoLoading] = useState(true);
  const [nodeLoading, setNodeLoading] = useState(true);

  // EVM balances
  const [nevmBalance,   setNevmBalance]   = useState<string | null>(null);
  const [rolluxBalance, setRolluxBalance] = useState<string | null>(null);
  const [zksysBalance,  setZksysBalance]  = useState<string | null>(null);
  const [evmLoading,    setEvmLoading]    = useState(false);

  // Wallet loading state
  const [availableWallets, setAvailableWallets] = useState<string[]>([]);
  const [walletActionLoading, setWalletActionLoading] = useState(false);

  const fetchUtxoBalance = useCallback(async (background = false) => {
    if (!background) setUtxoLoading(true);
    setUtxoError(null);
    const result = await rpcClient.getBalances();
    if (result.ok) {
      setUtxoBalance(formatSys(result.value.mine.trusted));
      setUtxoUnconfirmed(formatSys(result.value.mine.untrusted_pending));
    } else {
      const msg = result.error?.message ?? "";
      // Common case: no wallet loaded in Syscoin Core
      const noWallet =
        msg.includes("-18") || // RPC_WALLET_NOT_FOUND
        msg.toLowerCase().includes("requested wallet does not exist") ||
        msg.includes("method not found");
      
      // Prevent false positives on connection errors containing the URL (e.g. /wallet/xxx)
      const isConnectionError = msg.toLowerCase().includes("connection error") || msg.toLowerCase().includes("fetch");
      
      if (noWallet && !isConnectionError) {
        setUtxoError(`No wallet loaded or recognized.\nError: ${msg}`);
        // Fetch available wallets
        try {
          const dirRes = await rpcClient.listWalletDir();
          if (dirRes.ok && dirRes.value.wallets) {
            setAvailableWallets(dirRes.value.wallets.map(w => w.name));
          } else {
            setAvailableWallets([]);
          }
        } catch (e) {}
      } else {
        setUtxoError(msg || "Cannot connect to Syscoin Core RPC. Check your settings.");
      }
    }
    if (!background) setUtxoLoading(false);
  }, [rpcClient]);

  const handleLoadWallet = async (name: string) => {
    setWalletActionLoading(true);
    const res = await rpcClient.loadWallet(name);
    setWalletActionLoading(false);
    if (res.ok) {
      fetchUtxoBalance(false);
    } else {
      setUtxoError(`Failed to load wallet: ${res.error?.message}`);
    }
  };

  const handleCreateWallet = async () => {
    setWalletActionLoading(true);
    // Create a default wallet named "wallet"
    const res = await rpcClient.createWallet("wallet", false, false);
    setWalletActionLoading(false);
    if (res.ok) {
      fetchUtxoBalance(false);
    } else {
      setUtxoError(`Failed to create wallet: ${res.error?.message}`);
    }
  };

  const fetchNodeStatus = useCallback(async (background = false) => {
    if (!background) setNodeLoading(true);
    setNodeError(null);
    const [chainRes, netRes] = await Promise.all([
      rpcClient.getBlockchainInfo(),
      rpcClient.getNetworkInfo(),
    ]);
    if (chainRes.ok && netRes.ok) {
      const chain = chainRes.value;
      const net = netRes.value;
      setNodeStatus({
        running: true,
        version: net.subversion,
        protocolVersion: net.protocolversion,
        network: activeNetwork,
        chain: chain.chain,
        blocks: chain.blocks,
        headers: chain.headers,
        syncProgress: chain.verificationprogress,
        peers: net.connections,
        mempoolSize: 0,
        pruned: chain.pruned,
        warnings: chain.warnings,
        rpcAvailable: true,
      });
    } else {
      setNodeError("Node status unavailable.");
    }
    if (!background) setNodeLoading(false);
  }, [rpcClient, activeNetwork]);


  const fetchEvmBalances = useCallback(async (background = false) => {
    if (!evmAddress) return;
    if (!background) setEvmLoading(true);
    const { nevm, rollux, zksys } = await fetchAllEvmBalances(activeNetwork, evmAddress);
    setNevmBalance(nevm?.sys ?? null);
    setRolluxBalance(rollux?.sys ?? null);
    setZksysBalance(zksys?.sys ?? null);
    if (!background) setEvmLoading(false);
  }, [evmAddress, activeNetwork]);

  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // seconds, 0 = off

  // Initial load & Event Listeners
  useEffect(() => {
    fetchUtxoBalance(false);
    fetchNodeStatus(false);
    fetchEvmBalances(false);

    const handleRpcConfigUpdate = () => {
      fetchEvmBalances(false);
    };
    window.addEventListener("nexsys_rpc_config_updated", handleRpcConfigUpdate);
    return () => {
      window.removeEventListener("nexsys_rpc_config_updated", handleRpcConfigUpdate);
    };
  }, [fetchUtxoBalance, fetchNodeStatus, fetchEvmBalances]);

  // Auto-polling interval
  useEffect(() => {
    if (autoRefreshInterval === 0) return;
    const interval = setInterval(() => {
      fetchUtxoBalance(true);
      fetchNodeStatus(true);
      fetchEvmBalances(true);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshInterval, fetchUtxoBalance, fetchNodeStatus, fetchEvmBalances]);

  const isTestnet = activeNetwork !== "MAINNET";

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Overview</h1>
          <p>Your Syscoin wallet at a glance.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted" title="Auto-refresh interval">
            <span>Auto:</span>
            <select 
              className="bg-transparent border border-muted/30 rounded px-1 py-0.5 text-xs text-white focus:outline-none focus:border-primary"
              value={autoRefreshInterval}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            >
              <option className="bg-base-200" value={0}>Off</option>
              <option className="bg-base-200" value={5}>5s</option>
              <option className="bg-base-200" value={10}>10s</option>
              <option className="bg-base-200" value={30}>30s</option>
              <option className="bg-base-200" value={60}>60s</option>
            </select>
          </div>
          <button id="overview-refresh" className="btn btn-ghost btn-sm" onClick={() => { fetchUtxoBalance(); fetchNodeStatus(); fetchEvmBalances(); }}>
            ⟳ Refresh
          </button>
        </div>
      </div>

      {isTestnet && (
        <WarningBox severity="warn" title={`${activeNetwork} active`} className="mb-8">
          You are on a test or development network. Funds here have no mainnet value.
          Do not mix testnet addresses or transactions with mainnet workflows.
        </WarningBox>
      )}

      {/* Balance row */}
      <div className="grid-3 mb-8">
        <BalanceCard
          chain="SYSCOIN_NATIVE_UTXO"
          network={activeNetwork}
          confirmed={utxoBalance ?? "—"}
          unconfirmed={utxoUnconfirmed}
          loading={utxoLoading}
          error={utxoError ?? undefined}
          errorAction={
            utxoError?.includes("No wallet loaded") ? (
              <div className="flex gap-2 flex-wrap">
                {availableWallets.map((w, idx) => (
                  <button 
                    key={idx} 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleLoadWallet(w)}
                    disabled={walletActionLoading}
                  >
                    {walletActionLoading ? "Loading…" : `Load ${w || 'Default Wallet'}`}
                  </button>
                ))}
                {availableWallets.length === 0 && (
                   <button 
                    className="btn btn-primary btn-sm"
                    onClick={() => handleCreateWallet()}
                    disabled={walletActionLoading}
                  >
                    {walletActionLoading ? "Creating…" : "Create Default Wallet"}
                  </button>
                )}
              </div>
            ) : undefined
          }
          description="Your native UTXO SYS. Spendable directly on Syscoin Native."
        />
        <BalanceCard
          chain="SYSCOIN_NEVM"
          network={activeNetwork}
          confirmed={nevmBalance ?? "—"}
          loading={evmLoading && nevmBalance === null}
          description={evmAddress
            ? "SYS on Syscoin NEVM (EVM-compatible)."
            : "Set your 0x address in Settings to see your NEVM balance."}
        />
        {/* Node status card (Moved to first row) */}
        <div className={`card card--${activeNetwork.toLowerCase()}`}>
          <div className="card__label stat-label mb-4">Node Status</div>
          {nodeLoading ? (
            <div className="flex items-center gap-2"><div className="spinner" /><span className="text-muted text-sm">Checking node…</span></div>
          ) : nodeError ? (
            <WarningBox severity="danger" className="mt-2">{nodeError}</WarningBox>
          ) : nodeStatus ? (
            <div className="flex flex-col gap-2">
              <div className="overview-stat">
                <span className="text-muted text-xs">Blocks</span>
                <span className="font-mono text-sm">{nodeStatus.blocks.toLocaleString()}</span>
              </div>
              <div className="overview-stat">
                <span className="text-muted text-xs">Sync</span>
                <span className={`text-sm font-semibold ${nodeStatus.syncProgress >= 0.9999 ? "text-success" : "text-warning"}`}>
                  {nodeStatus.syncProgress >= 0.9999 ? "Synced" : syncPercent(nodeStatus.syncProgress)}
                </span>
              </div>
              <div className="overview-stat">
                <span className="text-muted text-xs">Peers</span>
                <span className="text-sm">{nodeStatus.peers}</span>
              </div>
              <div className="overview-stat">
                <span className="text-muted text-xs">Version</span>
                <span className="font-mono text-xs truncate" title={nodeStatus.version}>{nodeStatus.version}</span>
              </div>
              {nodeStatus.warnings && (
                <div className="text-xs text-warning mt-1">{nodeStatus.warnings}</div>
              )}
            </div>
          ) : null}
          <Link to="/node" className="btn btn-ghost btn-sm mt-4 w-full" id="overview-node-link">
            Full Node Status →
          </Link>
        </div>
      </div>

      {/* Status row */}
      <div className="grid-3 mb-8">
        {/* Rollux card (Moved to second row) */}
        <BalanceCard
          chain="ROLLUX"
          network={activeNetwork}
          confirmed={rolluxBalance ?? "—"}
          loading={evmLoading && rolluxBalance === null}
          description={evmAddress
            ? "SYS on Rollux Layer 2. Bridged from Syscoin NEVM."
            : "Set your 0x address in Settings to see your Rollux balance."}
        />

        {/* zkSYS card */}
        <BalanceCard
          chain="ZKSYS"
          network={activeNetwork}
          confirmed={zksysBalance ?? "—"}
          loading={evmLoading && zksysBalance === null}
          description={evmAddress
            ? "SYS on the zkSYS zero-knowledge proof layer."
            : "Set your 0x address in Settings to see your zkSYS balance."}
        />

        {/* Security card */}
        <div className={`card card--${activeNetwork.toLowerCase()}`}>
          <div className="stat-label mb-4">Security & Backup</div>
          <div className="flex flex-col gap-2">
            <div className="overview-stat">
              <span className="text-muted text-xs">Wallet Encrypted</span>
              <span className="text-xs text-warning">Unknown</span>
            </div>
            <div className="overview-stat">
              <span className="text-muted text-xs">Backup Status</span>
              <span className="text-xs text-warning">Not verified</span>
            </div>
            <div className="overview-stat">
              <span className="text-muted text-xs">Hardware Wallet</span>
              <span className="text-xs text-muted">Not connected</span>
            </div>
          </div>
          <Link to="/security" id="overview-security-link" className="btn btn-ghost btn-sm mt-4 w-full">
            Security Details →
          </Link>
        </div>
      </div>

      {/* Quick actions */}
      <div className="card">
        <div className="stat-label mb-4">Quick Actions</div>
        <div className="flex gap-4">
          <Link to="/receive" id="overview-receive" className="btn btn-primary">↓ Receive</Link>
          <Link to="/send"    id="overview-send"    className="btn btn-secondary">↑ Send</Link>
          <Link to="/bridge"  id="overview-bridge"  className="btn btn-secondary">⇄ Bridge</Link>
          <Link to="/where-is-my-sys" id="overview-where" className="btn btn-ghost">🗺 Where Is My SYS?</Link>
        </div>
      </div>
    </div>
  );
}
