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
  const memberIpIds = members.map((m) => m.ipId);

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

          <DistributePanel
            groupIpId={groupIpId}
            memberIpIds={memberIpIds}
          />

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
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canSubscribe = !!group.licenseTermsId;

  async function handleSubscribe() {
    if (!group.licenseTermsId) return;
    setPhase("minting");
    setError(null);
    setTokenId(null);
    try {
      const clients = await getClients();
      const { mintLicense } = await import("@/lib/licensing");
      // 10 WIP cap — explicit ceiling. Actual fee is whatever the group's
      // license terms charge on-chain; if higher than this cap, the mint
      // reverts loudly. No silent default.
      const { parseEther } = await import("viem");
      const id = await mintLicense(
        clients.story,
        group.ipId,
        group.licenseTermsId,
        parseEther("10"),
      );
      setTokenId(id.toString());
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
        Mints one license token against the group&apos;s terms. Vaults gated by
        the deployed <code className="font-mono">GroupLicenseReadCondition</code>{" "}
        will accept this token as <code className="font-mono">accessAuxData</code>{" "}
        for ANY member.
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
      {!canSubscribe ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="gated" icon="flag">
            This group has no license terms id indexed — subscribe is disabled
            until a terms id is attached to the group.
          </DisclosureStrip>
        </div>
      ) : null}
      {phase === "done" && tokenId ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="public" icon="check">
            License token #
            <span className="font-mono" style={{ fontSize: 12 }}>{tokenId}</span>{" "}
            minted. Present it as accessAuxData on any member vault to unlock.
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
          §8.7 wired: GROUP_LICENSE_READ_CONDITION is deployed and member vaults
          accept any holder of a valid license on the group&apos;s terms. If a
          specific member was sealed under per-IP gating, that fallback still
          applies.
        </DisclosureStrip>
      </div>
      {group.licenseTermsId ? (
        <div
          className="meta"
          style={{
            marginTop: 12,
            color: "var(--ov-text-faint)",
            textAlign: "right",
          }}
        >
          terms #{group.licenseTermsId}
        </div>
      ) : null}
    </div>
  );
}

function DistributePanel({
  groupIpId,
  memberIpIds,
}: {
  groupIpId: `0x${string}`;
  memberIpIds: `0x${string}`[];
}) {
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDistribute() {
    setError(null);
    setPhase("running");
    try {
      const clients = await getClients();
      const { distribute } = await import("@/lib/group");
      const res = await distribute(clients.story, { groupIpId, memberIpIds });
      setTxHash(res.txHash);
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
        Collect the group pool and distribute it evenly to all{" "}
        {memberIpIds.length} member IPs.
      </p>
      <button
        type="button"
        className="btn btn-ghost"
        style={{
          width: "100%",
          color: "var(--tier-group)",
          borderColor: "var(--tier-group)",
        }}
        disabled={phase === "running" || memberIpIds.length === 0}
        onClick={handleDistribute}
      >
        {phase === "running" ? <Spinner /> : null}
        {phase === "done" ? "Distributed" : "Distribute royalties"}
      </button>

      {phase === "done" && txHash ? (
        <div style={{ marginTop: 12 }}>
          <DisclosureStrip tone="public" icon="check">
            Distributed <TxLink hash={txHash} />
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
