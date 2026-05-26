/**
 * services/bridgeService.ts
 * Implements the Syscoin Bridge functionality (UTXO -> NEVM)
 * using syscoinjs-lib to craft PSBTs and Syscoin Core to sign them.
 */

// @ts-ignore
import { SyscoinJSLib, utils as syscoinUtils } from "syscoinjs-lib";
import { SyscoinRpcClient } from "./syscoinRpcClient";
import type { NetworkEnvironment } from "../types/chain";
import BN from "bn.js";

const MAINNET_BLOCKBOOK = "https://blockbook.syscoin.org";
const TESTNET_BLOCKBOOK = "https://blockbook.tanenbaum.io";

/**
 * Fetch UTXOs for an address.
 * Primary: local node (listunspent)
 * Fallback: Blockbook API
 */
/**
 * Fetch UTXOs for an address.
 * Primary: local node (listunspent)
 * Fallback: Blockbook API
 */
async function fetchUtxos(
  rpcClient: SyscoinRpcClient,
  network: NetworkEnvironment,
  address: string
) {
  let utxosList: any[] = [];
  let hasAssets = false;

  // Try local node first (requires wallet to be unlocked or address in wallet)
  try {
    const addressesParam = address ? [address] : [];
    const listUnspentRes = await rpcClient.call<any[]>("listunspent", [1, 9999999, addressesParam]);
    if (listUnspentRes.ok && Array.isArray(listUnspentRes.value)) {
      utxosList = listUnspentRes.value.map(utxo => {
        const item: any = {
          txid: utxo.txid,
          vout: utxo.vout,
          value: Math.floor(utxo.amount * 1e8).toString(),
          confirmations: utxo.confirmations,
          address: utxo.address || address,
          path: ""
        };
        const guid = utxo.asset_guid !== undefined ? utxo.asset_guid : utxo.assetguid;
        const amount = utxo.asset_amount !== undefined ? utxo.asset_amount : utxo.assetamount;
        if (guid !== undefined) {
          hasAssets = true;
          item.assetInfo = {
            assetGuid: guid.toString(),
            value: Math.floor(amount * 1e8).toString()
          };
        }
        return item;
      });
    }
  } catch (err) {
    console.warn("listunspent failed, falling back to Blockbook", err);
  }

  // Fallback to Blockbook if local node listunspent is empty or failed
  if (utxosList.length === 0) {
    const blockbookUrl = network === "MAINNET" ? MAINNET_BLOCKBOOK : TESTNET_BLOCKBOOK;
    const isBrowserDev = typeof window !== "undefined" && !(window as any).__TAURI__;
    let fetchUrl = `${blockbookUrl}/api/v2/utxo/${address}`;
    if (isBrowserDev) {
      fetchUrl = `/rpc-proxy/api/v2/utxo/${address}?target=${encodeURIComponent(blockbookUrl)}`;
    }
    try {
      const res = await fetch(fetchUrl);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          utxosList = data.map((utxo: any) => {
            const item: any = {
              txid: utxo.txid,
              vout: utxo.vout,
              value: utxo.value,
              confirmations: utxo.confirmations,
              address: address,
              path: ""
            };
            const guid = utxo.assetGuid !== undefined ? utxo.assetGuid : (utxo.asset_guid !== undefined ? utxo.asset_guid : utxo.assetguid);
            const amount = utxo.assetAmount !== undefined ? utxo.assetAmount : (utxo.asset_amount !== undefined ? utxo.asset_amount : utxo.assetamount);
            if (guid !== undefined) {
              hasAssets = true;
              item.assetInfo = {
                assetGuid: guid.toString(),
                value: amount.toString()
              };
            }
            return item;
          });
        }
      }
    } catch (err) {
      console.error("Blockbook UTXO fetch failed", err);
    }
  }

  const assets: any[] = [];
  if (hasAssets || utxosList.some(u => u.assetInfo !== undefined)) {
    // Add default definition for SYSX (GUID 123456)
    assets.push({
      assetGuid: "123456",
      decimals: 8,
      maxSupply: "100000000000000000",
      contract: ""
    });
  }

  return {
    utxos: utxosList,
    assets
  };
}

