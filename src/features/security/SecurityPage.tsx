/**
 * features/security/SecurityPage.tsx
 * Wallet security and backup status screen.
 * Calls getwalletinfo to determine encryption / lock status.
 */

import { useEffect, useState, useCallback } from "react";
import { WarningBox } from "../../components/shared/WarningBox";
import { useNetworkStore } from "../../store/networkStore";
import type { RawWalletInfoFull } from "../../services/syscoinRpcClient";
import "./SecurityPage.css";

// ── Backup checklist ─────────────────────────────────────────────────────────

interface CheckItem {
  id: string;
  title: string;
  desc: string;
}

const CHECKLIST: CheckItem[] = [
  {
    id: "backup-written",
    title: "Wallet backup file created",
    desc: "Run 'syscoin-cli backupwallet <path>' to create an encrypted backup of your wallet.dat.",
  },
  {
    id: "backup-offsite",
    title: "Backup stored off-site",
    desc: "Keep at least one copy on a separate physical device (USB, hardware wallet, encrypted cloud).",
  },
  {
    id: "passphrase-recorded",
    title: "Wallet passphrase recorded securely",
    desc: "Your passphrase is required to unlock the wallet. Store it in a password manager or physical safe — never in plaintext.",
  },
  {
    id: "seed-verified",
    title: "Recovery path tested (optional)",
    desc: "Verified that wallet can be restored from backup on a separate machine.",
  },
];

const STORAGE_KEY = "nexsys_backup_checks";

function loadChecks(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function saveChecks(checks: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(checks));
}

// ── Encryption status helpers ────────────────────────────────────────────────

type EncryptionStatus = "unencrypted" | "encrypted-locked" | "encrypted-unlocked" | "unknown";

function getEncryptionStatus(info: RawWalletInfoFull | null): EncryptionStatus {
  if (!info) return "unknown";
  if (info.unlocked_until === undefined) return "unencrypted";
  if (info.unlocked_until === 0) return "encrypted-locked";
  return "encrypted-unlocked";
}

