/**
 * services/evmBridgeService.ts
 * Interacts with MetaMask and the Syscoin NEVM contracts for the Bridge Claim phase.
 */
import { BrowserProvider, Contract, sha256, getBytes } from "ethers";

// ABI placeholder for the Syscoin Vault Manager to get the trusted relayer
const SYSCOIN_VAULT_MANAGER_ABI = [
  "function trustedRelayerContract() view returns(address)"
];

// ABI for the Relayer Contract which actually processes the proof
const RELAYER_CONTRACT_ABI = [
  "function relayTx(uint64 _blockNumber, bytes _txBytes, uint256 _txIndex, uint256[] _txSiblings, bytes _syscoinBlockHeader) external returns (uint256)"
];

// Provided by the user
const SYSCOIN_VAULT_MANAGER_ADDRESS = "0x7904299b3D3dC1b03d1DdEb45E9fDF3576aCBd5f";

/**
 * Helper to compute double SHA256.
 */
function doubleSha256(hexStr: string): string {
  return sha256(sha256(hexStr));
}

/**
 * Computes the layer-by-layer Merkle siblings path expected by the Syscoin Bridge contract.
 */
function buildMerklePath(txs: string[], index: number): string[] {
  let siblings: string[] = [];
  
  let currentLayer = txs.map(tx => {
    const cleanTx = tx.startsWith("0x") ? tx.slice(2) : tx;
    const buf = getBytes("0x" + cleanTx);
    const reversed = new Uint8Array(buf.length);
    for (let i = 0; i < buf.length; i++) {
      reversed[i] = buf[buf.length - 1 - i];
    }
    return reversed;
  });
  
  let currentIndex = index;

  while (currentLayer.length > 1) {
    let nextLayer: Uint8Array[] = [];
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = i + 1 < currentLayer.length ? currentLayer[i + 1] : left;
      
      if (i === currentIndex) {
        const reversedRight = new Uint8Array(right.length);
        for (let j = 0; j < right.length; j++) {
          reversedRight[j] = right[right.length - 1 - j];
        }
        const hex = Array.from(reversedRight).map(b => b.toString(16).padStart(2, "0")).join("");
        siblings.push(hex);
      } else if (i + 1 === currentIndex) {
        const reversedLeft = new Uint8Array(left.length);
        for (let j = 0; j < left.length; j++) {
          reversedLeft[j] = left[left.length - 1 - j];
        }
        const hex = Array.from(reversedLeft).map(b => b.toString(16).padStart(2, "0")).join("");
        siblings.push(hex);
      }
      
      const concat = new Uint8Array(left.length + right.length);
      concat.set(left);
      concat.set(right, left.length);
      
      const concatHex = "0x" + Array.from(concat).map(b => b.toString(16).padStart(2, "0")).join("");
      const parentHex = doubleSha256(concatHex);
      
      nextLayer.push(getBytes(parentHex));
    }
    currentLayer = nextLayer;
    currentIndex = Math.floor(currentIndex / 2);
  }
  return siblings;
}

/**
 * Request MetaMask to connect and switch to the Syscoin NEVM network.
 */
export async function ensureNevmNetwork(): Promise<BrowserProvider> {
  if (!window.ethereum) {
    throw new Error("MetaMask (or a Web3 wallet) is not installed.");
  }

  try {
    await window.ethereum.request({ method: "eth_requestAccounts" });
  } catch (err: any) {
    if (err.code === 4001) {
      throw new Error("MetaMask connection was rejected.");
    }
    throw new Error(`Failed to connect to MetaMask. Please ensure it is unlocked. (${err.message})`);
  }

  const provider = new BrowserProvider(window.ethereum);

  // Check network - 57 (Mainnet) or 5700 (Testnet)
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);
  
  if (chainId !== 57 && chainId !== 5700) {
    try {
      // Prompt user to switch to Syscoin NEVM Mainnet
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x39" }], // 57 in hex
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        throw new Error("Syscoin NEVM network is not added to your MetaMask. Please add it and try again.");
      }
      throw switchError;
    }
  }
  return provider;
}

/**
 * Submits the SPV proof to the NEVM smart contract to mint the SYS.
 */
