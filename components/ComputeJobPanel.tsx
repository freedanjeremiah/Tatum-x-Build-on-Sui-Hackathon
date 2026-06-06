"use client";

import { useEffect, useState } from "react";
import type { Artifact, ComputeJobResult } from "@/types/artifact";
import { algoName, runJob } from "@/lib/compute";
import TxLink from "./TxLink";
import DisclosureStrip from "./ui/DisclosureStrip";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

type Phase = "idle" | "verifying" | "running" | "done" | "rejected" | "error";

const COMPUTE = "var(--tier-compute)";

/**
 * Pick an allowlisted algorithm + params → mint a compute license → run
 * the job via /api/compute → show metrics + the result IPA + the
 * isolation-mode disclosure. NO raw data is ever returned; an off-allowlist
 * request is rejected before any decryption.
 */
export default function ComputeJobPanel({ artifact }: { artifact: Artifact }) {
  const allowed = artifact.allowedAlgoHashes ?? [];
  const [algoHash, setAlgoHash] = useState(allowed[0] ?? "");
  const [params, setParams] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ComputeJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Server-declared isolation mode — read once so the IsolationStrip can render
  // honestly BEFORE the user runs a job. After a job, result.isolationMode
  // overrides this with the actual disclosure the worker produced.
  const [declaredMode, setDeclaredMode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/runtime")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { workerIsolation?: string; keyServers?: { attestationEnabled?: boolean; enforced?: boolean } } | null) => {
        if (cancelled || !data) return;
        const wi = data.workerIsolation ?? "plain-server";
        const keyServersPart = data.keyServers?.attestationEnabled
          ? data.keyServers.enforced
            ? "Seal key-server TEEs attested (enforced)"
            : "Seal key-server TEEs attested (report-only)"
          : "Seal key-server TEEs not attested";
        const wiPart =
          wi === "enclave"
            ? "compute worker in attested enclave"
            : wi === "enclave-sim"
              ? "compute worker in SIMULATED enclave (TEE-SIM declared) — NOT hardware-attested"
              : "compute worker on plain server (operator-trusted, demo)";
        setDeclaredMode(`${wiPart}; ${keyServersPart}`);
      })
      .catch(() => {
        // /api/runtime missing → leave declaredMode null; IsolationStrip falls
        // back to its honest default (which says plain-server, true for a
        // process that can't even tell us otherwise).
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const running = phase === "verifying" || phase === "running";

  async function handleRun() {
    if (!algoHash) return;
    setError(null);
    setResult(null);
    setPhase("verifying");

    try {
      let parsedParams: Record<string, unknown> = {};
      if (params.trim()) {
        try {
          parsedParams = JSON.parse(params);
        } catch {
          parsedParams = { raw: params.trim() };
        }
      }
      setPhase("running");
      const res = await runJob({
        datasetIpId: artifact.ipId,
        algoHash,
        params: parsedParams,
      });
      setResult(res);
      if (res.status === "done") {
        setPhase("done");
        if (res.resultIpId && res.resultTx) {
          try {
            const resp = await fetch("/api/index", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                ipId: res.resultIpId,
                tier: "public",
                modality: "dataset",
                title: `Compute result · ${algoName(algoHash)}`,
                description:
                  "Aggregate compute result derived in the confidential-compute worker. Metrics only.",
                tags: ["compute-result", "derivative"],
                ipMetadataURI: "",
                parentIpId: artifact.ipId,
                createdTx: res.resultTx,
              }),
            });
            if (!resp.ok) {
              const txt = await resp.text().catch(() => "");
              const note = `local index update failed (${resp.status}). On-chain derivative is real and still flows royalties; only the local read model is stale.${txt ? " " + txt.slice(0, 200) : ""}`;
              setResult({ ...res, warning: res.warning ? `${res.warning}; ${note}` : note });
            }
          } catch (e) {
            const msg = e instanceof Error ? e.message : "unknown error";
            const note = `local index update failed: ${msg}. On-chain derivative is real and still flows royalties; only the local read model is stale.`;
            setResult({ ...res, warning: res.warning ? `${res.warning}; ${note}` : note });
          }
        }
      } else if (res.status === "rejected") {
        setPhase("rejected");
      } else {
        setError(res.reason ?? "Compute job failed.");
        setPhase("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compute job failed.");
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
        Run a confidential job
      </div>
      <p
        style={{
          fontSize: 12.5,
          color: "var(--ov-text-dim)",
          lineHeight: 1.55,
          marginTop: 0,
        }}
      >
        The worker mints one compute license, decrypts in-process, runs your
        algorithm, and returns{" "}
        <strong style={{ color: COMPUTE }}>aggregates only</strong> — the raw
        rows never leave the worker.
      </p>

      {phase === "done" && result ? (
        <ComputeDone artifact={artifact} result={result} />
      ) : phase === "rejected" && result ? (
        <div
          className="anim-up"
          style={{ display: "grid", gap: 12, marginTop: 14 }}
        >
          <DisclosureStrip tone="gated" icon="flag">
            <strong>Rejected by the worker.</strong>{" "}
            {result.reason ?? "Algorithm not on the dataset allowlist."}
          </DisclosureStrip>
          <div
            className="font-mono"
            style={{ fontSize: 11.5, color: "var(--ov-text-faint)" }}
          >
            decryptCalled: {String(result.decryptCalled)} — no decryption was
            performed.
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ justifySelf: "start" }}
            onClick={() => {
              setPhase("idle");
              setResult(null);
            }}
          >
            Try again
          </button>
          <IsolationStrip mode={declaredMode ?? undefined} />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 16, marginTop: 14 }}>
          {/* algorithm radio list */}
          <div style={{ display: "grid", gap: 8 }}>
            {allowed.map((h) => {
              const on = algoHash === h;
              return (
                <button
                  key={h}
                  type="button"
                  className="panel-soft"
                  disabled={running}
                  onClick={() => setAlgoHash(h)}
                  style={{
                    padding: "11px 13px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: running ? "default" : "pointer",
                    textAlign: "left",
                    borderColor: on ? COMPUTE : "var(--ov-line)",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 999,
                      flex: "none",
                      border: `2px solid ${on ? COMPUTE : "var(--ov-line-ink)"}`,
                      background: on ? COMPUTE : "transparent",
                      boxShadow: on
                        ? "inset 0 0 0 2.5px var(--ov-panel)"
                        : "none",
                    }}
                  />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span
                      style={{
                        display: "block",
                        fontWeight: 600,
                        fontSize: 13,
                        color: "var(--ov-text)",
                      }}
                    >
                      {algoName(h)}
                    </span>
                    <code
                      className="font-mono"
                      style={{
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        fontSize: 11,
                        color: "var(--ov-text-faint)",
                      }}
                    >
                      {h}
                    </code>
                  </span>
                </button>
              );
            })}
          </div>

          <label style={{ display: "block" }}>
            <span className="field-label">Params (optional JSON)</span>
            <input
              className="input mono"
              placeholder='{ "epsilon": 1.0 }'
              value={params}
              onChange={(e) => setParams(e.target.value)}
              disabled={running}
            />
          </label>

          {running ? (
            <div
              className="panel-soft anim-up"
              style={{ padding: 16, display: "grid", gap: 14 }}
            >
              <TrailItem
                state={phase === "verifying" ? "active" : "done"}
                label="Allowlist check + mint compute license in worker"
              />
              <TrailItem
                state={phase === "verifying" ? "pending" : "active"}
                label="Decrypt + run (no rows leave)"
              />
            </div>
          ) : (
            <button
              type="button"
              className="btn"
              disabled={!algoHash}
              onClick={handleRun}
              style={{
                background: COMPUTE,
                color: "#fff",
                boxShadow: "3px 3px 0 var(--ov-navy)",
              }}
            >
              <Icon name="play" size={14} />
              Run confidential job
            </button>
          )}

          {error ? (
            <DisclosureStrip tone="gated" icon="flag">
              {error}
            </DisclosureStrip>
          ) : null}

          <IsolationStrip mode={declaredMode ?? undefined} />
        </div>
      )}
    </div>
  );
}

