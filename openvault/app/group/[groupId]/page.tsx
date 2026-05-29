"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import type { Artifact } from "@/types/artifact";
import { tierMeta } from "@/lib/tiers";
import { TierBadge } from "@/components/ModelCard";
import TxLink from "@/components/TxLink";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";

/**
 * Group bundle page. Shows the group artifact + member artifacts, a group license
 * summary with a (mock) subscribe CTA, and a Distribute-royalties action.
 *
 * SPEC §8.7 OPEN ITEM is surfaced prominently: one group license unlocking every
 * member's vault is NOT yet confirmed in CDR — this demo falls back to per-IP
 * gating (each member keeps its own LicenseReadCondition).
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

  // The group artifact is identified by its groupId OR its ipId matching the route.
  const group =
    all.find((a) => a.groupId === groupId || a.ipId === groupId) ??
    all.find((a) => a.tier === "group");

  // Members are the indexed artifacts whose groupId points at this group. No
  // fabrication — if none are indexed yet, the list is honestly empty.
  const groupKey = (group?.groupId ?? group?.ipId) as `0x${string}` | undefined;
  const members = group && groupKey
    ? all.filter((a) => a.groupId === groupKey)
    : [];

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 pt-16">
        <div className="h-40 animate-pulse rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/40" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="mx-auto flex min-h-[55vh] max-w-4xl flex-col items-center justify-center gap-4 px-5 text-center">
        <span className="rounded-full border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--tier-group)]">
          Group
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ov-text)]">
          No group with that ID
        </h1>
        <p className="max-w-md text-[13px] text-[var(--ov-text-dim)]">
          The group{" "}
          <code className="font-mono text-[var(--ov-text-faint)]">{groupId}</code>{" "}
          is not in the index.
        </p>
        <Link
          href="/"
          className="rounded-lg border border-[var(--ov-line)] px-4 py-2 text-[13px] text-[var(--ov-text-dim)] transition-colors hover:text-[var(--ov-text)]"
        >
          Back to browse
        </Link>
      </div>
    );
  }

  const groupIpId = (group.groupId ?? group.ipId) as `0x${string}`;
  const memberIpIds = members.map((m) => m.ipId);

  return (
    <div className="mx-auto max-w-4xl px-5 pb-24">
      {/* breadcrumb */}
      <div className="ov-anim-up flex items-center gap-2 pt-6 text-[12px] text-[var(--ov-text-faint)]">
        <Link href="/" className="transition-colors hover:text-[var(--ov-text)]">
          Browse
        </Link>
        <span>/</span>
        <span className="text-[var(--ov-text-dim)]">group</span>
      </div>

      {/* header */}
      <header className="ov-anim-up mt-4 flex flex-col gap-4 border-b border-[var(--ov-line)] pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <TierBadge tier="group" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--tier-group)]/40 bg-[var(--tier-group)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--tier-group)]">
            {members.length} members · even-split pool
          </span>
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--ov-text)]">
          {group.title}
        </h1>
        <p className="max-w-2xl text-[14px] leading-relaxed text-[var(--ov-text-dim)]">
          {group.description}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <TxLink ipId={groupIpId} label={`group ${truncate(groupIpId)}`} />
          <TxLink hash={group.createdTx} />
        </div>
      </header>

      {/* OPEN ITEM notice — prominent */}
      <OpenItemNotice />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        {/* members */}
        <section className="ov-anim-up space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
            Member artifacts
          </h2>
          <div className="space-y-2.5">
            {members.map((m) => (
              <MemberRow key={m.ipId} artifact={m} />
            ))}
          </div>
        </section>

        {/* sidebar: license + actions */}
        <aside className="ov-anim-up space-y-4">
          <LicenseSummary group={group} />
          <DistributePanel groupIpId={groupIpId} memberIpIds={memberIpIds} />
        </aside>
      </div>
    </div>
  );
}

