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
 * member IPs and the group's license terms id. Lives at /group/new — wallet-
 * gated, surfaces the real tx hash + groupIpId on success.
 */
export default function NewGroupPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [loadingIndex, setLoadingIndex] = useState(true);
  const [indexError, setIndexError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<`0x${string}`>>(new Set());
  const [termsId, setTermsId] = useState("");
  const [phase, setPhase] = useState<"idle" | "creating" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    groupIpId: `0x${string}`;
    txHash: `0x${string}`;
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

  // Candidate members: anything with a real licenseTermsId can be a member of a
  // group (the group's licence terms are independent, but only commercial-remix
  // artifacts have terms to attach).
  const candidates = useMemo(
    () => artifacts.filter((a) => !!a.licenseTermsId && a.tier !== "group"),
    [artifacts],
  );

  // Suggest the first candidate's terms id when nothing is set yet.
  useEffect(() => {
    if (!termsId && candidates.length > 0 && candidates[0].licenseTermsId) {
      setTermsId(candidates[0].licenseTermsId);
    }
  }, [candidates, termsId]);

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
      setError("Pick at least one member IP.");
      setPhase("error");
      return;
    }
    if (!termsId.trim()) {
      setError("Group requires a license terms id.");
      setPhase("error");
      return;
    }
    setPhase("creating");
    setError(null);
    try {
      const clients = await getClients();
      const { createGroup } = await import("@/lib/group");
      const out = await createGroup(clients.story, {
        ipIds: Array.from(selectedIds),
        termsId: termsId.trim(),
      });
      setResult({ groupIpId: out.groupIpId, txHash: out.txHash });
      setPhase("done");

      // Best-effort self-index so /group/<id> resolves immediately on redirect.
      try {
        const memberIds = Array.from(selectedIds);
        await fetch("/api/index", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ipId: out.groupIpId,
            tier: "group",
            modality: "dataset",
            title: `Group ${out.groupIpId.slice(0, 6)}…${out.groupIpId.slice(-4)}`,
            description: `Group bundle of ${memberIds.length} member IP${memberIds.length === 1 ? "" : "s"}.`,
            tags: ["group"],
            ipMetadataURI: "",
            createdTx: out.txHash,
            groupId: out.groupIpId,
            licenseTermsId: termsId.trim(),
          }),
        });
        // Tag each member with the new groupId so the group page can find them.
        for (const memberIpId of memberIds) {
          const a = artifacts.find((x) => x.ipId === memberIpId);
          if (!a) continue;
          await fetch("/api/index", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ...a, groupId: out.groupIpId }),
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
            {selectedIds.size} member IP{selectedIds.size === 1 ? "" : "s"} bound
            on-chain.
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
            <Row label="Group IP">
              <TxLink ipId={result.groupIpId} />
            </Row>
            <Row label="Register tx">
              <TxLink hash={result.txHash} />
            </Row>
            <Row label="Group terms">
              <span className="font-mono" style={{ fontSize: 12 }}>
                #{termsId}
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
              onClick={() => router.push(`/group/${result.groupIpId}`)}
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
          Bind member IPs into one group artifact with an even-split reward pool.
          A reader who mints any member&apos;s license unlocks every group-gated
          vault. The deployed{" "}
          <code className="font-mono">GroupLicenseReadCondition</code> enforces
          this on-chain (spec §8.7).
        </p>
      </div>

      <div
        className="panel anim-up"
        style={{ padding: 24, display: "grid", gap: 22 }}
      >
        <Field label="Group license terms id">
          <input
            className="input mono"
            value={termsId}
            onChange={(e) => setTermsId(e.target.value)}
            placeholder="e.g. 2553"
            disabled={phase === "creating"}
          />
          <p
            style={{
              fontSize: 11.5,
              color: "var(--ov-text-faint)",
              margin: "6px 0 0",
            }}
          >
            Pre-filled from the first selectable artifact. Must be a real
            commercial-remix terms id already attached to an IP on Story.
          </p>
        </Field>

        <div>
          <span className="field-label">Members</span>
          {loadingIndex ? (
            <div
              className="skeleton"
              style={{ height: 120, borderRadius: 12 }}
            />
          ) : indexError ? (
            <DisclosureStrip tone="gated" icon="flag">
              Could not load candidate IPs: {indexError}
            </DisclosureStrip>
          ) : candidates.length === 0 ? (
            <DisclosureStrip tone="gated" icon="flag">
              No indexed IPs with a license terms id available. Upload at least
              one gated/compute artifact first.
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
                        {a.ipId.slice(0, 8)}…{a.ipId.slice(-6)} · terms #
                        {a.licenseTermsId}
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
              phase === "creating" ||
              loadingIndex ||
              selectedIds.size === 0 ||
              !termsId.trim()
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span className="field-label">{label}</span>
      {children}
    </label>
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
