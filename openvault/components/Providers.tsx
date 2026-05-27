"use client";

import dynamic from "next/dynamic";
import { IS_MOCK, PRIVY_APP_ID } from "@/lib/env";

// Privy is only needed in real mode. Load it lazily (client-only) so mock
// test builds never instantiate the auth shell and never pay its bundle cost.
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
  if (IS_MOCK || !PRIVY_APP_ID) {
    return <>{children}</>;
  }
  return <PrivyAuthProvider>{children}</PrivyAuthProvider>;
}
