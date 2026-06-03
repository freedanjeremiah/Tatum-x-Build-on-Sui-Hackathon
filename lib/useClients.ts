"use client";

// Browser-side client acquisition for Sui + Privy.
//
// getClients() is the main entry point. It acquires a SuiClient (read path)
// and a signer (write path) from the active Privy wallet via lib/walletBridge.
//
// IMPORTANT: The browser write-signer depends on how @privy-io/react-auth exposes
// a Sui transaction-signing callback. Privy v3 (installed: ^3.28.0) embeds a
// Sui wallet in `useWallets()` with a `signTransaction` method, but that method
// must be called from within a React context (hook). getClients() is a plain
// async function, so it cannot call hooks directly.
//
// The approach used here:
//   - WalletBridge.tsx (already mounted inside PrivyProvider) calls setActiveWallet()
//     each time the wallet changes. lib/walletBridge.ts stashes the signer shim.
//   - getClients() picks up the stashed signer via getActiveWallet().
//   - The signer shim exposes a Sui-compatible Signer-like interface.
//
// TODO(A2/signer): Full Privy-Sui signing requires the Privy wallet's
//   `signTransaction(txBytes: Uint8Array) → Uint8Array` to be wired through
//   walletBridge. That wiring is in lib/walletBridge.ts (see the TODO there).
//   Until completed, any call that requires a write transaction will throw an
//   explicit "WalletNotConnectedError: Sui signer not available" error.

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
 * function — this is the honest stub described in the migration plan (A2).
 */
export async function getClients(): Promise<BrowserClients> {
  const { makeClientsFromProvider } = await import("./clients");
  const { getActiveWallet } = await import("./walletBridge");

  const wallet = getActiveWallet();
  if (!wallet) {
    throw new WalletNotConnectedError(
      "Connect a wallet first (use the Connect button in the header)."
    );
  }

  // wallet.signer is set by WalletBridge.tsx once Privy resolves the Sui
  // signing callback. Until that wiring is done, it is null (see walletBridge.ts
  // TODO) and makeClientsFromProvider wraps it in a loud stub signer.
  if (!wallet.signer) {
    throw new WalletNotConnectedError(
      "Sui signer not available. The wallet bridge has not yet provided a " +
        "signing function — ensure <WalletBridge> is mounted inside <PrivyProvider>."
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