function ComputeDone({
  artifact,
  result,
}: {
  artifact: Artifact;
  result: ComputeJobResult;
}) {
  return (
    <div
      className="anim-up"
      style={{ display: "grid", gap: 16, marginTop: 14 }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 9,
          color: COMPUTE,
          fontWeight: 700,
          fontSize: 15,
        }}
      >
        <Icon name="check" size={18} />
        Job complete — results only
      </div>

      {result.metrics ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))",
            gap: 10,
          }}
        >
          {Object.entries(result.metrics).map(([k, v]) => (
            <Metric key={k} k={k} v={String(v)} />
          ))}
        </div>
      ) : null}

      <div className="panel-soft" style={{ padding: 16 }}>
        {result.resultIpId ? (
          <DoneRow label="Result IP (derivative)">
            <TxLink ipId={result.resultIpId} />
          </DoneRow>
        ) : null}
        {result.resultTx ? (
          <DoneRow label="Registration tx">
            <TxLink hash={result.resultTx} />
          </DoneRow>
        ) : null}
        {result.licenseTokenId ? (
          <DoneRow label="Compute license token">
            <span
              className="font-mono"
              style={{ fontSize: 12, color: "var(--ov-text)" }}
            >
              #{result.licenseTokenId}
            </span>
          </DoneRow>
        ) : null}
        {result.metricsURI ? (
          <DoneRow label="Metrics URI">
            <span
              className="font-mono"
              style={{
                fontSize: 11.5,
                color: "var(--ov-text)",
                wordBreak: "break-all",
              }}
            >
              {result.metricsURI}
            </span>
          </DoneRow>
        ) : null}
      </div>

      <p
        style={{
          fontSize: 12.5,
          color: "var(--ov-text-dim)",
          margin: 0,
          lineHeight: 1.55,
        }}
      >
        The result is registered as a derivative of{" "}
        <strong>{artifact.title}</strong>, so royalties flow upstream. No raw
        rows were returned.
      </p>

      {result.warning ? (
        <DisclosureStrip tone="gated" icon="flag">
          ⚠ {result.warning}
        </DisclosureStrip>
      ) : null}

      <IsolationStrip mode={result.isolationMode} decryptCalled={result.decryptCalled} />
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div className="panel-soft" style={{ padding: 14 }}>
      <div className="meta" style={{ marginBottom: 6 }}>
        {k.replace(/_/g, " ")}
      </div>
      <div
        className="font-mono"
        style={{ fontSize: 15, fontWeight: 600, color: "var(--ov-text)" }}
      >
        {v}
      </div>
    </div>
  );
}

