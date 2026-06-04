"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/lib/env";

/**
 * Real-mode auth shell. Email/social login provides identity/UX. Sui signing is
 * handled separately by dapp-kit (see SuiDappProvider / WalletBridge) because
 * Privy v3.28 has no Sui wallet support.
 *
 * This file statically imports Privy and is itself loaded lazily by
 * Providers.tsx only when a Privy app id is configured, so the provider is
 * absent when no Privy app id is configured.
 */
export default function PrivyAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email", "google", "wallet"],
        appearance: {
          theme: "dark",
          accentColor: "#2ee6a6",
          logo: undefined,
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
