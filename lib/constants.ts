// Tessera Sui/Walrus/Seal/Tatum testnet constants.
//
// Every constant here is env-overrideable so the same code runs against a
// different network (e.g. Sui mainnet, alternative Walrus endpoints) without
// code edits. Defaults preserve testnet behaviour.
//
// Naming: vars are read in this order for each constant:
//   1. NEXT_PUBLIC_OV_<NAME>   (works in client + server bundles)
//   2. OV_<NAME>               (server-only override)
//   3. Tessera testnet default
// Browsers only see NEXT_PUBLIC_ vars; the server reads both.

function envStr(name: string, fallback: string): string {
  const fromPublic = process.env[`NEXT_PUBLIC_OV_${name}`];
  if (fromPublic && fromPublic.length > 0) return fromPublic;
  const fromServer = process.env[`OV_${name}`];
  if (fromServer && fromServer.length > 0) return fromServer;
  return fallback;
}

function envNum(name: string, fallback: number): number {
  const v = envStr(name, "");
  return v === "" ? fallback : Number(v);
}

// --- Sui network -----------------------------------------------------------------

/** "testnet" | "mainnet" | "devnet" */
export const SUI_NETWORK: string = envStr("SUI_NETWORK", "testnet");

/** Public Sui fullnode (fallback when Tatum key is absent). */
export const SUI_FULLNODE_URL: string = envStr(
  "SUI_FULLNODE_URL",
  "https://fullnode.testnet.sui.io",
);

/** Tatum Sui JSON-RPC gateway — primary RPC used by clients. */
export const TATUM_SUI_JSONRPC: string = envStr(
  "TATUM_SUI_JSONRPC",
  "https://sui-testnet.gateway.tatum.io",
);

// --- Walrus storage --------------------------------------------------------------

export const WALRUS_PUBLISHER: string = envStr(
  "WALRUS_PUBLISHER",
  "https://publisher.walrus-testnet.walrus.space",
);

export const WALRUS_AGGREGATOR: string = envStr(
  "WALRUS_AGGREGATOR",
  "https://aggregator.walrus-testnet.walrus.space",
);

/** How many epochs to store a blob (default 5). */
export const STORAGE_EPOCHS: number = envNum("STORAGE_EPOCHS", 5);

// --- Seal threshold encryption ---------------------------------------------------

/**
 * Comma-separated Seal key-server object ids (on-chain, testnet defaults from
 * the Mysten-run testnet deployment). Override via SEAL_KEY_SERVER_IDS.
 */
export const SEAL_KEY_SERVER_IDS: string[] = envStr("SEAL_KEY_SERVER_IDS", "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Minimum key-server responses required to decrypt (k-of-n). Default 2. */
export const SEAL_THRESHOLD: number = envNum("SEAL_THRESHOLD", 2);

// --- Tessera Move package --------------------------------------------------------

/** Object id of the published `tessera` Move package on the target network. */
export const TESSERA_PACKAGE_ID: string = envStr("TESSERA_PACKAGE_ID", "");

// --- Explorer -------------------------------------------------------------------

export const SUI_EXPLORER_TX: string = envStr(
  "SUI_EXPLORER_TX",
  "https://suiscan.xyz/testnet/tx/",
);

export const SUI_EXPLORER_OBJECT: string = envStr(
  "SUI_EXPLORER_OBJECT",
  "https://suiscan.xyz/testnet/object/",
);
