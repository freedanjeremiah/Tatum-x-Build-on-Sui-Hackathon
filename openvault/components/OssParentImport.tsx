"use client";

import { useState } from "react";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import TxLink from "./TxLink";

interface OssParentImportProps {
  /** Called with the created provenance parent once registered. */
  onParent: (parentIpId: `0x${string}`, parentTermsId: string) => void;
}

/**
 * Register a PUBLIC provenance record for an off-platform OSS parent
 * (HuggingFace / GitHub). Does NOT claim ownership — it states the true
 * upstream license and authors, and returns the created parent ipId + termsId
 * up to the wizard so a derivative can be linked to it.
 */
export default function OssParentImport({ onParent }: OssParentImportProps) {
  const [url, setUrl] = useState("");
  const [upstreamLicense, setUpstreamLicense] = useState("");
  const [authors, setAuthors] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    ipId: `0x${string}`;
    createdTx: `0x${string}`;
  } | null>(null);

  const canImport = url.trim() && upstreamLicense.trim() && authors.trim();

  async function handleImport() {
    setError(null);
    setBusy(true);
    try {
      const clients = await getClients();
      const { registerProvenanceParent } = await import("@/lib/artifacts");
      const title = deriveTitle(url.trim());
      const reg = await registerProvenanceParent(clients, {
        externalSource: url.trim(),
        upstreamLicense: upstreamLicense.trim(),
        authors: authors
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
        title,
      });
      setResult({ ipId: reg.ipId, createdTx: reg.createdTx });
      onParent(reg.ipId, reg.licenseTermsId);
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to import parent."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-[var(--ov-line)] bg-[var(--ov-panel)]/60 p-4">
      <div className="flex items-start gap-2 rounded-lg border border-[var(--tier-gated)]/30 bg-[var(--tier-gated)]/8 px-3 py-2">
        <InfoIcon />
        <p className="text-[11.5px] leading-relaxed text-[var(--ov-text-dim)]">
          Registers a{" "}
          <span className="font-medium text-[var(--ov-text)]">PUBLIC</span>{" "}
          provenance record of the upstream source. Does NOT claim ownership;
          must state the true upstream license.
        </p>
      </div>

      <Field label="Upstream source URL (HuggingFace / GitHub)">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://huggingface.co/org/model"
          className={inputCls}
        />
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Upstream license">
          <input
            value={upstreamLicense}
            onChange={(e) => setUpstreamLicense(e.target.value)}
            placeholder="apache-2.0"
            className={inputCls}
          />
        </Field>
        <Field label="Authors (comma-separated)">
          <input
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Jane Doe, Acme Lab"
            className={inputCls}
          />
        </Field>
      </div>

      {error && <ErrorNote message={error} />}

      {result ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--ov-accent)]/30 bg-[var(--ov-accent)]/8 px-3 py-2.5">
          <span className="text-[12px] font-medium text-[var(--ov-accent)]">
            Provenance parent registered
          </span>
          <TxLink ipId={result.ipId} />
          <TxLink hash={result.createdTx} />
        </div>
      ) : (
        <button
          type="button"
          onClick={handleImport}
          disabled={!canImport || busy}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--ov-accent)] px-3.5 py-2 text-[13px] font-semibold text-[var(--ov-accent-ink)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? <Spinner /> : null}
          {busy ? "Registering…" : "Import parent"}
        </button>
      )}
    </div>
  );
}

function deriveTitle(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const tail = parts.slice(-2).join("/");
    return tail ? `Provenance: ${tail}` : `Provenance: ${u.hostname}`;
  } catch {
    return "Provenance: upstream source";
  }
}

const inputCls =
  "w-full rounded-lg border border-[var(--ov-line)] bg-[var(--ov-bg-elev)] px-3 py-2 text-[13px] text-[var(--ov-text)] outline-none placeholder:text-[var(--ov-text-faint)] focus:border-[var(--ov-accent)]";

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

function ErrorNote({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-3 py-2 text-[12px] text-[var(--tier-gated)]">
      {message}
    </p>
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

function InfoIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="mt-0.5 shrink-0 text-[var(--tier-gated)]"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" strokeLinecap="round" />
    </svg>
  );
}
