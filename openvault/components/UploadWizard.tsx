"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Artifact, Modality, Tier } from "@/types/artifact";
import type { Clients, UploadMeta } from "@/lib/artifacts";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import { tierMeta } from "@/lib/tiers";
import TierPicker from "./TierPicker";
import OssParentImport from "./OssParentImport";
import TxLink from "./TxLink";
import { TierBadge } from "./ModelCard";

const ALGO_OPTIONS = ["sha256:mean-aggregate", "sha256:logistic-regression"];

type StepId = "artifact" | "details" | "tier" | "lineage" | "review";

interface ParentRef {
  parentIpId: `0x${string}`;
  parentTermsId: string;
  label: string;
}

export default function UploadWizard() {
  const [step, setStep] = useState<StepId>("artifact");

  // Step 1 — Artifact
  const [fileName, setFileName] = useState("");
  const [bytes, setBytes] = useState<Uint8Array | null>(null);
  const [modality, setModality] = useState<Modality>("model");

  // Step 2 — Details
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [creators, setCreators] = useState("");

  // Step 3 — Tier
  const [tier, setTier] = useState<Tier | null>(null);
  const [fee, setFee] = useState("1");
  const [revshare, setRevshare] = useState("5");
  const [allowedAlgoHashes, setAllowedAlgoHashes] = useState<string[]>([]);

  // Step 4 — Lineage
  const [parent, setParent] = useState<ParentRef | null>(null);

  // Submit
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Artifact | null>(null);

  const steps = useMemo<StepId[]>(() => {
    const base: StepId[] = ["artifact", "details", "tier"];
    base.push("lineage"); // lineage offered for both; optional for datasets
    base.push("review");
    return base;
  }, []);

  const stepIndex = steps.indexOf(step);
  const isCompute = tier === "compute";
  const isGated = tier === "gated";

  const canNext = (() => {
    switch (step) {
      case "artifact":
        return !!bytes;
      case "details":
        return title.trim().length > 0 && description.trim().length > 0;
      case "tier":
        if (!tier) return false;
        if (isCompute && allowedAlgoHashes.length === 0) return false;
        return true;
      case "lineage":
        return true; // optional
      default:
        return true;
    }
  })();

  function go(dir: 1 | -1) {
    const next = steps[stepIndex + dir];
    if (next) setStep(next);
  }

  async function handleFile(file: File) {
    const buf = new Uint8Array(await file.arrayBuffer());
    setBytes(buf.byteLength > 0 ? buf : new Uint8Array([0]));
    setFileName(file.name);
  }

  function buildMeta(clients: Clients): UploadMeta {
    const tagList = tags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const names = creators
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const list = names.length ? names : ["Anonymous"];
    return {
      title: title.trim(),
      description: description.trim(),
      tags: tagList,
      modality,
      creators: list.map((name) => ({
        name,
        address: clients.account.address,
        contributionPercent: Math.floor(100 / list.length),
      })),
    };
  }

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);
    try {
      setProgress("Connecting…");
      const clients = await getClients();
      const meta = buildMeta(clients);
      // Thread the user's fee/revshare into the published license terms.
      const { parseEther } = await import("viem");
      let feeWei = 1n;
      try { feeWei = parseEther((fee || "1").trim()); } catch { feeWei = 1n; }
      const rev = Math.min(100, Math.max(0, Number(revshare) || 5));
      const input = { bytes: bytes ?? new Uint8Array([0]), meta, terms: { rev, fee: feeWei } };

      // Dynamic import keeps the node-touching artifacts lib out of the static
      // client bundle (it reaches node:fs/node:crypto at module scope).
      const {
        uploadPublic,
        uploadPrivate,
        uploadGated,
        uploadCompute,
        registerDerivative,
      } = await import("@/lib/artifacts");

      let artifact: Artifact;
      if (parent) {
        setProgress("Registering derivative IP → linking to parent…");
        artifact = await registerDerivative(clients, {
          parentIpId: parent.parentIpId,
          parentTermsId: parent.parentTermsId,
          bytes: input.bytes,
          meta,
        });
      } else if (tier === "public") {
        setProgress("Registering IP → pinning public file…");
        artifact = await uploadPublic(clients, input);
      } else if (tier === "private") {
        setProgress("Registering IP → encrypting to owner vault…");
        artifact = await uploadPrivate(clients, input);
      } else if (tier === "gated") {
        setProgress("Registering IP → encrypting to license-gated vault…");
        artifact = await uploadGated(clients, input);
      } else if (tier === "compute") {
        setProgress("Registering IP → sealing confidential compute vault…");
        artifact = await uploadCompute(clients, {
          ...input,
          allowedAlgoHashes,
        });
      } else {
        throw new Error("Select a tier before submitting.");
      }

      setResult(artifact);
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : friendlyError(e)
      );
    } finally {
      setSubmitting(false);
      setProgress("");
    }
  }

  if (result) {
    return <SuccessScreen artifact={result} />;
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-24">
      <header className="ov-anim-up py-8">
        <span className="inline-flex items-center gap-2 rounded-full border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-[var(--ov-accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--ov-accent)]" />
          Publish
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[var(--ov-text)]">
          Register an artifact
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-[var(--ov-text-dim)]">
          Register the IP first, then encrypt the bytes into a vault gated by
          your chosen tier. The order is enforced — your ipId exists before any
          byte is uploaded.
        </p>
      </header>

      <Stepper steps={steps} current={stepIndex} />

      <div className="ov-anim-up mt-6 rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/50 p-5 sm:p-6">
        {step === "artifact" && (
          <StepArtifact
            fileName={fileName}
            onFile={handleFile}
            modality={modality}
            setModality={setModality}
          />
        )}

        {step === "details" && (
          <StepDetails
            title={title}
            setTitle={setTitle}
            description={description}
            setDescription={setDescription}
            tags={tags}
            setTags={setTags}
            creators={creators}
            setCreators={setCreators}
          />
        )}

        {step === "tier" && (
          <div className="space-y-5">
            <StepHeading
              n={3}
              title="Access tier"
              sub="How is this artifact accessed and monetized?"
            />
            <TierPicker value={tier} onChange={setTier} />

            {(isGated || isCompute) && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/50 p-4 sm:grid-cols-2">
                <Field label="Minting fee (WIP)">
                  <input
                    type="number"
                    min="0"
                    value={fee}
                    onChange={(e) => setFee(e.target.value)}
                    className={inputCls}
                  />
                </Field>
                <Field label="Revenue share (%)">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={revshare}
                    onChange={(e) => setRevshare(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            )}

            {isCompute && (
              <div className="space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ov-text-faint)]">
                  Allowed algorithms
                </span>
                <div className="flex flex-col gap-2">
                  {ALGO_OPTIONS.map((algo) => {
                    const on = allowedAlgoHashes.includes(algo);
                    return (
                      <button
                        key={algo}
                        type="button"
                        onClick={() =>
                          setAllowedAlgoHashes((cur) =>
                            on
                              ? cur.filter((a) => a !== algo)
                              : [...cur, algo]
                          )
                        }
                        className="flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors"
                        style={{
                          borderColor: on
                            ? "color-mix(in oklab, var(--tier-compute) 55%, var(--ov-line))"
                            : "var(--ov-line)",
                          background: on
                            ? "color-mix(in oklab, var(--tier-compute) 10%, transparent)"
                            : "transparent",
                        }}
                      >
                        <Checkbox on={on} color="var(--tier-compute)" />
                        <span className="font-mono text-[12px] text-[var(--ov-text)]">
                          {algo}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-[var(--ov-text-faint)]">
                  Compute-tier data is never downloadable — consumers run only
                  these allowlisted algorithms inside the compute worker (a plain
                  server in this demo; an attested enclave in production).
                </p>
              </div>
            )}
          </div>
        )}

        {step === "lineage" && (
          <StepLineage
            modality={modality}
            parent={parent}
            setParent={setParent}
          />
        )}

        {step === "review" && (
          <StepReview
            fileName={fileName}
            modality={modality}
            title={title}
            description={description}
            tags={tags}
            creators={creators}
            tier={tier}
            fee={fee}
            revshare={revshare}
            allowedAlgoHashes={allowedAlgoHashes}
            parent={parent}
            submitting={submitting}
            progress={progress}
            error={error}
          />
        )}
      </div>

      {/* nav */}
      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => go(-1)}
          disabled={stepIndex === 0 || submitting}
          className="rounded-lg border border-[var(--ov-line)] px-4 py-2 text-[13px] text-[var(--ov-text-dim)] transition-colors hover:text-[var(--ov-text)] disabled:cursor-not-allowed disabled:opacity-30"
        >
          Back
        </button>

        {step === "review" ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !tier}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--ov-accent)] px-5 py-2 text-[13px] font-semibold text-[var(--ov-accent-ink)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? <Spinner ink /> : null}
            {submitting ? "Publishing…" : "Register & upload"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            disabled={!canNext}
            className="rounded-lg bg-[var(--ov-accent)] px-5 py-2 text-[13px] font-semibold text-[var(--ov-accent-ink)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- Steps ----------------------------- */

function StepArtifact({
  fileName,
  onFile,
  modality,
  setModality,
}: {
  fileName: string;
  onFile: (f: File) => void;
  modality: Modality;
  setModality: (m: Modality) => void;
}) {
  return (
    <div className="space-y-5">
      <StepHeading
        n={1}
        title="The artifact"
        sub="Pick the file to register and whether it is a dataset or a model."
      />
      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/40 px-6 py-10 text-center transition-colors hover:border-[var(--ov-accent)]/50">
        <UploadIcon />
        <span className="text-[13px] font-medium text-[var(--ov-text)]">
          {fileName ? fileName : "Choose a file"}
        </span>
        <span className="text-[11.5px] text-[var(--ov-text-faint)]">
          {fileName
            ? "Click to replace"
            : "Any file — it will be read into bytes and encrypted to your vault"}
        </span>
        <input
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
      </label>

      <Field label="Modality">
        <div className="flex gap-2">
          {(["dataset", "model"] as Modality[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModality(m)}
              className="flex-1 rounded-lg border px-4 py-2.5 text-[13px] font-medium capitalize transition-colors"
              style={{
                borderColor:
                  modality === m
                    ? "color-mix(in oklab, var(--ov-accent) 55%, var(--ov-line))"
                    : "var(--ov-line)",
                background:
                  modality === m
                    ? "color-mix(in oklab, var(--ov-accent) 10%, transparent)"
                    : "transparent",
                color:
                  modality === m
                    ? "var(--ov-text)"
                    : "var(--ov-text-dim)",
              }}
            >
              {m}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}

function StepDetails({
  title,
  setTitle,
  description,
  setDescription,
  tags,
  setTags,
  creators,
  setCreators,
}: {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  tags: string;
  setTags: (v: string) => void;
  creators: string;
  setCreators: (v: string) => void;
}) {
  return (
    <div className="space-y-4">
      <StepHeading
        n={2}
        title="Details"
        sub="This metadata is pinned and attached to your IP record."
      />
      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="SentimentLLM-7B"
          className={inputCls}
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="What it is, how it was trained, and what it is good for."
          className={`${inputCls} resize-none`}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Tags (comma-separated)">
          <input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="llm, sentiment, nlp"
            className={inputCls}
          />
        </Field>
        <Field label="Creators (comma-separated)">
          <input
            value={creators}
            onChange={(e) => setCreators(e.target.value)}
            placeholder="Jane Doe, Acme Lab"
            className={inputCls}
          />
        </Field>
      </div>
    </div>
  );
}

function StepLineage({
  modality,
  parent,
  setParent,
}: {
  modality: Modality;
  parent: ParentRef | null;
  setParent: (p: ParentRef | null) => void;
}) {
  const [mode, setMode] = useState<"none" | "onchain" | "oss">("none");

  return (
    <div className="space-y-5">
      <StepHeading
        n={4}
        title="Lineage"
        sub={
          modality === "model"
            ? "Is this derived from an existing artifact? Royalties route upstream per the parent's license terms."
            : "Optional — link an upstream source if this dataset is derived from one."
        }
      />

      {parent ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--ov-accent)]/30 bg-[var(--ov-accent)]/8 px-4 py-3">
          <span className="text-[12px] font-medium text-[var(--ov-accent)]">
            Derived from
          </span>
          <span className="text-[12px] text-[var(--ov-text-dim)]">
            {parent.label}
          </span>
          <TxLink ipId={parent.parentIpId} />
          <button
            type="button"
            onClick={() => {
              setParent(null);
              setMode("none");
            }}
            className="ml-auto text-[12px] text-[var(--ov-text-faint)] underline-offset-2 hover:text-[var(--ov-text)] hover:underline"
          >
            Clear
          </button>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <ModeChip
              active={mode === "none"}
              label="Original work"
              onClick={() => setMode("none")}
            />
            <ModeChip
              active={mode === "onchain"}
              label="Derived from on-platform artifact"
              onClick={() => setMode("onchain")}
            />
            <ModeChip
              active={mode === "oss"}
              label="Derived from OSS source"
              onClick={() => setMode("oss")}
            />
          </div>

          {mode === "onchain" && <ParentSearch onPick={setParent} />}
          {mode === "oss" && (
            <OssParentImport
              onParent={(parentIpId, parentTermsId) =>
                setParent({
                  parentIpId,
                  parentTermsId,
                  label: "OSS provenance parent",
                })
              }
            />
          )}
        </>
      )}
    </div>
  );
}

function ParentSearch({ onPick }: { onPick: (p: ParentRef) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Artifact[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/index?${params.toString()}`);
      const data = (await r.json()) as Artifact[];
      setResults(
        Array.isArray(data) ? data.filter((a) => a.licenseTermsId) : []
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 p-4">
      <div className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          placeholder="Search a parent by title or tag…"
          className={inputCls}
        />
        <button
          type="button"
          onClick={search}
          className="shrink-0 rounded-lg border border-[var(--ov-line)] px-4 text-[13px] text-[var(--ov-text)] transition-colors hover:border-[var(--ov-accent)]"
        >
          {loading ? "…" : "Search"}
        </button>
      </div>
      {results.length > 0 && (
        <ul className="divide-y divide-[var(--ov-line-soft)] overflow-hidden rounded-lg border border-[var(--ov-line-soft)]">
          {results.slice(0, 6).map((a) => (
            <li key={a.ipId}>
              <button
                type="button"
                onClick={() =>
                  onPick({
                    parentIpId: a.ipId,
                    parentTermsId: a.licenseTermsId ?? "",
                    label: a.title,
                  })
                }
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
              >
                <TierBadge tier={a.tier} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--ov-text)]">
                  {a.title}
                </span>
                <span className="font-mono text-[10px] text-[var(--ov-text-faint)]">
                  terms {a.licenseTermsId}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StepReview({
  fileName,
  modality,
  title,
  description,
  tags,
  creators,
  tier,
  fee,
  revshare,
  allowedAlgoHashes,
  parent,
  submitting,
  progress,
  error,
}: {
  fileName: string;
  modality: Modality;
  title: string;
  description: string;
  tags: string;
  creators: string;
  tier: Tier | null;
  fee: string;
  revshare: string;
  allowedAlgoHashes: string[];
  parent: ParentRef | null;
  submitting: boolean;
  progress: string;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <StepHeading
        n={5}
        title="Review & submit"
        sub="Confirm the details. We register the IP, then encrypt and upload."
      />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-xl border border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/40 p-4 sm:grid-cols-2">
        <Row label="File" value={fileName || "—"} />
        <Row label="Modality" value={modality} />
        <Row label="Title" value={title || "—"} />
        <Row
          label="Tier"
          value={
            tier ? (
              <TierBadge tier={tier} />
            ) : (
              <span className="text-[var(--tier-gated)]">Not selected</span>
            )
          }
        />
        <Row label="Tags" value={tags || "—"} />
        <Row label="Creators" value={creators || "Anonymous"} />
        {(tier === "gated" || tier === "compute") && (
          <Row label="Fee / Rev-share" value={`${fee} WIP · ${revshare}%`} />
        )}
        {tier === "compute" && (
          <Row
            label="Algorithms"
            value={
              allowedAlgoHashes.length
                ? allowedAlgoHashes.join(", ")
                : "none"
            }
          />
        )}
        {parent && (
          <Row
            label="Derived from"
            value={
              <span className="inline-flex items-center gap-2">
                {parent.label}
                <TxLink ipId={parent.parentIpId} />
              </span>
            }
          />
        )}
      </dl>

      <p className="text-[12px] leading-relaxed text-[var(--ov-text-dim)] line-clamp-3">
        {description}
      </p>

      {submitting && progress && (
        <div className="flex items-center gap-2.5 rounded-lg border border-[var(--ov-accent)]/30 bg-[var(--ov-accent)]/8 px-3 py-2.5">
          <Spinner />
          <span className="text-[12.5px] text-[var(--ov-text)]">
            {progress}
          </span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-3 py-2.5 text-[12.5px] text-[var(--tier-gated)]">
          {error}
        </div>
      )}
    </div>
  );
}

function SuccessScreen({ artifact }: { artifact: Artifact }) {
  const meta = tierMeta(artifact.tier);
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <div className="ov-anim-up flex flex-col items-center gap-4 text-center">
        <span
          className="grid h-14 w-14 place-items-center rounded-2xl"
          style={{
            background: `color-mix(in oklab, ${meta.color} 16%, transparent)`,
            border: `1px solid color-mix(in oklab, ${meta.color} 40%, transparent)`,
          }}
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke={meta.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--ov-text)]">
          Artifact registered
        </h1>
        <p className="max-w-md text-[13.5px] text-[var(--ov-text-dim)]">
          {artifact.title} is now on-chain and {artifact.tier === "public"
            ? "pinned in the clear"
            : "sealed in its vault"}
          .
        </p>
      </div>

      <div className="ov-anim-up mt-8 space-y-3 rounded-2xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 p-5">
        <div className="flex items-center gap-2">
          <TierBadge tier={artifact.tier} />
          <span className="text-[12px] capitalize text-[var(--ov-text-faint)]">
            {artifact.modality}
          </span>
        </div>
        <Row label="Title" value={artifact.title} />
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-[11px] uppercase tracking-wider text-[var(--ov-text-faint)]">
            IP asset
          </span>
          <TxLink ipId={artifact.ipId} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-24 text-[11px] uppercase tracking-wider text-[var(--ov-text-faint)]">
            Register tx
          </span>
          <TxLink hash={artifact.createdTx} />
        </div>
        {artifact.parentIpId && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-24 text-[11px] uppercase tracking-wider text-[var(--ov-text-faint)]">
              Parent
            </span>
            <TxLink ipId={artifact.parentIpId} />
          </div>
        )}
      </div>

      <div className="ov-anim-up mt-6 flex flex-wrap justify-center gap-3">
        <Link
          href={`/artifact/${artifact.ipId}`}
          className="rounded-lg bg-[var(--ov-accent)] px-5 py-2.5 text-[13px] font-semibold text-[var(--ov-accent-ink)]"
        >
          View artifact
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-[var(--ov-line)] px-5 py-2.5 text-[13px] text-[var(--ov-text-dim)] transition-colors hover:text-[var(--ov-text)]"
        >
          Back to browse
        </Link>
      </div>
    </div>
  );
}

/* --------------------------- Primitives --------------------------- */

const inputCls =
  "w-full rounded-lg border border-[var(--ov-line)] bg-[var(--ov-bg-elev)] px-3 py-2 text-[13px] text-[var(--ov-text)] outline-none placeholder:text-[var(--ov-text-faint)] focus:border-[var(--ov-accent)]";

function Stepper({ steps, current }: { steps: StepId[]; current: number }) {
  const labels: Record<StepId, string> = {
    artifact: "Artifact",
    details: "Details",
    tier: "Tier",
    lineage: "Lineage",
    review: "Review",
  };
  return (
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className="grid h-6 w-6 place-items-center rounded-full border text-[11px] font-semibold transition-colors"
              style={{
                borderColor: active || done ? "var(--ov-accent)" : "var(--ov-line)",
                background: done
                  ? "var(--ov-accent)"
                  : active
                    ? "color-mix(in oklab, var(--ov-accent) 14%, transparent)"
                    : "transparent",
                color: done
                  ? "var(--ov-accent-ink)"
                  : active
                    ? "var(--ov-accent)"
                    : "var(--ov-text-faint)",
              }}
            >
              {done ? "✓" : i + 1}
            </span>
            <span
              className={`text-[12px] ${active ? "text-[var(--ov-text)]" : "text-[var(--ov-text-faint)]"}`}
            >
              {labels[s]}
            </span>
            {i < steps.length - 1 && (
              <span className="mx-1 h-px w-5 bg-[var(--ov-line)]" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StepHeading({
  n,
  title,
  sub,
}: {
  n: number;
  title: string;
  sub: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[11px] text-[var(--ov-accent)]">
          {String(n).padStart(2, "0")}
        </span>
        <h2 className="text-[16px] font-semibold tracking-tight text-[var(--ov-text)]">
          {title}
        </h2>
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--ov-text-dim)]">
        {sub}
      </p>
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
    <label className="block space-y-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-[var(--ov-text-faint)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-24 shrink-0 text-[11px] uppercase tracking-wider text-[var(--ov-text-faint)]">
        {label}
      </dt>
      <dd className="min-w-0 flex-1 text-[13px] capitalize-none text-[var(--ov-text)]">
        {value}
      </dd>
    </div>
  );
}

function ModeChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors"
      style={{
        borderColor: active
          ? "color-mix(in oklab, var(--ov-accent) 45%, transparent)"
          : "var(--ov-line)",
        background: active
          ? "color-mix(in oklab, var(--ov-accent) 14%, transparent)"
          : "transparent",
        color: active ? "var(--ov-accent)" : "var(--ov-text-dim)",
      }}
    >
      {label}
    </button>
  );
}

function Checkbox({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      className="grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors"
      style={{
        borderColor: on ? color : "var(--ov-line)",
        background: on ? color : "transparent",
      }}
    >
      {on && (
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--ov-accent-ink)"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )}
    </span>
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

function UploadIcon() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--ov-accent)"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M12 3v13M7 8l5-5 5 5" />
    </svg>
  );
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/insufficient funds/i.test(msg))
    return "Insufficient funds to cover the transaction. Top up your wallet and try again.";
  if (/user rejected|denied/i.test(msg))
    return "Transaction was rejected in your wallet.";
  return msg || "Something went wrong while publishing.";
}
