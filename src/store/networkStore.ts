/**
 * store/networkStore.ts
 * Zustand store for active network environment and RPC config.
 */

import { create } from "zustand";
import { Wallet } from "ethers";
import type { NetworkEnvironment } from "../types/chain";
import type { RpcConfig } from "../types/network";
import {
  loadSavedNetwork,
  saveActiveNetwork,
  loadRpcConfig,
  saveRpcConfig,
} from "../services/networkEnvironmentService";
import { SyscoinRpcClient } from "../services/syscoinRpcClient";
import { encryptData, decryptData } from "../services/cryptoService";

// ── EVM address persistence ───────────────────────────────────────────────────

function evmAddressKey(network: NetworkEnvironment) {
  return `nexsys_evm_address_${network}`;
}
function loadEvmAddress(network: NetworkEnvironment): string {
  return localStorage.getItem(evmAddressKey(network)) ?? "";
}
function saveEvmAddress(network: NetworkEnvironment, address: string) {
  if (address) localStorage.setItem(evmAddressKey(network), address);
  else localStorage.removeItem(evmAddressKey(network));
}

function evmEncryptedKey(network: NetworkEnvironment) {
  return `nexsys_evm_encrypted_${network}`;
}
function loadEvmEncrypted(network: NetworkEnvironment): string {
  return localStorage.getItem(evmEncryptedKey(network)) ?? "";
}
function saveEvmEncrypted(network: NetworkEnvironment, encryptedJson: string) {
  if (encryptedJson) localStorage.setItem(evmEncryptedKey(network), encryptedJson);
  else localStorage.removeItem(evmEncryptedKey(network));
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface NetworkState {
  activeNetwork: NetworkEnvironment;
  rpcConfig: RpcConfig;
  rpcClient: SyscoinRpcClient;
  /** The user's Syscoin NEVM / Rollux (0x) address, saved per network. */
  evmAddress: string;
  /** Whether the user has saved encrypted EVM credentials. */
  isCredentialsSaved: boolean;
  /** The encrypted EVM credentials JSON string. */
  evmEncryptedJson: string;

  setNetwork: (network: NetworkEnvironment) => void;
  updateRpcConfig: (partial: Partial<RpcConfig>) => void;
  setEvmAddress: (address: string) => void;
  saveCredentials: (type: "private_key" | "mnemonic", value: string, password: string) => Promise<void>;
  clearCredentials: () => void;
  decryptPrivateKey: (password: string) => Promise<string>;
}

const initialNetwork   = loadSavedNetwork();
const initialRpcConfig = loadRpcConfig(initialNetwork);
const initialEncrypted = loadEvmEncrypted(initialNetwork);

export const useNetworkStore = create<NetworkState>((set, get) => ({
  activeNetwork: initialNetwork,
  rpcConfig:     initialRpcConfig,
  rpcClient:     new SyscoinRpcClient(initialRpcConfig),
  evmAddress:    loadEvmAddress(initialNetwork),
  isCredentialsSaved: !!initialEncrypted,
  evmEncryptedJson:   initialEncrypted,

  setNetwork(network) {
    const rpcConfig = loadRpcConfig(network);
    const encrypted = loadEvmEncrypted(network);
    saveActiveNetwork(network);
    set({
      activeNetwork: network,
      rpcConfig,
      rpcClient:  new SyscoinRpcClient(rpcConfig),
      evmAddress: loadEvmAddress(network),
      isCredentialsSaved: !!encrypted,
      evmEncryptedJson:   encrypted,
    });
  },

  updateRpcConfig(partial) {
    const current = get().rpcConfig;
    const updated = { ...current, ...partial };
    saveRpcConfig(get().activeNetwork, updated);
    set({ rpcConfig: updated, rpcClient: new SyscoinRpcClient(updated) });
  },

  setEvmAddress(address) {
    const network = get().activeNetwork;
    saveEvmAddress(network, address.trim());
    set({ evmAddress: address.trim() });
  },

  async saveCredentials(type, value, password) {
    const network = get().activeNetwork;
    const cleanValue = value.trim();
    if (!cleanValue) return;

    // Encrypt the credentials payload
    const payload = JSON.stringify({ type, value: cleanValue });
    const encryptedJson = await encryptData(payload, password);

    // Save encrypted credentials
    saveEvmEncrypted(network, encryptedJson);

    // Derive public EVM address
    let derivedAddress = "";
    if (type === "private_key") {
      const keyWithPrefix = cleanValue.startsWith("0x") ? cleanValue : `0x${cleanValue}`;
      derivedAddress = new Wallet(keyWithPrefix).address;
    } else {
      derivedAddress = Wallet.fromPhrase(cleanValue).address;
    }

    saveEvmAddress(network, derivedAddress);

    set({
      isCredentialsSaved: true,
      evmEncryptedJson: encryptedJson,
      evmAddress: derivedAddress,
    });
  },

  clearCredentials() {
    const network = get().activeNetwork;
    saveEvmEncrypted(network, "");
    saveEvmAddress(network, "");
    set({
      isCredentialsSaved: false,
      evmEncryptedJson: "",
      evmAddress: "",
    });
  },

  async decryptPrivateKey(password) {
    const json = get().evmEncryptedJson;
    if (!json) throw new Error("No credentials saved.");

    // Decrypt the payload
    const decryptedPayload = await decryptData(json, password);
    const { type, value } = JSON.parse(decryptedPayload);

    if (type === "private_key") {
      return value.startsWith("0x") ? value : `0x${value}`;
    } else {
      // Derive private key from seed phrase
      const wallet = Wallet.fromPhrase(value);
      return wallet.privateKey;
    }
  },
}));
