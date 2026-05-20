/**
 * addressClassifier.ts
 * Classifies Syscoin / EVM addresses into their correct type.
 *
 * Supports:
 *  - Syscoin UTXO P2PKH (legacy): mainnet starts with 'S', testnet with 'T' or 'y'
 *  - UTXO P2SH (SegWit-compatible): starts with '3' or 'M'
 *  - UTXO Bech32 (native SegWit): sys1... / tsys1...
 *  - UTXO Bech32m (Taproot): sys1p... / tsys1p...
 *  - EVM 0x addresses
 *
 * Returns an AddressType, a confidence score (0–1), and any warnings.
 */

import type { AddressType, NetworkEnvironment } from "../types/chain";

export interface ClassificationResult {
  type: AddressType;
  /** 0.0 – 1.0 confidence. 1.0 = definitive pattern match. */
  confidence: number;
  warnings: string[];
  /** Short label for UI display. */
  label: string;
}

// -----------------------------------------------------------------------
// Regex patterns
// -----------------------------------------------------------------------

/** EVM 0x address: 0x followed by exactly 40 hex chars (case-insensitive) */
const RE_EVM_0X = /^0x[0-9a-fA-F]{40}$/;

/** Syscoin UTXO Bech32 / Bech32m — mainnet */
const RE_SYS_BECH32    = /^sys1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,87}$/i;
/** Syscoin UTXO Bech32 / Bech32m — testnet */
const RE_TSYS_BECH32   = /^tsys1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,87}$/i;

/** Taproot = Bech32m with witness version 1 → starts sys1p or tsys1p */
const RE_SYS_TAPROOT   = /^sys1p[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,87}$/i;
const RE_TSYS_TAPROOT  = /^tsys1p[qpzry9x8gf2tvdw0s3jn54khce6mua7l]{6,87}$/i;

/** P2PKH legacy mainnet: starts with S (Syscoin) */
const RE_SYS_P2PKH     = /^S[1-9A-HJ-NP-Za-km-z]{24,33}$/;
/** P2PKH legacy testnet: starts with T or y */
const RE_TSYS_P2PKH    = /^[Ty][1-9A-HJ-NP-Za-km-z]{24,33}$/;

/** P2SH SegWit-compatible: starts with 3 or M (Syscoin P2SH) */
const RE_P2SH          = /^[3M][1-9A-HJ-NP-Za-km-z]{24,33}$/;

// -----------------------------------------------------------------------
// Classifier
// -----------------------------------------------------------------------

/**
 * Classify a raw address string.
 *
 * @param address - The address string to classify.
 * @param network - The current active network environment. Used to detect mismatches.
 */
export function classifyAddress(
  address: string,
  network: NetworkEnvironment = "MAINNET"
): ClassificationResult {
  const warnings: string[] = [];

  if (!address || address.trim() === "") {
    return { type: "INVALID", confidence: 1, warnings: ["Address is empty."], label: "Invalid" };
  }

  const addr = address.trim();

  // ---- EVM ----
  if (RE_EVM_0X.test(addr)) {
    return {
      type: "EVM_0X",
      confidence: 1,
      warnings: [],
      label: "EVM (0x)",
    };
  }

  // ---- Taproot (check before generic bech32) ----
  if (RE_SYS_TAPROOT.test(addr)) {
    if (network === "TESTNET" || network === "REGTEST" || network === "DEVNET") {
      warnings.push(
        "This appears to be a Syscoin Mainnet Taproot address but you are on a test network."
      );
    }
    return { type: "UTXO_TAPROOT", confidence: 0.95, warnings, label: "UTXO Taproot (sys1p)" };
  }

  if (RE_TSYS_TAPROOT.test(addr)) {
    if (network === "MAINNET") {
      warnings.push(
        "This appears to be a Syscoin Testnet Taproot address but you are on Mainnet."
      );
    }
    return { type: "UTXO_TAPROOT", confidence: 0.95, warnings, label: "UTXO Taproot Testnet (tsys1p)" };
  }

  // ---- Native SegWit Bech32 ----
  if (RE_SYS_BECH32.test(addr)) {
    if (network !== "MAINNET") {
      warnings.push("This is a Mainnet Bech32 address — you are currently on a non-mainnet environment.");
    }
    return { type: "UTXO_BECH32", confidence: 0.95, warnings, label: "UTXO Bech32 (sys1)" };
  }

  if (RE_TSYS_BECH32.test(addr)) {
    if (network === "MAINNET") {
      warnings.push("This is a Testnet Bech32 address — you are currently on Mainnet.");
    }
    return { type: "UTXO_BECH32", confidence: 0.95, warnings, label: "UTXO Bech32 Testnet (tsys1)" };
  }

  // ---- P2PKH Legacy ----
  if (RE_SYS_P2PKH.test(addr)) {
    if (network !== "MAINNET") {
      warnings.push("This looks like a Syscoin Mainnet legacy address — you are on a non-mainnet network.");
    }
    return { type: "UTXO_LEGACY", confidence: 0.85, warnings, label: "UTXO Legacy (S…)" };
  }

  if (RE_TSYS_P2PKH.test(addr)) {
    if (network === "MAINNET") {
      warnings.push("This looks like a Syscoin Testnet legacy address — you are currently on Mainnet.");
    }
    return { type: "UTXO_LEGACY", confidence: 0.85, warnings, label: "UTXO Legacy Testnet (T/y…)" };
  }

  // ---- P2SH SegWit-compatible ----
  if (RE_P2SH.test(addr)) {
    return { type: "UTXO_SEGWIT", confidence: 0.8, warnings, label: "UTXO SegWit (3/M…)" };
  }

  // ---- Unknown ----
  warnings.push("Address format not recognised. Double-check before sending.");
  return { type: "UNKNOWN", confidence: 0, warnings, label: "Unknown" };
}