export async function submitSpvProofToNevm(proofData: any): Promise<string> {
  const provider = await ensureNevmNetwork();
  const signer = await provider.getSigner();

  // Parse proof first to have blockNumber in outer catch scope
  const proof = typeof proofData === "string" ? JSON.parse(proofData) : proofData;
  let nevmBlockNumber = Number(proof.blockNumber);

  let tx;
  try {
    // 1. Get the Vault Manager contract
    const vaultManager = new Contract(
      SYSCOIN_VAULT_MANAGER_ADDRESS,
      SYSCOIN_VAULT_MANAGER_ABI,
      signer
    );

    // 2. Fetch the actual Relayer Contract address dynamically
    const relayerAddress = await vaultManager.trustedRelayerContract();
    if (!relayerAddress || relayerAddress === "0x0000000000000000000000000000000000000000") {
      throw new Error("Could not find trusted Relayer Contract from Vault Manager.");
    }

    // 3. Connect to the Relayer Contract
    const relayerContract = new Contract(
      relayerAddress,
      RELAYER_CONTRACT_ABI,
      signer
    );

    // Ensure all hex strings are properly prefixed with "0x"
    const formatHex = (val: string) => val.startsWith("0x") ? val : "0x" + val;
    
    const txBytes = formatHex(proof.transaction);
    const txIndex = proof.index;
    const syscoinBlockHeader = formatHex(proof.header);

    // Resolve NEVM block number from the nevm_blockhash in the proof
    if (proof.nevm_blockhash) {
      try {
        const nevmBlock = await provider.getBlock(formatHex(proof.nevm_blockhash));
        if (nevmBlock && nevmBlock.number) {
          nevmBlockNumber = nevmBlock.number;
          console.log(`Resolved UTXO block hash ${proof.blockhash} to NEVM block number ${nevmBlockNumber}`);
        }
      } catch (err: any) {
        console.warn("Failed to resolve NEVM block number from hash, falling back to UTXO block number:", err);
      }
    }

    // Format the siblings using buildMerklePath to create the layer-by-layer structure
    const txSiblings = buildMerklePath(proof.siblings || [], txIndex).map(formatHex);

    // 5. Pre-check: Verify if the Syscoin block has been relayed to NEVM
    // The Syscoin NEVM uses a precompile at address 0x00...61 to store verified block hashes.
    try {
      // Pad the nevmBlockNumber to 8 bytes (16 hex characters) for the precompile call
      const blockHex = "0x" + nevmBlockNumber.toString(16).padStart(16, "0");
      const precompileRes = await provider.call({
        to: "0x0000000000000000000000000000000000000061",
        data: blockHex
      });
      
      if (precompileRes && precompileRes !== "0x" && precompileRes.replace(/0/g, "").length > 1) {
        console.log(`Precompile check: block ${nevmBlockNumber} verified as relayed (hash: ${precompileRes})`);
      } else {
        console.warn(`Precompile check: Block ${nevmBlockNumber} hash not found in precompile, proceeding anyway to let MetaMask/Pali simulate...`);
      }
    } catch (precompileErr: any) {
      console.warn("Precompile check call failed, proceeding anyway:", precompileErr);
    }

    // 6. Submit the transaction to relayTx
    tx = await relayerContract.relayTx(
      nevmBlockNumber,
      txBytes,
      txIndex,
      txSiblings,
      syscoinBlockHeader
    );

    const receipt = await tx.wait();
    return receipt.hash;
  } catch (error: any) {
    console.error("EVM Submission Error:", error);
    let errMsg = error.message || "";
    if (errMsg.includes("Unregistered asset")) {
      throw new Error("Claim failed: Unregistered asset. Ensure the correct asset GUID (123456) was used.");
    }
    if (errMsg.includes("Tx already processed") || errMsg.includes("TX already processed")) {
      throw new Error("Claim failed: This transaction has already been claimed on the NEVM chain.");
    }
    if (
      errMsg.includes("SYSBLOCKHASH precompile returned empty result") ||
      errMsg.includes("SPV proof verification failed") ||
      errMsg.includes("missing revert data") ||
      errMsg.includes("execution reverted")
    ) {
      throw new Error(
        `Syscoin block ${nevmBlockNumber} has not yet been relayed to the NEVM chain. ` +
        `Bridge transfers typically require ~2 hours of confirmations. Please wait and try again.`
      );
    }
    throw new Error(`Failed to submit proof to NEVM Relayer: ${error.message}`);
  }
}
