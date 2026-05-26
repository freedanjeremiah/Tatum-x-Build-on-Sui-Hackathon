"use client";

import { useState } from "react";

const LIMITS: { title: string; body: string }[] = [
  {
    title: "Testnet only",
    body: "Runs on Story Aeneid. Assets, tokens, and txs are test artifacts with no monetary value.",
  },
  {
    title: "Metadata is public by design",
    body: "Titles, descriptions, tags, CIDs, and vault ids are on-chain / index data. Only the artifact bytes are encrypted — never the catalog entry.",
  },
  {
    title: "No decryption revocation",
    body: "Once a license token grants decryption and a holder pulls the key material, access cannot be retroactively revoked.",
  },
  {
    title: "Read latency",
    body: "Confidential reads assemble validator key partials; this can take up to ~2 minutes before plaintext is recoverable.",
  },
];

/**
 * An honest, expandable disclosure of CDR's real limits. Lives in the footer.
 */
export default function CdrLimitsNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-panel)]/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-[13px] font-medium text-[var(--ov-text)]">
          <span className="text-[var(--ov-accent)]">⚐</span>
          Honest limits of confidential data on CDR
        </span>
        <span
          className="font-mono text-xs text-[var(--ov-text-faint)] transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        >
          ▸
        </span>
      </button>
      {open && (
        <dl className="grid gap-3 border-t border-[var(--ov-line-soft)] px-4 py-4 sm:grid-cols-2">
          {LIMITS.map((l) => (
            <div key={l.title} className="space-y-1">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-[var(--ov-accent)]">
                {l.title}
              </dt>
              <dd className="text-[12px] leading-relaxed text-[var(--ov-text-dim)]">
                {l.body}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
