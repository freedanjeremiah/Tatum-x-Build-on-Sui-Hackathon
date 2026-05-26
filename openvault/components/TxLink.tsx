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

/** Truncate a hex identifier to 0x1234…abcd form. */
function truncateMiddle(value: string): string {
  if (value.length <= 13) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

/**
 * A first-class provenance link. Renders a monospace, middle-truncated
 * identifier prefixed with a chain-link glyph, opening the relevant explorer
 * in a new tab. Surfacing tx/ipId provenance is a core visual element.
 */
export default function TxLink({ hash, ipId, label, className }: TxLinkProps) {
  const isTx = Boolean(hash);
  const raw = (hash ?? ipId ?? "") as string;
  if (!raw) return null;

  const href = isTx ? `${STORYSCAN_TX}${hash}` : `${EXPLORER_IPA}${ipId}`;
  const kind = isTx ? "tx" : "ipa";
  const display = label ?? truncateMiddle(raw);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={`${isTx ? "View transaction" : "View IP asset"} ${raw}`}
      onClick={(e) => e.stopPropagation()}
      className={`group/tx inline-flex items-center gap-1.5 rounded-md border border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/70 px-2 py-1 font-mono text-[11px] leading-none text-[var(--ov-text-dim)] transition-colors hover:border-[var(--ov-accent)] hover:text-[var(--ov-text)] ${className ?? ""}`}
    >
      <ChainLinkIcon />
      <span className="tracking-tight">{display}</span>
      <span className="text-[9px] uppercase tracking-wider text-[var(--ov-text-faint)] group-hover/tx:text-[var(--ov-accent)]">
        {kind}
      </span>
    </a>
  );
}

function ChainLinkIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 text-[var(--ov-accent)]"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
