"use client";

/**
 * Legacy runtime gate. The old Story/CDR path needed a WASM runtime
 * (`@piplabs/cdr-sdk` initWasm) to be ready before any client component rendered.
 *
 * The Sui core (Seal threshold encryption + Walrus storage via @mysten/* SDKs) is
 * pure JavaScript with no WASM init step, so there is nothing to gate. This
 * wrapper is kept as a transparent passthrough so existing layout call sites
 * (<WasmGate><main/></WasmGate>) keep working without churn.
 */
export default function WasmGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
