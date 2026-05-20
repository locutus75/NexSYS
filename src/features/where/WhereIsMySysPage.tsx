/**
 * features/where/WhereIsMySysPage.tsx
 * "Where Is My SYS?" — cross-chain balance overview with plain-language explanations.
 * MVP 2 killer feature.
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { ChainBadge } from "../../components/shared/ChainBadge";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import { fetchAllEvmBalances } from "../../services/evmRpcClient";
import "./WhereIsMySysPage.css";

// ── Chain definitions ─────────────────────────────────────────────────────────

interface ChainInfo {
  id: "SYSCOIN_NATIVE_UTXO" | "SYSCOIN_NEVM" | "ROLLUX" | "ZKSYS";
  name: string;
  balance: string | null;
  loading: boolean;
  error?: string;
  explanation: string;
  canDo: { label: string; primary?: boolean }[];
  cannotDo: string[];
  addressFormat: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function WhereIsMySysPage() {
  const { rpcClient, activeNetwork, evmAddress } = useNetworkStore();

  const [utxoBalance,   setUtxoBalance]   = useState<string | null>(null);
  const [utxoLoading,   setUtxoLoading]   = useState(true);
  const [utxoError,     setUtxoError]     = useState<string | null>(null);
  const [nevmBalance,   setNevmBalance]   = useState<string | null>(null);
  const [rolluxBalance, setRolluxBalance] = useState<string | null>(null);
  const [evmLoading,    setEvmLoading]    = useState(false);
  const [evmErrors,     setEvmErrors]     = useState<string[]>([]);

  const fetchAll = useCallback(async () => {
    // UTXO
    setUtxoLoading(true);
    setUtxoError(null);
    const res = await rpcClient.getBalances();
    if (res.ok) {
      const n = res.value.mine.trusted;
      setUtxoBalance(n.toFixed(8).replace(/\.?0+$/, "") || "0");
    } else {
      setUtxoError(res.error?.message ?? "Could not fetch UTXO balance.");
    }
    setUtxoLoading(false);

    // EVM
    if (evmAddress) {
      setEvmLoading(true);
      const { nevm, rollux, errors } = await fetchAllEvmBalances(activeNetwork, evmAddress);
      setNevmBalance(nevm?.sys ?? null);
      setRolluxBalance(rollux?.sys ?? null);
      setEvmErrors(errors);
      setEvmLoading(false);
    }
  }, [rpcClient, activeNetwork, evmAddress]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const isTestnet = activeNetwork !== "MAINNET";

  // ── Total (rough sum) ────────────────────────────────────────────────────────
  const totalSys = [utxoBalance, nevmBalance, rolluxBalance]
    .map(b => parseFloat(b ?? "0"))
    .reduce((a, b) => a + b, 0);

  // ── Chain card data ──────────────────────────────────────────────────────────
  const chains: ChainInfo[] = [
    {
      id: "SYSCOIN_NATIVE_UTXO",
      name: "Syscoin Native (UTXO)",
      balance: utxoBalance,
      loading: utxoLoading,
      error: utxoError ?? undefined,
      explanation:
        "This is your native UTXO balance — the same model as Bitcoin. " +
        "It lives on the Syscoin base layer and is the most secure form of SYS custody. " +
        "You need a Syscoin native address (starts with sys1…) to receive it.",
      canDo: [
        { label: "Send SYS natively", primary: true },
        { label: "Receive SYS (sys1… address)", primary: true },
        { label: "Run a Sentry Node" },
        { label: "Bridge to NEVM / Rollux" },
        { label: "Coin control" },
      ],
      cannotDo: [
        "Send directly to an 0x EVM address",
        "Interact with EVM smart contracts",
        "Use in Rollux dApps",
      ],
      addressFormat: "sys1q… (bech32)",
    },
    {
      id: "SYSCOIN_NEVM",
      name: "Syscoin NEVM",
      balance: nevmBalance,
      loading: evmLoading && nevmBalance === null && !!evmAddress,
      explanation:
        "NEVM (Native EVM) is Syscoin's Ethereum-compatible layer. " +
        "SYS here is the same SYS but wrapped for use in EVM smart contracts, DeFi, and dApps. " +
        "It requires an 0x Ethereum-style address. You bridge UTXO SYS → NEVM to use it here.",
      canDo: [
        { label: "Use EVM dApps", primary: true },
        { label: "Interact with smart contracts", primary: true },
        { label: "Bridge back to UTXO" },
        { label: "Bridge to Rollux" },
      ],
      cannotDo: [
        "Spend directly as UTXO SYS",
        "Use as Sentry Node collateral without bridging back",
      ],
      addressFormat: "0x… (EVM / hex)",
    },
    {
      id: "ROLLUX",
      name: "Rollux (L2)",
      balance: rolluxBalance,
      loading: evmLoading && rolluxBalance === null && !!evmAddress,
      explanation:
        "Rollux is Syscoin's optimistic rollup Layer 2. " +
        "Transactions are cheaper and faster here. " +
        "SYS on Rollux has been bridged from NEVM. " +
        "It uses the same 0x address format as NEVM.",
      canDo: [
        { label: "Fast, cheap transactions", primary: true },
        { label: "Use Rollux dApps", primary: true },
        { label: "Bridge back to NEVM" },
      ],
      cannotDo: [
        "Use as UTXO SYS without bridging back through NEVM",
        "Directly pay Sentry Node collateral",
      ],
      addressFormat: "0x… (same as NEVM)",
    },
    {
      id: "ZKSYS",
      name: "zkSYS",
      balance: null,
      loading: false,
      explanation:
        "zkSYS is Syscoin's upcoming zero-knowledge proof layer. " +
        "When public interfaces become available, your zkSYS proving status and balance will appear here. " +
        "No action is required now.",
      canDo: [{ label: "Coming soon — zkSYS readiness (MVP 6)" }],
      cannotDo: [],
      addressFormat: "TBD",
    },
  ];

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Where Is My SYS?</h1>
          <p>A plain-language view of your SYS across all Syscoin chain layers.</p>
        </div>
        <button id="wims-refresh-btn" className="btn btn-ghost btn-sm" onClick={fetchAll}>
          ⟳ Refresh
        </button>
      </div>

      {isTestnet && (
        <WarningBox severity="warn" title={`${activeNetwork} active`} className="mb-6">
          You are on a test network. Balances here have no real value.
        </WarningBox>
      )}

      {!evmAddress && (
        <WarningBox severity="info" title="0x address not set" className="mb-6">
          NEVM and Rollux balances require your Ethereum-compatible address.{" "}
          <Link to="/settings" className="text-accent" style={{ textDecoration: "underline" }}>
            Add it in Settings →
          </Link>
        </WarningBox>
      )}

      {evmErrors.length > 0 && (
        <WarningBox severity="warn" className="mb-4">
          {evmErrors.map((e, i) => <div key={i}>{e}</div>)}
        </WarningBox>
      )}

      {/* Total bar */}
      <div className="wims-total-bar mb-6">
        <div>
          <div className="stat-label mb-1">Estimated Total</div>
          <div className="wims-balance-large" style={{ fontSize: "1.6rem" }}>
            {totalSys.toFixed(4)} <span className="text-muted" style={{ fontSize: "1rem" }}>SYS</span>
          </div>
          <div className="wims-balance-sub">Across all chains where balances are available</div>
        </div>
        <div className="text-right">
          <div className="stat-label mb-1">Active Network</div>
          <div className="text-sm font-semibold">{activeNetwork}</div>
          {evmAddress && (
            <div className="font-mono text-xs text-muted mt-1" title={evmAddress}>
              {evmAddress.slice(0, 8)}…{evmAddress.slice(-6)}
            </div>
          )}
        </div>
      </div>

      <div className="wims-layout">
        {chains.map(chain => (
          <div key={chain.id} className="wims-chain-card">
            <div className="wims-chain-header">
              <ChainBadge chain={chain.id} />
              <div style={{ textAlign: "right" }}>
                {chain.loading ? (
                  <div className="flex items-center gap-2" style={{ justifyContent: "flex-end" }}>
                    <div className="spinner" style={{ width: 14, height: 14 }} />
                    <span className="text-xs text-muted">Loading…</span>
                  </div>
                ) : chain.id === "ZKSYS" ? (
                  <span className="badge badge--devnet">Future chain</span>
                ) : !evmAddress && (chain.id === "SYSCOIN_NEVM" || chain.id === "ROLLUX") ? (
                  <span className="text-xs text-muted">No 0x address set</span>
                ) : (
                  <div>
                    <div className="wims-balance-large">
                      {chain.error ? <span className="text-danger text-sm">Error</span>
                        : chain.balance !== null ? `${chain.balance} SYS`
                        : "— SYS"}
                    </div>
                    {chain.error && (
                      <div className="text-xs text-danger" title={chain.error}>
                        {chain.error.slice(0, 60)}{chain.error.length > 60 ? "…" : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="wims-chain-body">
              <p className="wims-explain">{chain.explanation}</p>

              <div className="mb-3">
                <div className="text-xs text-muted mb-2">WHAT YOU CAN DO HERE</div>
                <div className="wims-can-do">
                  {chain.canDo.map((a, i) => (
                    <span key={i} className={`wims-action-tag ${a.primary ? "wims-action-tag--primary" : ""}`}>
                      {a.primary ? "✓" : "·"} {a.label}
                    </span>
                  ))}
                </div>
              </div>

              {chain.cannotDo.length > 0 && (
                <div>
                  <div className="text-xs text-muted mb-2">CANNOT DO WITHOUT BRIDGING</div>
                  <div className="wims-can-do">
                    {chain.cannotDo.map((a, i) => (
                      <span key={i} className="wims-action-tag" style={{ color: "var(--color-danger)", borderColor: "rgba(239,68,68,0.3)" }}>
                        ✕ {a}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 text-xs text-muted">
                Address format: <span className="font-mono">{chain.addressFormat}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
