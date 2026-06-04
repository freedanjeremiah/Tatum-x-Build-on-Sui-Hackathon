"use client";

import { useEffect, useState } from "react";
import type { Artifact } from "@/types/artifact";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import { formatSui, parseSui } from "@/lib/sui-format";
import TxLink from "./TxLink";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";
import DisclosureStrip from "./ui/DisclosureStrip";

interface RoyaltyPanelProps {
  artifact: Artifact;
}

type Phase = "idle" | "loading" | "claiming" | "paying" | "done" | "error";

/**
 * Owner-facing royalty controls. Reads the artifact's accrued on-chain revenue
 * vault (getClaimable); lets the owner claim it with their ArtifactCap
 * (claimRevenue); lets anyone pay royalties into the vault (payRoyalty). All
 * amounts are bigint MIST — formatted via lib/sui-format. Currency is SUI.
 */
export default function RoyaltyPanel({ artifact }: RoyaltyPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [claimable, setClaimable] = useState<bigint | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("0.01");

  // Read the artifact's accrued revenue vault on mount (read-only — no signer
  // needed; getClaimable accepts a bare SuiClient bundle).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { makeSuiClient } = await import("@/lib/clients");
        const { getClaimable } = await import("@/lib/royalty");
        const client = makeSuiClient();
        const v = await getClaimable(client, artifact.ipId);
        if (!cancelled) setClaimable(v);
      } catch {
        // Read failed (RPC hiccup) — leave unknown so we don't wrongly block.
        if (!cancelled) setClaimable(null);
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
      const { makeSuiClient } = await import("@/lib/clients");
      const { getClaimable } = await import("@/lib/royalty");
      const client = makeSuiClient();
      const v = await getClaimable(client, artifact.ipId);
      setClaimable(v);
      setPhase("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read claimable.");
      setPhase("error");
    }
  }

  async function handleClaim() {
    setPhase("claiming");
    setError(null);
    setLastTx(null);
    try {
      if (!artifact.capId) {
        throw new Error(
          "No ArtifactCap available for this artifact — only the owner can claim, and the cap id is required.",
        );
      }
      const clients = await getClients();
      const { claimRevenue, NoRoyaltyVaultError } = await import("@/lib/royalty");
      try {
        const out = await claimRevenue(clients, artifact.ipId, artifact.capId);
        setLastTx(out.txHash);
        setClaimable(0n);
        setPhase("done");
      } catch (e) {
        if (e instanceof NoRoyaltyVaultError) {
          setError(e.message);
          setPhase("error");
          return;
        }
        throw e;
      }
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
      let amount: bigint;
      try {
        amount = parseSui(payAmount);
      } catch (pe) {
        throw new Error(pe instanceof Error ? pe.message : "Enter a valid SUI amount.");
      }
      if (amount <= 0n) throw new Error("Amount must be greater than 0.");
      const clients = await getClients();
      const { payRoyalty } = await import("@/lib/royalty");
      const out = await payRoyalty(clients, artifact.ipId, amount);
      setLastTx(out.txHash);
      setPhase("done");
      // Refresh the claimable readout after a successful payment.
      try {
        const { makeSuiClient } = await import("@/lib/clients");
        const { getClaimable } = await import("@/lib/royalty");
        setClaimable(await getClaimable(makeSuiClient(), artifact.ipId));
      } catch {
        /* non-fatal */
      }
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
            {claimable === null ? "—" : formatSui(claimable)}
            <span
              style={{
                marginLeft: 6,
                fontSize: 13,
                color: "var(--ov-text-faint)",
              }}
            >
              SUI
            </span>
          </div>
          <div
            style={{
              fontSize: 11.5,
              color: "var(--ov-text-faint)",
              marginTop: 6,
            }}
          >
            Accrues when someone pays a royalty into this artifact&apos;s
            on-chain vault.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-accent"
          disabled={busy || !artifact.capId || (claimable !== null && claimable <= 0n)}
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
        Pay royalties to this artifact
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
            SUI
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
        Pays native SUI into the artifact&apos;s on-chain revenue vault.
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
