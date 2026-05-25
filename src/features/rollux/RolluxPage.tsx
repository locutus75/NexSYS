import { useState, useEffect } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import { NETWORK_LABELS } from "../../types/chain";
import { fetchAllEvmBalances } from "../../services/evmRpcClient";

export function RolluxPage() {
  const { activeNetwork, evmAddress } = useNetworkStore();
  const [balance, setBalance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!evmAddress) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    fetchAllEvmBalances(activeNetwork, evmAddress)
      .then(res => {
        if (!active) return;
        setBalance(res.rollux ? res.rollux.sys : "—");
      })
      .catch(() => {
        if (active) setBalance("—");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [evmAddress, activeNetwork]);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>Rollux L2</h1>
        <p>The Syscoin Optimistic Rollup layer.</p>
      </div>

      <div className="card" style={{ maxWidth: 640, marginBottom: "var(--space-6)" }}>
        <div className="flex items-center gap-4" style={{ marginBottom: "var(--space-5)" }}>
          <img src="/rollux.svg" alt="Rollux" style={{ width: "32px", height: "32px" }} />
          <div>
            <div className="font-semibold">Rollux Chain Environment</div>
            <span className="badge badge--success mt-1">Live on {NETWORK_LABELS[activeNetwork]}</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted text-xs">Status</span>
            <span className="text-sm font-semibold text-success">ONLINE</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted text-xs">Network</span>
            <span className="text-sm">{NETWORK_LABELS[activeNetwork]}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted text-xs">Public Interface</span>
            <span className="text-sm">EVM RPC (ethers.js compatible)</span>
          </div>
          {evmAddress && (
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span className="text-muted text-xs">Wallet Balance</span>
              <span className="text-sm font-mono">
                {loading ? "..." : balance} SYS
              </span>
            </div>
          )}
        </div>
      </div>

      <WarningBox severity="info" title="About Rollux">
        Rollux is Syscoin's Optimistic Rollup (L2) designed for high scalability, near-instant transaction speeds, and extremely low fees. It relies on Syscoin's UTXO layer for Proof-of-Data Availability (PoDA) and security.
      </WarningBox>
    </div>
  );
}