function encryptionLabel(status: EncryptionStatus): { text: string; dot: string; severity: "ok" | "warn" | "danger" | "unknown" } {
  switch (status) {
    case "encrypted-locked":   return { text: "Encrypted & Locked ✓",   dot: "ok",      severity: "ok"      };
    case "encrypted-unlocked": return { text: "Encrypted (unlocked)",   dot: "warn",    severity: "warn"    };
    case "unencrypted":        return { text: "Not encrypted ⚠",        dot: "danger",  severity: "danger"  };
    case "unknown":            return { text: "Unknown",                 dot: "unknown", severity: "unknown" };
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SecurityPage() {
  const { rpcClient, activeNetwork } = useNetworkStore();
  const [walletInfo, setWalletInfo] = useState<RawWalletInfoFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>(loadChecks);

  const fetchWalletInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    const res = await rpcClient.getWalletInfoFull();
    if (res.ok) {
      setWalletInfo(res.value);
    } else {
      const msg = res.error?.message ?? "";
      const noWallet = msg.toLowerCase().includes("wallet") || msg.includes("-18");
      setError(
        noWallet
          ? "No wallet loaded. Set a Wallet Name in Settings or load a wallet in your node."
          : (msg || "Could not fetch wallet info.")
      );
    }
    setLoading(false);
  }, [rpcClient]);

  useEffect(() => { fetchWalletInfo(); }, [fetchWalletInfo]);

  function toggleCheck(id: string) {
    const next = { ...checks, [id]: !checks[id] };
    setChecks(next);
    saveChecks(next);
  }

  const encStatus = getEncryptionStatus(walletInfo);
  const encInfo   = encryptionLabel(encStatus);
  const isTestnet = activeNetwork !== "MAINNET";
  const completedChecks = CHECKLIST.filter(c => checks[c.id]).length;
  const allDone = completedChecks === CHECKLIST.length;

  const unlockTs = walletInfo?.unlocked_until;
  const unlockTime = unlockTs && unlockTs > 0
    ? new Date(unlockTs * 1000).toLocaleTimeString()
    : null;

  return (
    <div className="page animate-fade-in">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1>Security &amp; Backup</h1>
          <p>Wallet encryption, backup verification, and self-custody checklist.</p>
        </div>
        <button
          id="security-refresh-btn"
          className="btn btn-ghost btn-sm"
          onClick={fetchWalletInfo}
          disabled={loading}
        >
          ⟳ Refresh
        </button>
      </div>

      {isTestnet && (
        <WarningBox severity="warn" title={`${activeNetwork} active`} className="mb-6">
          Testnet wallet shown. Always maintain separate backups per network.
        </WarningBox>
      )}

      {error && <WarningBox severity="danger" className="mb-6">{error}</WarningBox>}

      {/* Encryption warning */}
      {encStatus === "unencrypted" && (
        <WarningBox severity="danger" title="Wallet is not encrypted" className="mb-6">
          Your wallet is unprotected. Anyone with access to your device can spend your funds.
          Encrypt it immediately: <code className="font-mono text-xs">syscoin-cli encryptwallet "your-passphrase"</code>
        </WarningBox>
      )}
      {encStatus === "encrypted-unlocked" && unlockTime && (
        <WarningBox severity="warn" title="Wallet is temporarily unlocked" className="mb-6">
          Your wallet is unlocked until {unlockTime}. It will automatically re-lock after the timeout.
        </WarningBox>
      )}

      <div className="security-grid">
        {/* Wallet status card */}
        <div className="card">
          <div className="stat-label mb-4">Wallet Status</div>
          {loading ? (
            <div className="flex items-center gap-2"><div className="spinner" /><span className="text-muted text-sm">Loading…</span></div>
          ) : walletInfo ? (
            <>
              <div className="security-status-row">
                <span className="security-status-label">Wallet Name</span>
                <span className="security-status-value font-mono text-xs">{walletInfo.walletname || "(default)"}</span>
              </div>
              <div className="security-status-row">
                <span className="security-status-label">Encryption</span>
                <span className="security-status-value">
                  <span className={`security-dot security-dot--${encInfo.dot}`} />
                  {encInfo.text}
                </span>
              </div>
              {unlockTime && (
                <div className="security-status-row">
                  <span className="security-status-label">Locked at</span>
                  <span className="security-status-value text-warning">{unlockTime}</span>
                </div>
              )}
              <div className="security-status-row">
                <span className="security-status-label">Format</span>
                <span className="security-status-value text-secondary">
                  {walletInfo.descriptors ? "Descriptor wallet" : "Legacy wallet"}
                </span>
              </div>
              <div className="security-status-row">
                <span className="security-status-label">Transactions</span>
                <span className="security-status-value">{walletInfo.txcount.toLocaleString()}</span>
              </div>
              <div className="security-status-row">
                <span className="security-status-label">Keypool</span>
                <span className="security-status-value">{walletInfo.keypoolsize} addresses pre-generated</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Hardware wallet + hot wallet notice */}
        <div className="card">
          <div className="stat-label mb-4">Custody Mode</div>
          <div className="security-status-row">
            <span className="security-status-label">Mode</span>
            <span className="security-status-value">
              <span className="security-dot security-dot--warn" />
              Hot wallet
            </span>
          </div>
          <div className="security-status-row">
            <span className="security-status-label">Hardware Wallet</span>
            <span className="security-status-value text-muted">Not connected</span>
          </div>
          <div className="security-status-row">
            <span className="security-status-label">Watch-only</span>
            <span className="security-status-value text-muted">Not configured</span>
          </div>
          <div className="security-status-row">
            <span className="security-status-label">Multisig</span>
            <span className="security-status-value text-muted">MVP 5</span>
          </div>
          <p className="text-xs text-secondary mt-4">
            Hardware wallet and multisig support are planned for MVP 5.
            For maximum security, use a hardware wallet with watch-only mode.
          </p>
        </div>
      </div>

      {/* Backup checklist */}
      <div className="card">
        <div className="flex justify-between items-center mb-5">
          <div className="stat-label">Backup Checklist</div>
          <span className={`text-xs font-semibold ${allDone ? "text-success" : "text-warning"}`}>
            {completedChecks} / {CHECKLIST.length} complete
          </span>
        </div>

        {allDone && (
          <WarningBox severity="success" className="mb-4">
            All backup steps confirmed. Keep your backup and passphrase in a safe place.
          </WarningBox>
        )}

        <div className="backup-checklist">
          {CHECKLIST.map(item => (
            <label
              key={item.id}
              className={`backup-check-item ${checks[item.id] ? "backup-check-item--done" : ""}`}
              htmlFor={`check-${item.id}`}
            >
              <input
                id={`check-${item.id}`}
                type="checkbox"
                checked={!!checks[item.id]}
                onChange={() => toggleCheck(item.id)}
              />
              <div className="backup-check-text">
                <div className="backup-check-title">{item.title}</div>
                <div className="backup-check-desc">{item.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          <p className="text-xs text-muted">
            <strong>How to back up:</strong> Run{" "}
            <code className="font-mono">syscoin-cli backupwallet "/path/to/backup.dat"</code>{" "}
            while your node is running. Store the file on an encrypted external drive or secure cloud storage.
            Your passphrase is required to restore it.
          </p>
        </div>
      </div>
    </div>
  );
}
