"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Artifact } from "@/types/artifact";
import ModelCard from "@/components/ModelCard";
import TxLink from "@/components/TxLink";
import DisclosureStrip from "@/components/ui/DisclosureStrip";
import Icon from "@/components/ui/Icon";
import Spinner from "@/components/ui/Spinner";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import { formatSui } from "@/lib/sui-format";

/**
 * Group bundle page. Shows the group artifact + member artifacts, a group
 * license summary with a subscribe CTA, and a Distribute-royalties action.
 *
 * SPEC §8.7 OPEN ITEM is surfaced prominently: one group license unlocking
 * every member's vault is NOT yet confirmed in CDR — this demo falls back to
 * per-IP gating.
 */
export default function GroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = use(params);
  const [all, setAll] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/index", { signal: controller.signal })
      .then((r) => r.json())
      .then((data: Artifact[]) => {
        if (Array.isArray(data)) setAll(data);
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setAll([]);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const group =
    all.find((a) => a.groupId === groupId || a.ipId === groupId) ??
    all.find((a) => a.tier === "group");

  const groupKey = (group?.groupId ?? group?.ipId) as `0x${string}` | undefined;
  const members =
    group && groupKey ? all.filter((a) => a.groupId === groupKey) : [];

  if (loading) {
    return (
      <div
        className="container maxw-artifact"
        style={{ paddingTop: 60, paddingBottom: 60 }}
      >
        <div className="skeleton" style={{ height: 200, borderRadius: 18 }} />
      </div>
    );
  }

  if (!group) {
    return (
      <div
        className="container maxw-artifact"
        style={{ paddingTop: 60, paddingBottom: 60 }}
      >
        <div
          style={{
            border: "2px dashed var(--ov-line-ink)",
            borderRadius: 18,
            padding: "52px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            background: "color-mix(in srgb, var(--ov-panel) 50%, transparent)",
          }}
        >
          <span style={{ color: "var(--ov-text-faint)" }}>
            <Icon name="search" size={30} />
          </span>
          <div
            className="font-display"
            style={{
              fontSize: 22,
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--ov-text)",
            }}
          >
            No group with that ID
          </div>
          <p
            style={{
              margin: 0,
              color: "var(--ov-text-dim)",
              fontSize: 13,
              maxWidth: 420,
            }}
          >
            The id{" "}
            <code className="font-mono" style={{ fontSize: 12 }}>
              {groupId}
            </code>{" "}
            does not resolve to a group bundle in the index.
          </p>
          <Link href="/" className="btn btn-accent" style={{ marginTop: 6 }}>
            Back to browse
          </Link>
        </div>
      </div>
    );
  }

  const groupIpId = (group.groupId ?? group.ipId) as `0x${string}`;

  return (
    <div
      className="container maxw-browse"
      style={{ paddingTop: 26, paddingBottom: 60 }}
    >
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <Link href="/" style={{ color: "var(--ov-text-faint)" }}>
          Browse
        </Link>{" "}
        / group
      </div>

      <div className="ov-detail-grid">
        <div style={{ display: "grid", gap: 22, alignContent: "start" }}>
          <div className="anim-up" style={{ animationDelay: "40ms" }}>
            <span
              className="chip"
              style={{
                color: "var(--tier-group)",
                borderColor: "var(--tier-group)",
              }}
            >
              <span
                className="tier-dot"
                style={{ background: "var(--tier-group)" }}
              />
              Group · {members.length} member{members.length === 1 ? "" : "s"}
            </span>
            <h1
              className="h1"
              style={{
                fontSize: "clamp(28px,4vw,40px)",
                margin: "14px 0 12px",
                color: "var(--ov-text)",
              }}
            >
              {group.title}
            </h1>
            <p
              style={{
                maxWidth: 600,
                fontSize: 14.5,
                color: "var(--ov-text-dim)",
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {group.description}
            </p>
          </div>

          <AccessPanel group={group} />

          <DistributePanel members={members} />

          <div>
            <div
              className="meta"
              style={{
                margin: "4px 0 14px",
                color: "var(--ov-text-faint)",
              }}
            >
              {members.length} MEMBER{members.length === 1 ? "" : "S"}
            </div>
            {members.length === 0 ? (
              <p
                style={{
                  color: "var(--ov-text-dim)",
                  fontSize: 13,
                }}
              >
                No member artifacts indexed under this group yet.
              </p>
            ) : (
              <div className="ov-grid">
                {members.map((a) => (
                  <ModelCard key={a.ipId} artifact={a} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* sidebar */}
        <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
          <div className="panel" style={{ padding: 18 }}>
            <div className="meta" style={{ marginBottom: 8 }}>
              Provenance
            </div>
            <ProvRow label="Group IP">
              <TxLink ipId={groupIpId} />
            </ProvRow>
            <ProvRow label="Created">
              <TxLink hash={group.createdTx} />
            </ProvRow>
            {group.licenseTermsId ? (
              <ProvRow label="License terms">
                <span
                  className="font-mono"
                  style={{ fontSize: 12, color: "var(--ov-text)" }}
                >
                  #{group.licenseTermsId}
                </span>
              </ProvRow>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessPanel({ group }: { group: Artifact }) {
  const [phase, setPhase] = useState<"idle" | "minting" | "done" | "error">(
    "idle",
  );
  const [txDigest, setTxDigest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSubscribe = true;

  async function handleSubscribe() {
    setPhase("minting");
    setError(null);
    setTxDigest(null);
    try {
      const clients = await getClients();
      const { mintLicense } = await import("@/lib/licensing");
      // Buy a license against the group object. No explicit price → mintLicense
      // reads the group's on-chain price and pays exactly that (no fake default;
      // a mismatch aborts loudly on-chain). This adds the buyer to the group's
      // license_holders, satisfying seal_approve for the group tier.
      const out = await mintLicense(clients, group.ipId);
      setTxDigest(out.digest);
      setPhase("done");
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Subscribe failed.",
      );
      setPhase("error");
    }
  }

  return (
    <div
      className="panel"
      style={{
        padding: 20,
        borderColor:
          "color-mix(in srgb, var(--tier-group) 45%, var(--ov-line-ink))",
        background: "color-mix(in srgb, var(--tier-group) 6%, var(--ov-panel))",
      }}
    >
      <div
        className="h2"
        style={{
          fontSize: 16,
          marginBottom: 6,
          color: "var(--ov-text)",
        }}
      >
        Access
      </div>
      <p
        style={{
          fontSize: 13,
          color: "var(--ov-text-dim)",
          marginTop: 0,
        }}
      >
        Buys a license on the group object at its on-chain price (native SUI).
        This adds your wallet to the group&apos;s on-chain license holders, which
        the Move <code className="font-mono">seal_approve</code> policy checks to
        unlock the group-gated vaults.
      </p>
      <button
        type="button"
        className="btn"
        style={{
          width: "100%",
          background: "var(--tier-group)",
          color: "#fff",
          boxShadow: "3px 3px 0 var(--ov-navy)",
          opacity: canSubscribe ? 1 : 0.55,
          cursor: canSubscribe ? "pointer" : "not-allowed",
        }}
        disabled={!canSubscribe || phase === "minting"}
        onClick={handleSubscribe}
      >
        {phase === "minting" ? <Spinner /> : <Icon name="key" size={15} />}
        {phase === "minting" ? "Minting…" : "Subscribe to unlock family"}
      </button>
      {phase === "done" && txDigest ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="public" icon="check">
            License acquired. <TxLink hash={txDigest} /> Your wallet is now in the
            group&apos;s on-chain license holders.
          </DisclosureStrip>
        </div>
      ) : null}
      {phase === "error" && error ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="gated" icon="flag">
            {error}
          </DisclosureStrip>
        </div>
      ) : null}
      <div style={{ marginTop: 14 }}>
        <DisclosureStrip tone="public" icon="shield">
          Group access on Sui is gated by the member&apos;s own
          <code className="font-mono"> license_holders</code> + group binding
          (set via the artifact cap). Members sealed under per-IP gating keep that
          fallback.
        </DisclosureStrip>
      </div>
    </div>
  );
}

function DistributePanel({
  members,
}: {
  members: Artifact[];
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [totalClaimed, setTotalClaimed] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  // distribute() claims each member's OWN royalty vault, which is owner-gated by
  // that member's ArtifactCap. We can only drive it for members whose capId is
  // present in the index (i.e. members the connected wallet registered). Members
  // without a known capId are skipped honestly — no fake cap.
  const claimable = members.filter((m) => !!m.capId);

  async function handleDistribute() {
    setError(null);
    setPhase("running");
    setTotalClaimed(null);
    try {
      const clients = await getClients();
      const { distribute } = await import("@/lib/group");
      const pairs = claimable.map((m) => ({
        artifactId: m.ipId as string,
        capId: m.capId as string,
      }));
      const res = await distribute(clients, pairs);
      setTotalClaimed(res.totalClaimed);
      setPhase("done");
    } catch (e) {
      if (e instanceof WalletNotConnectedError) setError(e.message);
      else setError(e instanceof Error ? e.message : "Distribution failed.");
      setPhase("error");
    }
  }

  return (
    <div className="panel" style={{ padding: 20 }}>
      <div
        className="h2"
        style={{
          fontSize: 16,
          marginBottom: 8,
          color: "var(--ov-text)",
        }}
      >
        Royalties
      </div>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--ov-text-dim)",
          marginTop: 0,
        }}
      >
        On Sui each member keeps its own royalty vault. Distribute claims every
        member vault for which the owner&apos;s ArtifactCap is known
        ({claimable.length} of {members.length} member
        {members.length === 1 ? "" : "s"}).
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        style={{
          width: "100%",
          color: "var(--tier-group)",
          borderColor: "var(--tier-group)",
        }}
        disabled={phase === "running" || claimable.length === 0}
        onClick={handleDistribute}
      >
        {phase === "running" ? <Spinner /> : null}
        {phase === "done" ? "Distributed" : "Distribute royalties"}
      </button>

      {claimable.length === 0 ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="gated" icon="flag">
            No member ArtifactCaps are available in the index, so no member vault
            can be claimed from here. Each member&apos;s owner must claim their own
            vault (claim_revenue is cap-gated).
          </DisclosureStrip>
        </div>
      ) : null}
      {phase === "done" && totalClaimed !== null ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="public" icon="check">
            Distributed {formatSui(totalClaimed)} SUI across{" "}
            {claimable.length} member vault{claimable.length === 1 ? "" : "s"}.
          </DisclosureStrip>
        </div>
      ) : null}
      {phase === "error" && error ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="gated" icon="flag">
            {error}
          </DisclosureStrip>
        </div>
      ) : null}
    </div>
  );
}

function ProvRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10,
        padding: "9px 0",
        borderBottom: "1px solid var(--ov-line-soft)",
      }}
    >
      <span className="meta" style={{ color: "var(--ov-text-faint)" }}>
        {label}
      </span>
      <span style={{ textAlign: "right" }}>{children}</span>
    </div>
  );
}
