"use client";

import { useEffect, useState } from "react";
import { IS_MOCK } from "@/lib/env";

/**
 * Nothing that uses CDR may render before initWasm() resolves. WasmGate blocks
 * its children until the secure runtime is ready.
 *
 * In mock mode there is no CDR; we resolve immediately but keep the exact same
 * component shape so the real and mock trees are structurally identical.
 */
export default function WasmGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(IS_MOCK);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (IS_MOCK) return;
    let cancelled = false;
    (async () => {
      try {
        const { initWasm } = await import("@piplabs/cdr-sdk");
        await initWasm();
        if (!cancelled) setReady(true);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Failed to initialize runtime",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--tier-gated)]">
          Runtime error
        </div>
        <p className="max-w-md text-sm text-[var(--ov-text-dim)]">
          The confidential runtime failed to start. {error}
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-6 text-center">
        <div className="relative h-10 w-10">
          <span
            className="absolute inset-0 rounded-full border-2 border-[var(--ov-line)] border-t-[var(--ov-accent)]"
            style={{ animation: "ov-spin 0.9s linear infinite" }}
          />
        </div>
        <div className="space-y-1">
          <div className="font-mono text-sm tracking-tight text-[var(--ov-text)]">
            Initializing secure runtime…
          </div>
          <div className="text-xs text-[var(--ov-text-faint)]">
            Loading the confidential decryption WASM
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
