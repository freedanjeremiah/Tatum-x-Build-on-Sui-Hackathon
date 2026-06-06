"use client";

import { useEffect, useMemo } from "react";
import {
  useCurrentAccount,
  useSignTransaction,
  useSignPersonalMessage,
} from "@mysten/dapp-kit";
import { publicKeyFromRawBytes } from "@mysten/sui/verify";
import type { PublicKey, SignatureScheme } from "@mysten/sui/cryptography";
import {
  setActiveWallet,
  WalletStandardSigner,
  type WalletStandardSignFns,
} from "@/lib/walletBridge";

// Candidate signature schemes for deriving a PublicKey from a wallet-standard
// account's raw public-key bytes. The account exposes raw bytes + address but
// not the scheme, so we pick the scheme whose derived address matches the
// account's address (honest derivation — never a guessed/fake key).
const CANDIDATE_SCHEMES: SignatureScheme[] = [
  "ED25519",
  "Secp256k1",
  "Secp256r1",
];

function constructPk(
  bytes: Uint8Array,
  address: string,
  requireMatch: boolean,
): PublicKey | null {
  for (const scheme of CANDIDATE_SCHEMES) {
    try {
      const pk = publicKeyFromRawBytes(scheme, bytes);
      if (!requireMatch || pk.toSuiAddress() === address) return pk;
    } catch {
      /* wrong scheme for these bytes — try the next */
    }
  }
  return null;
}

function derivePublicKey(
  rawBytes: Uint8Array,
  address: string,
): PublicKey | null {
  // Some wallets prefix the raw key with a 1-byte scheme flag — try both.
  const candidates =
    rawBytes.length > 32 ? [rawBytes, rawBytes.subarray(1)] : [rawBytes];

  // 1) Prefer the scheme + bytes whose derived address EXACTLY matches the
  //    account's address (the correct, verified public key).
  for (const b of candidates) {
    const pk = constructPk(b, address, true);
    if (pk) return pk;
  }

  // 2) Best-effort fallback. A wallet-standard wallet (Slush, Suiet, …) signs
  //    transactions itself and returns a COMPLETE, chain-valid signature —
  //    including for zkLogin / multisig accounts whose address is NOT derivable
  //    from the raw public-key bytes. So build any usable PublicKey we can: the
  //    Signer is then non-null, signing goes through the wallet, and
  //    toSuiAddress() is overridden to the real address (getPublicKey() is not
  //    consulted on the wallet-sign path). This is what makes Slush work.
  for (const b of candidates) {
    const pk = constructPk(b, address, false);
    if (pk) return pk;
  }
  return null;
}

/**
 * Publishes the connected Sui wallet (address + a real Signer) to
 * lib/walletBridge so getClients() — a non-hook async fn — can sign and send
 * transactions and build Seal SessionKeys in the browser.
 *
 * Sui signing comes from @mysten/dapp-kit (the Sui wallet-standard), NOT Privy:
 * Privy v3.28 has no Sui support (see lib/walletBridge.ts header). Privy still
 * handles email/social login; a user connects a Sui wallet via dapp-kit for the
 * on-chain write/decrypt paths. Renders nothing; mounted inside the providers.
 */
export default function WalletBridge() {
  const account = useCurrentAccount();
  const { mutateAsync: signTransaction } = useSignTransaction();
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();

  // Stable callback bag for the signer (mutateAsync identities are stable).
  const signFns = useMemo<WalletStandardSignFns>(
    () => ({
      signTransaction: (input) => signTransaction(input),
      signPersonalMessage: (input) => signPersonalMessage(input),
    }),
    [signTransaction, signPersonalMessage],
  );

  useEffect(() => {
    if (!account) {
      setActiveWallet(null);
      return;
    }

    const publicKey = derivePublicKey(
      account.publicKey as Uint8Array,
      account.address,
    );

    if (!publicKey) {
      // We have an address but couldn't reconstruct a usable PublicKey (unknown
      // scheme). Expose the address for read/display paths, but leave signer null
      // so write paths fail honestly rather than with a broken signer.
      setActiveWallet({ signer: null, address: account.address });
      return;
    }

    const signer = new WalletStandardSigner(account.address, publicKey, signFns);
    setActiveWallet({ signer, address: account.address });

    return () => {
      setActiveWallet(null);
    };
  }, [account, signFns]);

  return null;
}
