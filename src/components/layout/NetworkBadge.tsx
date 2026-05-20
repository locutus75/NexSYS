/**
 * components/layout/NetworkBadge.tsx
 * Always-visible network environment badge.
 * MAINNET = green, TESTNET = amber, REGTEST = red, DEVNET = purple.
 */

import { useNetworkStore } from "../../store/networkStore";
import type { NetworkEnvironment } from "../../types/chain";
import { NETWORK_LABELS } from "../../types/chain";

const DOTS: Record<NetworkEnvironment, string> = {
  MAINNET: "●",
  TESTNET: "●",
  REGTEST: "●",
  DEVNET:  "●",
  UNKNOWN: "○",
};

interface Props {
  onClick?: () => void;
}

export function NetworkBadge({ onClick }: Props) {
  const network = useNetworkStore((s) => s.activeNetwork);
  const variant = network.toLowerCase() as
    "mainnet" | "testnet" | "regtest" | "devnet" | "unknown";

  return (
    <button
      id="network-badge"
      className={`badge badge--${variant}`}
      onClick={onClick}
      title={`Active network: ${NETWORK_LABELS[network]}. Click to switch.`}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <span aria-hidden="true">{DOTS[network]}</span>
      {NETWORK_LABELS[network]}
    </button>
  );
}
