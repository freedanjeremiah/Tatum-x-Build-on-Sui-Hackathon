"use client";

import { EXPLORER_IPA, STORYSCAN_TX } from "@/lib/constants";

interface TxLinkProps {
  /** Transaction hash → links to Storyscan. */
  hash?: string;
  /** IP asset id → links to the Story IP Explorer. */
  ipId?: string;
  /** Optional override for the visible label. */
  label?: string;
  /** Optional extra classes. */
  className?: string;
}

function truncateMiddle(v: string): string {
  if (v.length <= 13) return v;
  return `${v.slice(0, 6)}…${v.slice(-4)}`;
}

/**
 * Provenance pill. Mono, middle-truncated, with a small `IPA` or `TX` suffix
 * tag — the chain artefact is always legible at a glance.
 */
export default function TxLink({ hash, ipId, label, className }: TxLinkProps) {
  const isTx = Boolean(hash);
  const raw = (hash ?? ipId ?? "") as string;
  if (!raw) return null;

  const href = isTx ? `${STORYSCAN_TX}${hash}` : `${EXPLORER_IPA}${ipId}`;
  const suffix = isTx ? "TX" : "IPA";
  const display = label ?? truncateMiddle(raw);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${isTx ? "View transaction" : "View IP asset"} ${raw}`}
      onClick={(e) => e.stopPropagation()}
      className={`txlink ${className ?? ""}`}
    >
      <span>{display}</span>
      <span className="suffix">{suffix}</span>
    </a>
  );
}
