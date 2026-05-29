"use client";

import { useEffect, useState } from "react";
import type { Artifact } from "@/types/artifact";
import { getClients, WalletNotConnectedError, freshEvidenceCidBrowser } from "@/lib/useClients";
import TxLink from "./TxLink";

interface ReportDialogProps {
  artifact: Artifact;
  open: boolean;
  onClose: () => void;
  /** Flips the artifact into "in dispute" state in the parent's React state. */
  onDisputed: (disputeId: string) => void;
}

export default function ReportDialog({
  artifact,
  open,
  onClose,
  onDisputed,
}: ReportDialogProps) {
  const [evidence, setEvidence] = useState("");
  const [cid, setCid] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    disputeId: string;
    txHash: `0x${string}`;
  } | null>(null);

  // Fresh evidence CID each time the dialog opens — never reuse stale evidence.
  useEffect(() => {
    if (open) {
      setCid(freshEvidenceCidBrowser());
      setError(null);
      setResult(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleSubmit() {
    setBusy(true);
    setError(null);
    try {
      const clients = await getClients();
      const { raiseReport } = await import("@/lib/dispute");
      // Bond + liveness are omitted — the SDK reads them from the on-chain
      // arbitration policy (OptimisticOracleV3.getMinimumBond + min liveness).
      const { disputeId, txHash } = await raiseReport(clients.story, {
        targetIpId: artifact.ipId,
        cid,
        tag: "IMPROPER_REGISTRATION",
      });
      const id = String(disputeId);
      setResult({ disputeId: id, txHash });
      onDisputed(id);
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to raise the report."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div className="ov-anim-up relative w-full max-w-md rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)] p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.8)]">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--tier-gated)]/12 text-[var(--tier-gated)]">
                <FlagIcon />
              </span>
              <h2 className="text-[16px] font-semibold tracking-tight text-[var(--ov-text)]">
                Report artifact
              </h2>
            </div>
            <p className="text-[12px] text-[var(--ov-text-dim)]">
              Raise an on-chain dispute against{" "}
              <span className="text-[var(--ov-text)]">{artifact.title}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md px-2 py-1 text-[var(--ov-text-faint)] transition-colors hover:bg-white/5 hover:text-[var(--ov-text)]"
          >
            ✕
          </button>
        </div>

        {result ? (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--tier-gated)]/30 bg-[var(--tier-gated)]/8 px-3 py-2.5">
              <span className="text-[12px] font-medium text-[var(--tier-gated)]">
                Dispute #{result.disputeId} raised
              </span>
              <TxLink hash={result.txHash} />
            </div>
            <p className="text-[11.5px] text-[var(--ov-text-faint)]">
              This artifact is now marked in dispute. A reviewer will assess the
              evidence during the liveness window.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg border border-[var(--ov-line)] py-2 text-[13px] text-[var(--ov-text)] transition-colors hover:border-[var(--ov-accent)]"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ov-text-faint)]">
                Evidence
              </span>
              <textarea
                value={evidence}
                onChange={(e) => setEvidence(e.target.value)}
                rows={4}
                placeholder="Describe why this artifact is improperly registered, infringing, or fraudulent."
                className="w-full resize-none rounded-lg border border-[var(--ov-line)] bg-[var(--ov-bg-elev)] px-3 py-2 text-[13px] text-[var(--ov-text)] outline-none placeholder:text-[var(--ov-text-faint)] focus:border-[var(--ov-accent)]"
              />
            </label>

            <div className="flex items-center gap-2 rounded-lg border border-[var(--ov-line-soft)] bg-[var(--ov-bg-elev)]/50 px-3 py-2">
              <span className="text-[10px] uppercase tracking-wider text-[var(--ov-text-faint)]">
                Evidence CID
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--ov-text-dim)]">
                {cid}
              </code>
            </div>

            <p className="rounded-lg border border-[var(--ov-line-soft)] bg-[var(--ov-bg-elev)]/40 px-3 py-2 text-[11.5px] leading-relaxed text-[var(--ov-text-dim)]">
              A bond in <span className="font-medium text-[var(--ov-text)]">WIP</span>{" "}
              is required to raise a dispute (read on-chain from the arbitration
              policy at submit time, auto-wrapped from native IP). It is returned
              if your report is upheld and forfeited if it is rejected.
            </p>

            {error && (
              <div className="rounded-lg border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-3 py-2 text-[12px] text-[var(--tier-gated)]">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-[var(--ov-line)] py-2 text-[13px] text-[var(--ov-text-dim)] transition-colors hover:text-[var(--ov-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy || !evidence.trim()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--tier-gated)] py-2 text-[13px] font-semibold text-[var(--ov-accent-ink)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? (
                  <span
                    className="h-3.5 w-3.5 rounded-full border-2 border-[var(--ov-accent-ink)]/40 border-t-[var(--ov-accent-ink)]"
                    style={{ animation: "ov-spin 0.7s linear infinite" }}
                  />
                ) : null}
                {busy ? "Raising…" : "Raise dispute"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 21V4M4 4h12l-2 4 2 4H4" />
    </svg>
  );
}