/**
 * Bridges SYS from UTXO to NEVM.
 * 1. Fetches UTXOs
 * 2. Checks if SYSX (GUID 123456) balance is sufficient.
 *    - If not: converts SYS to SYSX using syscoinBurnToAssetAllocation.
 *    - If yes: burns SYSX to NEVM using assetAllocationBurn.
 * 3. Signs PSBT via local node (walletprocesspsbt)
 * 4. Broadcasts transaction (sendrawtransaction)
 */
export async function executeUtxoToNevmBridge(
  rpcClient: SyscoinRpcClient,
  network: NetworkEnvironment,
  sourceAddress: string,
  amountSys: number,
  destEthAddress: string
): Promise<string> {
  const blockbookUrl = network === "MAINNET" ? MAINNET_BLOCKBOOK : TESTNET_BLOCKBOOK;
  const sysNetwork = network === "MAINNET" ? syscoinUtils.syscoinNetworks.mainnet : syscoinUtils.syscoinNetworks.testnet;
  const syscoinjs = new SyscoinJSLib(null, blockbookUrl, sysNetwork);

  // Fetch UTXOs (returns { utxos, assets })
  const blockbookUtxos = await fetchUtxos(rpcClient, network, sourceAddress);

  // Setup options for syscoinjs-lib
  const txOpts = { rbf: true };
  const amountSats = Math.floor(amountSys * 1e8);
  const feeRate = new BN(10); // 10 sat/byte

  // Fetch a change address if sourceAddress is empty
  let changeAddress = sourceAddress;
  if (!changeAddress) {
    const addrRes = await rpcClient.call<string>("getnewaddress", [""]);
    if (addrRes.ok && addrRes.value) {
      changeAddress = addrRes.value;
    } else {
      throw new Error("Could not generate a change address from the node.");
    }
  }

  // Calculate existing SYSX (GUID 123456) balance
  let sysxBalanceSats = 0;
  for (const utxo of blockbookUtxos.utxos) {
    if (utxo.assetInfo && utxo.assetInfo.assetGuid === "123456") {
      sysxBalanceSats += Number(utxo.assetInfo.value);
    }
  }

  const isConversion = sysxBalanceSats < amountSats;
  const assetGuid = "123456";

  const assetMap = new Map([
    [assetGuid, { outputs: [{ value: new BN(amountSats) }] }]
  ]);

  let psbtResult;
  try {
    // Monkey-patch syscoinjs-lib's fetchBackendRawTx to use our local RPC node instead of Blockbook
    syscoinUtils.fetchBackendRawTx = async (_backendUrl: string, txid: string) => {
      const txRes = await rpcClient.call<string>("getrawtransaction", [txid]);
      if (txRes.ok && txRes.value) {
        return { hex: txRes.value };
      }
      return null;
    };

    if (isConversion) {
      // Step 1: Convert native SYS to SYSX
      psbtResult = await syscoinjs.syscoinBurnToAssetAllocation(
        txOpts,
        assetMap,
        changeAddress,
        feeRate,
        sourceAddress,
        blockbookUtxos,
        null
      );
    } else {
      // Step 2: Burn SYSX to NEVM
      const assetOpts = {
        ethaddress: Buffer.from(destEthAddress.replace(/^0x/i, ''), 'hex')
      };
      psbtResult = await syscoinjs.assetAllocationBurn(
        assetOpts,
        txOpts,
        assetMap,
        changeAddress,
        feeRate,
        sourceAddress,
        blockbookUtxos,
        null
      );
    }
  } catch (err: any) {
    throw new Error(`Failed to create PSBT: ${err.message}`);
  }

  const psbtBase64 = psbtResult.psbt.toBase64();

  // Sign PSBT with local node
  const signRes = await rpcClient.call<any>("walletprocesspsbt", [psbtBase64, true, "ALL", true]);
  if (!signRes.ok) {
    throw new Error(`Node failed to sign PSBT: ${signRes.error?.message || "Unknown error"}`);
  }
  if (!signRes.value.complete) {
    throw new Error("PSBT signing incomplete. Is your wallet unlocked?");
  }

  // Extract raw hex and broadcast
  const signedHex = signRes.value.hex;
  const sendRes = await rpcClient.call<string>("sendrawtransaction", [signedHex]);
  
  if (!sendRes.ok) {
    throw new Error(`Failed to broadcast transaction: ${sendRes.error?.message || "Unknown error"}`);
  }

  const txid = sendRes.value;
  return isConversion ? `conversion:${txid}` : txid;
}

