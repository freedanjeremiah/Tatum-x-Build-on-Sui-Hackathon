"use client";

import { useState } from "react";
import type { Artifact, ComputeJobResult } from "@/types/artifact";
import { runJob, algoName } from "@/lib/compute";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import TxLink from "./TxLink";

type Phase = "idle" | "minting" | "verifying" | "running" | "done" | "rejected" | "error";

/**
 * Pick an allowlisted algorithm + params → mint a compute license → run
 * the job via /api/compute → show metrics + the resultIpId (a derivative of the
 * dataset) + the isolation-mode disclosure. NO raw data is ever returned; an
 * off-allowlist request is rejected before any decryption.
 */
export default function ComputeJobPanel({ artifact }: { artifact: Artifact }) {
  const allowed = artifact.allowedAlgoHashes ?? [];
  const [algoHash, setAlgoHash] = useState(allowed[0] ?? "");
  const [params, setParams] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<ComputeJobResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [licenseTokenId, setLicenseTokenId] = useState<string | null>(null);

  const busy = phase === "minting" || phase === "verifying" || phase === "running";

  async function handleRun() {
    if (!algoHash) return;
    setError(null);
    setResult(null);
    setLicenseTokenId(null);

    // STEP 1: mint a compute license for the dataset.
    setPhase("minting");
    try {
      const clients = await getClients();
      const termsId = artifact.computeLicenseTermsId ?? artifact.licenseTermsId ?? "";
      if (!termsId) throw new Error("This dataset has no compute license terms.");
      const { mintLicense } = await import("@/lib/licensing");
      const tokenId = String(await mintLicense(clients.story, artifact.ipId, termsId));
      setLicenseTokenId(tokenId);
    } catch (e) {
      if (e instanceof WalletNotConnectedError) {
        setError(e.message);
      } else {
        setError(e instanceof Error ? e.message : "Failed to mint compute license.");
      }
      setPhase("error");
      return;
    }

    // STEP 2: submit + run the job (POST /api/compute). The worker re-checks the
    // allowlist before any decryption and returns metrics only.
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
      if (res.status === "done") setPhase("done");
      else if (res.status === "rejected") setPhase("rejected");
      else {
        setError(res.reason ?? "Compute job failed.");
        setPhase("error");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compute job failed.");
      setPhase("error");
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--tier-compute)]/30 bg-[color-mix(in_oklab,var(--tier-compute)_6%,var(--ov-panel))] p-5">
      <h2 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--ov-text-faint)]">
        Run a confidential job
      </h2>
      <p className="mb-4 text-[12.5px] leading-relaxed text-[var(--ov-text-dim)]">
        Mint a compute license, pick a permitted algorithm, and run it inside the
        worker. You receive{" "}
        <span className="font-medium text-[var(--tier-compute)]">
          aggregate results only
        </span>{" "}
        — the raw rows never leave the worker.
      </p>

      {/* algorithm picker */}
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--ov-text-faint)]">
        Algorithm
      </label>
      <div className="mb-4 flex flex-col gap-1.5">
        {allowed.map((h) => (
          <button
            key={h}
            type="button"
            disabled={busy}
            onClick={() => setAlgoHash(h)}
            className="flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed"
            style={{
              borderColor:
                algoHash === h
                  ? "color-mix(in oklab, var(--tier-compute) 55%, transparent)"
                  : "var(--ov-line)",
              background:
                algoHash === h
                  ? "color-mix(in oklab, var(--tier-compute) 10%, transparent)"
                  : "transparent",
            }}
          >
            <span
              className="grid h-4 w-4 shrink-0 place-items-center rounded-full border"
              style={{
                borderColor:
                  algoHash === h ? "var(--tier-compute)" : "var(--ov-line)",
              }}
            >
              {algoHash === h && (
                <span className="h-2 w-2 rounded-full bg-[var(--tier-compute)]" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-[var(--ov-text)]">
                {algoName(h)}
              </span>
              <code className="block truncate font-mono text-[11px] text-[var(--ov-text-faint)]">
                {h}
              </code>
            </span>
          </button>
        ))}
      </div>

      {/* params */}
      <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--ov-text-faint)]">
        Params <span className="normal-case text-[var(--ov-text-faint)]">(optional JSON)</span>
      </label>
      <input
        value={params}
        onChange={(e) => setParams(e.target.value)}
        disabled={busy}
        placeholder='{ "epsilon": 1.0 }'
        className="mb-4 w-full rounded-lg border border-[var(--ov-line)] bg-[var(--ov-bg-elev)] px-3 py-2 font-mono text-[12px] text-[var(--ov-text)] outline-none placeholder:text-[var(--ov-text-faint)] focus:border-[var(--tier-compute)] disabled:opacity-60"
      />

      <button
        type="button"
        onClick={handleRun}
        disabled={busy || !algoHash}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
        style={{ background: "var(--tier-compute)", color: "var(--ov-accent-ink)" }}
      >
        {busy ? <Spinner /> : <ComputeIcon ink />}
        {phase === "minting"
          ? "Minting compute license…"
          : phase === "verifying"
            ? "Verifying token…"
            : phase === "running"
              ? "Running in worker…"
              : "Mint compute license & run"}
      </button>

      {/* progress trail */}
      {busy && (
        <ol className="mt-4 space-y-1.5 text-[12px] text-[var(--ov-text-dim)]">
          <Step done={true} active={phase === "minting"} label="Mint compute license" />
          <Step
            done={phase === "running"}
            active={phase === "verifying"}
            label="Verify token in worker"
          />
          <Step done={false} active={phase === "running"} label="Decrypt + run (no rows leave)" />
        </ol>
      )}

      {/* DONE */}
      {phase === "done" && result && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--tier-compute)]">
            <CheckIcon /> Job complete — results only
          </div>

          {result.metrics && (
            <div className="rounded-lg border border-[var(--ov-line)] bg-[var(--ov-bg-elev)]/60 p-4">
              <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--ov-text-faint)]">
                Metrics (aggregate output)
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                {Object.entries(result.metrics).map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-[10px] uppercase tracking-wider text-[var(--ov-text-faint)]">
                      {k}
                    </dt>
                    <dd className="font-mono text-[14px] text-[var(--ov-text)]">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <dl className="space-y-2.5">
            {result.resultIpId && (
              <Row label="Result IP (derivative of this dataset)">
                <TxLink ipId={result.resultIpId} />
              </Row>
            )}
            {result.resultTx && (
              <Row label="Registration tx">
                <TxLink hash={result.resultTx} />
              </Row>
            )}
            {licenseTokenId && (
              <Row label="Compute license token">
                <span className="font-mono text-[12px] text-[var(--ov-text-dim)]">
                  {licenseTokenId}
                </span>
              </Row>
            )}
            {result.metricsURI && (
              <Row label="Metrics URI">
                <span className="break-all font-mono text-[12px] text-[var(--ov-text-dim)]">
                  {result.metricsURI}
                </span>
              </Row>
            )}
          </dl>

          <p className="text-[12px] leading-relaxed text-[var(--ov-text-dim)]">
            The result is registered as a derivative of this dataset, so royalties
            flow upstream to the data owner. No raw rows were returned.
          </p>

          <IsolationDisclosure mode={result.isolationMode} decryptCalled={result.decryptCalled} />
        </div>
      )}

      {/* REJECTED */}
      {phase === "rejected" && result && (
        <div className="mt-5 space-y-3">
          <div className="rounded-lg border border-[var(--tier-gated)]/45 bg-[var(--tier-gated)]/10 p-4">
            <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-[var(--tier-gated)]">
              <BanIcon /> Rejected by the worker
            </div>
            <p className="text-[12.5px] text-[var(--ov-text-dim)]">
              {result.reason ?? "Algorithm not on the dataset allowlist."}
            </p>
            <p className="mt-2 font-mono text-[11px] text-[var(--ov-text-faint)]">
              decryptCalled: {String(result.decryptCalled)} — no decryption was
              performed.
            </p>
          </div>
        </div>
      )}

      {/* ERROR */}
      {phase === "error" && error && (
        <div className="mt-4 rounded-lg border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-3 py-2.5 text-[12.5px] text-[var(--tier-gated)]">
          {error}
        </div>
      )}

      {/* always-on isolation disclosure (idle state) */}
      {phase !== "done" && phase !== "rejected" && (
        <div className="mt-5">
          <IsolationDisclosure />
        </div>
      )}
    </section>
  );
}

