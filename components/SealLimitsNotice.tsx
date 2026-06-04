"use client";

import { useState } from "react";
import Icon from "./ui/Icon";

const LIMITS: { t: string; d: string; ref: string }[] = [
  {
    t: "No decryption revocation",
    d: "Seal cannot revoke a decryption credential once granted. Rotate access by re-encrypting under a new identity.",
    ref: "Confidentiality",
  },
  {
    t: "Compute runs on a plain server",
    d: "The demo worker is operator-trusted — plaintext is visible in memory. Production would attest an SGX/TDX enclave.",
    ref: "Compute",
  },
  {
    t: "Group → member unlock unconfirmed",
    d: "One group license unlocking every member artifact is gated per-artifact today; a single-identity group unlock is future work.",
    ref: "Grouping",
  },
];

/** Collapsible, persistent disclosure footer. Lives in the layout. */
export default function SealLimitsNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        borderTop: "1.5px solid var(--ov-line-ink)",
        background: "var(--ov-bg-2)",
      }}
    >
      <div
        className="container maxw-browse"
        style={{ paddingTop: 10, paddingBottom: 10 }}
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          style={{
            background: "none",
            border: 0,
            padding: 0,
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            color: "var(--ov-text-dim)",
          }}
        >
          <span style={{ color: "var(--ov-accent)", display: "inline-flex" }}>
            <Icon name="shield" size={15} />
          </span>
          <span className="meta" style={{ color: "var(--ov-text-dim)" }}>
            Spec disclosures — honest about what the chain can &amp; can&apos;t do
          </span>
          <span style={{ flex: 1 }} />
          <span
            style={{
              display: "inline-flex",
              transition: "transform .2s",
              transform: open ? "rotate(180deg)" : "none",
            }}
          >
            <Icon name="chevron" size={16} />
          </span>
        </button>
        {open ? (
          <div
            className="anim-up"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))",
              gap: 14,
              marginTop: 14,
            }}
          >
            {LIMITS.map((it, i) => (
              <div
                key={i}
                style={{
                  borderLeft: "3px solid var(--tier-gated)",
                  paddingLeft: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <strong style={{ fontSize: 12.5, color: "var(--ov-text)" }}>
                    {it.t}
                  </strong>
                  <span
                    className="meta"
                    style={{ color: "var(--ov-text-faint)" }}
                  >
                    {it.ref}
                  </span>
                </div>
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12.5,
                    color: "var(--ov-text-dim)",
                    lineHeight: 1.5,
                  }}
                >
                  {it.d}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
