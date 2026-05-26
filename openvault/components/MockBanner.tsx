"use client";

import { useState } from "react";
import { IS_MOCK } from "@/lib/env";

/**
 * Slim, honest banner shown only in mock mode. Dismissible via React state
 * (no storage — it reappears on reload by design).
 */
export default function MockBanner() {
  const [open, setOpen] = useState(true);
  if (!IS_MOCK || !open) return null;

  return (
    <div className="relative z-20 border-b border-[var(--ov-line)] bg-[linear-gradient(90deg,color-mix(in_oklab,var(--tier-gated)_14%,transparent),transparent)]">
      <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-5 py-2 text-[12px]">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-widest text-[var(--tier-gated)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tier-gated)]" />
          Mock
        </span>
        <p className="min-w-0 flex-1 truncate text-[var(--ov-text-dim)]">
          No on-chain calls · deterministic demo data.{" "}
          <span className="text-[var(--ov-text-faint)]">
            Add credentials in <code className="font-mono">.env.local</code> to
            go live.
          </span>
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Dismiss mock banner"
          className="shrink-0 rounded-md px-2 py-1 text-[var(--ov-text-faint)] transition-colors hover:bg-white/5 hover:text-[var(--ov-text)]"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
