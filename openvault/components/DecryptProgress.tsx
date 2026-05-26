"use client";

import { useEffect, useState } from "react";

interface DecryptProgressProps {
  /** When true, show the timeout/retry affordance instead of the live bar. */
  timedOut?: boolean;
  onRetry?: () => void;
}

/**
 * Determinate-ish decryption progress. Collecting validator partials genuinely
 * takes up to ~2 minutes — this is EXPECTED, not an error. The bar eases toward
 * (but never reaches) 100% until the download resolves; on timeout we surface a
 * calm Retry rather than a scary failure.
 */
export default function DecryptProgress({
  timedOut,
  onRetry,
}: DecryptProgressProps) {
  const [pct, setPct] = useState(8);

  useEffect(() => {
    if (timedOut) return;
    const id = setInterval(() => {
      // Approach 92% asymptotically over ~2 min so it always feels alive.
      setPct((p) => (p >= 92 ? 92 : p + Math.max(0.4, (92 - p) * 0.04)));
    }, 600);
    return () => clearInterval(id);
  }, [timedOut]);

  return (
    <div className="space-y-2.5 rounded-lg border border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/60 p-3.5">
      <div className="flex items-center gap-2">
        {!timedOut ? (
          <span
            className="h-3.5 w-3.5 rounded-full border-2 border-[var(--ov-accent)]/30 border-t-[var(--ov-accent)]"
            style={{ animation: "ov-spin 0.8s linear infinite" }}
          />
        ) : (
          <span className="grid h-3.5 w-3.5 place-items-center text-[var(--tier-gated)]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        <span className="text-[12.5px] font-medium text-[var(--ov-text)]">
          {timedOut
            ? "Still collecting partials — this can take a moment"
            : "Collecting validator partials…"}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--ov-line)]">
        <div
          className="h-full rounded-full bg-[var(--ov-accent)] transition-[width] duration-500 ease-out"
          style={{
            width: `${timedOut ? 92 : pct}%`,
            opacity: timedOut ? 0.5 : 1,
          }}
        />
      </div>

      <p className="text-[11px] leading-relaxed text-[var(--ov-text-faint)]">
        Threshold decryption gathers key shares from validators. This can take up
        to ~2 min — it is expected, not a failure.
      </p>

      {timedOut && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-md border border-[var(--ov-line)] px-3 py-1.5 text-[12px] text-[var(--ov-text)] transition-colors hover:border-[var(--ov-accent)]"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          Retry
        </button>
      )}
    </div>
  );
}
