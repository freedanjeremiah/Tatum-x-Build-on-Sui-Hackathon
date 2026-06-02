"use client";

// Bridges the active wallet's EIP-1193 provider from Privy (a React hook world)
// to getClients() (a plain async function). Privy embedded wallets — created for
// social/email logins — do NOT inject window.ethereum, so the provider must be
// obtained via Privy's useWallets() and stashed here for non-hook callers.
//
// <WalletBridge> (mounted inside PrivyProvider) keeps this ref current.

export interface ActiveWallet {
  provider: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
  address: `0x${string}`;
}

let active: ActiveWallet | null = null;

export function setActiveWallet(w: ActiveWallet | null): void {
  active = w;
}

export function getActiveWallet(): ActiveWallet | null {
  return active;
}
