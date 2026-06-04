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

import { Signer, SIGNATURE_FLAG_TO_SCHEME } from "@mysten/sui/cryptography";
import type { PublicKey } from "@mysten/sui/cryptography";
import type { SignatureScheme } from "@mysten/sui/cryptography";

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
 * Minimal shim that adapts an external (Privy) Sui wallet to the @mysten/sui
 * `Signer` abstract class. Only the abstract members are implemented here
 * (`sign`, `getPublicKey`, `getKeyScheme`); the base `Signer` provides the
 * concrete `signTransaction` / `signPersonalMessage` / `signAndExecuteTransaction`
 * helpers, which delegate to `sign()` via `signWithIntent`.
 *
 * The constructor takes the resolved Ed25519 `PublicKey` (so `getPublicKey()`
 * stays synchronous, as the base class requires) and a raw signing callback that
 * signs intent-prefixed message bytes and returns the 64-byte Ed25519 signature.
 *
 * Usage once the Privy Sui provider API is known:
 *   const shim = new SuiSignerShim(
 *     address,
 *     publicKey,                                  // Ed25519PublicKey from Privy
 *     async (bytes) => privyWallet.sign(bytes),   // raw bytes → signature bytes
 *   );
 *   setActiveWallet({ signer: shim, address });
 */
export class SuiSignerShim extends Signer {
  constructor(
    private readonly _address: string,
    private readonly _publicKey: PublicKey,
    private readonly _sign: (bytes: Uint8Array) => Promise<Uint8Array>
  ) {
    super();
  }

  // The single abstract signing primitive. The base Signer's signTransaction /
  // signPersonalMessage call this with intent-prefixed bytes. Delegates to the
  // external (Privy) signing callback.
  //
  // TODO(A2/signer): wire `_sign` to Privy's Sui provider in WalletBridge.tsx.
  // Until then this throws honestly (never returns a fake signature).
  async sign(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    const sig = await this._sign(bytes);
    // Normalize to a Uint8Array backed by a plain ArrayBuffer (the Signer
    // contract's element type), copying off any SharedArrayBuffer-backed view.
    return Uint8Array.from(sig);
  }

  getPublicKey(): PublicKey {
    return this._publicKey;
  }

  getKeyScheme(): SignatureScheme {
    const flag = this._publicKey.flag() as keyof typeof SIGNATURE_FLAG_TO_SCHEME;
    const scheme = SIGNATURE_FLAG_TO_SCHEME[flag];
    if (!scheme) throw new Error(`SuiSignerShim: unknown signature scheme flag ${flag}`);
    return scheme;
  }

  toSuiAddress(): string {
    return this._address;
  }
}
