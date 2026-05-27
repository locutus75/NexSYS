/**
 * tests/sendValidator.test.ts
 * Unit tests for the send intent validator.
 */

import { describe, it, expect } from "vitest";
import { validateSendIntent } from "../services/sendValidator";
import type { SendIntent } from "../services/sendValidator";

const EVM_ADDRESS  = "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12";
const UTXO_ADDRESS = "sys1qw508d6qejxtdg4y5r3zarvary0c5xw7k8tjxv";
const TSYS_ADDRESS = "tsys1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0ghcqfnuuqlfpk";

function makeIntent(overrides: Partial<SendIntent> = {}): SendIntent {
  return {
    sourceChain: "SYSCOIN_NATIVE_UTXO",
    network: "MAINNET",
    destinationAddress: UTXO_ADDRESS,
    asset: "SYS",
    amount: "10.0",
    ...overrides,
  };
}

describe("validateSendIntent", () => {

  // ---- Allowed cases ----
  it("allows a UTXO → UTXO send on mainnet", () => {
    const result = validateSendIntent(makeIntent());
    expect(result.action).toBe("ALLOW");
  });

  it("allows a NEVM → NEVM (0x→0x) send", () => {
    const result = validateSendIntent(makeIntent({
      sourceChain: "SYSCOIN_NEVM",
      destinationAddress: EVM_ADDRESS,
      isCredentialsSaved: true,
    }));
    expect(result.action).toBe("ALLOW");
  });

  // ---- Blocked cases ----
  it("blocks UTXO → EVM address (must bridge)", () => {
    const result = validateSendIntent(makeIntent({
      sourceChain: "SYSCOIN_NATIVE_UTXO",
      destinationAddress: EVM_ADDRESS,
    }));
    expect(result.action).toBe("BLOCK");
    expect(result.suggestedAction).toMatch(/bridge/i);
  });

  it("blocks NEVM → UTXO address (must bridge)", () => {
    const result = validateSendIntent(makeIntent({
      sourceChain: "SYSCOIN_NEVM",
      destinationAddress: UTXO_ADDRESS,
      isCredentialsSaved: true,
    }));
    expect(result.action).toBe("BLOCK");
    expect(result.suggestedAction).toMatch(/bridge/i);
  });

  it("blocks Rollux → UTXO address (must bridge)", () => {
    const result = validateSendIntent(makeIntent({
      sourceChain: "ROLLUX",
      destinationAddress: UTXO_ADDRESS,
      isCredentialsSaved: true,
    }));
    expect(result.action).toBe("BLOCK");
  });

  it("blocks a frozen UTXO from being spent", () => {
    const result = validateSendIntent(makeIntent({ sourceUtxoFrozen: true }));
    expect(result.action).toBe("BLOCK");
    expect(result.reason).toMatch(/frozen/i);
  });

  it("blocks a node-reserved UTXO from being spent", () => {
    const result = validateSendIntent(makeIntent({ sourceUtxoReservedForNode: true }));
    expect(result.action).toBe("BLOCK");
    expect(result.reason).toMatch(/node/i);
  });

  it("blocks an invalid address", () => {
    const result = validateSendIntent(makeIntent({ destinationAddress: "" }));
    expect(result.action).toBe("BLOCK");
  });

  it("blocks a zero amount", () => {
    const result = validateSendIntent(makeIntent({ amount: "0" }));
    expect(result.action).toBe("BLOCK");
  });

  it("blocks a negative amount", () => {
    const result = validateSendIntent(makeIntent({ amount: "-5" }));
    expect(result.action).toBe("BLOCK");
  });

  // ---- Warn cases ----
  it("warns when using zkSYS as source chain", () => {
    const result = validateSendIntent(makeIntent({
      sourceChain: "ZKSYS",
      destinationAddress: EVM_ADDRESS,
      isCredentialsSaved: true,
    }));
    expect(result.action).toBe("WARN");
    expect(result.reason).toMatch(/zkSYS/i);
  });

  it("warns on unknown address format", () => {
    const result = validateSendIntent(makeIntent({ destinationAddress: "notanaddress!!" }));
    expect(result.action).toBe("WARN");
  });

  it("warns when a mainnet address is used on testnet", () => {
    const result = validateSendIntent(makeIntent({
      network: "TESTNET",
      destinationAddress: UTXO_ADDRESS, // sys1q... is mainnet bech32
    }));
    // Should warn due to network mismatch detected by addressClassifier
    expect(["WARN", "BLOCK"]).toContain(result.action);
  });

  it("warns when a testnet address is used on mainnet", () => {
    const result = validateSendIntent(makeIntent({
      network: "MAINNET",
      destinationAddress: TSYS_ADDRESS,
    }));
    expect(["WARN", "BLOCK"]).toContain(result.action);
  });
});
