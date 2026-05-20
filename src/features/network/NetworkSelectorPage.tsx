/**
 * features/network/NetworkSelectorPage.tsx
 * Explicit network environment switcher — MAINNET / TESTNET / REGTEST / DEVNET.
 */

import { useState } from "react";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type { NetworkEnvironment } from "../../types/chain";
import { NETWORK_LABELS } from "../../types/chain";
import "./NetworkSelectorPage.css";

const NETWORK_DESCS: Record<NetworkEnvironment, string> = {
  MAINNET: "Live Syscoin network. Real SYS, real value. Never mix with testnet data.",
  TESTNET: "Public test network. Testnet SYS has no real value. Safe for testing.",
  REGTEST: "Local regression test environment. Fully isolated. For developers only.",
  DEVNET:  "Development/devnet environment. Custom configuration. For advanced users.",
  UNKNOWN: "Unknown environment.",
};

const ENVIRONMENTS: NetworkEnvironment[] = ["MAINNET", "TESTNET", "REGTEST", "DEVNET"];

export function NetworkSelectorPage() {
  const { activeNetwork, setNetwork } = useNetworkStore();
  const [pending, setPending] = useState<NetworkEnvironment | null>(null);

  function handleSelect(network: NetworkEnvironment) {
    if (network === activeNetwork) return;
    setPending(network);
  }

  function handleConfirm() {
    if (pending) setNetwork(pending);
    setPending(null);
  }

  const isMainnetRisk = activeNetwork === "MAINNET" && pending !== "MAINNET";
  const isTestnetToMainnet = activeNetwork !== "MAINNET" && pending === "MAINNET";

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>Network Environment</h1>
        <p>
          Switching networks completely isolates all balances, addresses, transaction history,
          and bridge state. Mainnet and testnet data are never mixed.
        </p>
      </div>

      <WarningBox severity="warn" title="Critical: network isolation" className="mb-8">
        Always verify which network you are on before sending or bridging funds.
        Test network funds have no mainnet value and must never be sent to mainnet addresses.
      </WarningBox>

      <div className="network-grid">
        {ENVIRONMENTS.map((env) => {
          const isActive = env === activeNetwork;
          const variant = env.toLowerCase() as "mainnet" | "testnet" | "regtest" | "devnet";
          return (
            <button
              key={env}
              id={`network-select-${env}`}
              className={`network-card ${isActive ? "network-card--active" : ""}`}
              onClick={() => handleSelect(env)}
              disabled={isActive}
            >
              <div className={`badge badge--${variant} network-card__badge`}>
                {NETWORK_LABELS[env]}
              </div>
              <p className="network-card__desc">{NETWORK_DESCS[env]}</p>
              {isActive && (
                <div className="network-card__active-label">Currently active</div>
              )}
            </button>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!pending}
        title={`Switch to ${pending ? NETWORK_LABELS[pending] : ""}?`}
        description={
          isMainnetRisk
            ? `You are leaving Mainnet. All balances, addresses, and history shown will switch to ${pending ? NETWORK_LABELS[pending] : ""}. Your mainnet data is preserved but hidden while on another network.`
            : isTestnetToMainnet
            ? `You are switching to Mainnet. Only real SYS will be shown. Testnet data is preserved but hidden.`
            : `Switching to ${pending ? NETWORK_LABELS[pending] : ""}. All on-screen data will update to reflect this network.`
        }
        confirmLabel={`Switch to ${pending ? NETWORK_LABELS[pending] : ""}`}
        cancelLabel="Stay on current network"
        danger={isMainnetRisk || isTestnetToMainnet}
        onConfirm={handleConfirm}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
