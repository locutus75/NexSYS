/**
 * features/send/SendPage.tsx
 * Chain-aware send flow with address classification and safety validation.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { classifyAddress } from "../../services/addressClassifier";
import { validateSendIntent } from "../../services/sendValidator";
import { useNetworkStore } from "../../store/networkStore";
import type { ChainEnvironment } from "../../types/chain";
import { CHAIN_LABELS } from "../../types/chain";
import type { ValidationAction } from "../../services/sendValidator";
import type { RawUtxo, RawWalletInfoFull } from "../../services/syscoinRpcClient";
import { CustomDropdown } from "../../components/shared/CustomDropdown";
import type { CustomDropdownOption } from "../../components/shared/CustomDropdown";
import "./SendPage.css";

const SOURCE_CHAINS: ChainEnvironment[] = ["SYSCOIN_NATIVE_UTXO", "SYSCOIN_NEVM", "ROLLUX", "ZKSYS"];

export function SendPage() {
  const { activeNetwork, rpcClient } = useNetworkStore();
  const [sourceChain, setSourceChain] = useState<ChainEnvironment>("SYSCOIN_NATIVE_UTXO");
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [validation, setValidation] = useState<{ action: ValidationAction; reason: string; suggested?: string } | null>(null);
  const [addressLabel, setAddressLabel] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [txid, setTxid] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  // Address selection state
  const [selectedSourceAddress, setSelectedSourceAddress] = useState("auto");
  const [utxos, setUtxos] = useState<RawUtxo[]>([]);
  const [sourceAddresses, setSourceAddresses] = useState<{ address: string; balance: number; label?: string }[]>([]);
  const [walletAddresses, setWalletAddresses] = useState<{ address: string; balance: number; label?: string }[]>([]);
  const [destinationSelectMode, setDestinationSelectMode] = useState("custom");

  // Live balance
  const [spendable, setSpendable] = useState<number | null>(null);
  const [balanceError, setBalanceError] = useState<string | null>(null);

  // Fee estimate
  const [feeRate, setFeeRate] = useState<number | null>(null);   // SYS/kB
  const [estFee, setEstFee]   = useState<number | null>(null);   // estimated fee for this tx

  const [feeTarget, setFeeTarget] = useState<6 | 3 | 1>(6);      // confirmation target blocks

  // Wallet lock & status state
  const [walletInfo, setWalletInfo] = useState<RawWalletInfoFull | null>(null);
  const [walletStatusError, setWalletStatusError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlockTimeout, setUnlockTimeout] = useState("300");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  // Fetch balance on mount and when wallet changes
  const fetchBalance = useCallback(async () => {
    const utxoRes = await rpcClient.listUnspent(0, 9999999, []);
    const addrRes = await rpcClient.listReceivedByAddress(0, true);

    if (utxoRes.ok && addrRes.ok) {
      setUtxos(utxoRes.value);

      // Group spendable coins by address to compute balances
      const balanceMap: Record<string, number> = {};
      let totalSpendable = 0;
      for (const u of utxoRes.value) {
        if (!u.address) continue;
        if (u.spendable) {
          totalSpendable += u.amount;
          balanceMap[u.address] = (balanceMap[u.address] || 0) + u.amount;
        }
      }
      setSpendable(totalSpendable);

      // Map received addresses list to calculate current balances
      const list = addrRes.value.map(item => ({
        address: item.address,
        balance: balanceMap[item.address] || 0,
        label: item.label,
      }));

      // Sort wallet addresses: positive balance first, then alphabetical
      list.sort((a, b) => {
        if (b.balance !== a.balance) return b.balance - a.balance;
        return a.address.localeCompare(b.address);
      });
      setWalletAddresses(list);

      // Source addresses are only those that have spendable coins (balance > 0)
      const sourceList = list.filter(wa => wa.balance > 0);
      setSourceAddresses(sourceList);

      setBalanceError(null);
    } else {
      const errorMsg = (!utxoRes.ok ? utxoRes.error.message : "") || 
                       (!addrRes.ok ? addrRes.error?.message : "") || 
                       "Error fetching wallet addresses";
      setBalanceError(errorMsg);
    }
  }, [rpcClient]);

  // Fetch fee rate
  const fetchFeeRate = useCallback(async (target: number) => {
    const res = await rpcClient.estimateSmartFee(target);
    if (res.ok && res.value.feerate) {
      setFeeRate(res.value.feerate);
      // Rough estimate: typical tx is ~250 bytes = 0.25kB
      setEstFee(parseFloat((res.value.feerate * 0.00025).toFixed(8)));
    } else {
      setFeeRate(null);
      setEstFee(null);
    }
  }, [rpcClient]);

  // Fetch wallet status (lock/unlock state)
  const fetchWalletStatus = useCallback(async () => {
    const res = await rpcClient.getWalletInfoFull();
    if (res.ok) {
      setWalletInfo(res.value);
      setWalletStatusError(null);
    } else {
      setWalletStatusError(res.error.message);
    }
  }, [rpcClient]);

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
        fetchWalletStatus();
      } else {
        setUnlockError(res.error.message);
      }
    } catch (err) {
      setUnlockError(err instanceof Error ? err.message : "Failed to unlock");
    } finally {
      setUnlocking(false);
    }
  };

  const handleLock = async () => {
    try {
      const res = await rpcClient.call<null>("walletlock");
      if (res.ok) {
        fetchWalletStatus();
      }
    } catch (err) {
      console.error("Lock failed:", err);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchFeeRate(feeTarget);
    fetchWalletStatus();
  }, [fetchBalance, fetchFeeRate, feeTarget, fetchWalletStatus]);

  const displaySpendable = useMemo(() => {
    if (selectedSourceAddress === "auto" || sourceChain !== "SYSCOIN_NATIVE_UTXO") {
      return spendable;
    }
    const match = sourceAddresses.find(sa => sa.address === selectedSourceAddress);
    return match ? match.balance : 0;
  }, [selectedSourceAddress, sourceChain, spendable, sourceAddresses]);

  function setMax() {
    if (displaySpendable === null) return;
    const fee = estFee ?? 0.0001;
    const maxAmt = Math.max(0, displaySpendable - fee);
    setAmount(maxAmt.toFixed(8));
  }


  function handleDestinationChange(value: string) {
    setDestination(value);
    setTxid(null);
    setSendError(null);

    const trimmed = value.trim();

    // Sync dropdown state with user's manual address typing
    const match = walletAddresses.find(wa => wa.address === trimmed);
    if (match) {
      setDestinationSelectMode(match.address);
    } else {
      setDestinationSelectMode("custom");
    }

    if (!trimmed) { setValidation(null); return; }

    const intent = {
      sourceChain,
      network: activeNetwork,
      destinationAddress: trimmed,
      asset: "SYS",
      amount: amount || "0",
    };
    const result = validateSendIntent(intent);
    setValidation({
      action: result.action,
      reason: result.reason,
      suggested: result.suggestedAction,
    });
    // Also show address type label
    setAddressLabel(classifyAddress(trimmed, activeNetwork).label);
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    if (destination.trim()) handleDestinationChange(destination);
  }

  function handleReview() {
    // Intercept if wallet is locked
    if (sourceChain === "SYSCOIN_NATIVE_UTXO" && walletInfo && walletInfo.unlocked_until === 0) {
      setUnlockError("Please unlock your wallet to proceed with sending.");
      setUnlockDialogOpen(true);
      return;
    }

    // Re-validate with actual amount
    const intent = {
      sourceChain,
      network: activeNetwork,
      destinationAddress: destination.trim(),
      asset: "SYS",
      amount,
    };
    const result = validateSendIntent(intent);
    setValidation({ action: result.action, reason: result.reason, suggested: result.suggestedAction });
    if (result.action === "BLOCK") return;
    setConfirmOpen(true);
  }

  async function handleConfirmedSend() {
    setConfirmOpen(false);
    setSending(true);
    setSendError(null);

    try {
      const outputs: Record<string, number> = {
        [destination.trim()]: parseFloat(amount),
      };

      let createRes;
      let fundOptions: Record<string, unknown> = {};

      if (selectedSourceAddress !== "auto" && sourceChain === "SYSCOIN_NATIVE_UTXO") {
        // Find UTXOs for the chosen address
        const addressUtxos = utxos.filter(u => u.address === selectedSourceAddress && u.spendable);
        // Sort by amount descending to minimize inputs count
        addressUtxos.sort((a, b) => b.amount - a.amount);

        const inputs: { txid: string; vout: number }[] = [];
        let accumulated = 0;
        const target = parseFloat(amount) + (estFee ?? 0.001);

        for (const utxo of addressUtxos) {
          inputs.push({ txid: utxo.txid, vout: utxo.vout });
          accumulated += utxo.amount;
          if (accumulated >= target) break;
        }

        if (accumulated < target) {
          throw new Error(`Insufficient funds at selected address. Need ${target.toFixed(8)} SYS (including fee), but only have ${accumulated.toFixed(8)} SYS.`);
        }

        createRes = await rpcClient.createRawTransaction(inputs, outputs);
        fundOptions = {
          add_inputs: false,
          changeAddress: selectedSourceAddress,
        };
      } else {
        createRes = await rpcClient.createRawTransaction([], outputs);
      }

      if (!createRes.ok) throw new Error(createRes.error.message);

      const fundRes = await rpcClient.fundRawTransaction(createRes.value, fundOptions);
      if (!fundRes.ok) throw new Error(fundRes.error.message);

      const signRes = await rpcClient.signRawTransactionWithWallet(fundRes.value.hex);
      if (!signRes.ok) throw new Error(signRes.error.message);
      if (!signRes.value.complete) throw new Error("Transaction signing incomplete — check wallet passphrase.");

      const sendRes = await rpcClient.sendRawTransaction(signRes.value.hex);
      if (!sendRes.ok) throw new Error(sendRes.error.message);

      setTxid(sendRes.value);
      setDestination("");
      setAmount("");
      setValidation(null);
      fetchBalance(); // refresh balance after send
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  const chainDropdownOptions = useMemo<CustomDropdownOption[]>(() => {
    return SOURCE_CHAINS.map((c) => ({
      value: c,
      label: CHAIN_LABELS[c],
    }));
  }, []);

  const sourceDropdownOptions = useMemo<CustomDropdownOption[]>(() => {
    const opts: CustomDropdownOption[] = [
      { value: "auto", label: "Automatic (Wallet Default)", isSpecial: true }
    ];
    for (const sa of sourceAddresses) {
      opts.push({
        value: sa.address,
        label: `${sa.address.slice(0, 12)}…${sa.address.slice(-8)}`,
        subtitle: sa.address,
        badge: sa.label,
        amount: `${sa.balance.toFixed(4)} SYS`,
      });
    }
    return opts;
  }, [sourceAddresses]);

  const destinationDropdownOptions = useMemo<CustomDropdownOption[]>(() => {
    const opts: CustomDropdownOption[] = [
      { value: "custom", label: "Custom Address (type below…)", isSpecial: true }
    ];
    for (const wa of walletAddresses) {
      opts.push({
        value: wa.address,
        label: `${wa.address.slice(0, 12)}…${wa.address.slice(-8)}`,
        subtitle: wa.address,
        badge: wa.label,
        amount: `${wa.balance.toFixed(4)} SYS`,
      });
    }
    return opts;
  }, [walletAddresses]);

  const canReview =
    destination.trim() !== "" &&
    parseFloat(amount) > 0 &&
    validation?.action !== "BLOCK";

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>Send SYS</h1>
        <p>Review all details carefully before signing. Unsafe address combinations are blocked automatically.</p>
      </div>

      <div className="send-layout">
        <div className="send-form card">
          {/* Source chain */}
          <CustomDropdown
            label="Source Chain"
            value={sourceChain}
            options={chainDropdownOptions}
            onChange={(val) => {
              setSourceChain(val as ChainEnvironment);
              setSelectedSourceAddress("auto");
              setDestinationSelectMode("custom");
              if (destination) handleDestinationChange(destination);
            }}
          />

          {/* Source Address (Send From) */}
          {sourceChain === "SYSCOIN_NATIVE_UTXO" && (
            <CustomDropdown
              label="Source Address (Send From)"
              value={selectedSourceAddress}
              options={sourceDropdownOptions}
              onChange={setSelectedSourceAddress}
            />
          )}

          {/* Destination Account Selector */}
          {sourceChain === "SYSCOIN_NATIVE_UTXO" && (
            <CustomDropdown
              label="Destination Account"
              value={destinationSelectMode}
              options={destinationDropdownOptions}
              onChange={(val) => {
                setDestinationSelectMode(val);
                if (val === "custom") {
                  handleDestinationChange("");
                } else {
                  handleDestinationChange(val);
                }
              }}
            />
          )}

          {/* Destination */}
          <div className="form-group">
            <label className="form-label" htmlFor="send-destination">Destination Address</label>
            <input
              id="send-destination"
              className="input input-mono"
              placeholder="sys1q… or 0x…"
              value={destination}
              onChange={(e) => handleDestinationChange(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {addressLabel && destination && (
              <span className="form-hint">Detected: {addressLabel}</span>
            )}
          </div>

          {/* Amount */}
          <div className="form-group">
            <label className="form-label" htmlFor="send-amount">Amount (SYS)</label>
            <input
              id="send-amount"
              className="input input-mono"
              type="number"
              min="0"
              step="0.00000001"
              placeholder="0.00000000"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
            />
          </div>

          {/* Validation feedback */}
          {validation && (
            <WarningBox
              severity={validation.action === "BLOCK" ? "danger" : validation.action === "WARN" ? "warn" : "success"}
              title={validation.action === "BLOCK" ? "Send blocked" : validation.action === "WARN" ? "Warning" : "Ready to send"}
              className="mt-4"
            >
              {validation.reason}
              {validation.suggested && (
                <div className="mt-2 text-xs" style={{ opacity: 0.85 }}>
                  <strong>Suggested action:</strong> {validation.suggested}
                </div>
              )}
            </WarningBox>
          )}

          {/* TX success */}
          {txid && (
            <WarningBox severity="success" title="Transaction sent!" className="mt-4">
              TXID: <span className="font-mono text-xs break-all">{txid}</span>
            </WarningBox>
          )}

          {/* Send error */}
          {sendError && (
            <WarningBox severity="danger" title="Send failed" className="mt-4">
              {sendError}
            </WarningBox>
          )}

          <button
            id="send-review-btn"
            className="btn btn-primary w-full mt-6"
            onClick={handleReview}
            disabled={!canReview || sending}
          >
            {sending ? <><div className="spinner" /> Sending…</> : "Review & Send"}
          </button>
        </div>

        {/* Side info */}
        <div className="flex flex-col gap-4">
          {/* Wallet Status */}
          <div className="card">
            <div className="stat-label mb-3">Wallet Status</div>
            {walletStatusError ? (
              <p className="text-xs text-danger">{walletStatusError}</p>
            ) : walletInfo === null ? (
              <div className="flex items-center gap-2">
                <div className="spinner" />
                <span className="text-muted text-xs">Loading status…</span>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-secondary">Encryption:</span>
                  {walletInfo.unlocked_until === undefined ? (
                    <span className="badge badge-success text-xs" style={{ background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", padding: "2px 6px", borderRadius: "3px" }}>Unencrypted</span>
                  ) : (
                    <span className="badge badge-warning text-xs" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", padding: "2px 6px", borderRadius: "3px" }}>Encrypted</span>
                  )}
                </div>
                {walletInfo.unlocked_until !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Status:</span>
                    {walletInfo.unlocked_until === 0 ? (
                      <span className="text-danger font-semibold text-xs flex items-center gap-1">
                        🔒 Locked
                      </span>
                    ) : (
                      <span className="text-success font-semibold text-xs flex items-center gap-1">
                        🔓 Unlocked
                      </span>
                    )}
                  </div>
                )}
                {walletInfo.unlocked_until !== undefined && walletInfo.unlocked_until > 0 && (
                  <div className="text-xs text-muted mt-1" style={{ textAlign: "right" }}>
                    Expires: {new Date(walletInfo.unlocked_until * 1000).toLocaleTimeString()}
                  </div>
                )}
                
                {walletInfo.unlocked_until === 0 && (
                  <button
                    className="btn btn-primary btn-sm mt-3 w-full"
                    onClick={() => {
                      setUnlockError(null);
                      setUnlockDialogOpen(true);
                    }}
                  >
                    Unlock Wallet
                  </button>
                )}
                {walletInfo.unlocked_until !== undefined && walletInfo.unlocked_until > 0 && (
                  <button
                    className="btn btn-secondary btn-sm mt-3 w-full"
                    onClick={handleLock}
                  >
                    Lock Wallet
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Available balance */}
          <div className="card">
            <div className="stat-label mb-3">Available Balance</div>
            {balanceError ? (
              <p className="text-xs text-danger">{balanceError}</p>
            ) : displaySpendable === null ? (
              <div className="flex items-center gap-2"><div className="spinner" /><span className="text-muted text-xs">Loading…</span></div>
            ) : (
              <div>
                <div className="stat-value" style={{ fontSize: "1.4rem" }}>
                  {displaySpendable.toFixed(8)} <span className="text-muted" style={{ fontSize: "0.8rem" }}>SYS</span>
                </div>
                <button
                  id="send-max-btn"
                  className="btn btn-ghost btn-sm mt-2"
                  onClick={setMax}
                  disabled={displaySpendable <= 0}
                >
                  Send max
                </button>
              </div>
            )}
          </div>

          {/* Fee estimate */}
          <div className="card">
            <div className="stat-label mb-3">Fee Estimate</div>
            <div className="flex gap-2 mb-3">
              {([6, 3, 1] as const).map(t => (
                <button
                  key={t}
                  className={`btn btn-sm ${feeTarget === t ? "btn-primary" : "btn-ghost"}`}
                  onClick={() => { setFeeTarget(t); }}
                  id={`send-fee-target-${t}`}
                >
                  {t === 1 ? "Fast (1 blk)" : t === 3 ? "Normal (3)" : "Economy (6)"}
                </button>
              ))}
            </div>
            {feeRate === null ? (
              <p className="text-xs text-secondary">Fee estimate unavailable (node not synced enough).</p>
            ) : (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Rate</span>
                  <span className="font-mono">{(feeRate * 1000).toFixed(5)} SYS/byte</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted">Est. fee</span>
                  <span className="font-mono text-warning">~{estFee?.toFixed(8) ?? "—"} SYS</span>
                </div>
              </div>
            )}
          </div>

          <WarningBox severity="info" title="Safety check">
            NexSYS automatically detects the address format and blocks unsafe chain combinations.
            UTXO SYS cannot be sent directly to an EVM address — use Bridge instead.
          </WarningBox>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Send"
        description={
          <div className="confirm-details">
            <div className="confirm-row">
              <span className="confirm-label">Amount</span>
              <span className="confirm-value amount">{amount} SYS</span>
            </div>
            <div className="confirm-row">
              <span className="confirm-label">Source Chain</span>
              <span className="confirm-value">{CHAIN_LABELS[sourceChain]}</span>
            </div>
            {selectedSourceAddress !== "auto" && (
              <div className="confirm-row">
                <span className="confirm-label">Source Address</span>
                <span className="confirm-value address">{selectedSourceAddress}</span>
              </div>
            )}
            <div className="confirm-row">
              <span className="confirm-label">Destination Address</span>
              <span className="confirm-value address">{destination}</span>
            </div>
            {estFee !== null && (
              <div className="confirm-row">
                <span className="confirm-label">Estimated Fee</span>
                <span className="confirm-value fee">~{estFee.toFixed(8)} SYS</span>
              </div>
            )}
            <div className="confirm-warning text-danger text-xs font-semibold">
              ⚠️ This action is irreversible. Please verify all details.
            </div>
          </div>
        }
        confirmLabel="Sign & Send"
        cancelLabel="Cancel"
        danger
        onConfirm={handleConfirmedSend}
        onCancel={() => setConfirmOpen(false)}
      />

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
              <h3 className="dialog__title">Unlock Wallet</h3>
            </div>
            <p className="dialog__desc" style={{ marginBottom: "var(--space-4)" }}>
              Enter your passphrase to unlock Syscoin Core for sending.
            </p>
            
            <div className="form-group" style={{ textAlign: "left", width: "100%", marginBottom: "var(--space-3)" }}>
              <label className="form-label" htmlFor="unlock-passphrase">Wallet Passphrase</label>
              <input
                id="unlock-passphrase"
                className="input"
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ textAlign: "left", width: "100%", marginBottom: "var(--space-4)" }}>
              <label className="form-label" htmlFor="unlock-timeout">Unlock Duration (seconds)</label>
              <input
                id="unlock-timeout"
                className="input"
                type="number"
                min="10"
                max="999999"
                value={unlockTimeout}
                onChange={(e) => setUnlockTimeout(e.target.value)}
                placeholder="300"
              />
            </div>

            {unlockError && (
              <WarningBox severity="danger" title="Unlock failed" className="mb-4">
                {unlockError}
              </WarningBox>
            )}

            <div className="dialog__actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setUnlockDialogOpen(false)}
                disabled={unlocking}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={unlocking}
              >
                {unlocking ? "Unlocking…" : "Unlock"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
