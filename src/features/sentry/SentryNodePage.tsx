/**
 * features/sentry/SentryNodePage.tsx
 * Sentry Node operator dashboard — MVP 4.
 *
 * Checks:
 *   ✓ Node synced (getblockchaininfo)
 *   ✓ Wallet loaded (getwalletinfo)
 *   ✓ Masternode status (masternode status)
 *   ✓ Masternode sync (mnsync status)
 *   ✓ Network counts (masternode count)
 *   ✓ P2P + RPC port reachability (via Rust TCP check)
 *   ✓ Peer count (getnetworkinfo)
 *   ✓ Version (getnetworkinfo)
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type {
  RawBlockchainInfo,
  RawNetworkInfo,
  RawWalletInfoFull,
  RawMasternodeStatus,
  RawMnSyncStatus,
  RawMasternodeCount,
  RawMasternodeList,
  RawProTxList,
} from "../../services/syscoinRpcClient";
import { StatusPieChart } from "../../components/charts/StatusPieChart";
import { CustomDropdown } from "../../components/shared/CustomDropdown";
import { UptimeHistogram } from "../../components/charts/UptimeHistogram";
import { HistoricalLineChart } from "../../components/charts/HistoricalLineChart";
import { getHistoricalStats, recordSentryStats, type HistoricalStat } from "../../services/sentryStatsService";
import "./SentryNodePage.css";

// ── Known port definitions per network ──────────────────────────────────────

const PORTS = {
  MAINNET:  { p2p: 8369,  rpc: 8370 },
  TESTNET:  { p2p: 18369, rpc: 18370 },
  REGTEST:  { p2p: 18444, rpc: 18443 },
  DEVNET:   { p2p: 19999, rpc: 18998 },
};

// ── Status types ──────────────────────────────────────────────────────────────

type CheckState = "loading" | "ok" | "warn" | "danger" | "muted";

interface PortResult {
  port: number;
  label: string;
  open: boolean | null;  // null = loading
}

type OverallHealth = "healthy" | "warning" | "critical" | "unknown";

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthFromChecks(checks: CheckState[]): OverallHealth {
  if (checks.includes("loading")) return "unknown";
  if (checks.includes("danger"))  return "critical";
  if (checks.includes("warn"))    return "warning";
  return "healthy";
}

function masternodeStateLabel(state?: string): { text: string; pill: CheckState } {
  if (!state) return { text: "Unknown", pill: "muted" };
  const s = state.toUpperCase();
  if (s === "READY")                     return { text: "Ready ✓",            pill: "ok"     };
  if (s.includes("WAITING"))             return { text: "Waiting for ProTx",  pill: "warn"   };
  if (s.includes("ERROR"))               return { text: "Error",              pill: "danger" };
  if (s.includes("NOT_CAPABLE"))         return { text: "Not capable",        pill: "danger" };
  if (s.includes("POSE_BAN"))            return { text: "PoSe banned",        pill: "danger" };
  return { text: state, pill: "muted" };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ state, label }: { state: CheckState; label: string }) {
  const icon =
    state === "loading" ? <span className="check-spinner" /> :
    state === "ok"      ? "✓" :
    state === "warn"    ? "⚠" :
    state === "danger"  ? "✕" : "—";
  return (
    <span className={`status-pill status-pill--${state === "loading" ? "muted" : state}`}>
      {icon} {label}
    </span>
  );
}

function CheckRow({
  label,
  state,
  value,
}: {
  label: string;
  state: CheckState;
  value: string;
}) {
  return (
    <div className="check-row">
      <span className="check-label">{label}</span>
      <span className="check-value">
        <StatusPill state={state} label={value} />
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function SentryNodePage() {
  const { rpcClient, rpcConfig, activeNetwork } = useNetworkStore();

  // Individual data slices
  const [chain,   setChain]   = useState<RawBlockchainInfo    | null>(null);
  const [net,     setNet]     = useState<RawNetworkInfo        | null>(null);
  const [wallet,  setWallet]  = useState<RawWalletInfoFull     | null>(null);
  const [mnStatus, setMnStatus] = useState<RawMasternodeStatus | null>(null);
  const [mnSync,  setMnSync]  = useState<RawMnSyncStatus       | null>(null);
  const [mnCount, setMnCount] = useState<RawMasternodeCount    | null>(null);
  const [ports,   setPorts]   = useState<PortResult[]>([]);
  
  // Dashboard state
  const [activeTab, setActiveTab] = useState<"overview" | "mynodes" | "network">("overview");
  const [myNodes, setMyNodes] = useState<RawProTxList | null>(null);
  const [mnList, setMnList] = useState<RawMasternodeList | null>(null);

  // New chart states
  const [chartView, setChartView] = useState<"health" | "uptime" | "history">("health");
  const [histStats, setHistStats] = useState<HistoricalStat[]>(getHistoricalStats());

  // Loading / error flags
  const [loading, setLoading] = useState(true);
  const [errors,  setErrors]  = useState<string[]>([]);

  // Actions list
  const [actions, setActions] = useState<{ level: "danger" | "warn" | "info"; icon: string; text: string }[]>([]);

  const networkPorts = PORTS[activeNetwork as keyof typeof PORTS] ?? PORTS.MAINNET;
  const host = rpcConfig.host;

  const runChecks = useCallback(async () => {
    setLoading(true);
    setErrors([]);
    setActions([]);

    // Initialise port states
    const portDefs: { port: number; label: string }[] = [
      { port: networkPorts.p2p,  label: "P2P"  },
      { port: networkPorts.rpc,  label: "RPC"  },
    ];
    setPorts(portDefs.map(p => ({ ...p, open: null })));

    const errs: string[] = [];

    // ── Parallel RPC fetches ────────────────────────────────────────────────
    const [chainRes, netRes, walletRes, mnStatusRes, mnSyncRes, mnCountRes, protxRes, mnListRes] =
      await Promise.all([
        rpcClient.getBlockchainInfo(),
        rpcClient.getNetworkInfo(),
        rpcClient.getWalletInfoFull(),
        rpcClient.masternodeStatus(),
        rpcClient.mnSyncStatus(),
        rpcClient.masternodeCount(),
        rpcClient.protxList("wallet", true),
        rpcClient.masternodeList("json"),
      ]);

    if (chainRes.ok)    setChain(chainRes.value);
    else errs.push(`Blockchain info: ${chainRes.error.message}`);

    if (netRes.ok)      setNet(netRes.value);
    else errs.push(`Network info: ${netRes.error.message}`);

    if (walletRes.ok)   setWallet(walletRes.value);
    else setWallet(null);
    if (mnStatusRes.ok) setMnStatus(mnStatusRes.value);
    else {
      setMnStatus(null);
      // Suppress "Method not found" for status if the node isn't configured as a masternode
      if (!mnStatusRes.error.message.includes("Method not found")) {
         errs.push(`Masternode status: ${mnStatusRes.error.message}`);
      }
    }

    if (mnSyncRes.ok)   setMnSync(mnSyncRes.value);
    else {
      setMnSync(null);
      if (!mnSyncRes.error.message.includes("Method not found")) {
        errs.push(`Masternode sync: ${mnSyncRes.error.message}`);
      }
    }

    if (mnCountRes.ok) {
      setMnCount(mnCountRes.value);
      const updatedStats = recordSentryStats(mnCountRes.value.total, mnCountRes.value.enabled);
      setHistStats(updatedStats);
    } else {
      setMnCount(null);
      errs.push(`Masternode count: ${mnCountRes.error.message}`);
    }

    if (protxRes.ok) setMyNodes(protxRes.value);
    else {
      setMyNodes([]);
      errs.push(`ProTx list: ${protxRes.error.message}`);
    }

    if (mnListRes.ok) setMnList(mnListRes.value);
    else {
      setMnList(null);
      errs.push(`Masternode list: ${mnListRes.error.message}`);
    }

    setErrors(errs);

    // ── Port checks (can run in parallel, update individually) ──────────────
    const portResults = await Promise.all(
      portDefs.map(async (pd) => ({
        ...pd,
        open: await rpcClient.checkPort(host, pd.port),
      }))
    );
    setPorts(portResults);

    // ── Derive action items ─────────────────────────────────────────────────
    const acts: typeof actions = [];

    if (chainRes.ok && chainRes.value.verificationprogress < 0.9999) {
      acts.push({ level: "danger", icon: "🔄", text: `<strong>Node not synced</strong> — ${(chainRes.value.verificationprogress * 100).toFixed(1)}% complete. Sentry Node cannot operate until sync is complete.` });
    }

    if (!walletRes.ok) {
      acts.push({ level: "danger", icon: "🔑", text: "<strong>No wallet loaded.</strong> Set Wallet Name in Settings or load a wallet in your node." });
    }

    if (walletRes.ok && walletRes.value.unlocked_until === undefined) {
      acts.push({ level: "warn", icon: "🔓", text: "<strong>Wallet is not encrypted.</strong> Encrypt your wallet immediately to protect collateral funds." });
    }

    if (netRes.ok && netRes.value.connections < 3) {
      acts.push({ level: "warn", icon: "🌐", text: `<strong>Low peer count (${netRes.value.connections}).</strong> Check your firewall and ensure P2P port ${networkPorts.p2p} is forwarded.` });
    }

    const p2pPort = portResults.find(p => p.label === "P2P");
    if (p2pPort && p2pPort.open === false) {
      acts.push({ level: "warn", icon: "🔌", text: `<strong>P2P port ${networkPorts.p2p} not reachable</strong> from this machine. External peers may be unable to connect.` });
    }

    if (mnStatusRes.ok) {
      const state = (mnStatusRes.value.state ?? "").toUpperCase();
      if (state.includes("POSE_BAN")) {
        acts.push({ level: "danger", icon: "⛔", text: "<strong>Sentry Node is PoSe banned.</strong> The node has been banned by the network for poor performance. Fix connectivity and wait for the ban to lift." });
      }
      if (state.includes("NOT_CAPABLE") || state.includes("ERROR")) {
        acts.push({ level: "danger", icon: "⚠️", text: `<strong>Sentry Node error: ${mnStatusRes.value.state}</strong> — check node configuration and ProTx registration.` });
      }
    } else {
      acts.push({ level: "info", icon: "ℹ️", text: "<strong>Node is not a Sentry Node.</strong> Not registered on-chain." });
    }

    setActions(acts);
    setLoading(false);
  }, [rpcClient, host, networkPorts]);

  useEffect(() => { runChecks(); }, [runChecks]);

  const pieData = useMemo(() => {
    if (!mnList) return [];
    const counts: Record<string, number> = {};
    Object.values(mnList).forEach(mn => {
      counts[mn.status] = (counts[mn.status] || 0) + 1;
    });
    
    const getStatusStyle = (status: string) => {
      const s = status.toUpperCase();
      if (s === "ENABLED" || s === "READY") return { color: "#22c55e", gradientStart: "#4ade80", gradientEnd: "#16a34a" }; // success green
      if (s.includes("POSE_BAN")) return { color: "#eab308", gradientStart: "#facc15", gradientEnd: "#ca8a04" }; // warning amber
      if (s.includes("NEW_START_REQUIRED")) return { color: "#f59e0b", gradientStart: "#fbbf24", gradientEnd: "#d97706" }; // warn amber
      if (s.includes("WAITING")) return { color: "#3b82f6", gradientStart: "#60a5fa", gradientEnd: "#2563eb" }; // info blue
      return { color: "#8b5cf6", gradientStart: "#a78bfa", gradientEnd: "#7c3aed" }; // default purple
    };

    return Object.entries(counts).map(([label, value]) => ({
      label,
      value,
      ...getStatusStyle(label)
    }));
  }, [mnList]);

  const diff24h = useMemo(() => {
    if (!histStats || histStats.length === 0 || !mnCount) return null;
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const pastStat = histStats.find(s => s.timestamp >= oneDayAgo) || histStats[0];
    return mnCount.total - pastStat.total;
  }, [histStats, mnCount]);

  // ── Derived check states ──────────────────────────────────────────────────

  const syncState: CheckState =
    !chain ? "loading" :
    chain.verificationprogress >= 0.9999 ? "ok" :
    chain.verificationprogress >= 0.8    ? "warn" : "danger";

  const syncLabel =
    !chain ? "Loading…" :
    chain.verificationprogress >= 0.9999 ? "Synced" :
    `${(chain.verificationprogress * 100).toFixed(1)}%`;

  const walletState: CheckState = !wallet ? (loading ? "loading" : "danger") : "ok";
  const walletLabel = !wallet ? (loading ? "Loading…" : "No wallet") : wallet.walletname || "(default)";

  const peerState: CheckState =
    !net ? "loading" :
    net.connections >= 8 ? "ok" :
    net.connections >= 3 ? "warn" : "danger";

  const mnStateInfo = masternodeStateLabel(mnStatus?.state);
  const mnSyncState: CheckState =
    !mnSync ? (loading ? "loading" : "muted") :
    mnSync.IsSynced ? "ok" : "warn";
  const mnSyncLabel =
    !mnSync ? (loading ? "Loading…" : "N/A") :
    mnSync.IsSynced ? "Synced" : mnSync.AssetName.replace(/_/g, " ");

  // Encryption
  const encState: CheckState =
    !wallet ? "muted" :
    wallet.unlocked_until === undefined ? "danger" :
    wallet.unlocked_until === 0         ? "ok" : "warn";
  const encLabel =
    !wallet ? "—" :
    wallet.unlocked_until === undefined ? "Not encrypted" :
    wallet.unlocked_until === 0         ? "Encrypted & locked" : "Encrypted (unlocked)";

  const overallHealth = healthFromChecks([syncState, walletState, peerState, encState,
    ...(mnStatus ? [mnStateInfo.pill as CheckState] : [])]);

  const healthLabel: Record<OverallHealth, string> = {
    healthy:  "Sentry Node Healthy",
    warning:  "Attention Required",
    critical: "Critical Issues Detected",
    unknown:  "Running Checks…",
  };

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Sentry Node</h1>
          <p>Operator dashboard — health, status, and diagnostics.</p>
        </div>
        <button
          id="sentry-refresh-btn"
          className="btn btn-ghost btn-sm"
          onClick={runChecks}
          disabled={loading}
        >
          ⟳ Refresh
        </button>
      </div>

      {errors.length > 0 && (
        <WarningBox severity="danger" className="mb-6">
          {errors.map((e, i) => <div key={i}>{e}</div>)}
        </WarningBox>
      )}

      {/* Tabs */}
      <div className="sentry-tabs">
        <button className={`sentry-tab ${activeTab === "overview" ? "sentry-tab--active" : ""}`} onClick={() => setActiveTab("overview")}>Overview</button>
        <button className={`sentry-tab ${activeTab === "mynodes" ? "sentry-tab--active" : ""}`} onClick={() => setActiveTab("mynodes")}>My Nodes</button>
        <button className={`sentry-tab ${activeTab === "network" ? "sentry-tab--active" : ""}`} onClick={() => setActiveTab("network")}>Network Stats</button>
      </div>

      {activeTab === "overview" && (
        <>
          {/* Overall health bar */}
          <div className="sentry-header-bar">
        <span className={`sentry-health-dot sentry-health-dot--${overallHealth}`} />
        <div>
          <div className="sentry-health-title">{healthLabel[overallHealth]}</div>
          <div className="sentry-health-sub">
            {chain
              ? `Block ${chain.blocks.toLocaleString()} · ${net?.connections ?? "?"} peers · ${net?.subversion ?? "?"}`
              : "Connecting to node…"}
          </div>
        </div>
        {mnCount && (
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div className="text-xs text-muted">Network Sentry Nodes</div>
            <div className="font-mono font-semibold">
              {mnCount.enabled.toLocaleString()} active / {mnCount.total.toLocaleString()} total
            </div>
          </div>
        )}
      </div>

      <div className="sentry-grid">
        {/* Node status card */}
        <div className="card">
          <div className="stat-label mb-4">Node Status</div>
          <div className="check-list">
            <CheckRow label="Blockchain sync" state={syncState} value={syncLabel} />
            <CheckRow label="Peers connected" state={peerState} value={net ? String(net.connections) : "…"} />
            <CheckRow
              label="Node version"
              state={net ? "ok" : "loading"}
              value={net?.subversion ?? "…"}
            />
            <CheckRow
              label="Chain"
              state={chain ? "ok" : "loading"}
              value={chain ? `${chain.chain} · block ${chain.blocks.toLocaleString()}` : "…"}
            />
            <CheckRow
              label="Pruned"
              state={chain ? (chain.pruned ? "warn" : "ok") : "loading"}
              value={chain ? (chain.pruned ? "Yes (pruned node)" : "No") : "…"}
            />
          </div>
        </div>

        {/* Wallet status card */}
        <div className="card">
          <div className="stat-label mb-4">Wallet Status</div>
          <div className="check-list">
            <CheckRow label="Wallet"      state={walletState} value={walletLabel} />
            <CheckRow label="Encryption"  state={encState}    value={encLabel}    />
            <CheckRow
              label="Wallet format"
              state={wallet ? "ok" : "muted"}
              value={wallet ? (wallet.descriptors ? "Descriptor" : "Legacy") : "—"}
            />
            <CheckRow
              label="Keypool size"
              state={wallet ? (wallet.keypoolsize > 100 ? "ok" : "warn") : "muted"}
              value={wallet ? `${wallet.keypoolsize} keys` : "—"}
            />
          </div>
        </div>

        {/* Sentry Node / Masternode card */}
        <div className="card">
          <div className="stat-label mb-4">Sentry Node Status</div>
          {!mnStatus && !loading ? (
            <p className="text-sm text-secondary">
              Masternode not active on this node, or <code className="font-mono text-xs">masternode status</code> returned an error.
              <br /><br />
              To register this node as a Sentry Node, follow the Syscoin Sentry Node setup guide and provide your ProTx hash and operator BLS key.
            </p>
          ) : (
            <div className="check-list">
              <CheckRow
                label="State"
                state={loading ? "loading" : mnStateInfo.pill}
                value={loading ? "…" : (mnStatus?.state ?? "Not configured")}
              />
              <CheckRow label="MN sync"  state={mnSyncState} value={mnSyncLabel} />
              <CheckRow
                label="Service"
                state={mnStatus?.service ? "ok" : "muted"}
                value={mnStatus?.service ?? "—"}
              />
              <CheckRow
                label="Collateral"
                state={mnStatus?.collateralHash ? "ok" : "muted"}
                value={mnStatus?.collateralHash
                  ? `${mnStatus.collateralHash.slice(0, 10)}…:${mnStatus.collateralIndex}`
                  : "—"}
              />
              {mnStatus?.dmnState?.lastPaidHeight != null && (
                <CheckRow
                  label="Last paid"
                  state="ok"
                  value={`Block ${mnStatus.dmnState.lastPaidHeight.toLocaleString()}`}
                />
              )}
              {mnStatus?.dmnState?.nextPaymentHeight != null && (
                <CheckRow
                  label="Next payment"
                  state="ok"
                  value={`~Block ${mnStatus.dmnState.nextPaymentHeight.toLocaleString()}`}
                />
              )}
            </div>
          )}
        </div>

        {/* Port reachability card */}
        <div className="card">
          <div className="stat-label mb-4">Port Reachability ({activeNetwork})</div>
          <div className="port-grid">
            {ports.map(p => (
              <div key={p.port} className="port-card">
                <div className="port-number">{p.port}</div>
                <div className="port-label">{p.label}</div>
                {p.open === null ? (
                  <StatusPill state="loading" label="Testing…" />
                ) : p.open ? (
                  <StatusPill state="ok" label="Open" />
                ) : (
                  <StatusPill state="warn" label="Closed / unreachable" />
                )}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted mt-4">
            Port checks are TCP connection tests from this machine.
            External reachability also depends on your firewall and ISP.
          </p>
        </div>
      </div>

      {/* Action items */}
      {actions.length > 0 && (
        <div className="card">
          <div className="stat-label mb-4">Action Items ({actions.length})</div>
          <div className="action-list">
            {actions.map((a, i) => (
              <div key={i} className={`action-item action-item--${a.level}`}>
                <span className="action-icon">{a.icon}</span>
                <span
                  className="action-text"
                  dangerouslySetInnerHTML={{ __html: a.text }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {actions.length === 0 && !loading && (
        <div className="card">
          <div className="stat-label mb-4">Action Items</div>
          <WarningBox severity="success">
            No critical issues detected. Keep your node software updated and monitor regularly.
          </WarningBox>
        </div>
      )}

      {/* Operator reference */}
      <div className="card mt-6">
        <div className="stat-label mb-4">Quick Reference</div>
        <div className="grid-3" style={{ gap: "var(--space-3)" }}>
          {[
            { label: "P2P port",    value: networkPorts.p2p  },
            { label: "RPC port",    value: networkPorts.rpc  },
            { label: "Network",     value: activeNetwork     },
            { label: "Collateral",  value: "100,000 SYS"     },
            { label: "MN protocol", value: net?.protocolversion ?? "—" },
            { label: "Peers",       value: net?.connections  ?? "—"    },
          ].map(item => (
            <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "var(--space-2) 0", borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-sm)" }}>
              <span className="text-muted">{item.label}</span>
              <span className="font-mono font-semibold">{item.value}</span>
            </div>
          ))}
        </div>
      </div>
        </>
      )}

      {activeTab === "mynodes" && (
        <div className="card animate-fade-in">
          <div className="stat-label mb-4">My Sentry Nodes</div>
          {myNodes && myNodes.length > 0 ? (
            <table className="sentry-table">
              <thead>
                <tr>
                  <th>ProTx Hash</th>
                  <th>Status</th>
                  <th>Service</th>
                  <th>Next Payment</th>
                </tr>
              </thead>
              <tbody>
                {myNodes.map(node => (
                  <tr key={node.proTxHash}>
                    <td className="font-mono text-xs">{node.proTxHash.substring(0, 16)}...</td>
                    <td>
                      <StatusPill 
                        state={node.state.PoSePenalty > 0 ? "warn" : "ok"} 
                        label={node.state.PoSePenalty > 0 ? `PoSe (${node.state.PoSePenalty})` : "Healthy"} 
                      />
                    </td>
                    <td className="font-mono text-xs">{node.state.service}</td>
                    <td>{node.state.nextPaymentHeight > 0 ? `Block ${node.state.nextPaymentHeight}` : "Waiting"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-muted text-sm py-4">No Sentry Nodes found in the currently connected wallet. Ensure your wallet has the ProTx transactions and is unlocked.</div>
          )}
        </div>
      )}

      {activeTab === "network" && (
        <div className="card animate-fade-in">
          <div className="stat-label mb-4">Network Status</div>
          {mnCount ? (
            <div className="grid-4 mb-6" style={{ gap: "var(--space-4)" }}>
              <div className="card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                <div className="text-muted text-sm mb-1">Total Registered</div>
                <div className="text-xl font-bold">{mnCount.total.toLocaleString()}</div>
              </div>
              <div className="card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                <div className="text-muted text-sm mb-1">Active / Enabled</div>
                <div className="text-xl font-bold text-success">{mnCount.enabled.toLocaleString()}</div>
              </div>
              <div className="card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                <div className="text-muted text-sm mb-1">Qualifying for Rewards</div>
                <div className="text-xl font-bold">{mnCount.qualify?.toLocaleString() ?? "—"}</div>
              </div>
              <div className="card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)" }}>
                <div className="text-muted text-sm mb-1">Joined / Left (24h)</div>
                <div className={`text-xl font-bold ${diff24h != null && diff24h > 0 ? "text-success" : diff24h != null && diff24h < 0 ? "text-danger" : ""}`}>
                  {diff24h != null ? (diff24h > 0 ? `+${diff24h}` : diff24h) : "—"}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted mb-6">Loading network stats...</p>
          )}

          {mnCount && (
            <div className="mt-2 mb-6 card" style={{ background: "var(--color-bg-base)", border: "1px solid var(--color-border)", minHeight: "140px" }}>
              <div className="flex justify-between items-center mb-4 border-b border-[var(--color-border)] pb-2">
                <div className="font-semibold text-sm">Network Analytics</div>
                <div style={{ width: "220px" }}>
                  <CustomDropdown
                    label=""
                    value={chartView}
                    options={[
                      { value: "health", label: "Node Status", subtitle: "Pie Chart" },
                      { value: "uptime", label: "Node Age", subtitle: "Histogram" },
                      { value: "history", label: "History", subtitle: "Line Chart" }
                    ]}
                    onChange={(val) => setChartView(val as any)}
                  />
                </div>
              </div>
              <div className="h-40 w-full mt-4">
                {chartView === "health" && <StatusPieChart data={pieData} />}
                {chartView === "uptime" && (mnList ? <UptimeHistogram mnList={mnList} /> : <div className="text-xs text-muted h-full flex items-center justify-center">Loading list...</div>)}
                {chartView === "history" && <HistoricalLineChart stats={histStats} />}
              </div>
            </div>
          )}

          {mnList && (
            <div>
              <div className="stat-label mb-4 mt-6">Recent Nodes</div>
              <table className="sentry-table">
                <thead>
                  <tr>
                    <th>Address</th>
                    <th>Status</th>
                    <th>Version</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(mnList).slice(0, 10).map((mn, idx) => (
                    <tr key={idx}>
                      <td className="font-mono text-xs">{mn.address}</td>
                      <td>
                        <StatusPill 
                          state={mn.status === "ENABLED" ? "ok" : "warn"} 
                          label={mn.status} 
                        />
                      </td>
                      <td className="font-mono text-xs">{mn.daemonversion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-muted text-xs mt-2 text-center">Showing first 10 nodes from {Object.keys(mnList).length} total nodes in registry.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
