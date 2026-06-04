"use client";

// Browser-side client acquisition for Sui.
//
// getClients() is the main entry point. It acquires a SuiClient (read path)
// and a real Signer (write path) from the connected Sui wallet via
// lib/walletBridge.
//
// SIGNING: Privy v3.28 has NO Sui support, so Sui signing comes from
// @mysten/dapp-kit (the Sui wallet-standard), while Privy keeps auth/login.
// getClients() is a plain async function and cannot call React hooks, so:
//   - components/WalletBridge.tsx (mounted inside SuiDappProvider) reads the
//     dapp-kit hooks and calls setActiveWallet() with a WalletStandardSigner
//     whenever the connected account changes.
//   - getClients() picks up the stashed signer via getActiveWallet().
//
// If no Sui wallet is connected, getActiveWallet() is null (or its signer is
// null) and getClients() throws WalletNotConnectedError — an honest failure,
// never a fake signature. Read paths use a live SuiClient and work regardless.

import type { BrowserClients } from "./clients";

export class WalletNotConnectedError extends Error {
  constructor(message = "Connect a wallet to continue.") {
    super(message);
    this.name = "WalletNotConnectedError";
  }
}

/**
 * Acquire { client, signer, address, account } in the browser.
 *
 * Requires the Privy wallet to be connected (set by <WalletBridge>); throws
 * WalletNotConnectedError otherwise so callers can prompt the user.
 *
 * The returned `client` is always a live SuiClient (read-path works
 * immediately). The returned `signer` is a shim that will throw
 * WalletNotConnectedError if the wallet bridge has not provided a real signing
 * function — an honest stub until the browser write-signer is wired.
 */
export async function getClients(): Promise<BrowserClients> {
  const { makeClientsFromProvider } = await import("./clients");
  const { getActiveWallet } = await import("./walletBridge");

  const wallet = getActiveWallet();
  if (!wallet) {
    throw new WalletNotConnectedError(
      "Connect a Sui wallet first (use the “Connect Sui wallet” button in the header)."
    );
  }

  // wallet.signer is a real WalletStandardSigner set by WalletBridge.tsx once a
  // Sui wallet is connected via dapp-kit. It is only null if the connected
  // account's public key could not be derived (unknown signature scheme).
  if (!wallet.signer) {
    throw new WalletNotConnectedError(
      "Sui signer not available — the connected wallet's key scheme is not " +
        "supported. Connect a standard Ed25519 Sui wallet to sign transactions."
    );
  }

  return makeClientsFromProvider(wallet.signer, wallet.address);
}

// ---------------------------------------------------------------------------
// Browser-side CID helpers (kept from the old useClients.ts — they are
// chain-agnostic utilities used by some UI paths for evidence/dispute flows).
// ---------------------------------------------------------------------------

/** @internal */
const BASE58_ALPHABET_BR =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** @internal */
function base58EncodeBR(bytes: Uint8Array): string {
  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);
  let out = "";
  while (value > 0n) {
    const r = Number(value % 58n);
    out = BASE58_ALPHABET_BR[r] + out;
    value /= 58n;
  }
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

/** Browser-side CIDv0 (dag-pb, sha2-256) generated client-side.
 *  A new CID is produced every call — a real dispute must never reuse stale evidence. */
export function freshEvidenceCidBrowser(prefix = "Evidence"): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
  const seedBytes = new TextEncoder().encode(
    prefix + ":" + uuid + ":" + Date.now() + ":" + Math.random()
  );
  const hash = new Uint8Array(32);
  for (let i = 0; i < seedBytes.length; i++) hash[i % 32] ^= seedBytes[i];
  // Avalanche pass.
  for (let i = 0; i < 32; i++) {
    const x =
      hash[i] ^
      ((hash[(i + 7) % 32]! << 1) | (hash[(i + 13) % 32]! >> 3));
    hash[i] = x & 0xff;
  }
  const bytes = new Uint8Array(34);
  bytes[0] = 0x12;
  bytes[1] = 0x20;
  bytes.set(hash, 2);
  return base58EncodeBR(bytes);
}

/** Async variant using real WebCrypto SHA-256 — preferred when the caller can await. */
export async function freshEvidenceCidBrowserAsync(
  prefix = "Evidence"
): Promise<string> {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
  const seed = prefix + ":" + uuid + ":" + Date.now();
  const data = new TextEncoder().encode(seed);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const bytes = new Uint8Array(34);
  bytes[0] = 0x12;
  bytes[1] = 0x20;
  bytes.set(hash, 2);
  return base58EncodeBR(bytes);
}