/**
 * Fetches the SPV proof required to claim SYS on NEVM after a UTXO burn is confirmed.
 */
export async function fetchSpvProof(
  _rpcClient: any,
  network: "MAINNET" | "TESTNET",
  txid: string
): Promise<any> {
  let nodeError = "Unknown node error";

  // First, try the node RPC directly as it is much more reliable and doesn't rely on 3rd party indexers.
  try {
    const rpcRes = await _rpcClient.call("syscoingetspvproof", [txid]);
    if (rpcRes.ok && rpcRes.value) {
      let proof = rpcRes.value;
      if (typeof proof === "string") {
        proof = JSON.parse(proof);
      }
      
      const blockRes = await _rpcClient.call("getblock", [proof.blockhash]);
      if (blockRes.ok && blockRes.value) {
        const blockNumber = blockRes.value.height;
        return {
          blockNumber: Number(blockNumber),
          transaction: proof.transaction,
          index: proof.index,
          siblings: proof.siblings,
          header: proof.header,
          nevm_blockhash: proof.nevm_blockhash,
          chainlock: proof.chainlock
        };
      } else {
        nodeError = `getblock failed: ${blockRes.error?.message || blockRes.error}`;
        console.warn("Node SPV proof getblock failed:", blockRes.error);
      }
    } else {
      nodeError = `syscoingetspvproof failed: ${rpcRes.error?.message || rpcRes.error}`;
      console.warn("Node SPV proof syscoingetspvproof failed:", rpcRes.error);
    }
  } catch (err: any) {
    nodeError = err.message || String(err);
    console.warn("Node SPV proof fetch failed, falling back to Blockbook...", err);
  }

  // If the node RPC failed, we use the Blockbook API response.
  try {
    const blockbookUrl = network === "MAINNET" ? MAINNET_BLOCKBOOK : TESTNET_BLOCKBOOK;
    const isBrowserDev = typeof window !== "undefined" && !(window as any).__TAURI__;
    
    let fetchUrl = `${blockbookUrl}/api/v2/getspvproof/${txid}`;
    if (isBrowserDev) {
      fetchUrl = `/rpc-proxy/api/v2/getspvproof/${txid}?target=${encodeURIComponent(blockbookUrl)}`;
    }

    const res = await fetch(fetchUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch SPV proof from blockbook: HTTP ${res.status}`);
    }
    
    const data = await res.json();
    let proof = data?.proof || data?.result;

    if (!proof) {
      throw new Error("Invalid or empty SPV proof returned from Blockbook.");
    }

    if (typeof proof === "string") {
      proof = JSON.parse(proof);
    }
    
    // We need the block height (_blockNumber) for the relayTx contract call.
    // Fetch the block details using the blockhash to get its height.
    let blockUrl = `${blockbookUrl}/api/v2/block/${proof.blockhash}`;
    if (isBrowserDev) {
      blockUrl = `/rpc-proxy/api/v2/block/${proof.blockhash}?target=${encodeURIComponent(blockbookUrl)}`;
    }
    
    const blockRes = await fetch(blockUrl);
    const blockData = await blockRes.json();
    
      const blockNumber = blockData?.height || blockData?.block?.height;
      if (blockNumber === undefined) {
        throw new Error("Could not retrieve block height for the SPV proof.");
      }

      return {
        blockNumber: Number(blockNumber),
        transaction: proof.transaction,
        index: proof.index,
        siblings: proof.siblings,
        header: proof.header,
        nevm_blockhash: proof.nevm_blockhash,
        chainlock: proof.chainlock
      };
    } catch (err: any) {
      throw new Error(`Local Node Error: ${nodeError}. Fallback Blockbook Error: ${err.message}`);
    }
}
