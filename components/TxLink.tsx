"use client";

import { SUI_EXPLORER_OBJECT, SUI_EXPLORER_TX } from "@/lib/constants";

interface TxLinkProps {
  /** Transaction digest → links to the Sui explorer tx view. */
  hash?: string;
  /** Sui object id (the artifact's ipId) → links to the Sui object view. */
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
 * Provenance pill. Mono, middle-truncated, with a small `OBJ` or `TX` suffix
 * tag — the chain artefact is always legible at a glance. A tx links to the Sui
 * explorer by digest; an object/ipId links by Sui object id.
 */
export default function TxLink({ hash, ipId, label, className }: TxLinkProps) {
  const isTx = Boolean(hash);
  const raw = (hash ?? ipId ?? "") as string;
  if (!raw) return null;

  const href = isTx ? `${SUI_EXPLORER_TX}${hash}` : `${SUI_EXPLORER_OBJECT}${ipId}`;
  const suffix = isTx ? "TX" : "OBJ";
  const display = label ?? truncateMiddle(raw);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${isTx ? "View transaction" : "View object"} ${raw}`}
      onClick={(e) => e.stopPropagation()}
      className={`txlink ${className ?? ""}`}
    >
      <span>{display}</span>
      <span className="suffix">{suffix}</span>
    </a>
  );
}