function MemberRow({ artifact: a }: { artifact: Artifact }) {
  const meta = tierMeta(a.tier);
  return (
    <Link
      href={`/artifact/${a.ipId}`}
      className="group flex items-center gap-3 rounded-xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 p-3.5 transition-colors hover:border-[color-mix(in_oklab,var(--tier-group)_45%,var(--ov-line))]"
    >
      <span
        className="h-9 w-1 shrink-0 rounded-full"
        style={{ background: meta.color }}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-medium text-[var(--ov-text)] group-hover:text-[var(--tier-group)]">
            {a.title}
          </span>
          <TierBadge tier={a.tier} />
        </div>
        <p className="truncate text-[12px] text-[var(--ov-text-dim)]">
          {a.description}
        </p>
      </div>
      <TxLink ipId={a.ipId} />
    </Link>
  );
}

function LicenseSummary({ group }: { group: Artifact }) {
  return (
    <div className="rounded-2xl border border-[var(--tier-group)]/30 bg-[color-mix(in_oklab,var(--tier-group)_6%,var(--ov-panel))] p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
        Group license
      </h2>
      <dl className="space-y-2.5 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--ov-text-faint)]">Reward split</dt>
          <dd className="text-[var(--ov-text)]">Even-split pool</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-[var(--ov-text-faint)]">License terms</dt>
          <dd className="font-mono text-[var(--ov-text-dim)]">
            #{group.licenseTermsId ?? "—"}
          </dd>
        </div>
      </dl>
      <button
        type="button"
        onClick={() =>
          alert(
            "Subscribe mints a group-pool license. Per SPEC §8.7 open item, unlocking member vaults still falls back to per-IP gating."
          )
        }
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all"
        style={{ background: "var(--tier-group)", color: "var(--ov-accent-ink)" }}
      >
        Subscribe to unlock family
      </button>
      <p className="mt-2 text-[11px] leading-relaxed text-[var(--ov-text-faint)]">
        Subscription governs the reward split today. Per the open item below,
        each member vault is still unlocked by its own per-IP license.
      </p>
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
  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">("idle");
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
    <div className="rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/50 p-4">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
        Royalties
      </h2>
      <p className="mb-3 text-[12px] leading-relaxed text-[var(--ov-text-dim)]">
        Collect the group pool and distribute it evenly to all {memberIpIds.length}{" "}
        member IPs.
      </p>
      <button
        type="button"
        onClick={handleDistribute}
        disabled={phase === "running"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--tier-group)]/40 px-4 py-2.5 text-[13px] font-semibold text-[var(--tier-group)] transition-all hover:bg-[var(--tier-group)]/10 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {phase === "running" ? (
          <span
            className="h-3.5 w-3.5 rounded-full border-2 border-[var(--tier-group)]/40 border-t-[var(--tier-group)]"
            style={{ animation: "ov-spin 0.7s linear infinite" }}
          />
        ) : null}
        {phase === "done" ? "Distributed" : "Distribute royalties"}
      </button>

      {phase === "done" && txHash && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-[var(--ov-text-dim)]">
          <span>Distributed</span>
          <TxLink hash={txHash} />
        </div>
      )}
      {phase === "error" && error && (
        <div className="mt-3 rounded-lg border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-3 py-2 text-[12px] text-[var(--tier-gated)]">
          {error}
        </div>
      )}
    </div>
  );
}

function OpenItemNotice() {
  return (
    <div className="ov-anim-up mt-6 rounded-2xl border border-[var(--tier-gated)]/35 bg-[var(--tier-gated)]/[0.07] p-4">
      <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--tier-gated)]">
        <WarnIcon /> Open item · SPEC §8.7
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--ov-text-dim)]">
        One group license unlocking every member&apos;s vault is{" "}
        <span className="font-medium text-[var(--ov-text)]">
          not yet confirmed in CDR
        </span>
        . This demo falls back to per-IP gating: the group governs the reward
        split, but each member vault is still unlocked by its own
        LicenseReadCondition. The subscribe CTA below reflects that fallback.
      </p>
    </div>
  );
}

function truncate(v: string): string {
  return v.length <= 13 ? v : `${v.slice(0, 6)}…${v.slice(-4)}`;
}

function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
