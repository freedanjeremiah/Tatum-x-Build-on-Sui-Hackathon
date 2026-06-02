"use client";

import { useEffect, useState } from "react";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

interface DecryptProgressProps {
  timedOut?: boolean;
  onRetry?: () => void;
}

/**
 * Determinate-ish decryption progress. Collecting validator partials genuinely
 * takes up to ~2 minutes — this is EXPECTED, not an error. On timeout we
 * surface a calm Retry rather than a scary failure.
 */
export default function DecryptProgress({
  timedOut,
  onRetry,
}: DecryptProgressProps) {
  const [pct, setPct] = useState(8);

  useEffect(() => {
    if (timedOut) return;
    const id = setInterval(() => {
      setPct((p) => (p >= 92 ? 92 : p + Math.max(0.4, (92 - p) * 0.04)));
    }, 600);
    return () => clearInterval(id);
  }, [timedOut]);

  return (
    <div
      className="panel-soft"
      style={{
        padding: 14,
        marginTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          fontSize: 12.5,
          color: "var(--ov-text)",
        }}
      >
        {timedOut ? (
          <span
            style={{ color: "var(--ov-accent)", display: "inline-flex" }}
          >
            <Icon name="refresh" size={15} />
          </span>
        ) : (
          <Spinner />
        )}
        <span style={{ fontWeight: 500 }}>
          {timedOut
            ? "Still collecting partials — this can take a moment"
            : "Unwrapping vault key → decrypting bytes in the browser (no plaintext leaves your device)…"}
        </span>
      </div>

      <div
        style={{
          height: 6,
          width: "100%",
          overflow: "hidden",
          borderRadius: 999,
          background: "var(--ov-line)",
        }}
      >
        <div
          style={{
            height: "100%",
            borderRadius: 999,
            background: "var(--ov-accent)",
            width: `${timedOut ? 92 : pct}%`,
            opacity: timedOut ? 0.55 : 1,
            transition: "width .5s ease-out",
          }}
        />
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 11,
          lineHeight: 1.5,
          color: "var(--ov-text-faint)",
        }}
      >
        Threshold decryption gathers key shares from validators. This can take up
        to ~2 min — it is expected, not a failure.
      </p>

      {timedOut && onRetry ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ alignSelf: "flex-start" }}
          onClick={onRetry}
        >
          <Icon name="refresh" size={13} />
          Retry
        </button>
      ) : null}
    </div>
  );
}
