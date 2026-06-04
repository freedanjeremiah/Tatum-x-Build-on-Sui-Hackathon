"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Artifact } from "@/types/artifact";
import { TierBadge } from "@/components/ui/TierBadge";
import DisclosureStrip from "@/components/ui/DisclosureStrip";
import Icon from "@/components/ui/Icon";
import Spinner from "@/components/ui/Spinner";
import TxLink from "@/components/TxLink";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";

/**
 * Create a new group bundle by calling lib/group.createGroup with the selected
 * member artifact ids. Lives at /group/new — wallet-gated, surfaces the real tx
 * digest + the shared Group object id (groupId) + GroupCap id on success.
 */
export default function NewGroupPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<`0x${string}`>>(new Set());
  const [phase, setPhase] = useState<"idle" | "creating" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    groupId: string;
    capId: string;
    txHash: string;
  } | null>(null);

  useEffect(() => {
    const ctl = new AbortController();
    fetch("/api/index", { signal: ctl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index ${r.status}`))))
      .then((data: Artifact[]) => {
        if (Array.isArray(data)) setArtifacts(data);
      })
      .catch((e) => {
        if (e?.name !== "AbortError")
          setIndexError(e instanceof Error ? e.message : "index unreachable");
      })
      .finally(() => setLoadingIndex(false));
    return () => ctl.abort();
  }, []);

  // Candidate members: any non-group artifact can be recorded as a group member.
  // On Sui group membership is recorded in the shared Group object (no license
  // terms id is attached to the group).
  const candidates = useMemo(
    () => artifacts.filter((a) => a.tier !== "group"),
    [artifacts],
  );

  function toggleMember(id: `0x${string}`) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreate() {
    if (selectedIds.size === 0) {
      setError("Pick at least one member artifact.");
      setPhase("error");
      return;
    }
    setPhase("creating");
    setError(null);
    try {
      const clients = await getClients();
      const { createGroup } = await import("@/lib/group");
      const out = await createGroup(clients, Array.from(selectedIds));
      setResult({ groupId: out.groupId, capId: out.capId, txHash: out.txHash });
      setPhase("done");

      // Best-effort self-index so /group/<id> resolves immediately on redirect.
      try {
        const memberIds = Array.from(selectedIds);
        await fetch("/api/index", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ipId: out.groupId,
            tier: "group",
            modality: "dataset",
            title: `Group ${out.groupId.slice(0, 6)}…${out.groupId.slice(-4)}`,
            description: `Group bundle of ${memberIds.length} member artifact${memberIds.length === 1 ? "" : "s"}.`,
            tags: ["group"],
            ipMetadataURI: "",
            createdTx: out.txHash,
            groupId: out.groupId,
          }),
        });
        // Tag each member with the new groupId so the group page can find them.
        for (const memberIpId of memberIds) {
          const a = artifacts.find((x) => x.ipId === memberIpId);
          if (!a) continue;
          await fetch("/api/index", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...a, groupId: out.groupId }),
          });
        }
      } catch {
        // Self-index is best-effort — the on-chain group is the truth, the
        // browse view will catch up via the indexer reconciler.
      }
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Create failed.",
      );
      setPhase("error");
    }
  }

  if (result) {
    return (
      <div
        className="container maxw-artifact"
        style={{ paddingTop: 40, paddingBottom: 60 }}
      >
        <div
          className="panel anim-up"
          style={{ padding: 30, textAlign: "center" }}
        >
          <span
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in srgb, var(--tier-group) 16%, transparent)",
              color: "var(--tier-group)",
              border: "1.5px solid var(--tier-group)",
              marginBottom: 14,
            }}
          >
            <Icon name="layers" size={26} />
          </span>
          <h1 className="h1" style={{ fontSize: 28, color: "var(--ov-text)" }}>
            Group registered
          </h1>
          <p
            style={{
              color: "var(--ov-text-dim)",
              marginTop: 8,
            }}
          >
            {selectedIds.size} member artifact{selectedIds.size === 1 ? "" : "s"}{" "}
            recorded on-chain.
          </p>
          <div
            className="panel-soft"
            style={{
              padding: 16,
              marginTop: 22,
              textAlign: "left",
              maxWidth: 480,
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            <Row label="Group object">
              <TxLink ipId={result.groupId} />
            </Row>
            <Row label="Create tx">
              <TxLink hash={result.txHash} />
            </Row>
            <Row label="Group cap">
              <span className="font-mono" style={{ fontSize: 12 }}>
                {result.capId.slice(0, 8)}…{result.capId.slice(-6)}
              </span>
            </Row>
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              justifyContent: "center",
              marginTop: 22,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => router.push(`/group/${result.groupId}`)}
            >
              View group
            </button>
            <Link href="/" className="btn btn-ghost">
              Back to browse
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container maxw-upload"
      style={{ paddingTop: 30, paddingBottom: 60 }}
    >
      <div className="anim-up" style={{ marginBottom: 18 }}>
        <span className="eyebrow">CREATE</span>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(28px,4vw,40px)",
            margin: "10px 0 10px",
            color: "var(--ov-text)",
          }}
        >
          New group bundle
        </h1>
        <p
          style={{
            color: "var(--ov-text-dim)",
            maxWidth: 620,
            margin: 0,
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          Record member artifacts in one shared on-chain Group object. Each
          member keeps its own royalty vault; group revenue is realized by
          claiming each member&apos;s vault via Distribute on the group page.
        </p>
      </div>

      <div
        className="panel anim-up"
        style={{ padding: 24, display: "grid", gap: 22 }}
      >
        <div>
          <span className="field-label">Members</span>
          {loadingIndex ? (
            <div
              className="skeleton"
              style={{ height: 120, borderRadius: 12 }}
            />
          ) : indexError ? (
            <DisclosureStrip tone="gated" icon="flag">
              Could not load candidate artifacts: {indexError}
            </DisclosureStrip>
          ) : candidates.length === 0 ? (
            <DisclosureStrip tone="gated" icon="flag">
              No indexed artifacts available to add as members. Upload at least
              one artifact first.
            </DisclosureStrip>
          ) : (
            <div
              style={{
                display: "grid",
                gap: 8,
                maxHeight: 360,
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {candidates.map((a) => {
                const on = selectedIds.has(a.ipId);
                return (
                  <button
                    key={a.ipId}
                    type="button"
                    onClick={() => toggleMember(a.ipId)}
                    disabled={phase === "creating"}
                    className="panel-soft"
                    style={{
                      padding: "11px 13px",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textAlign: "left",
                      cursor: phase === "creating" ? "default" : "pointer",
                      borderColor: on ? "var(--tier-group)" : "var(--ov-line)",
                    }}
                  >
                    <span
                      style={{
                        width: 16,
                        height: 16,
                        flex: "none",
                        borderRadius: 4,
                        border: `2px solid ${on ? "var(--tier-group)" : "var(--ov-line-ink)"}`,
                        background: on ? "var(--tier-group)" : "transparent",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {on ? (
                        <span style={{ color: "#fff", display: "inline-flex" }}>
                          <Icon name="check" size={11} />
                        </span>
                      ) : null}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 2,
                        }}
                      >
                        <TierBadge tier={a.tier} />
                        <span
                          style={{
                            fontWeight: 600,
                            fontSize: 13,
                            color: "var(--ov-text)",
                          }}
                        >
                          {a.title}
                        </span>
                      </span>
                      <code
                        className="font-mono"
                        style={{
                          fontSize: 11,
                          color: "var(--ov-text-faint)",
                        }}
                      >
                        {a.ipId.slice(0, 8)}…{a.ipId.slice(-6)} · {a.tier}
                      </code>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p
            style={{
              fontSize: 11.5,
              color: "var(--ov-text-faint)",
              margin: "8px 0 0",
            }}
          >
            {selectedIds.size} of {candidates.length} selected.
          </p>
        </div>

        {error ? (
          <DisclosureStrip tone="gated" icon="flag">
            {error}
          </DisclosureStrip>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <Link href="/" className="btn btn-ghost">
            Cancel
          </Link>
          <button
            type="button"
            className="btn"
            style={{
              background: "var(--tier-group)",
              color: "#fff",
              boxShadow: "3px 3px 0 var(--ov-navy)",
            }}
            disabled={
              phase === "creating" || loadingIndex || selectedIds.size === 0
            }
            onClick={handleCreate}
          >
            {phase === "creating" ? <Spinner /> : <Icon name="layers" size={15} />}
            {phase === "creating" ? "Registering…" : "Create group"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
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
        padding: "7px 0",
        borderBottom: "1px solid var(--ov-line-soft)",
      }}
    >
      <span className="meta">{label}</span>
      <span>{children}</span>
    </div>
  );
}
