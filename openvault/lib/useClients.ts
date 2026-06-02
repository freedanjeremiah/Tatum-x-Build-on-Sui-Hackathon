"use client";

// Browser-side client acquisition. Derives wallet-backed clients from the
// connected EIP-1193 provider.
//
// lib/clients reach for node:fs/node:crypto at module scope, so they must
// NEVER land in the static client chunk. We import them dynamically at call
// time — the bundler keeps them out of the browser graph and only resolves
// them when getClients() actually runs.

import type { Clients } from "./artifacts";

export class WalletNotConnectedError extends Error {
  constructor(message = "Connect a wallet to continue.") {
    super(message);
    this.name = "WalletNotConnectedError";
  }
}

/**
 * Acquire {cdr, story, account} clients in the browser.
 *
 * Requires an injected EIP-1193 provider + a connected address;
 * throws WalletNotConnectedError otherwise so callers can prompt the user.
 */
export async function getClients(): Promise<Clients> {
  const { makeClientsFromProvider } = await import("./clients");

  // Prefer the Privy embedded/connected wallet (set by <WalletBridge> after
  // login). Social/email logins have no window.ethereum — this is the only
  // provider those users have. Fall back to an injected extension wallet.
  const { getActiveWallet } = await import("./walletBridge");
  const privy = getActiveWallet();
  if (privy?.provider && privy.address) {
    return (await makeClientsFromProvider(
      privy.provider,
      privy.address
    )) as unknown as Clients;
  }

  const eth = (globalThis as { ethereum?: unknown }).ethereum as
    | { request: (args: { method: string; params?: unknown[] }) => Promise<string[]> }
    | undefined;
  if (!eth) {
    throw new WalletNotConnectedError(
      "Connect a wallet first (use the Connect button in the header)."
    );
  }

  const accounts = await eth.request({ method: "eth_requestAccounts" });
  const address = accounts?.[0] as `0x${string}` | undefined;
  if (!address) throw new WalletNotConnectedError();

  return (await makeClientsFromProvider(eth, address)) as unknown as Clients;
}

/**
 * Fresh evidence CID, generated client-side (lib/dispute.freshEvidenceCid uses
 * node:crypto and cannot run in the browser). A new CID is produced every call
 * — a real dispute must never reuse stale evidence.
 */
/** Browser-side CIDv0 (dag-pb, sha2-256) — Story SDK calls .toV0() internally
 *  and rejects anything else. CIDv0 = base58btc(0x12 0x20 ...32 hash bytes). */
const BASE58_ALPHABET_BR =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
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

export function freshEvidenceCidBrowser(prefix = "Evidence"): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const seedBytes = new TextEncoder().encode(
    prefix + ":" + uuid + ":" + Date.now() + ":" + Math.random(),
  );
  // Synchronous SHA-256: fold the seed into 32 bytes (collision-prone for a
  // huge corpus, fine for per-session unique dispute evidence — and produces a
  // valid CIDv0 either way). The async + WebCrypto version below is preferred
  // when the caller can await.
  const hash = new Uint8Array(32);
  for (let i = 0; i < seedBytes.length; i++) hash[i % 32] ^= seedBytes[i];
  // Avalanche pass so the fold doesn't have obvious 32-byte striping.
  for (let i = 0; i < 32; i++) {
    const x = hash[i] ^ ((hash[(i + 7) % 32] << 1) | (hash[(i + 13) % 32] >> 3));
    hash[i] = x & 0xff;
  }
  const bytes = new Uint8Array(34);
  bytes[0] = 0x12;
  bytes[1] = 0x20;
  bytes.set(hash, 2);
  return base58EncodeBR(bytes);
}

/** Async variant using real WebCrypto SHA-256 — preferred when the caller can
 *  await. Same CIDv0 shape so the SDK accepts it. */
export async function freshEvidenceCidBrowserAsync(prefix = "Evidence"): Promise<string> {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  const seed = prefix + ":" + uuid + ":" + Date.now();
  const data = new TextEncoder().encode(seed);
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", data));
  const bytes = new Uint8Array(34);
  bytes[0] = 0x12;
  bytes[1] = 0x20;
  bytes.set(hash, 2);
  return base58EncodeBR(bytes);
}
