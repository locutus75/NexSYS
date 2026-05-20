/**
 * features/transactions/TransactionsPage.tsx
 * Live transaction history from Syscoin Core via listtransactions RPC.
 */

import { useEffect, useState, useCallback } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type { RawTransaction } from "../../services/syscoinRpcClient";
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

function shortTxid(txid: string): string {
  return txid.slice(0, 8) + "…" + txid.slice(-6);
}

// ── Component ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export function TransactionsPage() {
  const { rpcClient, activeNetwork } = useNetworkStore();
  const [txs, setTxs] = useState<RawTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<"all" | "receive" | "send">("all");
  const [search, setSearch] = useState("");
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);

  const load = useCallback(async (newSkip: number, append = false) => {
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
          : (msg || "Could not load transactions.")
      );
    }
    setLoading(false);
  }, [rpcClient]);

  useEffect(() => { load(0); }, [load]);

  function copyTxid(txid: string) {
    navigator.clipboard.writeText(txid).then(() => {
      setCopiedTxid(txid);
      setTimeout(() => setCopiedTxid(null), 1500);
    });
  }

  const displayed = txs.filter(tx => {
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

  const isTestnet = activeNetwork !== "MAINNET";

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Transaction History</h1>
          <p>All wallet transactions from Syscoin Core — newest first.</p>
        </div>
        <button
          id="tx-refresh-btn"
          className="btn btn-ghost btn-sm"
          onClick={() => load(0)}
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

      {error && <WarningBox severity="danger" className="mb-6">{error}</WarningBox>}

      {/* Toolbar */}
      <div className="tx-toolbar">
        <input
          id="tx-search"
          className="input tx-search"
          placeholder="Search by TXID, address, or label…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {(["all", "receive", "send"] as const).map(f => (
          <button
            key={f}
            id={`tx-filter-${f}`}
            className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`}
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "All" : f === "receive" ? "↓ Received" : "↑ Sent"}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading && txs.length === 0 ? (
        <div className="flex items-center gap-4" style={{ marginTop: "var(--space-8)" }}>
          <div className="spinner" />
          <span className="text-secondary">Loading transactions…</span>
        </div>
      ) : displayed.length === 0 && !loading ? (
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
                {displayed.map((tx, i) => {
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
          </div>

          {hasMore && (
            <div className="tx-load-more">
              <button
                className="btn btn-ghost"
                onClick={() => load(skip + PAGE_SIZE, true)}
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
