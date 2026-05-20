/**
 * features/zksys/ZkSysPage.tsx
 * zkSYS readiness and status screen.
 */

import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import { NETWORK_LABELS } from "../../types/chain";

export function ZkSysPage() {
  const { activeNetwork } = useNetworkStore();

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>zkSYS</h1>
        <p>Future chain environment — zkSYS readiness status.</p>
      </div>

      <div className="card" style={{ maxWidth: 640, marginBottom: "var(--space-6)" }}>
        <div className="flex items-center gap-4" style={{ marginBottom: "var(--space-5)" }}>
          <span style={{ fontSize: "2rem" }}>⚡</span>
          <div>
            <div className="font-semibold">zkSYS Chain Environment</div>
            <span className="badge badge--devnet mt-1">Future — Not yet available</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted text-xs">Status</span>
            <span className="text-sm text-secondary">NOT_CONFIGURED</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted text-xs">Network</span>
            <span className="text-sm">{NETWORK_LABELS[activeNetwork]}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="text-muted text-xs">Public Interface</span>
            <span className="text-sm text-secondary">Pending</span>
          </div>
        </div>
      </div>

      <WarningBox severity="info" title="About zkSYS">
        zkSYS is a future Syscoin chain environment. When public interfaces become available,
        this screen will show zkSYS balance, proving status, and bridge integration.
        All interfaces are behind a service abstraction — real endpoints will be connected
        without breaking changes to the wallet.
      </WarningBox>

      <WarningBox severity="warn" title="zkSYS Warning" className="mt-4">
        zkSYS support may involve different transaction, bridge, or proving states.
        Always verify the active network and destination before signing any zkSYS transaction.
      </WarningBox>
    </div>
  );
}
