/**
 * features/utxos/CoinControlPage.tsx
 * UTXO list and Wallet Addresses from Syscoin Core.
 * Shows all spendable outputs with amounts, confirmations, and addresses.
 * Also lists all received addresses with inline label updating.
 */

import { useEffect, useState, useCallback, useMemo } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type { RawUtxo, RawReceivedAddress } from "../../services/syscoinRpcClient";
import "./CoinControlPage.css";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSys(n: number): string {
  return n.toFixed(8).replace(/\.?0+$/, "") || "0";
}

function shortAddr(addr: string): string {
  return addr.length > 24 ? addr.slice(0, 12) + "…" + addr.slice(-8) : addr;
}

function shortId(txid: string, vout: number): string {
  return txid.slice(0, 8) + "…" + txid.slice(-4) + ":" + vout;
}

type SortKey = "amount" | "confirmations" | "address";
type SortDir = "asc" | "desc";

type AddrSortKey = "address" | "label" | "amount" | "txs";

// ── Component ─────────────────────────────────────────────────────────────────

export function CoinControlPage() {
  const { rpcClient, activeNetwork } = useNetworkStore();
  const [activeTab, setActiveTab] = useState<"utxos" | "addresses">("utxos");

  // UTXO state
  const [utxos, setUtxos] = useState<RawUtxo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<SortKey>("amount");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showSpendableOnly, setShowSpendableOnly] = useState(false);

  // Address state
  const [addresses, setAddresses] = useState<RawReceivedAddress[]>([]);
  const [editingAddress, setEditingAddress] = useState<string | null>(null);
  const [editLabelValue, setEditLabelValue] = useState("");
  const [savingAddress, setSavingAddress] = useState<string | null>(null);
  const [addrSortKey, setAddrSortKey] = useState<AddrSortKey>("amount");
  const [addrSortDir, setAddrSortDir] = useState<SortDir>("desc");

  // Common UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelected(new Set());

    let allUtxos: RawUtxo[] = [];
    const utxoResult = await rpcClient.listUnspent(0, 9999999, []);
    if (utxoResult.ok) {
      allUtxos = utxoResult.value;
    } else {
      const msg = utxoResult.error?.message ?? "";
      const noWallet = msg.toLowerCase().includes("wallet") || msg.includes("-18");
      setError(
        noWallet
          ? "No wallet loaded. Set a Wallet Name in Settings or load a wallet in your node."
          : (msg || "Could not load UTXOs.")
      );
      setLoading(false);
      return;
    }

    // 1b. Fetch Locked UTXOs
    try {
      const lockedUtxos = await rpcClient.getLockedUtxos();
      allUtxos = [...allUtxos, ...lockedUtxos];
    } catch (e) {
      console.warn("Could not load locked UTXOs", e);
    }
    
    setUtxos(allUtxos);

    // 2. Fetch Addresses
    const addrResult = await rpcClient.listReceivedByAddress(0, true);
    if (addrResult.ok) {
      setAddresses(addrResult.value);
    }

    setLoading(false);
  }, [rpcClient]);

  useEffect(() => {
    load();
  }, [load]);

  // UTXO logic helpers
  function utxoKey(u: RawUtxo) { return `${u.txid}:${u.vout}`; }

  function toggleSelect(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === displayedUtxos.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(displayedUtxos.map(utxoKey)));
    }
  }

  function copyId(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(text);
      setTimeout(() => setCopiedId(null), 1500);
    });
  }

  function handleSortUtxos(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function handleSortAddresses(key: AddrSortKey) {
    if (addrSortKey === key) setAddrSortDir(d => d === "asc" ? "desc" : "asc");
    else { setAddrSortKey(key); setAddrSortDir("desc"); }
  }

  async function handleLock(unlock: boolean) {
    const selectedArr = Array.from(selected).map(key => {
      const [txid, vout] = key.split(":");
      return { txid, vout: parseInt(vout, 10) };
    });
    if (selectedArr.length === 0) return;
    
    const res = await rpcClient.lockUnspent(unlock, selectedArr);
    if (res.ok) {
      load(); // Reload everything
      setSelected(new Set()); // Clear selection after lock/unlock
    } else {
      alert(`Error ${unlock ? 'unlocking' : 'locking'}: ` + (res.error?.message ?? "Unknown error"));
    }
  }

  // Save label RPC
  const saveLabel = async (address: string, newLabel: string) => {
    setSavingAddress(address);
    const res = await rpcClient.setLabel(address, newLabel);
    if (res.ok) {
      // Reload received addresses
      const addrResult = await rpcClient.listReceivedByAddress(0, true);
      if (addrResult.ok) {
        setAddresses(addrResult.value);
      }
      // Also reload UTXOs since labels might have updated there too
      const utxoResult = await rpcClient.listUnspent(0, 9999999, []);
      if (utxoResult.ok) {
        setUtxos(utxoResult.value);
      }
      setEditingAddress(null);
    } else {
      alert("Error saving label: " + (res.error?.message ?? "Unknown error"));
    }
    setSavingAddress(null);
  };

  // Filter & Sort UTXOs
  const filteredUtxos = useMemo(() => {
    let list = utxos;
    if (showSpendableOnly) list = list.filter(u => u.spendable);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(u =>
        u.txid.toLowerCase().includes(q) ||
        (u.address ?? "").toLowerCase().includes(q) ||
        (u.label ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [utxos, search, showSpendableOnly]);

  const displayedUtxos = useMemo(() => {
    return [...filteredUtxos].sort((a, b) => {
      let diff = 0;
      if (sortKey === "amount") diff = a.amount - b.amount;
      else if (sortKey === "confirmations") diff = a.confirmations - b.confirmations;
      else if (sortKey === "address") diff = (a.address ?? "").localeCompare(b.address ?? "");
      return sortDir === "asc" ? diff : -diff;
    });
  }, [filteredUtxos, sortKey, sortDir]);

  // Filter & Sort Addresses
  const filteredAddresses = useMemo(() => {
    if (!search) return addresses;
    const q = search.toLowerCase();
    return addresses.filter(
      a =>
        a.address.toLowerCase().includes(q) ||
        (a.label ?? "").toLowerCase().includes(q)
    );
  }, [addresses, search]);

  const displayedAddresses = useMemo(() => {
    return [...filteredAddresses].sort((a, b) => {
      let diff = 0;
      if (addrSortKey === "address") diff = a.address.localeCompare(b.address);
      else if (addrSortKey === "label") diff = (a.label ?? "").localeCompare(b.label ?? "");
      else if (addrSortKey === "amount") diff = a.amount - b.amount;
      else if (addrSortKey === "txs") diff = a.txids.length - b.txids.length;
      return addrSortDir === "asc" ? diff : -diff;
    });
  }, [filteredAddresses, addrSortKey, addrSortDir]);

  // UTXO statistics
  const totalSys = utxos.reduce((s, u) => s + u.amount, 0);
  const spendableSys = utxos.filter(u => u.spendable).reduce((s, u) => s + u.amount, 0);
  const selectedUtxos = displayedUtxos.filter(u => selected.has(utxoKey(u)));
  const selectedSys = selectedUtxos.reduce((s, u) => s + u.amount, 0);

  // Address statistics
  const totalReceivedSys = addresses.reduce((s, a) => s + a.amount, 0);
  const labeledAddressesCount = addresses.filter(a => a.label).length;

  const isTestnet = activeNetwork !== "MAINNET";

  const SortArrow = ({ col, current, dir }: { col: string; current: string; dir: SortDir }) =>
    current === col ? (dir === "asc" ? " ↑" : " ↓") : "";

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Coin Control</h1>
          <p>Unspent outputs and wallet addresses from your Syscoin Core wallet.</p>
        </div>
        <button
          id="cc-refresh-btn"
          className="btn btn-ghost btn-sm"
          onClick={load}
          disabled={loading}
        >
          ⟳ Refresh
        </button>
      </div>

      {isTestnet && (
        <WarningBox severity="warn" title={`${activeNetwork} active`} className="mb-6">
          Showing testnet data. Switch to Mainnet in Settings to see real funds.
        </WarningBox>
      )}

      {error && <WarningBox severity="danger" className="mb-6">{error}</WarningBox>}

      {/* Tabs */}
      {!error && (
        <div className="cc-tabs">
          <button
            className={`cc-tab ${activeTab === "utxos" ? "cc-tab--active" : ""}`}
            onClick={() => {
              setActiveTab("utxos");
              setSearch("");
            }}
          >
            Unspent Outputs (UTXOs)
          </button>
          <button
            className={`cc-tab ${activeTab === "addresses" ? "cc-tab--active" : ""}`}
            onClick={() => {
              setActiveTab("addresses");
              setSearch("");
            }}
          >
            Received Addresses & Labels
          </button>
        </div>
      )}

      {/* UTXOs TAB CONTENT */}
      {!error && activeTab === "utxos" && (
        <>
          {/* UTXO Summary */}
          <div className="cc-summary">
            <div className="cc-summary-card">
              <div className="cc-summary-label">Total UTXOs</div>
              <div className="cc-summary-value">{utxos.length}</div>
            </div>
            <div className="cc-summary-card">
              <div className="cc-summary-label">Total Balance</div>
              <div className="cc-summary-value">
                {formatSys(totalSys)}{" "}
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>SYS</span>
              </div>
            </div>
            <div className="cc-summary-card">
              <div className="cc-summary-label">Spendable</div>
              <div className="cc-summary-value cc-summary-value--success">
                {formatSys(spendableSys)}{" "}
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>SYS</span>
              </div>
            </div>
            {selected.size > 0 && (
              <div className="cc-summary-card" style={{ borderColor: "var(--color-accent)" }}>
                <div className="cc-summary-label">Selected ({selected.size})</div>
                <div className="cc-summary-value cc-summary-value--accent">
                  {formatSys(selectedSys)}{" "}
                  <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>SYS</span>
                </div>
              </div>
            )}
          </div>

          {/* Selection bar */}
          {selected.size > 0 && (
            <div className="cc-selection-bar">
              <span className="text-sm font-semibold">
                {selected.size} UTXO{selected.size !== 1 ? "s" : ""} selected — {formatSys(selectedSys)} SYS
              </span>
              <div className="flex gap-2">
                <button className="btn btn-ghost btn-sm" onClick={() => handleLock(false)} title="Lock selected UTXOs">
                  🔒 Lock
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => handleLock(true)} title="Unlock selected UTXOs">
                  🔓 Unlock
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const ids = [...selected].join("\n");
                    navigator.clipboard.writeText(ids);
                  }}
                  title="Copy selected TXID:vout pairs"
                >
                  Copy IDs
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* UTXO Toolbar */}
          <div className="cc-toolbar">
            <input
              id="cc-search"
              className="input cc-search"
              placeholder="Search by TXID, address, or label…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm text-secondary" style={{ cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={showSpendableOnly}
                onChange={e => setShowSpendableOnly(e.target.checked)}
                id="cc-spendable-filter"
              />
              Spendable only
            </label>
          </div>

          {/* UTXO Table */}
          {loading && utxos.length === 0 ? (
            <div className="flex items-center gap-4" style={{ marginTop: "var(--space-8)" }}>
              <div className="spinner" />
              <span className="text-secondary">Loading UTXOs…</span>
            </div>
          ) : displayedUtxos.length === 0 && !loading ? (
            <div className="cc-empty card">
              <div style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>🪙</div>
              <p className="text-secondary">
                {utxos.length === 0 ? "No UTXOs found in this wallet." : "No UTXOs match your filter."}
              </p>
            </div>
          ) : (
            <div className="cc-table-wrap animate-fade-in">
              <table className="cc-table" id="cc-table">
                <thead>
                  <tr>
                    <th style={{ width: 40 }}>
                      <input
                        type="checkbox"
                        id="cc-select-all"
                        checked={displayedUtxos.length > 0 && selected.size === displayedUtxos.length}
                        onChange={toggleAll}
                        title="Select all"
                      />
                    </th>
                    <th>TXID:vout</th>
                    <th onClick={() => handleSortUtxos("address")} title="Sort by address">
                      Address <SortArrow col="address" current={sortKey} dir={sortDir} />
                    </th>
                    <th>Label</th>
                    <th className="col-amount" onClick={() => handleSortUtxos("amount")} title="Sort by amount">
                      Amount (SYS) <SortArrow col="amount" current={sortKey} dir={sortDir} />
                    </th>
                    <th className="col-confs" onClick={() => handleSortUtxos("confirmations")} title="Sort by confirmations">
                      Conf. <SortArrow col="confirmations" current={sortKey} dir={sortDir} />
                    </th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedUtxos.map((u, i) => {
                    const key = utxoKey(u);
                    const isSelected = selected.has(key);
                    const confirmed = u.confirmations >= 6;
                    const confWidth = Math.min(48, Math.max(4, (u.confirmations / 100) * 48));
                    return (
                      <tr
                        key={key}
                        className={isSelected ? "cc-row--selected" : ""}
                        onClick={() => toggleSelect(key)}
                        style={{ cursor: "pointer" }}
                        id={`cc-row-${i}`}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(key)}
                            id={`cc-cb-${i}`}
                          />
                        </td>
                        <td>
                          <button
                            className="cc-utxo-id"
                            title={`Click to copy: ${u.txid}:${u.vout}`}
                            onClick={e => {
                              e.stopPropagation();
                              copyId(`${u.txid}:${u.vout}`);
                            }}
                            id={`cc-copy-${i}`}
                          >
                            {copiedId === `${u.txid}:${u.vout}` ? "✓ Copied" : shortId(u.txid, u.vout)}
                          </button>
                        </td>
                        <td>
                          <span
                            className="font-mono"
                            style={{ fontSize: "0.7rem", color: "var(--color-text-secondary)", wordBreak: "break-all" }}
                            title={u.address}
                          >
                            {u.address ? shortAddr(u.address) : "—"}
                          </span>
                        </td>
                        <td style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                          {u.label || "—"}
                        </td>
                        <td className="col-amount">
                          <span className="font-mono text-sm font-semibold">
                            {formatSys(u.amount)}
                          </span>
                        </td>
                        <td className="col-confs">
                          <span
                            style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, fontSize: "var(--text-xs)" }}
                            title={`${u.confirmations} confirmations`}
                          >
                            <span
                              className="cc-conf-bar"
                              style={{
                                width: confWidth,
                                background: confirmed ? "var(--color-success)" : "var(--color-warning)",
                              }}
                            />
                            {u.confirmations >= 999 ? "999+" : u.confirmations}
                          </span>
                        </td>
                        <td>
                          {u.locked ? (
                            <span className="cc-spendable-badge cc-spendable-badge--no" title="Locked UTXOs cannot be spent automatically.">
                              🔒 Locked
                            </span>
                          ) : (
                            <span className={`cc-spendable-badge cc-spendable-badge--${u.spendable ? "yes" : "no"}`}>
                              {u.spendable ? "✓ Spendable" : "Not Spendable"}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ADDRESSES TAB CONTENT */}
      {!error && activeTab === "addresses" && (
        <>
          {/* Address Summary */}
          <div className="cc-summary">
            <div className="cc-summary-card">
              <div className="cc-summary-label">Total Addresses</div>
              <div className="cc-summary-value">{addresses.length}</div>
            </div>
            <div className="cc-summary-card">
              <div className="cc-summary-label">Total Received</div>
              <div className="cc-summary-value cc-summary-value--success">
                {formatSys(totalReceivedSys)}{" "}
                <span style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>SYS</span>
              </div>
            </div>
            <div className="cc-summary-card">
              <div className="cc-summary-label">Labeled Addresses</div>
              <div className="cc-summary-value" style={{ color: "var(--color-accent)" }}>
                {labeledAddressesCount}
              </div>
            </div>
          </div>

          {/* Address Toolbar */}
          <div className="cc-toolbar">
            <input
              id="cc-search-address"
              className="input cc-search"
              placeholder="Search by address or label…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Address Table */}
          {loading && addresses.length === 0 ? (
            <div className="flex items-center gap-4" style={{ marginTop: "var(--space-8)" }}>
              <div className="spinner" />
              <span className="text-secondary">Loading wallet addresses…</span>
            </div>
          ) : displayedAddresses.length === 0 && !loading ? (
            <div className="cc-empty card">
              <div style={{ fontSize: "2rem", marginBottom: "var(--space-3)" }}>📁</div>
              <p className="text-secondary">
                {addresses.length === 0 ? "No received addresses found." : "No addresses match your filter."}
              </p>
            </div>
          ) : (
            <div className="cc-table-wrap animate-fade-in">
              <table className="cc-table" id="cc-address-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSortAddresses("address")} title="Sort by address">
                      Address <SortArrow col="address" current={addrSortKey} dir={addrSortDir} />
                    </th>
                    <th onClick={() => handleSortAddresses("label")} title="Sort by label">
                      Label <SortArrow col="label" current={addrSortKey} dir={addrSortDir} />
                    </th>
                    <th className="col-amount" onClick={() => handleSortAddresses("amount")} title="Sort by amount">
                      Total Received (SYS) <SortArrow col="amount" current={addrSortKey} dir={addrSortDir} />
                    </th>
                    <th className="col-confs" onClick={() => handleSortAddresses("txs")} title="Sort by transactions count">
                      Tx Count <SortArrow col="txs" current={addrSortKey} dir={addrSortDir} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedAddresses.map((item, i) => {
                    const isCopied = copiedId === item.address;
                    return (
                      <tr key={item.address} id={`cc-addr-row-${i}`}>
                        <td>
                          <button
                            className="cc-utxo-id font-mono"
                            title={`Click to copy: ${item.address}`}
                            onClick={() => copyId(item.address)}
                            id={`cc-addr-copy-${i}`}
                            style={{ display: "inline-block" }}
                          >
                            {isCopied ? "✓ Copied" : shortAddr(item.address)}
                          </button>
                        </td>
                        <td>
                          {editingAddress === item.address ? (
                            <div className="cc-label-edit-container" onClick={e => e.stopPropagation()}>
                              <input
                                type="text"
                                className="input input-sm cc-label-input"
                                value={editLabelValue}
                                onChange={e => setEditLabelValue(e.target.value)}
                                disabled={savingAddress === item.address}
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === "Enter") saveLabel(item.address, editLabelValue);
                                  if (e.key === "Escape") setEditingAddress(null);
                                }}
                                id={`cc-label-input-${i}`}
                              />
                              <button
                                className="btn btn-primary btn-xs"
                                onClick={() => saveLabel(item.address, editLabelValue)}
                                disabled={savingAddress === item.address}
                                id={`cc-label-save-${i}`}
                              >
                                {savingAddress === item.address ? "..." : "Save"}
                              </button>
                              <button
                                className="btn btn-ghost btn-xs"
                                onClick={() => setEditingAddress(null)}
                                disabled={savingAddress === item.address}
                                id={`cc-label-cancel-${i}`}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="cc-label-display-container">
                              <span className="cc-label-text">
                                {item.label ? (
                                  item.label
                                ) : (
                                  <span style={{ color: "var(--color-text-muted)", fontStyle: "italic" }}>
                                    No label
                                  </span>
                                )}
                              </span>
                              <button
                                className="btn btn-ghost btn-xs cc-label-edit-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingAddress(item.address);
                                  setEditLabelValue(item.label || "");
                                }}
                                title="Edit Label"
                                id={`cc-label-edit-btn-${i}`}
                              >
                                ✏️
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="col-amount">
                          <span className="font-mono text-sm font-semibold">
                            {formatSys(item.amount)}
                          </span>
                        </td>
                        <td className="col-confs">
                          <span className="font-mono text-sm">
                            {item.txids.length}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
