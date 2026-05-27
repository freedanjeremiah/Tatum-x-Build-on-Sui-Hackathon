// Viem chain definition for Story Aeneid testnet. Used by the real-mode wallet +
// public clients so viem knows the chain id (1315) and RPC to send/sign txs.

import { defineChain } from "viem";
import { RPC_URL } from "./constants";

export const aeneid = defineChain({
  id: 1315,
  name: "Story Aeneid",
  nativeCurrency: { name: "IP", symbol: "IP", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});
