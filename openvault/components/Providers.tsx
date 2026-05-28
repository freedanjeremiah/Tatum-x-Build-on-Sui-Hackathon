"use client";

import dynamic from "next/dynamic";
import { PRIVY_APP_ID } from "@/lib/env";

// Privy is only needed when PRIVY_APP_ID is configured. Load it lazily
// (client-only) so builds without credentials never instantiate the auth shell.
const PrivyAuthProvider = dynamic(() => import("./PrivyAuthProvider"), {
  ssr: false,
});

/**
 * Top-level auth context. Must wrap the ENTIRE app (header included) so the
 * header's wallet button can call usePrivy() — it has to be inside PrivyProvider.
 * WasmGate is applied separately (in layout) around <main> only, so the header
 * and nav stay visible while the CDR WASM runtime initializes.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  if (!PRIVY_APP_ID) {
    return <>{children}</>;
  }
  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}
