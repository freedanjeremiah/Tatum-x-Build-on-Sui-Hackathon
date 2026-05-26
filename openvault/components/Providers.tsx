"use client";

import dynamic from "next/dynamic";
import { IS_MOCK, PRIVY_APP_ID } from "@/lib/env";
import WasmGate from "./WasmGate";

// Privy is only needed in real mode. Load it lazily (client-only) so mock
// builds never instantiate the auth shell and never pay its bundle cost.
const PrivyAuthProvider = dynamic(() => import("./PrivyAuthProvider"), {
  ssr: false,
});

/**
 * Top-level client providers.
 *
 * - Mock mode (or no Privy app id): render children directly behind WasmGate.
 * - Real mode: wrap in Privy auth, then WasmGate (so CDR never renders before
 *   the secure runtime is ready).
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  if (IS_MOCK || !PRIVY_APP_ID) {
    return <WasmGate>{children}</WasmGate>;
  }

  return (
    <PrivyAuthProvider>
      <WasmGate>{children}</WasmGate>
    </PrivyAuthProvider>
  );
}
