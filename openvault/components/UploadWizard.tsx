"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Artifact, Modality, Tier } from "@/types/artifact";
import type { Clients, UploadMeta } from "@/lib/artifacts";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import { tierMeta } from "@/lib/tiers";
import TierPicker from "./TierPicker";
import OssParentImport from "./OssParentImport";
import TxLink from "./TxLink";
import { ModalityChip, TierBadge } from "./ui/TierBadge";
import DisclosureStrip from "./ui/DisclosureStrip";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

const ALGO_OPTIONS = ["sha256:mean-aggregate", "sha256:logistic-regression"];

type StepId = "artifact" | "details" | "tier" | "lineage" | "review";

const STEP_LABEL: Record<StepId, string> = {
  artifact: "Artifact",
  details: "Details",
  tier: "Tier",
  lineage: "Lineage",
  review: "Review",
};

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

  const steps = useMemo<StepId[]>(
    () => ["artifact", "details", "tier", "lineage", "review"],
    [],
  );
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
        return true;
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
      const { parseEther } = await import("viem");
      let feeWei = 1n;
      try {
        feeWei = parseEther((fee || "1").trim());
      } catch {
        feeWei = 1n;
      }
      const rev = Math.min(100, Math.max(0, Number(revshare) || 5));
      const input = {
        bytes: bytes ?? new Uint8Array([0]),
        meta,
        terms: { rev, fee: feeWei },
      };

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

      setProgress("Indexing artifact…");
      try {
        await postArtifactToIndex(artifact);
      } catch (idxErr) {
        // eslint-disable-next-line no-console
        console.warn("[upload] self-index failed:", idxErr);
      }

      setResult(artifact);
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError ? e.message : friendlyError(e),
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
    <div
      className="container maxw-upload"
      style={{ paddingTop: 30, paddingBottom: 60 }}
    >
      <div className="anim-up" style={{ marginBottom: 22 }}>
        <span className="eyebrow">PUBLISH</span>
        <h1
          className="h1"
          style={{
            fontSize: "clamp(28px,4vw,40px)",
            margin: "10px 0 10px",
            color: "var(--ov-text)",
          }}
        >
          Register an artifact
        </h1>
        <p
          style={{
            color: "var(--ov-text-dim)",
            maxWidth: 540,
            fontSize: 14,
            margin: 0,
          }}
        >
          We register the IP first, then encrypt. Your{" "}
          <span className="font-mono" style={{ fontSize: 12.5 }}>
            ipId
          </span>{" "}
          exists before any byte is uploaded.
        </p>
      </div>

      <div className="panel" style={{ padding: 24 }}>
        <Stepper steps={steps} current={stepIndex} />

        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <span
            className="font-mono"
            style={{ color: "var(--ov-accent)", fontSize: 13 }}
          >
            {String(stepIndex + 1).padStart(2, "0")}
          </span>
          <span
            className="h2"
            style={{ fontSize: 16, color: "var(--ov-text)" }}
          >
            {STEP_LABEL[step]}
          </span>
        </div>

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
          <StepTier
            tier={tier}
            setTier={setTier}
            fee={fee}
            setFee={setFee}
            revshare={revshare}
            setRevshare={setRevshare}
            allowedAlgoHashes={allowedAlgoHashes}
            setAllowedAlgoHashes={setAllowedAlgoHashes}
          />
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
          />
        )}

        {submitting && progress ? (
          <div className="anim-up" style={{ marginTop: 18 }}>
            <DisclosureStrip tone="compute" icon="bolt">
              {progress}
            </DisclosureStrip>
          </div>
        ) : null}
        {error ? (
          <div style={{ marginTop: 16 }}>
            <DisclosureStrip tone="gated" icon="flag">
              {error}
            </DisclosureStrip>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 26,
          }}
        >
          <button
            type="button"
            className="btn btn-ghost"
            disabled={stepIndex === 0 || submitting}
            onClick={() => go(-1)}
          >
            Back
          </button>
          {step !== "review" ? (
            <button
              type="button"
              className="btn btn-accent"
              disabled={!canNext}
              onClick={() => go(1)}
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-accent"
              disabled={submitting || !tier}
              style={{ minWidth: 200 }}
              onClick={handleSubmit}
            >
              {submitting ? <Spinner /> : null}
              {submitting ? "Publishing…" : "Register & upload"}
            </button>
          )}
        </div>
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        style={{
          border: `2px dashed ${over ? "var(--ov-accent)" : "var(--ov-line-ink)"}`,
          borderRadius: 16,
          padding: "34px 20px",
          textAlign: "center",
          cursor: "pointer",
          background: over
            ? "color-mix(in srgb, var(--ov-accent) 7%, var(--ov-panel))"
            : "var(--ov-panel)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          transition: "all .14s",
        }}
      >
        <input
          ref={inputRef}
          type="file"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
          }}
        />
        <span
          style={{
            color: fileName ? "var(--tier-public)" : "var(--ov-text-faint)",
          }}
        >
          <Icon name={fileName ? "check" : "upload"} size={28} />
        </span>
        {fileName ? (
          <div className="font-mono" style={{ fontSize: 13, color: "var(--ov-text)" }}>
            {fileName}
          </div>
        ) : (
          <div style={{ alignSelf: "stretch", textAlign: "center" }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ov-text)" }}>
              Choose a file
            </div>
            <div
              style={{ fontSize: 12, color: "var(--ov-text-faint)", marginTop: 4 }}
            >
              or drag it here — bytes are encrypted client-side after the IP is registered
            </div>
          </div>
        )}
      </div>

      <Field label="Modality">
        <div style={{ display: "flex", gap: 8 }}>
          {(["dataset", "model"] as Modality[]).map((m) => {
            const on = modality === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setModality(m)}
                className="btn"
                style={{
                  flex: 1,
                  background: on ? "var(--ov-navy)" : "var(--ov-panel)",
                  color: on ? "var(--ov-accent-ink)" : "var(--ov-text-dim)",
                  border: `1.5px solid ${on ? "var(--ov-navy)" : "var(--ov-line)"}`,
                }}
              >
                {m === "dataset" ? "Dataset" : "Model"}
              </button>
            );
          })}
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
    <div style={{ display: "grid", gap: 14 }}>
      <Field label="Title">
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="SentimentLLM-7B"
        />
      </Field>
      <Field label="Description">
        <textarea
          className="textarea"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What it is, how it was built, intended use…"
        />
      </Field>
      <Field label="Tags (comma-separated)">
        <input
          className="input"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="llm, sentiment, nlp"
        />
      </Field>
      <Field label="Creators (comma-separated)">
        <input
          className="input"
          value={creators}
          onChange={(e) => setCreators(e.target.value)}
          placeholder="Jane Doe, Acme Lab"
        />
      </Field>
    </div>
  );
}

