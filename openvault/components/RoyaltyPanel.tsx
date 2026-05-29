"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import type { Artifact } from "@/types/artifact";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import TxLink from "./TxLink";

interface RoyaltyPanelProps {
  artifact: Artifact;
}

type Phase = "idle" | "loading" | "claiming" | "paying" | "done" | "error";

/**
 * Owner-facing royalty controls.
 *
 *   - Reads `claimableRevenue(ipId)` from the RoyaltyModule.
 *   - Lets the owner claim accrued revenue routed up from derivatives.
 *   - Lets anyone "tip" / pay royalties to this IP (useful for demo + manual
 *     payment flows from off-platform derivatives).
 */
export default function RoyaltyPanel({ artifact }: RoyaltyPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  const [payAmount, setPayAmount] = useState("0.01");
  const [derivativeIds, setDerivativeIds] = useState<string[]>([]);

  // Find derivatives indexed under this IP so claimRevenue can route them.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/index`);
        const data = (await r.json()) as Artifact[];
        if (!Array.isArray(data) || cancelled) return;
        const kids = data
          .filter((a) => a.parentIpId === artifact.ipId)
          .map((a) => a.ipId);
        setDerivativeIds(kids);
      } catch {
        // best-effort — leave empty
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [artifact.ipId]);

  async function refresh() {
    setPhase("loading");
    setError(null);
    try {
      const clients = await getClients();
      const { getClaimable } = await import("@/lib/royalty");
      const v = await getClaimable(clients.story, { ipId: artifact.ipId });
      setClaimable(v);
      setPhase("idle");
    } catch (e) {
      if (e instanceof WalletNotConnectedError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Failed to read claimable.");
      }
      setPhase("error");
    }
  }

  async function handleClaim() {
    setPhase("claiming");
    setError(null);
    setLastTx(null);
    try {
      const clients = await getClients();
      const { claimRevenue } = await import("@/lib/royalty");
      if (derivativeIds.length === 0) {
        throw new Error(
          "No indexed derivatives for this IP — nothing to claim through."
        );
      }
      const out = await claimRevenue(clients.story, {
        parentIpId: artifact.ipId,
        childIpIds: derivativeIds as `0x${string}`[],
      });
      setLastTx(out.txHash);
      setPhase("done");
      // After a successful claim, the claimable balance resets to 0.
      setClaimable(0n);
    } catch (e) {
      if (e instanceof WalletNotConnectedError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Claim failed.");
      }
      setPhase("error");
    }
  }

  async function handlePay() {
    setPhase("paying");
    setError(null);
    setLastTx(null);
    try {
      const clients = await getClients();
      const { payRoyalty } = await import("@/lib/royalty");
      const { parseEther } = await import("viem");
      let amount: bigint;
      try {
        amount = parseEther(payAmount.trim() || "0");
      } catch {
        throw new Error("Enter a valid WIP amount.");
      }
      if (amount <= 0n) throw new Error("Amount must be greater than 0.");
      const out = await payRoyalty(clients.story, {
        childIpId: artifact.ipId,
        amount,
      });
      setLastTx(out.txHash);
      setPhase("done");
    } catch (e) {
      if (e instanceof WalletNotConnectedError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Payment failed.");
      }
      setPhase("error");
    }
  }

  const busy =
    phase === "loading" || phase === "claiming" || phase === "paying";

  return (
    <section className="rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/50 p-5">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
          Royalties
        </h2>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="text-[11px] text-[var(--ov-accent)] underline-offset-2 hover:underline disabled:opacity-40"
        >
          {phase === "loading" ? "Reading…" : "Refresh"}
        </button>
      </div>

      <div className="mb-4 rounded-xl border border-[var(--ov-line-soft)] bg-[var(--ov-bg-elev)]/50 px-4 py-3">
        <div className="text-[10px] uppercase tracking-wider text-[var(--ov-text-faint)]">
          Claimable revenue
        </div>
        <div className="mt-1 font-mono text-[18px] text-[var(--ov-text)]">
          {claimable === null ? "—" : `${formatEther(claimable)} WIP`}
        </div>
        <div className="mt-0.5 text-[11px] text-[var(--ov-text-faint)]">
          {derivativeIds.length} indexed derivative
          {derivativeIds.length === 1 ? "" : "s"} route to this IP.
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleClaim}
          disabled={busy || derivativeIds.length === 0}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ov-accent)] px-4 py-2 text-[13px] font-semibold text-[var(--ov-accent-ink)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {phase === "claiming" ? <Spinner ink /> : null}
          {phase === "claiming" ? "Claiming…" : "Claim revenue (owner)"}
        </button>
      </div>

      <div className="mt-5 border-t border-[var(--ov-line-soft)] pt-4">
        <div className="mb-2 text-[10px] uppercase tracking-wider text-[var(--ov-text-faint)]">
          Pay royalties to this IP
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min="0"
            step="0.01"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            disabled={busy}
            className="w-32 rounded-lg border border-[var(--ov-line)] bg-[var(--ov-bg-elev)] px-3 py-2 font-mono text-[13px] text-[var(--ov-text)] outline-none focus:border-[var(--ov-accent)] disabled:opacity-60"
          />
          <span className="text-[12px] text-[var(--ov-text-dim)]">WIP</span>
          <button
            type="button"
            onClick={handlePay}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--ov-line)] px-3 py-2 text-[13px] text-[var(--ov-text)] transition-colors hover:border-[var(--ov-accent)] disabled:opacity-40"
          >
            {phase === "paying" ? <Spinner /> : null}
            {phase === "paying" ? "Sending…" : "Pay royalty"}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--ov-text-faint)]">
          Auto-wraps native IP → WIP if needed.
        </p>
      </div>

      {lastTx && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--ov-accent)]/30 bg-[var(--ov-accent)]/8 px-3 py-2 text-[12px] text-[var(--ov-text)]">
          <span>✓ Tx confirmed</span>
          <TxLink hash={lastTx} />
        </div>
      )}
      {error && (
        <div className="mt-4 rounded-lg border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-3 py-2 text-[12px] text-[var(--tier-gated)]">
          {error}
        </div>
      )}
    </section>
  );
}

function Spinner({ ink }: { ink?: boolean }) {
  return (
    <span
      className={`h-3.5 w-3.5 rounded-full border-2 ${
        ink
          ? "border-[var(--ov-accent-ink)]/40 border-t-[var(--ov-accent-ink)]"
          : "border-[var(--ov-accent)]/30 border-t-[var(--ov-accent)]"
      }`}
      style={{ animation: "ov-spin 0.7s linear infinite" }}
    />
  );
}
