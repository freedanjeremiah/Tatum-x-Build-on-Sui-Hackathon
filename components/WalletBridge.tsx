"use client";

import { useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";
import { setActiveWallet } from "@/lib/walletBridge";

/**
 * Publishes the active Privy wallet's address (and Sui signer, once wired) to
 * lib/walletBridge so getClients() (a non-hook async fn) can sign/send txs.
 * Privy embedded wallets (social/email logins) don't inject window.sui or
 * window.ethereum, so this bridge is the only signing path those users have.
 * Renders nothing; mounted inside PrivyProvider.
 *
 * TODO(A2/signer): Once the Privy Sui provider shape is confirmed, replace the
 *   null signer below with a real SuiSignerShim. Steps:
 *     1. Call wallet.getSuiProvider() (or wallet.getWalletClient('sui')).
 *     2. Wrap it with new SuiSignerShim(address, signFn, getPubKeyFn).
 *     3. Pass the shim as `signer` to setActiveWallet.
 *   Until then, read paths work but write paths throw WalletNotConnectedError.
 */
export default function WalletBridge() {
  const { wallets } = useWallets();

  useEffect(() => {
    const wallet = wallets?.[0];
    if (!wallet) {
      setActiveWallet(null);
      return;
    }

    // TODO(A2/signer): Obtain the Sui signer from Privy and set it here.
    // For now we set signer: null so the address is available for display /
    // read paths while write paths throw an honest error.
    setActiveWallet({
      signer: null,
      address: wallet.address,
    });

    // Cleanup: clear the wallet ref when the wallet disconnects.
    return () => {
      setActiveWallet(null);
    };
  }, [wallets]);

  return null;
}
