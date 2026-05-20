/**
 * components/shared/ChainBadge.tsx
 * Small pill badge labelling a chain environment.
 */

import type { ChainEnvironment } from "../../types/chain";
import { CHAIN_LABELS } from "../../types/chain";

interface Props {
  chain: ChainEnvironment;
  className?: string;
}

const VARIANT_MAP: Record<ChainEnvironment, string> = {
  SYSCOIN_NATIVE_UTXO: "chain-pill--utxo",
  SYSCOIN_NEVM:        "chain-pill--nevm",
  ROLLUX:              "chain-pill--rollux",
  ZKSYS:               "chain-pill--zksys",
  UNKNOWN:             "",
};

export function ChainBadge({ chain, className = "" }: Props) {
  return (
    <span className={`chain-pill ${VARIANT_MAP[chain]} ${className}`}>
      {CHAIN_LABELS[chain]}
    </span>
  );
}
