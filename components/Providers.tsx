"use client";

import dynamic from "next/dynamic";
import { PRIVY_APP_ID } from "@/lib/env";

// Privy is only needed when PRIVY_APP_ID is configured. Load it lazily
// (client-only) so builds without credentials never instantiate the auth shell.
const PrivyAuthProvider = dynamic(() => import("./PrivyAuthProvider"), {
  ssr: false,
});

// dapp-kit (Sui wallet-standard) supplies the browser SIGNING context. It is
// always mounted — independent of Privy — because Sui signing comes from a
// connected Sui wallet, not from Privy (Privy v3.28 has no Sui support). Loaded
// client-only (it touches localStorage / window for wallet discovery).
const SuiDappProvider = dynamic(() => import("./SuiDappProvider"), {
  ssr: false,
});

/**
 * Top-level provider stack, wrapping the ENTIRE app (header included).
 *
 *   SuiDappProvider (dapp-kit: Sui signing + WalletBridge)
 *     └─ PrivyAuthProvider (auth/login; only when PRIVY_APP_ID is set)
 *
 * The header's Privy button needs usePrivy() (inside PrivyProvider) and the Sui
 * connect button needs dapp-kit context (inside SuiDappProvider), so both wrap
 * the header. WasmGate is applied separately (in layout) around <main> only, so
 * the header and nav stay visible while the secure client runtime initializes.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const inner = PRIVY_APP_ID ? (
    <PrivyAuthProvider>{children}</PrivyAuthProvider>
  ) : (
    <>{children}</>
  );
  return <SuiDappProvider>{inner}</SuiDappProvider>;
}