function IsolationDisclosure({
  mode,
  decryptCalled,
}: {
  mode?: string;
  decryptCalled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-[var(--tier-gated)]/35 bg-[var(--tier-gated)]/[0.07] p-3.5">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--tier-gated)]">
        <WarnIcon /> Isolation-mode disclosure
      </div>
      <p className="text-[12px] leading-relaxed text-[var(--ov-text-dim)]">
        This demo worker runs on a <span className="font-medium">plain server</span>
        {mode ? ` (${mode})` : ""} — the operator can see plaintext in memory. A
        production deployment would run in an attested SGX/TDX enclave. CDR does
        key-delivery only; compute privacy comes from worker isolation + the
        algorithm allowlist, not from CDR.
      </p>
      {typeof decryptCalled === "boolean" && (
        <p className="mt-1.5 font-mono text-[11px] text-[var(--ov-text-faint)]">
          isolationMode: {mode ?? "n/a"} · decryptCalled: {String(decryptCalled)}
        </p>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ov-text-faint)]">
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Step({
  done,
  active,
  label,
}: {
  done: boolean;
  active: boolean;
  label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className="grid h-4 w-4 place-items-center rounded-full border"
        style={{
          borderColor:
            done || active ? "var(--tier-compute)" : "var(--ov-line)",
          background: done ? "var(--tier-compute)" : "transparent",
        }}
      >
        {done ? (
          <CheckIcon small ink />
        ) : active ? (
          <span
            className="h-2 w-2 rounded-full bg-[var(--tier-compute)]"
            style={{ animation: "ov-pulse-ring 1.4s ease-out infinite" }}
          />
        ) : null}
      </span>
      <span className={done || active ? "text-[var(--ov-text)]" : ""}>{label}</span>
    </li>
  );
}

function Spinner() {
  return (
    <span
      className="h-3.5 w-3.5 rounded-full border-2 border-[var(--ov-accent-ink)]/40 border-t-[var(--ov-accent-ink)]"
      style={{ animation: "ov-spin 0.7s linear infinite" }}
    />
  );
}

function CheckIcon({ small, ink }: { small?: boolean; ink?: boolean }) {
  const s = small ? 10 : 16;
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink ? "var(--ov-accent-ink)" : "currentColor"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ComputeIcon({ ink }: { ink?: boolean }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ink ? "var(--ov-accent-ink)" : "var(--tier-compute)"}
      strokeWidth="2"
      aria-hidden
    >
      <rect x="7" y="7" width="10" height="10" rx="1.5" />
      <path d="M9 1.5v3M15 1.5v3M9 19.5v3M15 19.5v3M1.5 9h3M1.5 15h3M19.5 9h3M19.5 15h3" strokeLinecap="round" />
    </svg>
  );
}

function BanIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" strokeLinecap="round" />
    </svg>
  );
}

function WarnIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10.3 3.2 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
