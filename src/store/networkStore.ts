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

function evmPrivateKeyKey(network: NetworkEnvironment) {
  return `nexsys_evm_private_key_${network}`;
}
function loadEvmPrivateKey(network: NetworkEnvironment): string {
  return localStorage.getItem(evmPrivateKeyKey(network)) ?? "";
}
function saveEvmPrivateKey(network: NetworkEnvironment, key: string) {
  if (key) localStorage.setItem(evmPrivateKeyKey(network), key);
  else localStorage.removeItem(evmPrivateKeyKey(network));
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface NetworkState {
  activeNetwork: NetworkEnvironment;
  rpcConfig: RpcConfig;
  rpcClient: SyscoinRpcClient;
  /** The user's Syscoin NEVM / Rollux (0x) address, saved per network. */
  evmAddress: string;
  /** The user's EVM private key, saved per network. */
  evmPrivateKey: string;

  setNetwork: (network: NetworkEnvironment) => void;
  updateRpcConfig: (partial: Partial<RpcConfig>) => void;
  setEvmAddress: (address: string) => void;
  setEvmPrivateKey: (key: string) => void;
}

const initialNetwork   = loadSavedNetwork();
const initialRpcConfig = loadRpcConfig(initialNetwork);

export const useNetworkStore = create<NetworkState>((set, get) => ({
  activeNetwork: initialNetwork,
  rpcConfig:     initialRpcConfig,
  rpcClient:     new SyscoinRpcClient(initialRpcConfig),
  evmAddress:    loadEvmAddress(initialNetwork),
  evmPrivateKey: loadEvmPrivateKey(initialNetwork),

  setNetwork(network) {
    const rpcConfig = loadRpcConfig(network);
    saveActiveNetwork(network);
    set({
      activeNetwork: network,
      rpcConfig,
      rpcClient:  new SyscoinRpcClient(rpcConfig),
      evmAddress: loadEvmAddress(network),
      evmPrivateKey: loadEvmPrivateKey(network),
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

  setEvmPrivateKey(key) {
    const network = get().activeNetwork;
    const trimmed = key.trim();
    saveEvmPrivateKey(network, trimmed);

    if (trimmed) {
      try {
        const keyWithPrefix = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
        const wallet = new Wallet(keyWithPrefix);
        const derivedAddress = wallet.address;
        saveEvmAddress(network, derivedAddress);
        set({ evmPrivateKey: trimmed, evmAddress: derivedAddress });
      } catch (err) {
        // Just save the private key, don't update address if invalid
        set({ evmPrivateKey: trimmed });
      }
    } else {
      set({ evmPrivateKey: "" });
    }
  },
}));