function DoneRow({
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
      <span style={{ textAlign: "right" }}>{children}</span>
    </div>
  );
}

function TrailItem({
  state,
  label,
}: {
  state: "pending" | "active" | "done";
  label: string;
}) {
  const col =
    state === "done"
      ? "var(--tier-compute)"
      : state === "active"
        ? "var(--ov-accent)"
        : "var(--ov-line)";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
      <span
        style={{
          width: 18,
          height: 18,
          borderRadius: 999,
          flex: "none",
          border: `4px solid ${col}`,
          background: state === "done" ? "var(--tier-compute)" : "transparent",
          animation:
            state === "active" ? "ov-pulse-ring 1.4s infinite" : "none",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {state === "done" ? (
          <span style={{ color: "#fff", display: "inline-flex" }}>
            <Icon name="check" size={10} />
          </span>
        ) : null}
      </span>
      <span
        style={{
          fontSize: 13,
          color: state === "pending" ? "var(--ov-text-faint)" : "var(--ov-text)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function IsolationStrip({
  mode,
  decryptCalled,
}: {
  mode?: string;
  decryptCalled?: boolean;
}) {
  // Detect mode from the disclosure string the worker returned. We don't
  // hardcode "plain server" — the UI must reflect whatever the worker says.
  const lower = (mode ?? "").toLowerCase();
  const isSim = lower.includes("simulated enclave") || lower.includes("enclave-sim");
  const isNitro = !isSim && (lower.includes("nitro enclave") || lower.includes("attestation verified on-chain"));
  const isEnclave = !isSim && !isNitro && lower.includes("attested enclave");
  const headline = isNitro
    ? "Isolation: AWS Nitro enclave — attestation verified on-chain."
    : isEnclave
    ? "Isolation: attested enclave (production)."
    : isSim
      ? "Isolation: simulated enclave (TEE-SIM, NOT hardware-attested — development only)."
      : mode
        ? `Isolation: ${mode}.`
        : "Isolation: plain server (operator-trusted, demo).";
  const body = isNitro
    ? "The worker ran inside an AWS Nitro enclave; reef::registry verified the AWS attestation + the enclave's signature on-chain before accepting the result. Seal delivers keys only — compute privacy comes from the attested enclave + the algorithm allowlist."
    : isEnclave
    ? "Worker measurements are verified by hardware attestation. Seal delivers keys only; privacy comes from the attested worker + the algorithm allowlist."
    : isSim
      ? "The simulator exercises the same verification code path real attestation would take, but the signature is HMAC over a server-side secret — not chained to Intel's quoting enclave. Do not trust for production data."
      : "The operator can see plaintext in memory. A production deployment would run in an attested SGX/TDX enclave. Seal does gated key-delivery only; compute privacy comes from worker isolation + the algorithm allowlist, not from Seal.";
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        alignItems: "flex-start",
        marginTop: 4,
        color: "var(--ov-text-dim)",
        background: "color-mix(in srgb, var(--tier-gated) 9%, transparent)",
        border: "1px solid color-mix(in srgb, var(--tier-gated) 32%, transparent)",
        fontSize: 12.5,
        lineHeight: 1.55,
      }}
    >
      <span
        style={{ color: "var(--tier-gated)", flex: "none", marginTop: 1 }}
      >
        <Icon name="shield" size={16} />
      </span>
      <div>
        <strong>{headline}</strong> {body}
        {typeof decryptCalled === "boolean" || mode ? (
          <div
            className="font-mono"
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "var(--ov-text-faint)",
              wordBreak: "break-word",
            }}
          >
            isolationMode: {mode ?? "(declared from env)"}
            {typeof decryptCalled === "boolean" ? ` · decryptCalled: ${String(decryptCalled)}` : ""}
          </div>
        ) : null}
      </div>
    </div>
  );
}
