/**
 * tests/addressClassifier.test.ts
 * Unit tests for the address classification service.
 */

import { describe, it, expect } from "vitest";
import { classifyAddress } from "../services/addressClassifier";

describe("classifyAddress", () => {

  // ---- EVM ----
  it("classifies a valid EVM 0x address", () => {
    const result = classifyAddress("0xAbCdEf1234567890AbCdEf1234567890AbCdEf12", "MAINNET");
    expect(result.type).toBe("EVM_0X");
    expect(result.confidence).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  it("rejects a truncated EVM address", () => {
    const result = classifyAddress("0xAbCdEf1234567890", "MAINNET");
    expect(result.type).not.toBe("EVM_0X");
  });

  // ---- UTXO Bech32 (native SegWit) ----
  it("classifies a sys1 bech32 address on mainnet", () => {
    const result = classifyAddress("sys1qw508d6qejxtdg4y5r3zarvary0c5xw7k8tjxv", "MAINNET");
    expect(result.type).toBe("UTXO_BECH32");
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when sys1 address is used on testnet", () => {
    const result = classifyAddress("sys1qw508d6qejxtdg4y5r3zarvary0c5xw7k8tjxv", "TESTNET");
    expect(result.type).toBe("UTXO_BECH32");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("classifies a tsys1 bech32 address on testnet", () => {
    const result = classifyAddress("tsys1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0ghcqfnuuqlfpk", "TESTNET");
    expect(result.type).toBe("UTXO_BECH32");
    expect(result.warnings).toHaveLength(0);
  });

  it("warns when tsys1 address is used on mainnet", () => {
    const result = classifyAddress("tsys1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0ghcqfnuuqlfpk", "MAINNET");
    expect(result.type).toBe("UTXO_BECH32");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // ---- Taproot ----
  it("classifies a sys1p taproot address", () => {
    const result = classifyAddress("sys1pqthkq0k5d4jzfq4zdq6y6qqw8yvdxe3c2qvqqz9x4smnqy3r", "MAINNET");
    expect(result.type).toBe("UTXO_TAPROOT");
  });

  // ---- P2PKH Legacy ----
  it("classifies a Syscoin mainnet legacy P2PKH address starting with S", () => {
    const result = classifyAddress("SYvq8UEEG5C9EBa9YsgbBqZ1LxJrJRtGN", "MAINNET");
    expect(result.type).toBe("UTXO_LEGACY");
    expect(result.confidence).toBeGreaterThan(0.8);
  });

  it("warns on mainnet P2PKH address when network is testnet", () => {
    const result = classifyAddress("SYvq8UEEG5C9EBa9YsgbBqZ1LxJrJRtGN", "TESTNET");
    expect(result.type).toBe("UTXO_LEGACY");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  // ---- P2SH ----
  it("classifies a P2SH address starting with 3", () => {
    const result = classifyAddress("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "MAINNET");
    expect(result.type).toBe("UTXO_SEGWIT");
  });

  // ---- Unknown / Invalid ----
  it("returns INVALID for an empty address", () => {
    const result = classifyAddress("", "MAINNET");
    expect(result.type).toBe("INVALID");
  });

  it("returns UNKNOWN for a garbage string", () => {
    const result = classifyAddress("not_an_address_xyz123!!!!", "MAINNET");
    expect(result.type).toBe("UNKNOWN");
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("returns UNKNOWN for a BTC address (not a Syscoin address)", () => {
    // BTC bech32 uses bc1q prefix, not sys1
    const result = classifyAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "MAINNET");
    expect(result.type).toBe("UNKNOWN");
  });
});