function StepTier({
  tier,
  setTier,
  fee,
  setFee,
  revshare,
  setRevshare,
  allowedAlgoHashes,
  setAllowedAlgoHashes,
}: {
  tier: Tier | null;
  setTier: (t: Tier) => void;
  fee: string;
  setFee: (v: string) => void;
  revshare: string;
  setRevshare: (v: string) => void;
  allowedAlgoHashes: string[];
  setAllowedAlgoHashes: (
    update: string[] | ((prev: string[]) => string[]),
  ) => void;
}) {
  const isCompute = tier === "compute";
  const isGated = tier === "gated";
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <TierPicker value={tier} onChange={setTier} />

      {(isCompute || isGated) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 12,
          }}
        >
          <Field label="Minting fee (WIP)">
            <input
              className="input mono"
              inputMode="decimal"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="5.0"
            />
          </Field>
          <Field label="Revenue share (%)">
            <input
              className="input mono"
              inputMode="numeric"
              value={revshare}
              onChange={(e) => setRevshare(e.target.value)}
              placeholder="8"
            />
          </Field>
        </div>
      )}

      {isCompute && (
        <div>
          <div className="meta" style={{ marginBottom: 8 }}>
            Algorithm allowlist
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {ALGO_OPTIONS.map((al) => {
              const on = allowedAlgoHashes.includes(al);
              return (
                <button
                  key={al}
                  type="button"
                  className="chip"
                  onClick={() =>
                    setAllowedAlgoHashes((cur) =>
                      on ? cur.filter((h) => h !== al) : [...cur, al],
                    )
                  }
                  style={{
                    cursor: "pointer",
                    padding: "8px 12px",
                    textTransform: "none",
                    letterSpacing: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11.5,
                    borderColor: on ? "var(--tier-compute)" : "var(--ov-line)",
                    color: on ? "var(--tier-compute)" : "var(--ov-text-dim)",
                    background: on
                      ? "color-mix(in srgb, var(--tier-compute) 12%, transparent)"
                      : "var(--ov-panel)",
                  }}
                >
                  <Icon name={on ? "check" : "plus"} size={12} />
                  {al}
                </button>
              );
            })}
          </div>
          <p
            style={{
              fontSize: 12,
              color: "var(--ov-text-faint)",
              marginTop: 10,
            }}
          >
            Compute data is never downloadable — only allowlisted aggregates
            ever leave the worker.
          </p>
        </div>
      )}
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
    <div style={{ display: "grid", gap: 16 }}>
      {parent ? (
        <DisclosureStrip tone="public" icon="check">
          Derived from <strong>{parent.label}</strong>{" "}
          <TxLink ipId={parent.parentIpId} />
          <div style={{ marginTop: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setParent(null);
                setMode("none");
              }}
            >
              Clear
            </button>
          </div>
        </DisclosureStrip>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { k: "none" as const, label: "Original work" },
              { k: "onchain" as const, label: "Derived from on-platform artifact" },
              { k: "oss" as const, label: "Derived from OSS source" },
            ].map((m) => {
              const on = mode === m.k;
              return (
                <button
                  key={m.k}
                  type="button"
                  className="chip"
                  onClick={() => setMode(m.k)}
                  style={{
                    cursor: "pointer",
                    padding: "8px 13px",
                    textTransform: "none",
                    letterSpacing: 0,
                    fontFamily: "var(--font-sans)",
                    fontSize: 12.5,
                    fontWeight: 600,
                    borderColor: on ? "var(--ov-accent)" : "var(--ov-line)",
                    color: on ? "var(--ov-accent)" : "var(--ov-text-dim)",
                    background: on
                      ? "color-mix(in srgb, var(--ov-accent) 10%, transparent)"
                      : "var(--ov-panel)",
                  }}
                >
                  {m.label}
                </button>
              );
            })}
          </div>

          {mode === "none" && (
            <p style={{ fontSize: 13, color: "var(--ov-text-dim)" }}>
              This artifact is registered as an original work — no parent IP
              will be linked. {modality === "model" ? "Models" : "Datasets"} can
              still be cited later as parents of downstream derivatives.
            </p>
          )}
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
        Array.isArray(data) ? data.filter((a) => a.licenseTermsId) : [],
      );
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Field label="Search on-platform artifacts">
        <div style={{ display: "flex", gap: 8 }}>
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Search by title…"
          />
          <button
            type="button"
            className="btn btn-ghost"
            onClick={search}
            style={{ flex: "none" }}
          >
            {loading ? <Spinner /> : <Icon name="search" size={14} />}
            Search
          </button>
        </div>
      </Field>
      {results.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          {results.slice(0, 6).map((a) => (
            <button
              key={a.ipId}
              type="button"
              className="panel-soft"
              onClick={() =>
                onPick({
                  parentIpId: a.ipId,
                  parentTermsId: a.licenseTermsId ?? "",
                  label: a.title,
                })
              }
              style={{
                padding: 12,
                display: "flex",
                alignItems: "center",
                gap: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <TierBadge tier={a.tier} />
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "var(--ov-text)",
                  flex: 1,
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {a.title}
              </span>
              {a.licenseTermsId ? (
                <span
                  className="font-mono"
                  style={{ fontSize: 11, color: "var(--ov-text-faint)" }}
                >
                  #{a.licenseTermsId}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
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
}) {
  const showFee = tier === "gated" || tier === "compute";
  return (
    <div>
      <dl style={{ margin: 0 }}>
        <ReviewRow label="File">
          <span className="font-mono">{fileName || "—"}</span>
        </ReviewRow>
        <ReviewRow label="Modality">
          {modality === "model" ? "Model" : "Dataset"}
        </ReviewRow>
        <ReviewRow label="Title">{title || "—"}</ReviewRow>
        <ReviewRow label="Tier">
          {tier ? (
            <TierBadge tier={tier} />
          ) : (
            <span style={{ color: "var(--tier-gated)" }}>Not selected</span>
          )}
        </ReviewRow>
        <ReviewRow label="Tags">{tags || "—"}</ReviewRow>
        <ReviewRow label="Creators">{creators || "Anonymous"}</ReviewRow>
        {showFee ? (
          <ReviewRow label="Fee · Rev-share">
            <span className="font-mono">
              {fee || "0"} WIP · {revshare || "0"}%
            </span>
          </ReviewRow>
        ) : null}
        {tier === "compute" ? (
          <ReviewRow label="Algorithms">
            <span className="font-mono" style={{ fontSize: 11.5 }}>
              {allowedAlgoHashes.length
                ? allowedAlgoHashes.join(", ")
                : "—"}
            </span>
          </ReviewRow>
        ) : null}
        {parent ? (
          <ReviewRow label="Derived from">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              {parent.label}
              <TxLink ipId={parent.parentIpId} />
            </span>
          </ReviewRow>
        ) : null}
      </dl>
      <p
        className="clamp-3"
        style={{
          fontSize: 13,
          color: "var(--ov-text-dim)",
          marginTop: 14,
          lineHeight: 1.6,
        }}
      >
        {description || "No description provided."}
      </p>
    </div>
  );
}

function SuccessScreen({ artifact }: { artifact: Artifact }) {
  const t = tierMeta(artifact.tier);
  const sealed = artifact.tier !== "public";
  return (
    <div
      className="container maxw-upload"
      style={{ paddingTop: 30, paddingBottom: 60 }}
    >
      <div className="panel anim-up" style={{ padding: 34, textAlign: "center" }}>
        <span
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            background: `color-mix(in srgb, ${t.color} 16%, transparent)`,
            color: t.color,
            border: `1.5px solid ${t.color}`,
            marginBottom: 16,
          }}
        >
          <Icon name="check" size={28} />
        </span>
        <h1 className="h1" style={{ fontSize: 30, color: "var(--ov-text)" }}>
          Artifact registered
        </h1>
        <p style={{ color: "var(--ov-text-dim)", marginTop: 10 }}>
          <strong>{artifact.title}</strong> is now on-chain and{" "}
          {sealed ? "sealed in its vault" : "pinned in the clear"}.
        </p>
        <div
          className="panel-soft"
          style={{
            padding: 16,
            marginTop: 22,
            textAlign: "left",
            maxWidth: 460,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 4,
            }}
          >
            <TierBadge tier={artifact.tier} />
            <ModalityChip modality={artifact.modality} />
          </div>
          <ReviewRow label="Title">{artifact.title}</ReviewRow>
          <ReviewRow label="IP asset">
            <TxLink ipId={artifact.ipId} />
          </ReviewRow>
          <ReviewRow label="Register tx">
            <TxLink hash={artifact.createdTx} />
          </ReviewRow>
          {artifact.parentIpId ? (
            <ReviewRow label="Parent IP">
              <TxLink ipId={artifact.parentIpId} />
            </ReviewRow>
          ) : null}
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            justifyContent: "center",
            marginTop: 24,
            flexWrap: "wrap",
          }}
        >
          <Link
            href={`/artifact/${artifact.ipId}`}
            className="btn btn-accent"
          >
            View artifact
          </Link>
          <Link href="/" className="btn btn-ghost">
            Back to browse
          </Link>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Primitives --------------------------- */

function Stepper({ steps, current }: { steps: StepId[]; current: number }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 24,
        flexWrap: "wrap",
        gap: "8px 0",
      }}
    >
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <span
            key={s}
            style={{ display: "flex", alignItems: "center", flex: "0 1 auto" }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                  flex: "none",
                  border: `1.5px solid ${done || active ? "var(--ov-accent)" : "var(--ov-line)"}`,
                  background: done
                    ? "var(--ov-accent)"
                    : active
                      ? "color-mix(in srgb, var(--ov-accent) 14%, transparent)"
                      : "transparent",
                  color: done
                    ? "var(--ov-accent-ink)"
                    : active
                      ? "var(--ov-accent)"
                      : "var(--ov-text-faint)",
                }}
              >
                {done ? <Icon name="check" size={14} /> : i + 1}
              </span>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: active ? "var(--ov-text)" : "var(--ov-text-faint)",
                }}
              >
                {STEP_LABEL[s]}
              </span>
            </span>
            {i < steps.length - 1 ? (
              <span
                style={{
                  flex: 1,
                  minWidth: 24,
                  height: 1.5,
                  background: "var(--ov-line)",
                  margin: "0 12px",
                }}
              />
            ) : null}
          </span>
        );
      })}
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

function ReviewRow({
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
        gap: 14,
        padding: "9px 0",
        borderBottom: "1px solid var(--ov-line-soft)",
      }}
    >
      <span
        className="meta"
        style={{
          color: "var(--ov-text-faint)",
          width: 110,
          flex: "none",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: "var(--ov-text)" }}>{children}</span>
    </div>
  );
}

function friendlyError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/insufficient funds/i.test(msg))
    return "Top up your wallet — there isn't enough native IP to cover this transaction.";
  if (/user rejected|denied/i.test(msg))
    return "Transaction was rejected in your wallet.";
  return msg || "Something went wrong while publishing.";
}

async function postArtifactToIndex(a: Artifact): Promise<void> {
  const payload = JSON.parse(
    JSON.stringify(a, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  );
  const res = await fetch("/api/index", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`/api/index POST ${res.status}: ${text}`);
  }
}
