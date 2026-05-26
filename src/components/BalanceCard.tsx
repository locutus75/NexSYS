/**
 * components/BalanceCard.tsx
 * Reusable balance card for each chain environment.
 */

import type { ChainEnvironment, NetworkEnvironment } from "../types/chain";
import { ChainBadge } from "./shared/ChainBadge";

interface Props {
  chain: ChainEnvironment;
  network: NetworkEnvironment;
  confirmed: string;
  unconfirmed?: string;
  spendable?: string;
  locked?: string;
  loading?: boolean;
  error?: string;
  /** Action node to render below an error message, e.g. a button */
  errorAction?: React.ReactNode;
  /** Description shown below the amount, explaining what this chain is. */
  description?: string;
  className?: string;
}

export function BalanceCard({
  chain,
  network,
  confirmed,
  unconfirmed,
  spendable,
  locked,
  loading,
  error,
  errorAction,
  description,
  className = "",
}: Props) {
  const isTestnet = network !== "MAINNET";

  return (
    <div className={`card card--balance card--${network.toLowerCase()} ${className}`}>
      <div className="balance-card__header">
        <ChainBadge chain={chain} />
        {isTestnet && (
          <span className="badge badge--testnet" style={{ fontSize: "0.65rem" }}>
            {network}
          </span>
        )}
      </div>

      <div className="balance-card__body">
        {loading ? (
          <div className="flex items-center gap-2" style={{ marginTop: "var(--space-4)" }}>
            <div className="spinner" />
            <span className="text-muted text-sm">Loading…</span>
          </div>
        ) : error ? (
          <div className="balance-card__error text-sm text-danger" style={{ marginTop: "var(--space-3)" }}>
            {error.split("\n").map((line, i) => (
              <span key={i} style={{ display: "block", fontFamily: line.startsWith("syscoin-cli") ? "monospace" : undefined, fontSize: line.startsWith("syscoin-cli") ? "0.75em" : undefined, opacity: i > 0 ? 0.8 : 1 }}>
                {line}
              </span>
            ))}
            {errorAction && <div className="mt-3">{errorAction}</div>}
          </div>
        ) : (
          <>
            <div className="stat-value" style={{ marginTop: "var(--space-3)" }}>
              {confirmed} <span className="balance-card__unit">SYS</span>
            </div>
            <div className="stat-label">Confirmed</div>

            {(unconfirmed && unconfirmed !== "0" && unconfirmed !== "0.00000000") && (
              <div className="balance-card__row mt-2">
                <span className="text-xs text-muted">Pending</span>
                <span className="text-xs text-warning font-mono">{unconfirmed} SYS</span>
              </div>
            )}
            {(locked && locked !== "0" && locked !== "0.00000000") && (
              <div className="balance-card__row">
                <span className="text-xs text-muted">Locked</span>
                <span className="text-xs text-secondary font-mono">{locked} SYS</span>
              </div>
            )}
            {spendable !== undefined && (
              <div className="balance-card__row">
                <span className="text-xs text-muted">Spendable</span>
                <span className="text-xs text-success font-mono">{spendable} SYS</span>
              </div>
            )}
          </>
        )}
      </div>

      {description && (
        <p className="balance-card__desc">{description}</p>
      )}
    </div>
  );
}
