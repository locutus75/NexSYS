/**
 * features/transactions/TransactionsPage.tsx
 * Live transaction history from Syscoin Core and EVM Blockscouts.
 */

import { useEffect, useState, useCallback } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type { RawTransaction } from "../../services/syscoinRpcClient";
import { fetchEvmTransactions, type EvmTransaction, type EvmChainIdentifier } from "../../services/evmExplorerService";
import "./TransactionsPage.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function formatSys(amount: number): string {
  return Math.abs(amount).toFixed(8).replace(/\.?0+$/, "") || "0";
}

function formatEvmSys(wei: string): string {
  try {
    const ether = Number(wei) / 1e18;
    return ether.toFixed(8).replace(/\.?0+$/, "") || "0";
  } catch {
    return "0";
  }
}

function shortTxid(txid: string): string {
  return txid.slice(0, 8) + "…" + txid.slice(-6);
}

// ── Component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

type TabType = "UTXO" | "NEVM" | "ROLLUX" | "ZKSYS";

export function TransactionsPage() {
  const { rpcClient, activeNetwork, evmAddress } = useNetworkStore();
  const [activeTab, setActiveTab] = useState<TabType>("UTXO");
  
  // UTXO State
  const [txs, setTxs] = useState<RawTransaction[]>([]);
  const [skip, setSkip] = useState(0);
  
  // EVM State
  const [evmTxs, setEvmTxs] = useState<EvmTransaction[]>([]);
  const [evmPage, setEvmPage] = useState(1);
  
  // Common State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "receive" | "send">("all");
  const [search, setSearch] = useState("");
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);

  const loadUtxo = useCallback(async (newSkip: number, append = false) => {
    setLoading(true);
    setError(null);
    const result = await rpcClient.listTransactions("*", PAGE_SIZE + 1, newSkip);
    if (result.ok) {
      const data = result.value;
      const hasNext = data.length > PAGE_SIZE;
      const page = hasNext ? data.slice(0, PAGE_SIZE) : data;
      // listtransactions returns oldest-first; reverse for newest-first display
      const reversed = [...page].reverse();
      setTxs(prev => append ? [...prev, ...reversed] : reversed);
      setHasMore(hasNext);
      setSkip(newSkip);
    } else {
      const msg = result.error?.message ?? "";
      const noWallet = msg.toLowerCase().includes("wallet") || msg.includes("-18");
      setError(
        noWallet
          ? "No wallet loaded. Set a Wallet Name in Settings or load a wallet in your node."
          : (msg || "Could not load UTXO transactions.")
      );
    }
    setLoading(false);
  }, [rpcClient]);

  const loadEvm = useCallback(async (chain: EvmChainIdentifier, pageNo: number, append = false) => {
    if (chain === "ZKSYS") {
      setEvmTxs([]);
      setHasMore(false);
      setLoading(false);
      return;
    }
    
    if (!evmAddress) {
      setError("No EVM address configured. Set your 0x address in Settings.");
      setEvmTxs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const result = await fetchEvmTransactions(chain, activeNetwork, evmAddress, pageNo, PAGE_SIZE);
    
    if (result.ok) {
      const newTxs = result.data || [];
      setEvmTxs(prev => append ? [...prev, ...newTxs] : newTxs);
      setHasMore(newTxs.length === PAGE_SIZE);
      setEvmPage(pageNo);
    } else {
      setError(result.error || `Could not load ${chain} transactions.`);
    }
    setLoading(false);
  }, [activeNetwork, evmAddress]);

  const loadData = useCallback((tab: TabType, append = false) => {
    if (tab === "UTXO") {
      loadUtxo(append ? skip + PAGE_SIZE : 0, append);
    } else if (tab === "NEVM") {
      loadEvm("SYSCOIN_NEVM", append ? evmPage + 1 : 1, append);
    } else if (tab === "ROLLUX") {
      loadEvm("ROLLUX", append ? evmPage + 1 : 1, append);
    } else if (tab === "ZKSYS") {
      loadEvm("ZKSYS", 1, false);
    }
  }, [loadUtxo, loadEvm, skip, evmPage]);

  // Initial load or tab switch
  useEffect(() => {
    // Reset filters
    setSearch("");
    setFilter("all");
    loadData(activeTab, false);
  }, [activeTab, loadData]);

  function copyTxid(txid: string) {
    navigator.clipboard.writeText(txid).then(() => {
      setCopiedTxid(txid);
      setTimeout(() => setCopiedTxid(null), 1500);
    });
  }

  const isTestnet = activeNetwork !== "MAINNET";

  // Filter UTXO
  const displayedUtxo = txs.filter(tx => {
    if (filter !== "all" && tx.category !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        tx.txid.toLowerCase().includes(q) ||
        (tx.address ?? "").toLowerCase().includes(q) ||
        (tx.label ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filter EVM
  const displayedEvm = evmTxs.filter(tx => {
    const isReceive = tx.to.toLowerCase() === evmAddress?.toLowerCase();
    const isSend = tx.from.toLowerCase() === evmAddress?.toLowerCase();
    
    if (filter === "receive" && !isReceive) return false;
    if (filter === "send" && !isSend) return false;
    
    if (search) {
      const q = search.toLowerCase();
      return (
        tx.hash.toLowerCase().includes(q) ||
        tx.from.toLowerCase().includes(q) ||
        tx.to.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const renderUtxoTable = () => (
    <table className="tx-table" id="tx-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Address</th>
          <th>Label</th>
          <th className="col-amount">Amount (SYS)</th>
          <th>Conf.</th>
          <th>TXID</th>
        </tr>
      </thead>
      <tbody>
        {displayedUtxo.map((tx, i) => {
          const isReceive = tx.category === "receive";
          const isSend    = tx.category === "send";
          const amtCls    = isReceive ? "tx-amount--positive" : isSend ? "tx-amount--negative" : "tx-amount--zero";
          const confirmed = tx.confirmations >= 6;
          return (
            <tr key={`${tx.txid}-${i}`}>
              <td style={{ whiteSpace: "nowrap", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {formatDate(tx.time)}
              </td>
              <td>
                <span className={`tx-type-badge tx-type-badge--${isReceive ? "receive" : isSend ? "send" : "other"}`}>
                  {isReceive ? "↓ Receive" : isSend ? "↑ Send" : tx.category}
                </span>
              </td>
              <td>
                <span
                  className="font-mono"
                  style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", wordBreak: "break-all" }}
                  title={tx.address}
                >
                  {tx.address ? (tx.address.length > 20 ? tx.address.slice(0, 12) + "…" + tx.address.slice(-8) : tx.address) : "—"}
                </span>
              </td>
              <td style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                {tx.label || "—"}
              </td>
              <td className="col-amount">
                <span className={`font-mono text-sm ${amtCls}`}>
                  {isReceive ? "+" : isSend ? "−" : ""}{formatSys(tx.amount)}
                </span>
              </td>
              <td>
                <span
                  title={`${tx.confirmations} confirmations`}
                  style={{ display: "flex", alignItems: "center", fontSize: "var(--text-xs)" }}
                >
                  <span className={`tx-conf-dot ${confirmed ? "tx-conf-dot--confirmed" : "tx-conf-dot--unconfirmed"}`} />
                  {tx.confirmations >= 999 ? "999+" : tx.confirmations}
                </span>
              </td>
              <td>
                <button
                  className="tx-txid"
                  title={`Click to copy: ${tx.txid}`}
                  onClick={() => copyTxid(tx.txid)}
                  id={`tx-copy-${i}`}
                >
                  {copiedTxid === tx.txid ? "✓ Copied" : shortTxid(tx.txid)}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const renderEvmTable = () => (
    <table className="tx-table" id="tx-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Address</th>
          <th>Status</th>
          <th className="col-amount">Amount</th>
          <th>Conf.</th>
          <th>TXID</th>
        </tr>
      </thead>
      <tbody>
        {displayedEvm.map((tx, i) => {
          const isReceive = tx.to.toLowerCase() === evmAddress?.toLowerCase();
          const isSend    = tx.from.toLowerCase() === evmAddress?.toLowerCase();
          const amtCls    = isReceive ? "tx-amount--positive" : isSend ? "tx-amount--negative" : "tx-amount--zero";
          const confirmed = parseInt(tx.confirmations) >= 6;
          const displayAddr = isReceive ? tx.from : tx.to;
          
          return (
            <tr key={`${tx.hash}-${i}`}>
              <td style={{ whiteSpace: "nowrap", fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
                {formatDate(parseInt(tx.timeStamp))}
              </td>
              <td>
                <span className={`tx-type-badge tx-type-badge--${isReceive ? "receive" : isSend ? "send" : "other"}`}>
                  {isReceive ? "↓ Receive" : isSend ? "↑ Send" : "Contract"}
                </span>
              </td>
              <td>
                <span
                  className="font-mono"
                  style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", wordBreak: "break-all" }}
                  title={displayAddr}
                >
                  {displayAddr ? (displayAddr.length > 20 ? displayAddr.slice(0, 12) + "…" + displayAddr.slice(-8) : displayAddr) : "—"}
                </span>
              </td>
              <td style={{ fontSize: "var(--text-xs)" }}>
                 {tx.isError === "1" ? <span className="text-danger">Failed</span> : <span className="text-success">Success</span>}
              </td>
              <td className="col-amount">
                <span className={`font-mono text-sm ${amtCls}`}>
                  {isReceive ? "+" : isSend ? "−" : ""}{formatEvmSys(tx.value)}
                </span>
              </td>
              <td>
                <span
                  title={`${tx.confirmations} confirmations`}
                  style={{ display: "flex", alignItems: "center", fontSize: "var(--text-xs)" }}
                >
                  <span className={`tx-conf-dot ${confirmed ? "tx-conf-dot--confirmed" : "tx-conf-dot--unconfirmed"}`} />
                  {parseInt(tx.confirmations) >= 999 ? "999+" : tx.confirmations}
                </span>
              </td>
              <td>
                <button
                  className="tx-txid"
                  title={`Click to copy: ${tx.hash}`}
                  onClick={() => copyTxid(tx.hash)}
                  id={`tx-copy-${i}`}
                >
                  {copiedTxid === tx.hash ? "✓ Copied" : shortTxid(tx.hash)}
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const displayedCount = activeTab === "UTXO" ? displayedUtxo.length : displayedEvm.length;

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center mb-4">
        <div>
          <h1>Transaction History</h1>
          <p>Multi-chain transaction history — newest first.</p>
        </div>
        <button
          id="tx-refresh-btn"
          className="btn btn-ghost btn-sm"
          onClick={() => loadData(activeTab, false)}
          disabled={loading}
        >
          ⟳ Refresh
        </button>
      </div>

      {isTestnet && (
        <WarningBox severity="warn" title={`${activeNetwork} active`} className="mb-6">
          Showing testnet transactions only. Switch to Mainnet in Settings to see real funds.
        </WarningBox>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6" style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-2)" }}>
        <button 
          className={`btn btn-sm ${activeTab === "UTXO" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setActiveTab("UTXO")}
        >
          Syscoin Native (UTXO)
        </button>
        <button 
          className={`btn btn-sm ${activeTab === "NEVM" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setActiveTab("NEVM")}
        >
          Syscoin NEVM
        </button>
        <button 
          className={`btn btn-sm ${activeTab === "ROLLUX" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setActiveTab("ROLLUX")}
        >
          Rollux
        </button>
        <button 
          className={`btn btn-sm ${activeTab === "ZKSYS" ? "btn-primary" : "btn-ghost"}`}
          onClick={() => setActiveTab("ZKSYS")}
        >
          zkSYS
        </button>
      </div>

      {error && <WarningBox severity="danger" className="mb-6">{error}</WarningBox>}
      {activeTab === "ZKSYS" && !error && (
        <WarningBox severity="info" className="mb-6">zkSYS Block explorer is currently unavailable.</WarningBox>
      )}

      {/* Toolbar */}
      <div className="tx-toolbar">
        <input
          id="tx-search"
          className="input tx-search"
          placeholder="Search by TXID, address…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          disabled={activeTab === "ZKSYS"}
        />
        {(["all", "receive", "send"] as const).map(f => (
          <button
            key={f}
            id={`tx-filter-${f}`}
            className={`btn btn-sm ${filter === f ? "btn-secondary" : "btn-ghost"}`}
            onClick={() => setFilter(f)}
            style={{ border: filter === f ? "1px solid var(--color-accent)" : "none" }}
            disabled={activeTab === "ZKSYS"}
          >
            {f === "all" ? "All" : f === "receive" ? "↓ Received" : "↑ Sent"}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && displayedCount === 0 ? (
        <div className="flex items-center gap-4" style={{ marginTop: "var(--space-8)" }}>
          <div className="spinner" />
          <span className="text-secondary">Loading transactions…</span>
        </div>
      ) : displayedCount === 0 && !loading ? (
        <div className="tx-empty card">
          <div style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>📭</div>
          <p className="text-secondary">No transactions found.</p>
          {search && (
            <button className="btn btn-ghost btn-sm mt-4" onClick={() => setSearch("")}>
              Clear search
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="tx-table-wrap">
            {activeTab === "UTXO" ? renderUtxoTable() : renderEvmTable()}
          </div>

          {hasMore && (
            <div className="tx-load-more">
              <button
                className="btn btn-ghost"
                onClick={() => loadData(activeTab, true)}
                disabled={loading}
                id="tx-load-more-btn"
              >
                {loading ? <><div className="spinner" /> Loading…</> : "Load more"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
