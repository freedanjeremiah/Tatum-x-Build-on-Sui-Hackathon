"use client";

import { useEffect, useState } from "react";
import { formatEther } from "viem";
import type { Artifact } from "@/types/artifact";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import TxLink from "./TxLink";
import DisclosureStrip from "./ui/DisclosureStrip";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

interface RoyaltyPanelProps {
  artifact: Artifact;
}

type Phase = "idle" | "loading" | "claiming" | "paying" | "done" | "error";

/**
 * Owner-facing royalty controls. Reads claimable from the RoyaltyModule; lets
 * the owner claim accrued revenue from indexed derivatives; lets anyone
 * "tip"/pay royalties to this IP (auto-wraps native IP → WIP).
 */
export default function RoyaltyPanel({ artifact }: RoyaltyPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [lastTx, setLastTx] = useState<`0x${string}` | null>(null);
  const [payAmount, setPayAmount] = useState("0.01");
  const [derivativeIds, setDerivativeIds] = useState<string[]>([]);

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
        /* best-effort — leave empty */
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
          "No indexed derivatives for this IP — nothing to claim through.",
        );
      }
      const out = await claimRevenue(clients.story, {
        parentIpId: artifact.ipId,
        childIpIds: derivativeIds as `0x${string}`[],
      });
      setLastTx(out.txHash);
      setPhase("done");
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
    <div className="panel" style={{ padding: 20 }}>
      <div
        style={{ display: "flex", alignItems: "center", marginBottom: 16 }}
      >
        <div className="h2" style={{ fontSize: 16, color: "var(--ov-text)" }}>
          Royalties
        </div>
        <span style={{ flex: 1 }} />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={refresh}
          disabled={busy}
        >
          <Icon name="refresh" size={13} />
          {phase === "loading" ? "Reading…" : "Refresh"}
        </button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div
          className="panel-soft"
          style={{ padding: 16, flex: 1, minWidth: 220 }}
        >
          <div className="meta" style={{ marginBottom: 8 }}>
            Claimable revenue
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 20, fontWeight: 700, color: "var(--ov-text)" }}
          >
            {claimable === null ? "—" : formatEther(claimable)}
            <span
              style={{
                marginLeft: 6,
                fontSize: 13,
                color: "var(--ov-text-faint)",
              }}
            >
              WIP
            </span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ov-text-faint)",
              marginTop: 6,
            }}
          >
            {derivativeIds.length} indexed derivative
            {derivativeIds.length === 1 ? "" : "s"} route to this IP.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          disabled={busy || derivativeIds.length === 0}
          onClick={handleClaim}
        >
          {phase === "claiming" ? <Spinner /> : null}
          {phase === "claiming" ? "Claiming…" : "Claim revenue (owner)"}
        </button>
      </div>

      {lastTx ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="public" icon="check">
            ✓ Tx confirmed <TxLink hash={lastTx} />
          </DisclosureStrip>
        </div>
      ) : null}

      <hr className="divider" style={{ margin: "18px 0" }} />

      <div className="meta" style={{ marginBottom: 10 }}>
        Pay royalties to this IP
      </div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
          <input
            className="input mono"
            inputMode="decimal"
            placeholder="0.00"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            disabled={busy}
          />
          <span
            className="meta"
            style={{
              position: "absolute",
              right: 12,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          >
            WIP
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !payAmount.trim()}
          onClick={handlePay}
        >
          {phase === "paying" ? <Spinner /> : null}
          {phase === "paying" ? "Sending…" : "Pay royalty"}
        </button>
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: "var(--ov-text-faint)",
          marginTop: 8,
        }}
      >
        Auto-wraps native IP → WIP if needed.
      </div>

      {error ? (
        <div style={{ marginTop: 16 }}>
          <DisclosureStrip tone="gated" icon="flag">
            {error}
          </DisclosureStrip>
        </div>
      ) : null}
    </div>
  );
}
