// Reef Sui/Walrus/Seal/Tatum testnet constants.
//
// Every constant here is env-overrideable so the same code runs against a
// different network (e.g. Sui mainnet, alternative Walrus endpoints) without
// code edits. Defaults preserve testnet behaviour.
//
// Naming: vars are read in this order for each constant:
//   1. NEXT_PUBLIC_OV_<NAME>   (works in client + server bundles)
//   2. OV_<NAME>               (server-only override)
//   3. Reef testnet default
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
 * Comma-separated Seal key-server object ids (on-chain).
 *
 * Defaults to the two public Mysten-operated Seal key servers on Sui testnet
 * (`mysten-testnet-1` / `mysten-testnet-2`). Both were verified live on
 * 2026-06: each is a `Shared` object of type
 *   0x0f16e84a…::key_server::KeyServer
 * so encrypt/decrypt works out-of-the-box on testnet (k-of-n threshold = 2).
 *
 * Override via NEXT_PUBLIC_OV_SEAL_KEY_SERVER_IDS / OV_SEAL_KEY_SERVER_IDS
 * (e.g. for mainnet or a self-hosted key server).
 */
export const SEAL_TESTNET_KEY_SERVER_IDS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
];

export const SEAL_KEY_SERVER_IDS: string[] = envStr(
  "SEAL_KEY_SERVER_IDS",
  SEAL_TESTNET_KEY_SERVER_IDS.join(","),
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** Minimum key-server responses required to decrypt (k-of-n). Default 2. */
export const SEAL_THRESHOLD: number = envNum("SEAL_THRESHOLD", 2);

// --- Reef Move package --------------------------------------------------------

/** Object id of the published `reef` Move package on the target network.
 *  No default — it must be published per deployment (never fabricated). */
export const REEF_PACKAGE_ID: string = envStr("REEF_PACKAGE_ID", "");

// --- On-chain readiness ----------------------------------------------------

/**
 * True when the on-chain prerequisites for write/decrypt are configured: a
 * published Reef Move package id AND at least one Seal key-server id. When
 * false, the UI shows an honest config notice (components/OnchainConfigNotice)
 * and on-chain actions fail with a clear message rather than an opaque error.
 *
 * Browser-readable: REEF_PACKAGE_ID / SEAL_KEY_SERVER_IDS are sourced from
 * NEXT_PUBLIC_OV_* (or their built-in defaults) so this evaluates the same in
 * the client and server bundles.
 */
export const ONCHAIN_CONFIGURED: boolean =
  REEF_PACKAGE_ID.trim().length > 0 && SEAL_KEY_SERVER_IDS.length > 0;

// --- Explorer -------------------------------------------------------------------

export const SUI_EXPLORER_TX: string = envStr(
  "SUI_EXPLORER_TX",
  "https://suiscan.xyz/testnet/tx/",
);

export const SUI_EXPLORER_OBJECT: string = envStr(
  "SUI_EXPLORER_OBJECT",
  "https://suiscan.xyz/testnet/object/",
);
