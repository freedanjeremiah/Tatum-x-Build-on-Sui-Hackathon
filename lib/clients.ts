// Tessera Sui client factory. Replaces the old Story/CDR/viem clients.
//
// Server-side: SuiClient routed through the Tatum gateway (with x-api-key header)
// and an Ed25519Keypair signer loaded from WALLET_PRIVATE_KEY / MASTER_SUI_PRIVKEY.
// Browser-side: SuiClient is also exported for read paths; signers are handled by
// lib/useClients.ts (Privy) and lib/walletBridge.ts.
//
// Import patterns adapted from sharegraph packages/core/src/access.ts and identity.ts.
// Do NOT import from sharegraph directly.

import { SuiJsonRpcClient, JsonRpcHTTPTransport } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Signer } from "@mysten/sui/cryptography";

import { suiNetwork } from "./chains";
import { TATUM_API_KEY } from "./env";

// ---------------------------------------------------------------------------
// Re-exports of the concrete client type for callers in this project.
// ---------------------------------------------------------------------------

export type { Signer };
export type SuiClient = SuiJsonRpcClient;

// ---------------------------------------------------------------------------
// Internal: retrying fetch (Tatum free tier rate-limits bursts; 429/5xx back-off)
// Adapted from sharegraph packages/core/src/access.ts retryingFetch.
// ---------------------------------------------------------------------------

function retryingFetch(maxRetries = 5): typeof fetch {
  return async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    let delay = 250;
    for (let attempt = 0; ; attempt++) {
      const res = await fetch(input, init);
      if (res.status !== 429 && res.status < 500) return res;
      if (attempt >= maxRetries) return res;
      await new Promise<void>((r) => setTimeout(r, delay + Math.floor(delay * 0.3)));
      delay = Math.min(delay * 2, 4000);
    }
  };
}

// ---------------------------------------------------------------------------
// makeSuiClient — build a SuiClient optionally routed through the Tatum gateway.
//
// When TATUM_API_KEY is present, the Tatum JSON-RPC gateway URL (rpcUrl) is
// used as the transport endpoint with the x-api-key header. Otherwise the
// public fullnode is used (suiNetwork.fullnodeUrl).
// ---------------------------------------------------------------------------

export function makeSuiClient(): SuiClient {
  const hasTatum = Boolean(TATUM_API_KEY && TATUM_API_KEY.length > 0);

  if (hasTatum) {
    const transport = new JsonRpcHTTPTransport({
      url: suiNetwork.rpcUrl,
      fetch: retryingFetch(),
      rpc: { headers: { "x-api-key": TATUM_API_KEY } },
    });
    return new SuiJsonRpcClient({ network: suiNetwork.network, transport });
  }

  // Fallback: public fullnode (no Tatum key configured, e.g. local dev).
  return new SuiJsonRpcClient({
    network: suiNetwork.network,
    transport: new JsonRpcHTTPTransport({
      url: suiNetwork.fullnodeUrl,
      fetch: retryingFetch(),
    }),
  });
}

// ---------------------------------------------------------------------------
// keypairFromSecret — restore an Ed25519Keypair from a bech32 suiprivkey1...
// string or a raw 32-byte hex string (0x-prefixed or bare).
//
// Never logs the secret. Throws loudly if the secret is missing or invalid.
// ---------------------------------------------------------------------------

export function keypairFromSecret(secret: string | Uint8Array): Ed25519Keypair {
  return Ed25519Keypair.fromSecretKey(secret);
}

/** Return the on-chain Sui address for a keypair. */
export function addressOf(kp: Ed25519Keypair): string {
  return kp.getPublicKey().toSuiAddress();
}

// ---------------------------------------------------------------------------
// makeClientsFromKey — server-side (Node.js / scripts / worker / indexer).
//
// Reads WALLET_PRIVATE_KEY (hex) or MASTER_SUI_PRIVKEY (bech32 suiprivkey1…)
// from the environment. Uses the first one that is set. Never logs the key.
//
// Returns:
//   { client, keypair, address, signer }
// where `signer` is the Ed25519Keypair (implements @mysten/sui Signer interface).
// ---------------------------------------------------------------------------

export interface ServerClients {
  /** SuiClient routed through Tatum gateway (or public fullnode as fallback). */
  client: SuiClient;
  /** Ed25519 keypair — implements Signer; use for signAndExecuteTransaction. */
  keypair: Ed25519Keypair;
  /** Convenience Signer alias for the keypair (same object). */
  signer: Signer;
  /** On-chain Sui address derived from the keypair. */
  address: string;
  /** Mirror of address in an `account` wrapper for code that reads clients.account.address. */
  account: { address: string };
}

export async function makeClientsFromKey(secretOverride?: string): Promise<ServerClients> {
  // Read the secret from the environment (never from a default).
  const secret =
    secretOverride ??
    process.env.WALLET_PRIVATE_KEY ??
    process.env.MASTER_SUI_PRIVKEY;

  if (!secret || secret.trim() === "") {
    throw new Error(
      "Missing server signing key. Set WALLET_PRIVATE_KEY (hex) or " +
        "MASTER_SUI_PRIVKEY (bech32 suiprivkey1…) in your environment."
    );
  }

  const keypair = keypairFromSecret(secret.trim());
  const address = addressOf(keypair);
  const client = makeSuiClient();

  return {
    client,
    keypair,
    signer: keypair as unknown as Signer,
    address,
    account: { address },
  };
}

// ---------------------------------------------------------------------------
// makeClientsFromProvider — browser-side (wallet signer).
//
// Kept for symmetry with the old API. The actual browser path is handled by
// lib/useClients.ts, which calls this (or the walletBridge stub) after
// acquiring a Sui signer from Privy. Here we provide the read-side SuiClient
// and wrap the caller-supplied signer.
// ---------------------------------------------------------------------------

export interface BrowserClients {
  /** SuiClient for read operations (no write key). */
  client: SuiClient;
  /** Signer supplied by the caller (Privy embedded wallet or dapp-kit). */
  signer: Signer;
  /** On-chain Sui address. */
  address: string;
  /** Wrapper mirroring the old clients.account.address shape. */
  account: { address: string };
}

export function makeClientsFromProvider(
  signer: Signer,
  address: string
): BrowserClients {
  const client = makeSuiClient();
  return {
    client,
    signer,
    address,
    account: { address },
  };
}

// ---------------------------------------------------------------------------
// Lazy server-singleton (used by API routes + indexer that do not have a key).
// Exported for read-only access (e.g. listing objects, fetching metadata).
// ---------------------------------------------------------------------------

let _readClient: SuiClient | undefined;

/** Returns a shared read-only SuiClient (no signer). Safe to call at module
 *  scope in server code. The instance is memoised after the first call. */
export function getReadClient(): SuiClient {
  if (!_readClient) _readClient = makeSuiClient();
  return _readClient;
}
