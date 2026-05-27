"use client";

// Browser-side client acquisition. In mock mode this returns deterministic
// mock clients (no wallet, no chain). In real mode it derives wallet-backed
// clients from the connected EIP-1193 provider.
//
// lib/clients (and the mock CDR it pulls in) reach for node:fs/node:crypto at
// module scope, so they must NEVER land in the static client chunk. We import
// them dynamically at call time — the bundler keeps them out of the browser
// graph and only resolves them when getClients() actually runs (which, in mock,
// is server-rendered / dev-server territory, and in real mode talks to a wallet).

import { IS_MOCK } from "./env";
import type { Clients } from "./artifacts";

/** A mock private key (32 zero bytes) — only used to seed the mock clients. */
const MOCK_PK = ("0x" + "00".repeat(32)) as `0x${string}`;

export class WalletNotConnectedError extends Error {
  constructor(message = "Connect a wallet to continue.") {
    super(message);
    this.name = "WalletNotConnectedError";
  }
}

/**
 * Acquire {cdr, story, account} clients in the browser.
 *
 * Mock mode: always succeeds with deterministic mocks.
 * Real mode: requires an injected EIP-1193 provider + a connected address;
 *   throws WalletNotConnectedError otherwise so callers can prompt the user.
 */
export async function getClients(): Promise<Clients> {
  const { makeClientsFromKey, makeClientsFromProvider } = await import(
    "./clients"
  );

  if (IS_MOCK) {
    return (await makeClientsFromKey(MOCK_PK)) as unknown as Clients;
  }

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
export function freshEvidenceCidBrowser(prefix = "Evidence"): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Array.from({ length: 32 }, () =>
          Math.floor(Math.random() * 16).toString(16)
        ).join("");
  return "bafy" + prefix + uuid.replace(/-/g, "");
}
