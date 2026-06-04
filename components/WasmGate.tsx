"use client";

/**
 * Client runtime gate. The Sui core (Seal threshold encryption + Walrus storage
 * via @mysten/* SDKs) is pure JavaScript with no WASM init step, so there is
 * nothing to block on. This wrapper is a transparent passthrough that gives the
 * layout a single place (<WasmGate><main/></WasmGate>) to introduce a readiness
 * gate later if the client ever needs one.
 */
export default function WasmGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
