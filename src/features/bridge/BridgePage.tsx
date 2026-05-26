/**
 * features/bridge/BridgePage.tsx
 * Cross-chain bridge UI — MVP 2 / MVP 6.
 *
 * Native routes (via Syscoin Core RPC):
 *   UTXO → NEVM  — assetallocationburn
 *
 * External routes (open official portal):
 *   NEVM → UTXO  — bridge.syscoin.org
 *   NEVM ↔ Rollux — bridge.rollux.com
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { WarningBox } from "../../components/shared/WarningBox";
import { ConfirmDialog } from "../../components/shared/ConfirmDialog";
import { CustomDropdown } from "../../components/shared/CustomDropdown";
import type { CustomDropdownOption } from "../../components/shared/CustomDropdown";
import { useNetworkStore } from "../../store/networkStore";
import {
  addBridgeRecord,
  updateBridgeRecord,
  loadBridgeHistory,
  deleteBridgeRecord,
  makeBridgeId,
  BRIDGE_STATUS_LABELS,
  BRIDGE_STATUS_COLOR,
  type BridgeRecord,
} from "../../services/bridgeHistoryService";
import { executeUtxoToNevmBridge, fetchSpvProof } from "../../services/bridgeService";
import { submitSpvProofToNevm, depositEthToRollux } from "../../services/evmBridgeService";
import type { ChainEnvironment } from "../../types/chain";
import type { RawWalletInfoFull } from "../../services/syscoinRpcClient";
import "./BridgePage.css";

// ── Route definitions ─────────────────────────────────────────────────────────

type RouteId = "utxo_nevm" | "utxo_rollux" | "nevm_utxo" | "nevm_rollux" | "rollux_nevm";

interface BridgeRoute {
  id: RouteId;
  source: ChainEnvironment;
  dest: ChainEnvironment;
  sourceLabel: string;
  destLabel: string;
  native: boolean;          // can execute inside NexSYS
  estimatedTime: string;
  feeNote: string;
  externalUrl?: string;
  externalName?: string;
  steps?: string[];
  warning?: string;
}

const ROUTES: BridgeRoute[] = [
  {
    id: "utxo_nevm",
    source: "SYSCOIN_NATIVE_UTXO",
    dest: "SYSCOIN_NEVM",
    sourceLabel: "Syscoin Native (UTXO)",
    destLabel: "Syscoin NEVM",
    native: true,
    estimatedTime: "~2 minutes (on-chain confirmation)",
    feeNote: "Standaard Syscoin netwerkkosten (~0.0001 SYS)",
    warning: "This is a one-way transaction. SYS is burned on the UTXO layer and minted on NEVM. Check the NEVM address carefully — this is irreversible.",
  },
  {
    id: "utxo_rollux",
    source: "SYSCOIN_NATIVE_UTXO",
    dest: "ROLLUX",
    sourceLabel: "Syscoin Native (UTXO)",
    destLabel: "Rollux L2",
    native: true,
    estimatedTime: "~15–30 minuten (UTXO burn + NEVM claim + Rollux deposit)",
    feeNote: "Syscoin UTXO-kosten + NEVM-gaskosten",
    warning: "Two-step process: (1) SYS is burned on UTXO and claimed on NEVM via SPV proof. (2) Claimed SYS is automatically deposited to Rollux L2. Check the Rollux address carefully.",
  },
  {
    id: "nevm_utxo",
    source: "SYSCOIN_NEVM",
    dest: "SYSCOIN_NATIVE_UTXO",
    sourceLabel: "Syscoin NEVM",
    destLabel: "Syscoin Native (UTXO)",
    native: false,
    estimatedTime: "~5–15 minutes (EVM + UTXO confirmation)",
    feeNote: "Syscoin NEVM gas fee (paid in SYS/ETH)",
    externalUrl: "https://bridge.syscoin.org",
    externalName: "Syscoin Bridge Portal",
    steps: [
      "Connect your EVM wallet (Pali or MetaMask) to bridge.syscoin.org",
      "Select NEVM → UTXO and enter your native sys1… address",
      "Approve the contract call in your wallet",
      "Wait for bridge processing and UTXO confirmation",
    ],
    warning: "Requires an EVM-compatible wallet such as Pali Wallet or MetaMask with the Syscoin NEVM network added.",
  },
  {
    id: "nevm_rollux",
    source: "SYSCOIN_NEVM",
    dest: "ROLLUX",
    sourceLabel: "Syscoin NEVM",
    destLabel: "Rollux (L2)",
    native: false,
    estimatedTime: "~2–5 minutes (optimistic deposit)",
    feeNote: "NEVM gas fee (paid in SYS)",
    externalUrl: "https://bridge.rollux.com",
    externalName: "Rollux Bridge Portal",
    steps: [
      "Connect your EVM wallet to bridge.rollux.com",
      "Select Deposit (NEVM → Rollux) and enter the amount",
      "Approve the deposit in your wallet",
      "Wait for deposit confirmation (~2 minutes)",
    ],
  },
  {
    id: "rollux_nevm",
    source: "ROLLUX",
    dest: "SYSCOIN_NEVM",
    sourceLabel: "Rollux (L2)",
    destLabel: "Syscoin NEVM",
    native: false,
    estimatedTime: "7 days (optimistic challenge period)",
    feeNote: "Rollux gas fee (paid in SYS)",
    externalUrl: "https://bridge.rollux.com",
    externalName: "Rollux Bridge Portal",
    steps: [
      "Connect your EVM wallet to bridge.rollux.com",
      "Select Withdraw (Rollux → NEVM) and enter the amount",
      "Approve the withdrawal in your wallet",
      "Wait 7 days for the challenge period to expire",
      "Claim your NEVM SYS after the challenge period",
    ],
    warning: "Rollux withdrawals require a 7-day challenge period due to the optimistic rollup design. Plan ahead.",
  },
];

const SAFETY_CHECKS = [
  { id: "address-correct",  label: "I have verified the destination address is correct." },
  { id: "amount-correct",   label: "I understand the exact amount being bridged." },
  { id: "irreversible",     label: "I understand this transaction may be irreversible once submitted." },
  { id: "network-correct",  label: "I am on the correct network (Mainnet / Testnet)." },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortAddr(addr: string) {
  return addr.length > 20 ? addr.slice(0, 10) + "…" + addr.slice(-6) : addr;
}

function shortId(id?: string) {
  return id ? id.slice(0, 10) + "…" + id.slice(-6) : "—";
}

function timeAgo(ts: number) {
  const sec = Math.floor((Date.now() - ts) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

const CHAIN_LABELS: Record<ChainEnvironment, string> = {
  SYSCOIN_NATIVE_UTXO: "UTXO",
  SYSCOIN_NEVM:        "NEVM",
  ROLLUX:              "Rollux",
  ZKSYS:               "zkSYS",
  UNKNOWN:             "Unknown",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function BridgePage() {
  const { rpcClient, activeNetwork, evmAddress, isCredentialsSaved, decryptPrivateKey } = useNetworkStore();

  const [selectedRoute, setSelectedRoute] = useState<RouteId>("utxo_nevm");
  const [amount, setAmount] = useState("");
  const [destAddress, setDestAddress] = useState(evmAddress);
  const [spendable, setSpendable] = useState<number | null>(null);
  const [sourceAddress, setSourceAddress] = useState<string>("");
  const [walletAddresses, setWalletAddresses] = useState<any[]>([]);
  const [feeEst, setFeeEst] = useState<number | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bridging, setBridging] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [bridgeError, setBridgeError] = useState<string | null>(null);
  const [lastTxid, setLastTxid] = useState<string | null>(null);
  const [history, setHistory] = useState<BridgeRecord[]>([]);
  const [showResumeInput, setShowResumeInput] = useState(false);
  const [resumeTxid, setResumeTxid] = useState("");
  const [copiedTxid, setCopiedTxid] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Password Prompt Modal State
  const [passDialogOpen, setPassDialogOpen] = useState(false);
  const [passDialogPassword, setPassDialogPassword] = useState("");
  const [passDialogError, setPassDialogError] = useState<string | null>(null);
  const [pendingClaimRecord, setPendingClaimRecord] = useState<BridgeRecord | null>(null);
  const [claimStep, setClaimStep] = useState<string | null>(null);
  const [claimBlockInfo, setClaimBlockInfo] = useState<string | null>(null);

  // UTXO Wallet lock & status state
  const [walletInfo, setWalletInfo] = useState<RawWalletInfoFull | null>(null);
  const [walletStatusError, setWalletStatusError] = useState<string | null>(null);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [passphrase, setPassphrase] = useState("");
  const [unlockTimeout, setUnlockTimeout] = useState("300");
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  // Stores a bridge action to resume automatically after the wallet is unlocked
  const [pendingBridgeAfterUnlock, setPendingBridgeAfterUnlock] = useState<(() => Promise<void>) | null>(null);
  const [pendingBridgeLabel, setPendingBridgeLabel] = useState<string | null>(null);

  const route = ROUTES.find(r => r.id === selectedRoute)!;
  const allChecked = SAFETY_CHECKS.every(c => checks[c.id]);
  const amountNum = parseFloat(amount);
  const isTestnet = activeNetwork !== "MAINNET";

  const refreshHistory = useCallback(() => {
    setHistory(loadBridgeHistory(activeNetwork));
  }, [activeNetwork]);

  const fetchBalance = useCallback(async () => {
    if (route.source !== "SYSCOIN_NATIVE_UTXO") return;
    const res = await rpcClient.getBalances();
    if (res.ok) setSpendable(res.value.mine.trusted);
  }, [rpcClient, route.source]);

  const fetchFee = useCallback(async () => {
    if (route.source !== "SYSCOIN_NATIVE_UTXO") return;
    const res = await rpcClient.estimateSmartFee(6);
    if (res.ok && res.value.feerate) {
      setFeeEst(parseFloat((res.value.feerate * 0.00025).toFixed(8)));
    }
  }, [rpcClient, route.source]);

  const fetchWalletAddresses = useCallback(async () => {
    if (route.source !== "SYSCOIN_NATIVE_UTXO") return;
    
    // Fetch UTXOs and Received Addresses
    const utxoRes = await rpcClient.listUnspent(0, 9999999, []);
    const addrRes = await rpcClient.listReceivedByAddress(0, true);

    if (utxoRes.ok && addrRes.ok) {
      const balanceMap: Record<string, number> = {};
      const lockedBalanceMap: Record<string, number> = {};
      
      for (const u of utxoRes.value) {
        if (!u.address) continue;
        if (u.spendable) {
          balanceMap[u.address] = (balanceMap[u.address] || 0) + u.amount;
        }
      }
      
      try {
        const lockedUtxos = await rpcClient.getLockedUtxos();
        for (const u of lockedUtxos) {
          if (!u.address) continue;
          lockedBalanceMap[u.address] = (lockedBalanceMap[u.address] || 0) + u.amount;
        }
      } catch (e) {
        console.warn("Could not load locked UTXOs in BridgePage", e);
      }

      // Map received addresses list to calculate current balances
      const list = addrRes.value.map(item => ({
        address: item.address,
        balance: balanceMap[item.address] || 0,
        lockedBalance: lockedBalanceMap[item.address] || 0,
        label: item.label,
      }));

      list.sort((a, b) => {
        const aTotal = a.balance + (a.lockedBalance || 0);
        const bTotal = b.balance + (b.lockedBalance || 0);
        if (bTotal !== aTotal) return bTotal - aTotal;
        return a.address.localeCompare(b.address);
      });

      // We only care about addresses with some balance (spendable or locked)
      const sourceList = list.filter(wa => wa.balance > 0 || (wa.lockedBalance || 0) > 0);
      setWalletAddresses(sourceList as any); // Storing the mapped objects here
    }
  }, [rpcClient, route.source]);

  const sourceDropdownOptions = useMemo<CustomDropdownOption[]>(() => {
    const opts: CustomDropdownOption[] = [
      {
        value: "auto",
        label: "Automatic (Wallet Default)",
        isSpecial: true,
      }
    ];

    // walletAddresses is now an array of { address, balance, lockedBalance, label }
    (walletAddresses as any[]).forEach(a => {
      let amountStr = `${a.balance.toFixed(4)} SYS`;
      if (a.lockedBalance && a.lockedBalance > 0) {
        amountStr += ` (🔒 ${a.lockedBalance.toFixed(4)})`;
      }
      opts.push({
        value: a.address,
        label: `${a.address.slice(0, 12)}…${a.address.slice(-8)}`,
        subtitle: a.address,
        amount: amountStr,
        badge: a.label || undefined,
      });
    });

    return opts;
  }, [walletAddresses]);

  const isSourceLocked = useMemo(() => {
    if (!sourceAddress || route.source !== "SYSCOIN_NATIVE_UTXO") return false;
    const match = walletAddresses.find(wa => wa.address === sourceAddress);
    return match && match.balance <= 0 && (match.lockedBalance || 0) > 0;
  }, [sourceAddress, route.source, walletAddresses]);

  // Fetch UTXO wallet status (lock/unlock state)
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
        // If there's a pending bridge action (e.g. was blocked by locked wallet), run it now
        if (pendingBridgeAfterUnlock) {
          const action = pendingBridgeAfterUnlock;
          setPendingBridgeAfterUnlock(null);
          setPendingBridgeLabel(null);
          await action();
        }
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

  // Background polling for confirmations
  useEffect(() => {
    const checkConfirmations = async () => {
      const pending = history.filter(r => r.status === "confirming_source" && r.txid);
      for (const rec of pending) {
        if (!rec.txid) continue;
        const res = await rpcClient.call<any>("getrawtransaction", [rec.txid, 1]);
        if (res.ok && res.value && res.value.confirmations > 0) {
          if (rec.isConversion) {
            try {
              // Automatically execute the second step (burn SYSX to NEVM)
              const amountNum = parseFloat(rec.amount);
              const burnAction = async () => {
                const burnTxid = await executeUtxoToNevmBridge(
                  rpcClient,
                  activeNetwork,
                  "",
                  amountNum,
                  rec.destAddress
                );
                updateBridgeRecord(activeNetwork, rec.id, {
                  txid: burnTxid,
                  isConversion: false,
                  status: "confirming_source",
                  statusMessage: "Burn bevestigen..."
                });
                refreshHistory();
              };
              await burnAction();
            } catch (err: any) {
              console.error("Auto-burn after conversion failed:", err);
              const errMsg = err.message || "";
              let statusMsg = "Auto-burn failed: " + errMsg;
              if (errMsg.toLowerCase().includes("walletpassphrase")) {
                statusMsg = "Wallet locked. Click 'Resume Action' to enter your password and continue the bridge.";
              }
              updateBridgeRecord(activeNetwork, rec.id, {
                status: "failed",
                statusMessage: statusMsg
              });
            }
          } else {
            updateBridgeRecord(activeNetwork, rec.id, { 
              status: "waiting_bridge",
              statusMessage: undefined
            });
          }
          refreshHistory();
        }
      }
    };
    const interval = setInterval(checkConfirmations, 15000); // Check every 15s
    return () => clearInterval(interval);
  }, [history, rpcClient, activeNetwork, refreshHistory]);

  useEffect(() => {
    fetchBalance();
    fetchFee();
    fetchWalletAddresses();
    refreshHistory();
    fetchWalletStatus();
    // Reset dest address to saved EVM address when switching to UTXO→NEVM
    if (route.dest === "SYSCOIN_NEVM" || route.dest === "ROLLUX") {
      setDestAddress(evmAddress);
    } else {
      setDestAddress("");
    }
    setChecks({});
    setAmount("");
    setSourceAddress("");
    setBridgeError(null);
    setLastTxid(null);
  }, [selectedRoute, fetchBalance, fetchFee, fetchWalletAddresses, refreshHistory, evmAddress, route.dest, fetchWalletStatus]);

  // ── Native bridge execution ───────────────────────────────────────────────

  async function handleNativeBridge() {
    setConfirmOpen(false);

    // ── Pre-check: Wallet lock status ─────────────────────────────────────────
    // Proactively refresh wallet info. If the wallet is encrypted + locked,
    // show the unlock dialog first and resume the bridge after unlock.
    try {
      const wRes = await rpcClient.getWalletInfoFull();
      if (wRes.ok) {
        setWalletInfo(wRes.value);
        const isLocked =
          wRes.value.unlocked_until !== undefined && wRes.value.unlocked_until <= 0;
        if (isLocked) {
          // Store the bridge execution as a pending action
          const capturedAmount = amountNum;
          const capturedSource = sourceAddress;
          const capturedDest = destAddress;
          setPendingBridgeAfterUnlock(() => async () => {
            await executeBridgeTransaction(capturedAmount, capturedSource, capturedDest);
          });
          setPendingBridgeLabel(`Bridge ${amount} SYS → ${route.destLabel}`);
          setUnlockDialogOpen(true);
          return;
        }
      }
    } catch { /* if check fails, proceed anyway and let the bridge handle the error */ }

    await executeBridgeTransaction(amountNum, sourceAddress, destAddress);
  }

  /** Inner helper: performs the actual bridge transaction (separated so it can be deferred after unlock). */
  async function executeBridgeTransaction(capturedAmount: number, capturedSource: string, capturedDest: string) {
    setBridging(true);
    setBridgeError(null);

    const recordId = makeBridgeId();
    const record: BridgeRecord = {
      id: recordId,
      timestamp: Date.now(),
      network: activeNetwork,
      sourceChain: route.source,
      destChain: route.dest,
      amount,
      destAddress,
      status: "submitted",
    };
    addBridgeRecord(activeNetwork, record);
    refreshHistory();

    try {
      const txidRaw = await executeUtxoToNevmBridge(
        rpcClient,
        activeNetwork,
        capturedSource, // can be empty to let wallet pick
        capturedAmount,
        capturedDest
      );

      const isConv = txidRaw.startsWith("conversion:");
      const txid = isConv ? txidRaw.substring("conversion:".length) : txidRaw;

      setLastTxid(txid);
      updateBridgeRecord(activeNetwork, recordId, {
        txid,
        status: "confirming_source",
        isConversion: isConv,
        statusMessage: isConv ? "Confirming SYS → SYSX conversion..." : "Confirming burn..."
      });
      refreshHistory();
      setAmount("");
      setChecks({});
    } catch (err: any) {
      const errMsg: string = err.message || "";
      if (errMsg.toLowerCase().includes("walletpassphrase") || errMsg.toLowerCase().includes("passphrase")) {
        // Wallet was locked despite pre-check (race condition) — prompt for unlock
        const capturedAmountCopy = capturedAmount;
        const capturedSourceCopy = capturedSource;
        const capturedDestCopy = capturedDest;
        setPendingBridgeAfterUnlock(() => async () => {
          await executeBridgeTransaction(capturedAmountCopy, capturedSourceCopy, capturedDestCopy);
        });
        setPendingBridgeLabel(`Bridge ${capturedAmount.toFixed(8)} SYS → ${route.destLabel}`);
        updateBridgeRecord(activeNetwork, recordId, {
          status: "waiting_bridge",
          statusMessage: "Wallet locked — unlock wallet to resume bridging."
        });
        setUnlockDialogOpen(true);
      } else {
        setBridgeError(errMsg || "Bridge transactie mislukt.");
        updateBridgeRecord(activeNetwork, recordId, { status: "failed", statusMessage: errMsg });
      }
      refreshHistory();
    }
    setBridging(false);
  }

  const handleResumeAutoBurn = async (rec: BridgeRecord) => {
    updateBridgeRecord(activeNetwork, rec.id, {
      status: "confirming_source",
      statusMessage: "Resuming..."
    });
    refreshHistory();

    const amountNum = parseFloat(rec.amount);

    try {
      const wRes = await rpcClient.getWalletInfoFull();
      if (wRes.ok) {
        setWalletInfo(wRes.value);
        const isLocked = wRes.value.unlocked_until !== undefined && wRes.value.unlocked_until <= 0;
        if (isLocked) {
          setPendingBridgeAfterUnlock(() => async () => {
            const burnTxid = await executeUtxoToNevmBridge(rpcClient, activeNetwork, "", amountNum, rec.destAddress);
            updateBridgeRecord(activeNetwork, rec.id, {
              txid: burnTxid,
              isConversion: false,
              status: "confirming_source",
              statusMessage: "Burn bevestigen..."
            });
            refreshHistory();
          });
          setPendingBridgeLabel(`Resume auto-burn for ${rec.amount} SYS`);
          setUnlockDialogOpen(true);
          return;
        }
      }
    } catch { /* ignore pre-check failure */ }

    try {
      const burnTxid = await executeUtxoToNevmBridge(
        rpcClient,
        activeNetwork,
        "",
        amountNum,
        rec.destAddress
      );
      updateBridgeRecord(activeNetwork, rec.id, {
        txid: burnTxid,
        isConversion: false,
        status: "confirming_source",
        statusMessage: "Burn bevestigen..."
      });
      refreshHistory();
    } catch (err: any) {
      const errMsg: string = err.message || "";
      if (errMsg.toLowerCase().includes("walletpassphrase") || errMsg.toLowerCase().includes("passphrase")) {
        setPendingBridgeAfterUnlock(() => async () => {
          const burnTxid = await executeUtxoToNevmBridge(rpcClient, activeNetwork, "", amountNum, rec.destAddress);
          updateBridgeRecord(activeNetwork, rec.id, {
            txid: burnTxid,
            isConversion: false,
            status: "confirming_source",
            statusMessage: "Burn bevestigen..."
          });
          refreshHistory();
        });
        setPendingBridgeLabel(`Resume auto-burn for ${rec.amount} SYS`);
        updateBridgeRecord(activeNetwork, rec.id, {
          status: "waiting_bridge",
          statusMessage: "Wallet locked — unlock wallet to resume burn."
        });
        setUnlockDialogOpen(true);
      } else {
        updateBridgeRecord(activeNetwork, rec.id, { status: "failed", statusMessage: "Auto-burn mislukt: " + errMsg });
      }
      refreshHistory();
    }
  };

  // ── Claim Execution ───────────────────────────────────────────────────────
  const handleClaim = useCallback(async (rec: BridgeRecord, useInAppWallet: boolean) => {
    if (!rec.txid) return;

    if (useInAppWallet) {
      setPendingClaimRecord(rec);
      setPassDialogPassword("");
      setPassDialogError(null);
      setPassDialogOpen(true);
    } else {
      setClaimingId(rec.id);
      setClaimError(null);
      try {
        const proof = await fetchSpvProof(rpcClient, activeNetwork as "MAINNET" | "TESTNET", rec.txid);
        const evmTxHash = await submitSpvProofToNevm(proof, activeNetwork);

        if (rec.destChain === "ROLLUX") {
          // After NEVM claim, deposit minted SYS into Rollux L2
          updateBridgeRecord(activeNetwork, rec.id, {
            status: "released",
            statusMessage: `SYS geclaimd op NEVM (TX: ${evmTxHash.slice(0, 10)}...). Storten op Rollux L2...`
          });
          refreshHistory();

          const l2TxHash = await depositEthToRollux(
            rec.amount,
            rec.destAddress,
            activeNetwork
          );
          updateBridgeRecord(activeNetwork, rec.id, {
            status: "completed",
            statusMessage: `Gestort op Rollux L2 (TX: ${l2TxHash.slice(0, 10)}...)`
          });
        } else {
          updateBridgeRecord(activeNetwork, rec.id, {
            status: "completed",
            statusMessage: `Geclaimd op NEVM (TX: ${evmTxHash.slice(0, 10)}...)`
          });
        }
        refreshHistory();
      } catch (err: any) {
        console.error("Claim failed:", err);
        setClaimError(`Claim mislukt: ${err.message}`);
      } finally {
        setClaimingId(null);
      }
    }
  }, [rpcClient, activeNetwork, refreshHistory]);

  const resolveTxDetails = async (txid: string): Promise<{ amount: string }> => {
    const MAINNET_BLOCKBOOK = "https://blockbook.syscoin.org";
    const TESTNET_BLOCKBOOK = "https://blockbook.tanenbaum.io";
    try {
      // 1. Try local wallet gettransaction
      const txRes = await rpcClient.call<any>("gettransaction", [txid]);
      if (txRes.ok && txRes.value) {
        const amt = Math.abs(txRes.value.amount || 0);
        const fee = Math.abs(txRes.value.fee || 0);
        if (amt > 0) {
          const calculated = amt - fee;
          return { amount: calculated.toFixed(8) };
        }
      }

      // 2. Try getrawtransaction verbose
      const rawRes = await rpcClient.call<any>("getrawtransaction", [txid, 1]);
      if (rawRes.ok && rawRes.value) {
        const vout = rawRes.value.vout || [];
        
        // Find nulldata/OP_RETURN output
        const opReturnOut = vout.find((o: any) => 
          o.scriptPubKey && 
          (o.scriptPubKey.type === "nulldata" || 
           (o.scriptPubKey.asm && o.scriptPubKey.asm.startsWith("OP_RETURN")))
        );

        if (opReturnOut) {
          if (opReturnOut.value > 0) {
            return { amount: opReturnOut.value.toFixed(8) };
          }
          
          // If value is 0, it might be a SYSX burn. Let's inspect the vout for Syscoin-specific fields.
          for (const o of vout) {
            if (o.scriptPubKey && o.scriptPubKey.assetAllocation) {
              const allocationAmount = o.scriptPubKey.assetAllocation.amount;
              if (allocationAmount) {
                return { amount: (parseFloat(allocationAmount) / 1e8).toFixed(8) };
              }
            }
          }
        }
      }

      // 3. Fallback to Blockbook API
      const blockbookUrl = activeNetwork === "MAINNET" ? MAINNET_BLOCKBOOK : TESTNET_BLOCKBOOK;
      const isBrowserDev = typeof window !== "undefined" && !(window as any).__TAURI__;
      let txUrl = `${blockbookUrl}/api/v2/tx/${txid}`;
      if (isBrowserDev) {
        txUrl = `/rpc-proxy/api/v2/tx/${txid}?target=${encodeURIComponent(blockbookUrl)}`;
      }
      const fetchRes = await fetch(txUrl);
      if (fetchRes.ok) {
        const txData = await fetchRes.json();
        if (txData.value) {
          const valSys = (parseFloat(txData.value) / 1e8).toFixed(8);
          if (txData.tokenTransfers && txData.tokenTransfers.length > 0) {
            const transfer = txData.tokenTransfers[0];
            if (transfer.value) {
              const decimals = transfer.decimals || 8;
              const valToken = (parseFloat(transfer.value) / Math.pow(10, decimals)).toFixed(8);
              return { amount: valToken };
            }
          }
          return { amount: valSys };
        }
      }
    } catch (err) {
      console.warn("Failed to resolve tx details:", err);
    }
    return { amount: "Unknown" };
  };

  async function handlePasswordSubmit() {
    if (!pendingClaimRecord || !passDialogPassword) return;
    setPassDialogError(null);
    setClaimingId(pendingClaimRecord.id);
    const rec = pendingClaimRecord;

    let modalClosed = false;

    try {
      // 1. Decrypt private key
      setClaimStep("decrypting");
      const decryptedPrivKey = await decryptPrivateKey(passDialogPassword);

      // 2. Fetch proof
      setClaimStep("fetching_proof");
      const proof = await fetchSpvProof(rpcClient, activeNetwork as "MAINNET" | "TESTNET", rec.txid!);

      // 3. Submit proof (relayTx)
      const evmTxHash = await submitSpvProofToNevm(
        proof,
        activeNetwork,
        decryptedPrivKey,
        (step) => { if (!modalClosed) setClaimStep(step); },
        (info) => { if (!modalClosed) setClaimBlockInfo(info); },
        (hash) => {
          modalClosed = true;
          updateBridgeRecord(activeNetwork, rec.id, {
            status: "waiting_bridge",
            statusMessage: `Claiming on NEVM (TX: ${hash.slice(0, 10)}...)`
          });
          refreshHistory();
          
          setPassDialogOpen(false);
          setPassDialogPassword("");
          setPendingClaimRecord(null);
          setClaimStep(null);
          setClaimBlockInfo(null);
          setClaimingId(null);
        }
      );

      if (rec.destChain === "ROLLUX") {
        // 4. Deposit minted NEVM SYS into Rollux L2
        updateBridgeRecord(activeNetwork, rec.id, {
          status: "released",
          statusMessage: `SYS geclaimd op NEVM. Storten op Rollux L2...`
        });
        refreshHistory();

        const l2TxHash = await depositEthToRollux(
          rec.amount,
          rec.destAddress,
          activeNetwork,
          decryptedPrivKey,
          undefined,
          undefined,
          (hash) => {
             updateBridgeRecord(activeNetwork, rec.id, {
               status: "waiting_bridge",
               statusMessage: `Storten op Rollux L2 (TX: ${hash.slice(0, 10)}...)`
             });
             refreshHistory();
          }
        );
        updateBridgeRecord(activeNetwork, rec.id, {
          status: "completed",
          statusMessage: `Gestort op Rollux L2 (TX: ${l2TxHash.slice(0, 10)}...)`
        });
      } else {
        updateBridgeRecord(activeNetwork, rec.id, {
          status: "completed",
          statusMessage: `Geclaimd op NEVM (TX: ${evmTxHash.slice(0, 10)}...)`
        });
      }
      refreshHistory();

    } catch (err: any) {
      console.error("In-app claim failed:", err);
      if (modalClosed) {
        // Modal is closed, show error in the history record
        updateBridgeRecord(activeNetwork, rec.id, {
           status: "failed",
           statusMessage: "Claim mislukt: " + (err.message || String(err))
        });
        refreshHistory();
      } else {
        // Modal is open, show error there
        setClaimStep(null);
        if (err.message && (err.message.includes("decryption") || err.message.includes("Padding") || err.message.includes("mac") || err.message.includes("bad decrypt"))) {
          setPassDialogError("Incorrect master password. Decryption failed.");
        } else {
          setPassDialogError(err.message || String(err));
        }
        setClaimingId(null);
      }
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  function handleAmountChange(value: string) {
    let sanitized = value.replace(/,/g, '.');
    sanitized = sanitized.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }
    setAmount(sanitized);
  }

  const destValid =
    route.dest === "SYSCOIN_NATIVE_UTXO"
      ? destAddress.length > 10   // just non-empty for UTXO
      : destAddress.startsWith("0x") && destAddress.length === 42;

  const canBridge =
    route.native &&
    amountNum > 0 &&
    (spendable === null || amountNum <= spendable) &&
    destValid &&
    allChecked &&
    !isSourceLocked;

  const canReview = route.native && amountNum > 0 && destValid;

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <h1>Bridge</h1>
        <p>Move SYS between Syscoin chain layers safely.</p>
      </div>

      {isTestnet && (
        <WarningBox severity="warn" title={`${activeNetwork} active`} className="mb-6">
          You are on a test network. Only test SYS will be bridged.
        </WarningBox>
      )}

      <div className="bridge-layout">
        {/* ── Left: main form ──────────────────────────────────────────────── */}
        <div>
          {/* Route selector */}
          <div className="bridge-route-selector">
            <button
              className="bridge-chain-btn"
              style={{ cursor: "default", pointerEvents: "none" }}
            >
              <span className="bridge-chain-role">From</span>
              <span className="bridge-chain-name">{route.sourceLabel}</span>
            </button>

            <button
              className="bridge-swap-btn"
              title="Swap direction"
              onClick={() => {
                const rev = ROUTES.find(r => r.source === route.dest && r.dest === route.source);
                if (rev) setSelectedRoute(rev.id);
              }}
            >
              ⇄
            </button>

            <button
              className="bridge-chain-btn"
              style={{ cursor: "default", pointerEvents: "none" }}
            >
              <span className="bridge-chain-role">To</span>
              <span className="bridge-chain-name">{route.destLabel}</span>
            </button>
          </div>

          {/* Route tabs */}
          <div className="flex gap-2 flex-wrap mb-6">
            {ROUTES.map(r => (
              <button
                key={r.id}
                id={`bridge-route-${r.id}`}
                className={`btn btn-sm ${selectedRoute === r.id ? "btn-primary" : "btn-ghost"}`}
                onClick={() => setSelectedRoute(r.id)}
              >
                {CHAIN_LABELS[r.source]} → {CHAIN_LABELS[r.dest]}
                {r.native && <span style={{ marginLeft: 4, fontSize: "0.6rem", opacity: 0.7 }}>NATIVE</span>}
              </button>
            ))}
          </div>

          {/* ── External route card ─────────────────────────────────────────── */}
          {!route.native && (
            <div className="bridge-external-card">
              <div className="bridge-external-icon">🔗</div>
              <div className="bridge-external-title">
                {route.sourceLabel} → {route.destLabel}
              </div>
              <div className="bridge-external-desc">
                This bridge direction requires an EVM-compatible wallet (Pali Wallet or MetaMask)
                and cannot be executed directly in NexSYS.
                Use the official{" "}
                <strong>{route.externalName}</strong> to complete this transfer.
              </div>

              {route.warning && (
                <WarningBox severity="warn" className="mb-5">
                  <div style={{ textAlign: "left" }}>{route.warning}</div>
                </WarningBox>
              )}

              {route.steps && (
                <div className="bridge-step-list">
                  {route.steps.map((step, i) => (
                    <div key={i} className="bridge-step">
                      <span className="bridge-step-num">{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-3">
                <a
                  href={route.externalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary w-full"
                  id={`bridge-external-link-${route.id}`}
                >
                  Open {route.externalName} ↗
                </a>
                <div className="flex justify-between text-xs text-muted">
                  <span>⏱ {route.estimatedTime}</span>
                  <span>💸 {route.feeNote}</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Native bridge form ──────────────────────────────────────────── */}
          {route.native && (
            <div className="card">
              <div className="stat-label mb-5">{route.sourceLabel} → {route.destLabel}</div>

              {route.warning && (
                <WarningBox severity="danger" className="mb-5">
                  {route.warning}
                </WarningBox>
              )}

              {/* Source address */}
              <CustomDropdown
                label="Source Address (Optional)"
                value={sourceAddress || "auto"}
                options={sourceDropdownOptions}
                onChange={(val) => setSourceAddress(val === "auto" ? "" : val)}
              />

              {isSourceLocked && (
                <WarningBox severity="danger" title="Address Locked" className="mt-2 mb-4">
                  This address is currently locked in Coin Control and has no spendable balance. Please unlock it in Coin Control if you wish to use its funds.
                </WarningBox>
              )}

              {/* Amount */}
              <div className="form-group mb-4">
                <label className="form-label" htmlFor="bridge-amount">Amount (SYS)</label>
                <div className="flex gap-2 mt-2">
                  <input
                    id="bridge-amount"
                    className="input input-mono flex-1"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00000000"
                    value={amount}
                    onChange={e => handleAmountChange(e.target.value)}
                  />
                  {spendable !== null && (
                    <button
                      className="btn btn-ghost btn-sm"
                      id="bridge-max-btn"
                      onClick={() => {
                        const fee = feeEst ?? 0.0001;
                        setAmount(Math.max(0, spendable - fee).toFixed(8));
                      }}
                    >
                      Max
                    </button>
                  )}
                </div>
                {spendable !== null && (
                  <span className="form-hint">Available: {spendable.toFixed(8)} SYS</span>
                )}
                {amountNum > 0 && spendable !== null && amountNum > spendable && (
                  <span className="form-hint text-danger">Amount exceeds available balance.</span>
                )}
              </div>

              {/* Destination address */}
              <div className="form-group mb-4">
                <label className="form-label" htmlFor="bridge-dest">
                  Destination Address ({route.dest === "SYSCOIN_NATIVE_UTXO" ? "sys1…" : "0x…"})
                </label>
                <input
                  id="bridge-dest"
                  className="input input-mono mt-2"
                  placeholder={route.dest === "SYSCOIN_NATIVE_UTXO" ? "sys1q…" : "0x…"}
                  value={destAddress}
                  onChange={e => setDestAddress(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {!evmAddress && (route.dest === "SYSCOIN_NEVM" || route.dest === "ROLLUX") && (
                  <span className="form-hint">
                    Save your 0x address in{" "}
                    <Link to="/settings" className="text-accent">Settings</Link> to auto-fill.
                  </span>
                )}
                {destAddress && !destValid && (
                  <span className="form-hint text-warning">
                    {route.dest === "SYSCOIN_NATIVE_UTXO"
                      ? "Enter a valid Syscoin native address."
                      : "Must be a valid 0x EVM address (42 characters)."}
                  </span>
                )}
                {destAddress && destValid && (
                  <span className="form-hint text-success">Address format valid ✓</span>
                )}
              </div>

              {/* Preview */}
              {canReview && (
                <div className="bridge-preview mb-4">
                  <div className="bridge-preview-row">
                    <span className="text-muted">You send</span>
                    <span className="font-mono font-semibold">{amount} SYS</span>
                  </div>
                  <div className="bridge-preview-row">
                    <span className="text-muted">They receive</span>
                    <span className="font-mono font-semibold">~{amount} SYS</span>
                  </div>
                  <div className="bridge-preview-row">
                    <span className="text-muted">Network fee</span>
                    <span className="font-mono text-warning">
                      ~{feeEst?.toFixed(8) ?? "0.0001"} SYS
                    </span>
                  </div>
                  <div className="bridge-preview-row">
                    <span className="text-muted">Destination</span>
                    <span className="font-mono text-xs">{shortAddr(destAddress)}</span>
                  </div>
                  <div className="bridge-preview-row">
                    <span className="text-muted">Estimated time</span>
                    <span>{route.estimatedTime}</span>
                  </div>
                </div>
              )}

              {/* Safety checklist */}
              {canReview && (
                <>
                  <div className="stat-label mb-3">Safety Checklist</div>
                  <div className="bridge-checklist">
                    {SAFETY_CHECKS.map(item => (
                      <label key={item.id} className="bridge-check-item" htmlFor={`bridge-check-${item.id}`}>
                        <input
                          id={`bridge-check-${item.id}`}
                          type="checkbox"
                          checked={!!checks[item.id]}
                          onChange={() => setChecks(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                        />
                        {item.label}
                      </label>
                    ))}
                  </div>
                </>
              )}

              {bridgeError && (
                <WarningBox severity="danger" title="Bridge failed" className="mb-4">
                  {bridgeError}
                </WarningBox>
              )}

              {lastTxid && (
                <WarningBox severity="success" title="Bridge submitted!" className="mb-4">
                  TXID: <span className="font-mono text-xs break-all">{lastTxid}</span>
                  <br />
                  Your SYS will appear on {route.destLabel} after confirmation.
                </WarningBox>
              )}

              <button
                id="bridge-submit-btn"
                className="btn btn-primary w-full"
                disabled={!canBridge || bridging}
                onClick={() => {
                  if (route.source === "SYSCOIN_NATIVE_UTXO" && walletInfo && walletInfo.unlocked_until === 0) {
                    setUnlockError("Unlock your Syscoin UTXO Node Wallet to continue bridging.");
                    setPendingBridgeAfterUnlock(() => async () => {
                      setConfirmOpen(true);
                    });
                    setPendingBridgeLabel(`Resume bridge: ${amount || "0"} SYS to ${route.destLabel}`);
                    setUnlockDialogOpen(true);
                    return;
                  }
                  setConfirmOpen(true);
                }}
              >
                {bridging
                  ? <><div className="spinner" /> Bridging…</>
                  : `Bridge ${amount || "0"} SYS to ${route.destLabel}`}
              </button>
            </div>
          )}
        </div>

        {/* ── Right: info panel ────────────────────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {route.source === "SYSCOIN_NATIVE_UTXO" && (
            <div className="card animate-fade-in">
              <div className="stat-label mb-3">Syscoin UTXO Node Wallet Status</div>
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
                      Unlock Node Wallet
                    </button>
                  )}
                  {walletInfo.unlocked_until !== undefined && walletInfo.unlocked_until > 0 && (
                    <button
                      className="btn btn-secondary btn-sm mt-3 w-full"
                      onClick={handleLock}
                    >
                      Lock Node Wallet
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <div className="stat-label mb-3">Bridge Routes</div>
            {ROUTES.map(r => (
              <div
                key={r.id}
                className="flex justify-between items-center py-2"
                style={{ borderBottom: "1px solid var(--color-border)", fontSize: "var(--text-xs)" }}
              >
                <span className="text-muted">
                  {CHAIN_LABELS[r.source]} → {CHAIN_LABELS[r.dest]}
                </span>
                <span className={r.native ? "text-success font-semibold" : "text-muted"}>
                  {r.native ? "Native ✓" : "External"}
                </span>
              </div>
            ))}
          </div>

          <WarningBox severity="info" title="Bridge Safety">
            Always verify destination addresses carefully.
            Bridge transactions are usually irreversible.
            NexSYS never bridges funds without your explicit confirmation.
          </WarningBox>

          {!evmAddress && (
            <WarningBox severity="warn" title="No 0x address saved">
              <Link to="/settings" className="text-accent" style={{ textDecoration: "underline" }}>
                Add your NEVM address in Settings
              </Link>{" "}
              to auto-fill bridge destinations.
            </WarningBox>
          )}
        </div>
      </div>

      {/* ── Bridge History ──────────────────────────────────────────────────── */}
      {claimError && (
        <WarningBox severity="danger" title="Claim Failed" className="mt-8">
          {claimError}
        </WarningBox>
      )}
      <div className={claimError ? "card mt-4" : "card mt-8"}>
        <div className="flex justify-between items-center mb-5">
          <div className="stat-label">Bridge History</div>
          <div className="flex gap-2 items-center">
            {showResumeInput ? (
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  className="input input-sm input-bordered w-64"
                  placeholder="Paste UTXO TXID here..."
                  value={resumeTxid}
                  onChange={(e) => setResumeTxid(e.target.value)}
                  autoFocus
                />
                <button 
                  className="btn btn-primary btn-sm"
                  onClick={async () => {
                    if (resumeTxid) {
                      const recordId = makeBridgeId();
                      const txidClean = resumeTxid.trim();
                      addBridgeRecord(activeNetwork, {
                        id: recordId,
                        timestamp: Date.now(),
                        network: activeNetwork,
                        sourceChain: "SYSCOIN_NATIVE_UTXO",
                        destChain: "SYSCOIN_NEVM",
                        amount: "Loading...",
                        destAddress: evmAddress,
                        txid: txidClean,
                        status: "waiting_bridge"
                      });
                      setResumeTxid("");
                      setShowResumeInput(false);
                      refreshHistory();

                      const { amount: resolvedAmount } = await resolveTxDetails(txidClean);
                      updateBridgeRecord(activeNetwork, recordId, {
                        amount: resolvedAmount
                      });
                      refreshHistory();
                    }
                  }}
                >
                  Import
                </button>
                <button 
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowResumeInput(false)}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setShowResumeInput(true)}
                title="Import a TXID to resume claiming"
              >
                Resume TXID
              </button>
            )}
            <button className="btn btn-ghost btn-sm" onClick={refreshHistory}>⟳</button>
          </div>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-secondary">No bridge history yet. Completed and pending bridges will appear here.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="bridge-history-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Route</th>
                  <th>Amount</th>
                  <th>Destination</th>
                  <th>TXID</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {history.map(rec => {
                  const color = BRIDGE_STATUS_COLOR[rec.status];
                  return (
                    <tr key={rec.id}>
                      <td className="text-xs text-muted whitespace-nowrap">{timeAgo(rec.timestamp)}</td>
                      <td className="text-xs whitespace-nowrap">
                        {CHAIN_LABELS[rec.sourceChain]} → {CHAIN_LABELS[rec.destChain]}
                      </td>
                      <td className="font-mono text-sm whitespace-nowrap">{rec.amount} SYS</td>
                      <td className="font-mono text-xs text-muted whitespace-nowrap" title={rec.destAddress}>
                        {shortAddr(rec.destAddress)}
                      </td>
                      <td className="whitespace-nowrap">
                        {rec.txid ? (
                          <div
                            className="font-mono text-xs text-success hover:opacity-80 transition-colors flex items-center gap-2 cursor-pointer whitespace-nowrap"
                            title="Click to copy full TXID"
                            onClick={() => {
                              navigator.clipboard.writeText(rec.txid!);
                              setCopiedTxid(rec.txid!);
                              setTimeout(() => setCopiedTxid(null), 2000);
                            }}
                          >
                            <span>{shortId(rec.txid)}</span>
                            {copiedTxid === rec.txid ? (
                              <span className="text-[10px]">✓</span>
                            ) : (
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-80">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                              </svg>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                      <td>
                        <div className="bridge-status-container">
                          <span className={`bridge-status-pill bridge-status-pill--${color}`} title={rec.statusMessage}>
                            {BRIDGE_STATUS_LABELS[rec.status]}
                          </span>
                          {rec.statusMessage && (
                            <div 
                              className={`text-[10px] bridge-status-message--${color} mt-1 font-sans max-w-[200px]`}
                              style={{ 
                                wordBreak: "break-word", 
                                whiteSpace: "normal",
                                lineHeight: "1.2",
                                opacity: 0.9
                              }}
                              title={rec.statusMessage}
                            >
                              {rec.statusMessage}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className="bridge-actions-cell">
                          {rec.status === "waiting_bridge" && !rec.isConversion && (
                            <div className="flex flex-col gap-1 items-stretch" style={{ minWidth: "150px" }}>
                              {rec.statusMessage?.includes("Claiming on NEVM") || rec.statusMessage?.includes("Storten op Rollux L2") ? (
                                <div className="text-xs text-accent flex items-center justify-center gap-2 font-semibold bg-accent/10 py-1.5 px-2 rounded" style={{ backgroundColor: "rgba(var(--color-accent-rgb), 0.1)" }}>
                                  <div className="spinner" style={{ width: 12, height: 12, borderWidth: 2 }} />
                                  Processing...
                                </div>
                              ) : isCredentialsSaved ? (
                                <>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: "0.7rem", padding: "4px 8px", width: "100%" }}
                                    onClick={() => handleClaim(rec, true)}
                                    disabled={claimingId === rec.id}
                                  >
                                    {claimingId === rec.id ? "Claiming..." : "Claim via In-App Wallet"}
                                  </button>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    style={{ fontSize: "0.7rem", padding: "4px 8px", width: "100%" }}
                                    onClick={() => handleClaim(rec, false)}
                                    disabled={claimingId === rec.id}
                                  >
                                    Claim via MetaMask
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    className="btn btn-primary btn-sm"
                                    style={{ fontSize: "0.7rem", padding: "4px 8px", width: "100%" }}
                                    onClick={() => handleClaim(rec, false)}
                                    disabled={claimingId === rec.id}
                                  >
                                    {claimingId === rec.id ? "Claiming..." : "Claim via MetaMask"}
                                  </button>
                                  <span className="text-[10px] text-muted text-center mt-1" style={{ maxWidth: "150px", display: "inline-block", whiteSpace: "normal" }}>
                                    💡 Browser wallet extensions are not supported natively in desktop mode.
                                    Import your EVM Credentials in Settings, or run NexSYS in Chrome to claim.
                                  </span>
                                </>
                              )}
                            </div>
                          )}

                          {(rec.status === "failed" || (rec.status === "waiting_bridge" && rec.isConversion)) && (
                            <div className="flex flex-col gap-1 items-stretch" style={{ minWidth: "150px" }}>
                              <button
                                className="btn btn-primary btn-sm"
                                style={{ fontSize: "0.7rem", padding: "4px 8px", width: "100%" }}
                                onClick={() => handleResumeAutoBurn(rec)}
                              >
                                Resume Action
                              </button>
                            </div>
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: "0.7rem", padding: "2px 6px" }}
                            title="Remove from history"
                            onClick={() => {
                              deleteBridgeRecord(activeNetwork, rec.id);
                              refreshHistory();
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirm Bridge"
        description={[
          `Bridge ${amount} SYS from ${route.sourceLabel} to ${route.destLabel}.`,
          `Destination: ${destAddress}`,
          `Estimated fee: ~${feeEst?.toFixed(8) ?? "0.0001"} SYS`,
          `\nThis action cannot be undone.`,
        ].join("\n")}
        confirmLabel="Bridge Now"
        cancelLabel="Cancel"
        danger
        onConfirm={handleNativeBridge}
        onCancel={() => setConfirmOpen(false)}
      />

      <ConfirmDialog
        open={passDialogOpen}
        title={claimingId ? "Bridge in progress..." : "Unlock EVM Wallet (NEVM/Rollux)"}
        cancelDisabled={!!claimingId}
        confirmDisabled={!!claimingId || !passDialogPassword}
        description={(() => {
          // Helper: determine the display state of a step
          const STEP_ORDER = [
            "decrypting", "fetching_proof", "broadcasting", "mining",
            ...(pendingClaimRecord?.destChain === "ROLLUX" ? ["depositing_rollux", "mining_rollux"] : [])
          ];
          const activeIdx = STEP_ORDER.indexOf(claimStep || "");
          const stepState = (key: string): "active" | "done" | "pending" => {
            const idx = STEP_ORDER.indexOf(key);
            if (claimStep === key) return "active";
            if (activeIdx > idx) return "done";
            return "pending";
          };
          const stepIcon = (key: string) => {
            const s = stepState(key);
            if (s === "active") return <div className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px", flexShrink: 0 }} />;
            if (s === "done") return <span style={{ color: "var(--color-success, #4ade80)", fontSize: "1rem", lineHeight: 1, flexShrink: 0 }}>✓</span>;
            return <span style={{ color: "var(--color-text-muted)", fontSize: "0.9rem", lineHeight: 1, flexShrink: 0 }}>○</span>;
          };
          const stepColor = (key: string) => {
            const s = stepState(key);
            if (s === "active") return "var(--color-accent)";
            if (s === "done") return "var(--color-text)";
            return "var(--color-text-muted)";
          };

          const StepRow = ({ stepKey, label }: { stepKey: string; label: string }) => (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", color: stepColor(stepKey), fontWeight: stepState(stepKey) === "active" ? 600 : 400 }}>
                {stepIcon(stepKey)}
                <span>{label}</span>
              </div>
              {/* Block progress shown below the active mining step */}
              {claimBlockInfo && (claimStep === "mining" && stepKey === "mining" || claimStep === "mining_rollux" && stepKey === "mining_rollux") && (
                <div style={{ marginLeft: "24px", fontSize: "0.72rem", color: "var(--color-text-muted)", fontFamily: "monospace", marginTop: "2px" }}>
                  ⛓ {claimBlockInfo}
                </div>
              )}
            </div>
          );

          if (claimingId) {
            // ── PROCESSING MODE: show only steps ──────────────────────────────
            return (
              <div style={{ padding: "4px 0" }}>
                <div style={{
                  display: "flex", flexDirection: "column", gap: "14px",
                  padding: "16px", borderRadius: "8px",
                  backgroundColor: "rgba(0,0,0,0.2)",
                  border: "1px solid rgba(255,255,255,0.06)"
                }}>
                  <StepRow stepKey="decrypting"       label="Step 1: Decrypting EVM credentials..." />
                  <StepRow stepKey="fetching_proof"   label="Step 2: Fetching SPV proof from node..." />
                  <StepRow stepKey="broadcasting"     label="Step 3: Broadcasting SPV proof to NEVM (relayTx)..." />
                  <StepRow stepKey="mining"           label="Step 4: Waiting for NEVM confirmation..." />
                  {pendingClaimRecord?.destChain === "ROLLUX" && (
                    <>
                      <StepRow stepKey="depositing_rollux" label="Step 5: Depositing to Rollux L2 (depositETHTo)..." />
                      <StepRow stepKey="mining_rollux"     label="Step 6: Waiting for Rollux L2 confirmation..." />
                    </>
                  )}
                </div>
              </div>
            );
          }

          // ── INPUT MODE: show password form ────────────────────────────────
          return (
            <div>
              <p className="mb-4" style={{ fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
                Enter your <strong>EVM Master Password</strong> to decrypt your saved EVM credentials and sign the claim transaction on the NEVM/Rollux chain.
                <br /><br />
                <span className="text-accent" style={{ fontWeight: 500 }}>💡 Note: This is the in-app password you set in Settings, <em>not</em> the Syscoin UTXO Node Passphrase.</span>
              </p>
              <input
                type="password"
                className="input input-mono w-full"
                placeholder="EVM Master Password"
                value={passDialogPassword}
                disabled={false}
                onChange={(e) => {
                  setPassDialogPassword(e.target.value);
                  setPassDialogError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && passDialogPassword) {
                    handlePasswordSubmit();
                  }
                }}
                autoFocus
              />
              {passDialogError && (
                <div className="text-danger text-xs mt-2 font-semibold">
                  ⚠️ {passDialogError}
                </div>
              )}
            </div>
          );
        })()}

        confirmLabel={claimingId ? "Claiming..." : "Sign & Claim"}
        cancelLabel="Cancel"
        onConfirm={handlePasswordSubmit}
        onCancel={() => {
          setPassDialogOpen(false);
          setPassDialogPassword("");
          setPassDialogError(null);
          setPendingClaimRecord(null);
          setClaimStep(null);
          setClaimBlockInfo(null);
        }}
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
              <h3 className="dialog__title">Unlock Syscoin Core Node Wallet (UTXO)</h3>
            </div>
            <p className="dialog__desc" style={{ marginBottom: "var(--space-4)", fontSize: "0.85rem", color: "var(--color-text-secondary)" }}>
              Enter your <strong>Syscoin UTXO Node Passphrase</strong> to unlock your local Syscoin Core wallet for the burn transaction.
              {pendingBridgeLabel && (
                <div style={{ marginTop: "12px", padding: "8px 12px", backgroundColor: "rgba(var(--color-accent-rgb), 0.1)", borderLeft: "3px solid var(--color-accent)", borderRadius: "4px" }}>
                  <span style={{ fontWeight: 600, color: "var(--color-text)" }}>Automatic action after unlock:</span><br />
                  <span style={{ color: "var(--color-accent)" }}>{pendingBridgeLabel}</span>
                </div>
              )}
              <br /><br />
              <span className="text-warning" style={{ fontWeight: 500 }}>⚠️ Note: This is the passphrase of your local Syscoin Core node wallet, <em>not</em> the EVM Master Password.</span>
            </p>
            
            <div className="form-group" style={{ textAlign: "left", width: "100%", marginBottom: "var(--space-3)" }}>
              <label className="form-label" htmlFor="bridge-unlock-passphrase">Syscoin UTXO Node Passphrase</label>
              <input
                id="bridge-unlock-passphrase"
                className="input"
                type="password"
                required
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                placeholder="Passphrase of the Syscoin Core Node"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ textAlign: "left", width: "100%", marginBottom: "var(--space-4)" }}>
              <label className="form-label" htmlFor="bridge-unlock-timeout">Validity (seconds)</label>
              <input
                id="bridge-unlock-timeout"
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
              <WarningBox severity="danger" title="Unlock Failed" className="mb-4">
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
                Annuleren
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={unlocking}
              >
                {unlocking ? "Unlocking…" : "Unlock Wallet"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
