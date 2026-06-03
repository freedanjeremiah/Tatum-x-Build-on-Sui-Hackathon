"use client";

// Bridges the active Privy wallet from the React hook world to getClients()
// (a plain async function). Privy embedded wallets created for social/email
// logins do NOT inject window.ethereum or a window.suiWallet, so the signer
// must be obtained via Privy's useWallets() and stashed here for non-hook callers.
//
// <WalletBridge> (mounted inside PrivyProvider) keeps this ref current.
//
// Sui signing note:
//   Privy v3 (^3.28.0) exposes a Sui wallet via useWallets() with a
//   `signTransaction(txBytes: Uint8Array) → Promise<Uint8Array>` method
//   (returned by wallet.getSuiProvider() or similar). The exact shape depends
//   on the installed Privy SDK version and may require a sui-specific wallet
//   type. The WalletBridge component must call wallet.getSuiProvider() (or the
//   equivalent method in the installed version) and build a Signer shim that
//   delegates signTransaction + getPublicKey to Privy's callback, then call
//   setActiveWallet({ signer: <that shim>, address }).
//
// TODO(A2/signer): Wire the Sui signing callback from Privy into the signer
//   field below. Steps:
//   1. In components/WalletBridge.tsx, replace getEthereumProvider() with
//      wallet.getSuiProvider() (or wallet.getWalletClient('sui') depending on
//      the Privy version) to obtain a Sui-compatible provider.
//   2. Wrap it in a SuiSignerShim (see stub class below) that implements
//      @mysten/sui/cryptography Signer (signTransaction, getPublicKey).
//   3. Call setActiveWallet({ signer: shim, address: wallet.address }).
//   Until this is done, getClients() in useClients.ts will throw
//   WalletNotConnectedError("Sui signer not available") on any write path.
//   Read paths (client.core.getObject etc.) do not require a signer and work now.

import type { Signer } from "@mysten/sui/cryptography";

// ---------------------------------------------------------------------------
// ActiveWallet — the shape stashed by WalletBridge.tsx.
// ---------------------------------------------------------------------------

export interface ActiveWallet {
  /** Sui Signer implementation (keypair or Privy shim). null until wired. */
  signer: Signer | null;
  /** On-chain Sui address (0x-prefixed 64-char hex). */
  address: string;
}

let active: ActiveWallet | null = null;

export function setActiveWallet(w: ActiveWallet | null): void {
  active = w;
}

export function getActiveWallet(): ActiveWallet | null {
  return active;
}

// ---------------------------------------------------------------------------
// SuiSignerShim — a base class / interface adapters can extend to bridge a
// Privy (or other external) signing function to the @mysten/sui Signer shape.
//
// TODO(A2/signer): Instantiate this (or a concrete subclass) in
//   components/WalletBridge.tsx once Privy's Sui provider shape is confirmed.
// ---------------------------------------------------------------------------

/**
 * Minimal shim that wraps an external async signing callback.
 *
 * Usage once the Privy Sui provider API is known:
 *   const shim = new SuiSignerShim(
 *     address,
 *     async (txBytes) => privyWallet.signTransaction(txBytes),
 *     async () => privyWallet.getPublicKey(),
 *   );
 *   setActiveWallet({ signer: shim, address });
 */
export class SuiSignerShim implements Signer {
  constructor(
    private readonly _address: string,
    private readonly _signTransaction: (
      txBytes: Uint8Array
    ) => Promise<{ signature: string; bytes: string }>,
    private readonly _getPublicKey: () => Promise<import("@mysten/sui/cryptography").PublicKey>
  ) {}

  // TODO(A2/signer): Remove the throw once the real Privy callback is wired in.
  async signTransaction(
    bytes: Uint8Array
  ): Promise<{ signature: string; bytes: string }> {
    return this._signTransaction(bytes);
  }

  async getPublicKey(): Promise<import("@mysten/sui/cryptography").PublicKey> {
    return this._getPublicKey();
  }

  // Required by the Signer interface — delegates to signTransaction.
  async sign(bytes: Uint8Array): Promise<Uint8Array> {
    const result = await this._signTransaction(bytes);
    // Decode the base64 signature bytes.
    const sig = result.signature;
    return Uint8Array.from(atob(sig), (c) => c.charCodeAt(0));
  }

  toSuiAddress(): string {
    return this._address;
  }
}
