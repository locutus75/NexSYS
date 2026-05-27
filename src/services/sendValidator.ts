/**
 * sendValidator.ts
 * Validates send intents before they reach signing.
 *
 * Returns an action (ALLOW | WARN | BLOCK), a reason, and a suggested action.
 * All unsafe chain combos are explicitly handled here — never silently ignored.
 */

import { classifyAddress } from "./addressClassifier";
import type { AddressType, ChainEnvironment, NetworkEnvironment } from "../types/chain";

export type ValidationAction = "ALLOW" | "WARN" | "BLOCK";

export interface SendValidationResult {
  action: ValidationAction;
  reason: string;
  /** User-facing instruction for what to do next. */
  suggestedAction?: string;
  /** Which address type was detected. */
  detectedAddressType?: AddressType;
}

export interface SendIntent {
  sourceChain: ChainEnvironment;
  network: NetworkEnvironment;
  /** Raw destination address string. */
  destinationAddress: string;
  asset: string;   // e.g. "SYS"
  /** Decimal string amount. */
  amount: string;
  /** Whether the source UTXO is flagged as frozen. */
  sourceUtxoFrozen?: boolean;
  /** Whether the source UTXO is reserved for a Sentry Node. */
  sourceUtxoReservedForNode?: boolean;
  /** Whether the native Web3 wallet is configured. */
  isCredentialsSaved?: boolean;
}

/**
 * Validate a send intent.
 * Must be called before presenting the confirm dialog.
 * A BLOCK result must prevent submission entirely.
 */
export function validateSendIntent(intent: SendIntent): SendValidationResult {
  const {
    sourceChain,
    network,
    destinationAddress,
    amount,
    sourceUtxoFrozen,
    sourceUtxoReservedForNode,
    isCredentialsSaved,
  } = intent;

  // --- Guard: frozen UTXO ---
  if (sourceUtxoFrozen) {
    return {
      action: "BLOCK",
      reason: "The selected UTXO is frozen and cannot be spent.",
      suggestedAction: "Unfreeze the UTXO in Coin Control before sending.",
    };
  }

  // --- Guard: node-reserved UTXO ---
  if (sourceUtxoReservedForNode) {
    return {
      action: "BLOCK",
      reason: "This UTXO is reserved for Sentry Node operation. Spending it may break your node.",
      suggestedAction:
        "Enable Advanced Mode and explicitly override the node-reserve lock if you are sure this is safe.",
    };
  }

  // --- Guard: empty/zero amount ---
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return {
      action: "BLOCK",
      reason: "Invalid or zero amount specified.",
    };
  }

  // --- Classify destination address ---
  const classification = classifyAddress(destinationAddress, network);
  const addrType = classification.type;

  // --- Guard: invalid address ---
  if (addrType === "INVALID") {
    return {
      action: "BLOCK",
      reason: "The destination address is invalid.",
      detectedAddressType: addrType,
    };
  }

  // --- Guard: unknown address format ---
  if (addrType === "UNKNOWN") {
    return {
      action: "WARN",
      reason:
        "The destination address format is not recognised. Verify the address carefully before sending.",
      suggestedAction:
        "Double-check the address with the recipient. Unknown formats may cause permanent loss of funds.",
      detectedAddressType: addrType,
    };
  }

  // --- UTXO → EVM: must bridge ---
  if (
    sourceChain === "SYSCOIN_NATIVE_UTXO" &&
    addrType === "EVM_0X"
  ) {
    return {
      action: "BLOCK",
      reason:
        "You are trying to send Syscoin Native (UTXO) SYS to an EVM-style 0x address. " +
        "These are different chain environments — a direct send will not arrive safely.",
      suggestedAction:
        "Use the Bridge to move SYS from Syscoin Native to NEVM first, then send from NEVM.",
      detectedAddressType: addrType,
    };
  }

  // --- EVM → UTXO: must bridge ---
  if (
    (sourceChain === "SYSCOIN_NEVM" || sourceChain === "ROLLUX" || sourceChain === "ZKSYS") &&
    addrType.startsWith("UTXO_")
  ) {
    return {
      action: "BLOCK",
      reason:
        `You are trying to send from ${sourceChain} to a Syscoin Native (UTXO) address. ` +
        "These are different chain environments — a direct send will not arrive safely.",
      suggestedAction:
        "Use the Bridge to move SYS to Syscoin Native first.",
      detectedAddressType: addrType,
    };
  }

  // --- Native Web3 Wallet check ---
  if (sourceChain !== "SYSCOIN_NATIVE_UTXO" && !isCredentialsSaved) {
    const chainName = sourceChain === "ZKSYS" ? "zkSYS" : sourceChain === "ROLLUX" ? "Rollux" : "Syscoin NEVM";
    return {
      action: "BLOCK",
      reason: `Sending directly from ${chainName} requires your native Web3 wallet to be configured.`,
      suggestedAction: `Please go to Settings to import your EVM Private Key or Mnemonic phrase.`,
    };
  }

  // --- zkSYS: any destination requires explicit knowledge ---
  if (sourceChain === "ZKSYS") {
    return {
      action: "WARN",
      reason:
        "Sending from zkSYS is subject to zkSYS-specific proving rules. " +
        "Ensure the destination chain is correct.",
      suggestedAction:
        "Review the zkSYS status screen before proceeding.",
      detectedAddressType: addrType,
    };
  }

  // --- Network mismatch: address looks like wrong network ---
  if (classification.warnings.length > 0) {
    return {
      action: "WARN",
      reason: classification.warnings[0],
      suggestedAction:
        "Verify the address and make sure you are on the correct network before proceeding.",
      detectedAddressType: addrType,
    };
  }

  // --- All checks passed ---
  return {
    action: "ALLOW",
    reason: "Send intent validated. Review the details and confirm.",
    detectedAddressType: addrType,
  };
}
