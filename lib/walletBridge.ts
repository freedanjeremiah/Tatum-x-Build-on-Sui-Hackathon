"use client";

// Bridges the active Sui wallet from the React hook world to getClients()
// (a plain async function, not a hook).
//
// SIGNING ARCHITECTURE DECISION (verified June 2026):
//   Privy v3.28.0 (installed) has NO Sui support — its embedded wallets are
//   Ethereum/Solana only (grep of node_modules/@privy-io/react-auth/dist/dts
//   for "sui" returns nothing; the config only exposes embeddedWallets.ethereum
//   and .solana). The earlier TODO comments speculating about a Privy
//   `getSuiProvider()` were therefore wrong: that API does not exist.
//
//   So we keep Privy purely for AUTH (email/social/login UX) and use
//   @mysten/dapp-kit for Sui SIGNING. dapp-kit speaks the Sui wallet-standard,
//   so any installed Sui browser wallet (Sui Wallet, Suiet, Slush, …) provides
//   real signatures the @mysten/sui client accepts. components/WalletBridge.tsx
//   reads dapp-kit's useCurrentAccount + useSignTransaction/useSignPersonalMessage
//   and stashes a WalletStandardSigner here for non-hook callers.
//
// The wallet-standard exposes wallet-level signTransaction / signPersonalMessage
// (each receiving a full Transaction / message and returning a base64
// signature) — it does NOT expose a raw `sign(intentBytes)` primitive. So
// WalletStandardSigner overrides the higher-level Signer methods directly
// rather than the abstract `sign()`. The @mysten/sui base Signer's
// signAndExecuteTransaction() (used by Walrus writeBlob) builds the tx then
// calls this.signTransaction(bytes) + executes via the client, so overriding
// signTransaction is sufficient for the write path.

import { Signer, SIGNATURE_FLAG_TO_SCHEME } from "@mysten/sui/cryptography";
import type {
  PublicKey,
  SignatureScheme,
  SignatureWithBytes,
} from "@mysten/sui/cryptography";
import { toBase64 } from "@mysten/sui/utils";

// ---------------------------------------------------------------------------
// ActiveWallet — the shape stashed by WalletBridge.tsx.
// ---------------------------------------------------------------------------

export interface ActiveWallet {
  /** Sui Signer implementation (keypair or wallet-standard shim). null until wired. */
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
// Callbacks the React layer (dapp-kit hooks) supplies to the signer. They are
// the mutateAsync fns from useSignTransaction / useSignPersonalMessage, narrowed
// to exactly what the signer needs (a base64-tx-string in, base64 sig out).
// ---------------------------------------------------------------------------

export interface WalletStandardSignFns {
  /** dapp-kit useSignTransaction().mutateAsync — takes a tx (base64 string or
   *  Transaction) and returns { bytes, signature } (both base64). */
  signTransaction: (input: {
    transaction: string;
  }) => Promise<{ bytes: string; signature: string }>;
  /** dapp-kit useSignPersonalMessage().mutateAsync — takes message bytes and
   *  returns { bytes, signature } (both base64). */
  signPersonalMessage: (input: {
    message: Uint8Array;
  }) => Promise<{ bytes: string; signature: string }>;
}

// ---------------------------------------------------------------------------
// WalletStandardSigner — adapts a Sui wallet-standard wallet (surfaced via
// @mysten/dapp-kit hooks) to the @mysten/sui `Signer` abstract class.
//
// Unlike a keypair, a wallet-standard wallet cannot sign raw intent bytes
// directly — it signs whole transactions / personal messages and prompts the
// user. So we override signTransaction / signPersonalMessage (the methods the
// Walrus/registry/Seal code actually calls) instead of the abstract `sign()`.
//
// `sign()` and `signWithIntent()` are intentionally unsupported (a wallet never
// exposes that primitive) — they throw honestly so no code path can silently
// produce a fake/partial signature.
// ---------------------------------------------------------------------------

export class WalletStandardSigner extends Signer {
  constructor(
    private readonly _address: string,
    private readonly _publicKey: PublicKey,
    private readonly _fns: WalletStandardSignFns,
  ) {
    super();
  }

  /**
   * Sign a built transaction (BCS bytes). Delegates to the wallet via dapp-kit,
   * passing the tx as a base64 string. Returns { bytes, signature } (base64),
   * exactly the SignatureWithBytes shape @mysten/sui expects — including from
   * the base Signer's signAndExecuteTransaction (used by Walrus writeBlob).
   */
  override async signTransaction(
    bytes: Uint8Array,
  ): Promise<SignatureWithBytes> {
    const { bytes: outBytes, signature } = await this._fns.signTransaction({
      transaction: toBase64(bytes),
    });
    return { bytes: outBytes, signature };
  }

  /**
   * Sign a personal message (used by Seal's SessionKey certificate). The
   * wallet wraps + signs the message with the PersonalMessage intent; we return
   * { bytes, signature } (base64) as the base Signer contract requires.
   */
  override async signPersonalMessage(
    bytes: Uint8Array,
  ): Promise<{ bytes: string; signature: string }> {
    const { bytes: outBytes, signature } = await this._fns.signPersonalMessage({
      message: bytes,
    });
    return { bytes: outBytes, signature };
  }

  // A wallet-standard wallet never exposes raw intent signing. Throw honestly
  // rather than fabricate a signature — nothing in Reef's paths calls this
  // (signTransaction/signPersonalMessage are overridden above).
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sign(_bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    throw new Error(
      "WalletStandardSigner.sign(): a browser wallet cannot sign raw intent " +
        "bytes — use signTransaction()/signPersonalMessage() (overridden) instead.",
    );
  }

  getPublicKey(): PublicKey {
    return this._publicKey;
  }

  getKeyScheme(): SignatureScheme {
    const flag = this._publicKey.flag() as keyof typeof SIGNATURE_FLAG_TO_SCHEME;
    const scheme = SIGNATURE_FLAG_TO_SCHEME[flag];
    if (!scheme)
      throw new Error(
        `WalletStandardSigner: unknown signature scheme flag ${flag}`,
      );
    return scheme;
  }

  override toSuiAddress(): string {
    return this._address;
  }
}

// ---------------------------------------------------------------------------
// SuiSignerShim — legacy adapter for an external signing callback that CAN sign
// raw intent bytes (e.g. a future embedded-wallet provider that returns a
// 64-byte signature for given bytes). Kept for completeness; the live browser
// path uses WalletStandardSigner above. Only the abstract members are
// implemented; the base Signer provides signTransaction / signPersonalMessage
// by delegating to sign() via signWithIntent.
// ---------------------------------------------------------------------------

export class SuiSignerShim extends Signer {
  constructor(
    private readonly _address: string,
    private readonly _publicKey: PublicKey,
    private readonly _sign: (bytes: Uint8Array) => Promise<Uint8Array>,
  ) {
    super();
  }

  async sign(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    const sig = await this._sign(bytes);
    return Uint8Array.from(sig);
  }

  getPublicKey(): PublicKey {
    return this._publicKey;
  }

  getKeyScheme(): SignatureScheme {
    const flag = this._publicKey.flag() as keyof typeof SIGNATURE_FLAG_TO_SCHEME;
    const scheme = SIGNATURE_FLAG_TO_SCHEME[flag];
    if (!scheme)
      throw new Error(`SuiSignerShim: unknown signature scheme flag ${flag}`);
    return scheme;
  }

  override toSuiAddress(): string {
    return this._address;
  }
}
