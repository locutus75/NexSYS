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
import { DEFAULT_EVM_RPC, getEvmRpcEndpoints } from "../../services/evmRpcClient";
import "./NetworkSelectorPage.css";

// Reusable modal component
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div 
      className="dialog-overlay" 
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }} 
      style={{ zIndex: 2000 }}
    >
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dialog__header" style={{ justifyContent: "space-between", width: "100%", marginBottom: "16px" }}>
          <h3 className="dialog__title" style={{ margin: 0 }}>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ padding: "0 8px", fontSize: "20px" }}>×</button>
        </div>
        <div>
          {children}
        </div>
      </div>
    </div>
  );
}

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

  // RPC Config state
  const [configNetwork, setConfigNetwork] = useState<NetworkEnvironment | null>(null);
  const [rpcForm, setRpcForm] = useState({ nevm: "", rollux: "", zksys: "" });

  function openConfig(env: NetworkEnvironment, e: React.MouseEvent) {
    e.stopPropagation();
    const endpoints = getEvmRpcEndpoints(env);
    setRpcForm({
      nevm: endpoints.nevm,
      rollux: endpoints.rollux,
      zksys: endpoints.zksys
    });
    setConfigNetwork(env);
  }

  function saveConfig() {
    if (!configNetwork) return;
    localStorage.setItem(`nexsys_rpc_config_${configNetwork}`, JSON.stringify(rpcForm));
    setConfigNetwork(null);
    // Dispatch event to re-fetch balances immediately if modifying the active network
    if (configNetwork === activeNetwork) {
      window.dispatchEvent(new Event("nexsys_rpc_config_updated"));
    }
  }

  function resetConfig() {
    if (!configNetwork) return;
    localStorage.removeItem(`nexsys_rpc_config_${configNetwork}`);
    setConfigNetwork(null);
    if (configNetwork === activeNetwork) {
      window.dispatchEvent(new Event("nexsys_rpc_config_updated"));
    }
  }

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
            <div key={env} style={{ position: "relative" }}>
              <button
                id={`network-select-${env}`}
                className={`network-card network-card--${variant} ${isActive ? "network-card--active" : ""}`}
                onClick={() => handleSelect(env)}
                disabled={isActive}
                style={{ width: "100%", height: "100%" }}
              >
                <div className={`badge badge--${variant} network-card__badge`}>
                  {NETWORK_LABELS[env]}
                </div>
                <p className="network-card__desc">{NETWORK_DESCS[env]}</p>
                {isActive && (
                  <div className="network-card__active-label">Currently active</div>
                )}
              </button>
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, padding: '4px 8px', fontSize: '18px' }}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openConfig(env, e); }}
                title={`Configure RPC URLs for ${env}`}
              >
                ⚙️
              </button>
            </div>
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

      <Modal
        open={!!configNetwork}
        onClose={() => setConfigNetwork(null)}
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            Configure RPC URLs
            {configNetwork && (
              <span className={`badge badge--${configNetwork.toLowerCase()}`}>
                ● {NETWORK_LABELS[configNetwork]}
              </span>
            )}
          </div>
        }
      >
        <p className="text-secondary text-sm mb-4">
          Override the default RPC URLs. Leave a field blank to use no URL.
        </p>
        <div className="form-group mb-4">
          <label className="form-label">Syscoin NEVM RPC</label>
          <input 
            className="input mt-2" 
            value={rpcForm.nevm} 
            onChange={e => setRpcForm({...rpcForm, nevm: e.target.value})} 
            placeholder={configNetwork ? DEFAULT_EVM_RPC[configNetwork]?.nevm : ""}
          />
        </div>
        <div className="form-group mb-4">
          <label className="form-label">Rollux L2 RPC</label>
          <input 
            className="input mt-2" 
            value={rpcForm.rollux} 
            onChange={e => setRpcForm({...rpcForm, rollux: e.target.value})} 
            placeholder={configNetwork ? DEFAULT_EVM_RPC[configNetwork]?.rollux : ""}
          />
        </div>
        <div className="form-group mb-6">
          <label className="form-label">zkSYS L2 RPC</label>
          <input 
            className="input mt-2" 
            value={rpcForm.zksys} 
            onChange={e => setRpcForm({...rpcForm, zksys: e.target.value})} 
            placeholder={configNetwork ? DEFAULT_EVM_RPC[configNetwork]?.zksys : ""}
          />
        </div>
        <div className="flex justify-between items-center gap-4 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <button className="btn btn-ghost text-secondary" onClick={resetConfig}>
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button className="btn btn-secondary" onClick={() => setConfigNetwork(null)}>Cancel</button>
            <button className="btn btn-primary" onClick={saveConfig}>Save Configuration</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
