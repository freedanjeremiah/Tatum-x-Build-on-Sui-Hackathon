"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { PRIVY_APP_ID } from "@/lib/env";

/**
 * Real-mode auth shell. Social/email login mints an embedded wallet so users
 * can transact (mint license tokens, etc.) without a browser extension.
 *
 * This file statically imports Privy and is itself loaded lazily by
 * Providers.tsx only when a Privy app id is configured, so mock builds never
 * mount it.
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
