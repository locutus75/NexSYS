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
import { convertSysxToNative } from "../../services/bridgeService";
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
  const [zksysBalance,  setZksysBalance]  = useState<string | null>(null);
  const [evmLoading,    setEvmLoading]    = useState(false);
  const [evmErrors,     setEvmErrors]     = useState<string[]>([]);

  const [sysxBalance,        setSysxBalance]        = useState<string | null>(null);
  const [convertAmount,      setConvertAmount]      = useState<string>("");
  const [amountError,        setAmountError]        = useState<string | null>(null);
  const [walletInfo,         setWalletInfo]         = useState<any>(null);
  const [unlockDialogOpen,   setUnlockDialogOpen]   = useState(false);
  const [passphrase,         setPassphrase]         = useState("");
  const [unlockError,        setUnlockError]        = useState<string | null>(null);
  const [unlockTimeout]                             = useState("60");
  const [unlocking,          setUnlocking]          = useState(false);
  const [converting,         setConverting]         = useState(false);
  const [convertError,       setConvertError]       = useState<string | null>(null);
  const [convertSuccessTxid, setConvertSuccessTxid] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    // UTXO
    setUtxoLoading(true);
    setUtxoError(null);

    // Fetch wallet info (for lock status)
    try {
      const walletRes = await rpcClient.getWalletInfoFull();
      if (walletRes.ok) {
        setWalletInfo(walletRes.value);
      }
    } catch (e) {
      console.warn("Failed to fetch wallet info:", e);
    }

    const res = await rpcClient.getBalances();
    if (res.ok) {
      const n = res.value.mine.trusted;
      setUtxoBalance(n.toFixed(8).replace(/\.?0+$/, "") || "0");
    } else {
      setUtxoError(res.error?.message ?? "Could not fetch UTXO balance.");
    }

    // Fetch SYSX unspent allocations
    try {
      const unspentRes = await rpcClient.listUnspent(1, 9999999);
      if (unspentRes.ok && Array.isArray(unspentRes.value)) {
        let totalSysx = 0;
        for (const utxo of unspentRes.value) {
          const guid = (utxo as any).asset_guid !== undefined ? (utxo as any).asset_guid : (utxo as any).assetguid;
          if (guid && guid.toString() === "123456") {
            const amount = (utxo as any).asset_amount !== undefined ? (utxo as any).asset_amount : (utxo as any).assetamount;
            totalSysx += Number(amount);
          }
        }
        const formattedBalance = totalSysx > 0 ? totalSysx.toFixed(8).replace(/\.?0+$/, "") : "0";
        setSysxBalance(formattedBalance);
        
        // Default the input amount if it hasn't been set yet or exceeds current balance
        setConvertAmount(prev => {
          if (!prev || parseFloat(prev) === 0 || parseFloat(prev) > totalSysx) {
            return formattedBalance;
          }
          return prev;
        });
      } else {
        setSysxBalance("0");
        setConvertAmount("0");
      }
    } catch (e) {
      console.warn("Failed to fetch SYSX unspent UTXOs:", e);
      setSysxBalance("0");
      setConvertAmount("0");
    }

    setUtxoLoading(false);

    // EVM
    if (evmAddress) {
      setEvmLoading(true);
      const { nevm, rollux, zksys, errors } = await fetchAllEvmBalances(activeNetwork, evmAddress);
      setNevmBalance(nevm?.sys ?? null);
      setRolluxBalance(rollux?.sys ?? null);
      setZksysBalance(zksys?.sys ?? null);
      setEvmErrors(errors);
      setEvmLoading(false);
    }
  }, [rpcClient, activeNetwork, evmAddress]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlocking(true);
    setUnlockError(null);
    try {
      const res = await rpcClient.call<null>("walletpassphrase", [
        passphrase,
        parseInt(unlockTimeout, 10),
      ]);
      if (res.ok) {
        setUnlockDialogOpen(false);
        setPassphrase("");
        const info = await rpcClient.getWalletInfoFull();
        if (info.ok) setWalletInfo(info.value);
        // Continue to conversion after successful unlock
        await executeConversion();
      } else {
        setUnlockError(res.error?.message ?? "Invalid passphrase.");
      }
    } catch (err: any) {
      setUnlockError(err.message || "Failed to unlock wallet.");
    } finally {
      setUnlocking(false);
    }
  };

  const handleAmountChange = (val: string) => {
    let sanitized = val.replace(/,/g, '.');
    sanitized = sanitized.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    setConvertAmount(sanitized);

    if (!sanitized) {
      setAmountError("Amount is required.");
      return;
    }
    const num = parseFloat(sanitized);
    if (isNaN(num) || num <= 0) {
      setAmountError("Please enter a valid positive number.");
      return;
    }
    const total = parseFloat(sysxBalance || "0");
    if (num > total) {
      setAmountError(`Cannot exceed available balance of ${total} SYSX.`);
      return;
    }
    setAmountError(null);
  };

  const executeConversion = async () => {
    if (!convertAmount || parseFloat(convertAmount) <= 0 || amountError) return;
    setConverting(true);
    setConvertError(null);
    setConvertSuccessTxid(null);
    try {
      const amountNum = parseFloat(convertAmount);
      const txid = await convertSysxToNative(
        rpcClient,
        activeNetwork,
        amountNum
      );
      setConvertSuccessTxid(txid);
      setSysxBalance("0");
      setConvertAmount("");
      await fetchAll();
    } catch (err: any) {
      const errMsg = err.message || "Unknown error";
      if (errMsg.toLowerCase().includes("walletpassphrase") || errMsg.toLowerCase().includes("locked")) {
        setUnlockDialogOpen(true);
      } else {
        setConvertError(`Failed to convert: ${errMsg}`);
      }
    } finally {
      setConverting(false);
    }
  };

  const handleConvertClick = async () => {
    setConvertError(null);
    setConvertSuccessTxid(null);
    if (walletInfo && walletInfo.unlocked_until === 0) {
      setUnlockDialogOpen(true);
    } else {
      await executeConversion();
    }
  };

  const isTestnet = activeNetwork !== "MAINNET";

  // ── Total (rough sum) ────────────────────────────────────────────────────────
  const totalSys = [utxoBalance, nevmBalance, rolluxBalance, zksysBalance]
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
      balance: zksysBalance,
      loading: evmLoading && zksysBalance === null && !!evmAddress,
      explanation:
        "zkSYS is Syscoin's zero-knowledge proof layer. " +
        "You can view your zkSYS balance here. More features coming soon.",
      canDo: [{ label: "View zkSYS balance" }],
      cannotDo: [],
      addressFormat: "0x… (same as NEVM)",
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

      {sysxBalance && parseFloat(sysxBalance) > 0 && (
        <WarningBox severity="info" title="Wrapped SYS (SYSX) Detected" className="mb-6">
          <div className="flex flex-col gap-3" style={{ textAlign: "left" }}>
            <p>
              We found <strong>{sysxBalance} SYSX</strong> in your native UTXO wallet. 
              This is wrapped SYS (typically received from a bridge claim). 
              To spend these funds as standard Syscoin, they must be converted back to native SYS.
            </p>
            
            <div className="flex flex-col gap-2" style={{ maxWidth: "360px", width: "100%" }}>
              <label htmlFor="sysx-convert-amount" className="text-xs font-semibold text-muted">
                AMOUNT TO CONVERT
              </label>
              <div className="flex gap-2">
                <div className="wims-input-container">
                  <input
                    id="sysx-convert-amount"
                    type="text"
                    inputMode="decimal"
                    className="input input-mono w-full btn-sm"
                    style={{ height: "36px", paddingRight: "4.5rem" }}
                    placeholder="0.00000000"
                    value={convertAmount}
                    onChange={(e) => handleAmountChange(e.target.value)}
                    disabled={converting}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm wims-max-btn"
                    onClick={() => handleAmountChange(sysxBalance)}
                    disabled={converting}
                  >
                    Max
                  </button>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ height: "36px" }}
                  onClick={handleConvertClick}
                  disabled={converting || !!amountError || !convertAmount || parseFloat(convertAmount) <= 0}
                >
                  {converting ? (
                    <div className="flex items-center gap-2">
                      <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }} />
                      <span>Converting…</span>
                    </div>
                  ) : (
                    "Convert"
                  )}
                </button>
              </div>
              {amountError && (
                <div className="text-danger text-xs font-semibold mt-1">
                  ⚠️ {amountError}
                </div>
              )}
            </div>
          </div>
        </WarningBox>
      )}

      {convertSuccessTxid && (
        <WarningBox severity="success" title="Conversion successful!" className="mb-6">
          <div style={{ textAlign: "left" }}>
            Successfully converted SYSX back to native SYS.<br />
            <strong>Transaction ID:</strong> <span className="font-mono text-xs break-all">{convertSuccessTxid}</span>
          </div>
        </WarningBox>
      )}

      {convertError && (
        <WarningBox severity="danger" title="Conversion failed" className="mb-6">
          <div style={{ textAlign: "left" }}>{convertError}</div>
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
                ) : !evmAddress && (chain.id === "SYSCOIN_NEVM" || chain.id === "ROLLUX" || chain.id === "ZKSYS") ? (
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

      {unlockDialogOpen && (
        <div className="dialog-overlay" onClick={() => setUnlockDialogOpen(false)} role="presentation">
          <form
            className="dialog animate-fade-in"
            onSubmit={handleUnlock}
            onClick={(e) => e.stopPropagation()}
            style={{ width: "100%", maxWidth: "420px" }}
          >
            <div className="dialog__header">
              <span className="dialog__icon">🔑</span>
              <h3 className="dialog__title">Unlock Node Wallet for Conversion</h3>
            </div>
            <p className="dialog__desc" style={{ marginBottom: "var(--space-4)", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
              Enter your <strong>Syscoin UTXO Node Passphrase</strong> to unlock your local wallet and execute the SYSX conversion.
            </p>
            
            <div className="form-group" style={{ textAlign: "left", width: "100%", marginBottom: "var(--space-3)" }}>
              <input
                type="password"
                className="input input-mono w-full"
                placeholder="Node Wallet Passphrase"
                value={passphrase}
                onChange={(e) => {
                  setPassphrase(e.target.value);
                  setUnlockError(null);
                }}
                autoFocus
                required
              />
              {unlockError && (
                <div className="text-danger text-xs mt-2 font-semibold">
                  ⚠️ {unlockError}
                </div>
              )}
            </div>
            
            <div className="dialog__actions" style={{ display: "flex", gap: "10px", justifyContent: "flex-end", width: "100%" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setUnlockDialogOpen(false);
                  setPassphrase("");
                  setUnlockError(null);
                }}
                disabled={unlocking}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={unlocking || !passphrase}
              >
                {unlocking ? "Unlocking…" : "Unlock & Convert"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
