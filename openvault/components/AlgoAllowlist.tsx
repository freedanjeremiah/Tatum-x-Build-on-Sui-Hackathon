import type { Artifact } from "@/types/artifact";
import { algoName } from "@/lib/compute";

/**
 * Renders a compute dataset's hash-pinned permitted algorithms as a transparent
 * list. The allowlist is the privacy boundary for OUTPUTS — only these
 * algorithms ever touch the plaintext, so prefer DP / aggregate algorithms.
 */
export default function AlgoAllowlist({ artifact }: { artifact: Artifact }) {
  const hashes = artifact.allowedAlgoHashes ?? [];

  return (
    <section className="rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldIcon />
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
          Algorithm allowlist
        </h2>
      </div>
      <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--ov-text-dim)]">
        The worker refuses any algorithm not pinned below — it never decrypts for
        an off-allowlist request. This allowlist is the{" "}
        <span className="font-medium text-[var(--tier-compute)]">
          privacy boundary for outputs
        </span>
        ; owners should permit only aggregate / differentially-private
        algorithms.
      </p>

      {hashes.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--ov-line)] px-3 py-4 text-center text-[12px] text-[var(--ov-text-faint)]">
          No algorithms are permitted on this dataset.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {hashes.map((h) => (
            <li
              key={h}
              className="flex items-center gap-3 rounded-lg border border-[var(--tier-compute)]/25 bg-[var(--tier-compute)]/[0.06] px-3 py-2.5"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--tier-compute)]" />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-[var(--ov-text)]">
                  {algoName(h)}
                </div>
                <code className="block truncate font-mono text-[11px] text-[var(--ov-text-faint)]">
                  {h}
                </code>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ShieldIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--tier-compute)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}
