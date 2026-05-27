"use client";

import { useEffect } from "react";
import { useWallets } from "@privy-io/react-auth";
import { setActiveWallet } from "@/lib/walletBridge";

/**
 * Publishes the active Privy wallet's EIP-1193 provider to lib/walletBridge so
 * getClients() (a non-hook async fn) can sign/send txs. Privy embedded wallets
 * (social/email logins) don't inject window.ethereum, so this is the only way
 * those users can transact. Renders nothing; mounted inside PrivyProvider.
 */
export default function WalletBridge() {
  const { wallets } = useWallets();

  useEffect(() => {
    const wallet = wallets?.[0];
    if (!wallet) {
      setActiveWallet(null);
      return;
    }
    let cancelled = false;
    wallet
      .getEthereumProvider()
      .then((provider) => {
        if (!cancelled) {
          setActiveWallet({
            provider: provider as ActiveProvider,
            address: wallet.address as `0x${string}`,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setActiveWallet(null);
      });
    return () => {
      cancelled = true;
    };
  }, [wallets]);

  return null;
}

type ActiveProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};
