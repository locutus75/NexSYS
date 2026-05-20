/**
 * features/receive/ReceivePage.tsx
 * Chain-aware receive address screen.
 */

import { useState, useCallback } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { QrCode } from "../../components/QrCode";
import { useNetworkStore } from "../../store/networkStore";
import type { ChainEnvironment } from "../../types/chain";
import { CHAIN_LABELS } from "../../types/chain";
import "./ReceivePage.css";

const CHAIN_WARNINGS: Partial<Record<ChainEnvironment, string>> = {
  SYSCOIN_NATIVE_UTXO:
    "This is a Syscoin Native / UTXO address. Only send native SYS to this address. " +
    "Do not send NEVM or Rollux assets here unless the sender explicitly supports this format.",
  SYSCOIN_NEVM:
    "This is an EVM-style 0x address. Only send assets from Syscoin NEVM, Rollux, or compatible EVM environments. " +
    "Native UTXO SYS must be bridged before it can arrive here.",
  ROLLUX:
    "This is a Rollux address. Only send Rollux-native assets here.",
  ZKSYS:
    "zkSYS address generation is not yet available. Check the zkSYS status screen for updates.",
};

export function ReceivePage() {
  const { rpcClient, activeNetwork } = useNetworkStore();
  const [chain, setChain] = useState<ChainEnvironment>("SYSCOIN_NATIVE_UTXO");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateAddress = useCallback(async () => {
    if (chain === "ZKSYS") return;
    setLoading(true);
    setError(null);
    setAddress(null);
    setCopied(false);
    const result = await rpcClient.getNewAddress(label || "");
    if (result.ok) {
      setAddress(result.value);
    } else {
      setError("Could not generate address. Is your node connected?");
    }
    setLoading(false);
  }, [rpcClient, chain, label]);

  function handleCopy() {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const warning = CHAIN_WARNINGS[chain];
  const isTestnet = activeNetwork !== "MAINNET";

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>Receive SYS</h1>
        <p>Generate an address to receive SYS. Always check the chain type before sharing.</p>
      </div>

      <div className="receive-layout">
        <div className="card">
          {/* Chain selector tabs */}
          <div className="receive-tabs" role="tablist">
            {(["SYSCOIN_NATIVE_UTXO", "SYSCOIN_NEVM", "ROLLUX", "ZKSYS"] as ChainEnvironment[]).map((c) => (
              <button
                key={c}
                id={`receive-tab-${c}`}
                role="tab"
                aria-selected={chain === c}
                className={`receive-tab ${chain === c ? "receive-tab--active" : ""}`}
                onClick={() => { setChain(c); setAddress(null); setError(null); }}
              >
                {CHAIN_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Warning */}
          {warning && (
            <WarningBox severity={chain === "ZKSYS" ? "info" : "warn"} className="mt-4">
              {warning}
            </WarningBox>
          )}

          {isTestnet && (
            <WarningBox severity="warn" className="mt-4">
              You are on <strong>{activeNetwork}</strong>. This address is for test funds only.
            </WarningBox>
          )}

          {/* Label */}
          {chain !== "ZKSYS" && (
            <div className="form-group mt-6">
              <label className="form-label" htmlFor="receive-label">Address Label (optional)</label>
              <input
                id="receive-label"
                className="input"
                placeholder="e.g. Exchange deposit, Personal"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          )}

          {/* Generate button */}
          {chain !== "ZKSYS" && (
            <button
              id="receive-generate-btn"
              className="btn btn-primary"
              onClick={generateAddress}
              disabled={loading}
            >
              {loading ? <><div className="spinner" /> Generating…</> : "Generate New Address"}
            </button>
          )}

          {/* Error */}
          {error && <WarningBox severity="danger" className="mt-4">{error}</WarningBox>}

          {/* Address display */}
          {address && (
            <div className="receive-address-box mt-6">
              <div className="receive-qr" aria-label="QR code">
                <QrCode
                  value={address}
                  size={176}
                  fgColor="#0f172a"
                  bgColor="#ffffff"
                  className="receive-qr__svg"
                />
              </div>
              <div className="receive-address-text">
                <div className="stat-label mb-2">Your {CHAIN_LABELS[chain]} Address</div>
                <div className="receive-address-value font-mono" id="receive-address-display">
                  {address}
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    id="receive-copy-btn"
                    className="btn btn-primary"
                    onClick={handleCopy}
                  >
                    {copied ? "✓ Copied!" : "Copy Address"}
                  </button>
                  <button className="btn btn-ghost btn-sm" disabled title="Hardware wallet verification (coming soon)">
                    Verify on Device
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
