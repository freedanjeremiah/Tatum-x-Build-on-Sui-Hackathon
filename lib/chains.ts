// Sui network descriptor for Reef. Used by client factories (lib/clients.ts)
// so every caller gets a consistent network + RPC config from a single place.

import { SUI_NETWORK, SUI_FULLNODE_URL, TATUM_SUI_JSONRPC } from "./constants";

export type SuiNetworkId = "testnet" | "mainnet" | "devnet";

export interface SuiNetworkConfig {
  /** Network identifier understood by @mysten/sui helpers. */
  network: SuiNetworkId;
  /** Tatum Sui JSON-RPC gateway URL (primary). */
  rpcUrl: string;
  /** Fallback public fullnode (used when no Tatum key is configured). */
  fullnodeUrl: string;
}

export const suiNetwork: SuiNetworkConfig = {
  network: SUI_NETWORK as SuiNetworkId,
  rpcUrl: TATUM_SUI_JSONRPC,
  fullnodeUrl: SUI_FULLNODE_URL,
};
