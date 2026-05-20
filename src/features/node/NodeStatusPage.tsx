/**
 * features/node/NodeStatusPage.tsx
 * Full Syscoin Core node status screen.
 */

import { useEffect, useState, useCallback } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type { NodeStatus } from "../../types/network";
import "./NodeStatusPage.css";


function syncBar(progress: number) {
  const pct = Math.min(100, Math.round(progress * 100));
  const color = pct >= 100 ? "var(--color-success)" : pct > 50 ? "var(--color-warning)" : "var(--color-danger)";
  return (
    <div className="sync-bar-wrap">
      <div className="sync-bar" style={{ width: `${pct}%`, background: color }} />
      <span className="sync-bar-label" style={{ color }}>{pct >= 100 ? "Synced" : `${pct}%`}</span>
    </div>
  );
}

export function NodeStatusPage() {
  const { rpcClient, activeNetwork } = useNetworkStore();
  const [status, setStatus] = useState<NodeStatus | null>(null);
  const [mempoolSize, setMempoolSize] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [chainRes, netRes, mempoolRes] = await Promise.all([
      rpcClient.getBlockchainInfo(),
      rpcClient.getNetworkInfo(),
      rpcClient.getMempoolInfo(),
    ]);

    if (chainRes.ok && netRes.ok) {
      setStatus({
        running: true,
        version: netRes.value.subversion,
        protocolVersion: netRes.value.protocolversion,
        network: activeNetwork,
        chain: chainRes.value.chain,
        blocks: chainRes.value.blocks,
        headers: chainRes.value.headers,
        syncProgress: chainRes.value.verificationprogress,
        peers: netRes.value.connections,
        mempoolSize: mempoolRes.ok ? mempoolRes.value.size : 0,
        pruned: chainRes.value.pruned,
        warnings: chainRes.value.warnings || netRes.value.warnings || "",
        rpcAvailable: true,
      });
      if (mempoolRes.ok) setMempoolSize(mempoolRes.value.size);
    } else {
      setError("Cannot reach Syscoin Core RPC. Make sure the node is running and your connection is configured correctly in Settings.");
    }
    setLoading(false);
  }, [rpcClient, activeNetwork]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Node Status</h1>
          <p>Syscoin Core connection and blockchain sync state.</p>
        </div>
        <button id="node-refresh-btn" className="btn btn-ghost btn-sm" onClick={fetch}>⟳ Refresh</button>
      </div>

      {loading ? (
        <div className="flex items-center gap-4" style={{ marginTop: "var(--space-8)" }}>
          <div className="spinner" />
          <span className="text-secondary">Connecting to node…</span>
        </div>
      ) : error ? (
        <WarningBox severity="danger" title="Node unavailable">{error}</WarningBox>
      ) : status ? (
        <>
          {status.warnings && (
            <WarningBox severity="warn" className="mb-8">{status.warnings}</WarningBox>
          )}

          <div className="grid-4 mb-8">
            <div className="card">
              <div className="stat-label">Block Height</div>
              <div className="stat-value mt-2">{status.blocks.toLocaleString()}</div>
              <div className="text-xs text-muted mt-1">of {status.headers.toLocaleString()} headers</div>
            </div>
            <div className="card">
              <div className="stat-label">Peers</div>
              <div className="stat-value mt-2">{status.peers}</div>
              <div className="text-xs text-muted mt-1">connected</div>
            </div>
            <div className="card">
              <div className="stat-label">Mempool</div>
              <div className="stat-value mt-2">{mempoolSize ?? "—"}</div>
              <div className="text-xs text-muted mt-1">unconfirmed txs</div>
            </div>
            <div className="card">
              <div className="stat-label">Pruned</div>
              <div className={`stat-value mt-2 ${status.pruned ? "text-warning" : "text-success"}`} style={{ fontSize: "var(--text-xl)" }}>
                {status.pruned ? "Yes" : "No"}
              </div>
            </div>
          </div>

          <div className="card mb-6">
            <div className="stat-label mb-4">Sync Progress</div>
            {syncBar(status.syncProgress)}
          </div>

          <div className="grid-2">
            <div className="card">
              <div className="stat-label mb-4">Node Details</div>
              <div className="node-detail-row">
                <span className="text-muted text-xs">Version</span>
                <span className="font-mono text-xs">{status.version}</span>
              </div>
              <div className="node-detail-row">
                <span className="text-muted text-xs">Protocol</span>
                <span className="font-mono text-xs">{status.protocolVersion}</span>
              </div>
              <div className="node-detail-row">
                <span className="text-muted text-xs">Chain</span>
                <span className="font-mono text-xs">{status.chain}</span>
              </div>
              <div className="node-detail-row">
                <span className="text-muted text-xs">Environment</span>
                <span className="text-xs">{activeNetwork}</span>
              </div>
              <div className="node-detail-row">
                <span className="text-muted text-xs">RPC</span>
                <span className="text-xs text-success">Available</span>
              </div>
            </div>

            <div className="card">
              <div className="stat-label mb-4">Wallet Status</div>
              <p className="text-sm text-secondary">
                Connect wallet details by navigating to <strong>Settings</strong> and configuring your RPC credentials.
                Wallet encryption and backup status will appear here once connected.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
