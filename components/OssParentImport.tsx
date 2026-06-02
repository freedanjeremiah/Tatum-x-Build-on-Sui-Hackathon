"use client";

import { useState } from "react";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import TxLink from "./TxLink";
import DisclosureStrip from "./ui/DisclosureStrip";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

interface OssParentImportProps {
  /** Called with the created provenance parent once registered. */
  onParent: (parentIpId: `0x${string}`, parentTermsId: string) => void;
}

/**
 * Register a PUBLIC provenance record for an off-platform OSS parent.
 * Does NOT claim ownership — it states the upstream license + authors and
 * returns the created parent ipId + termsId up to the wizard.
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
      try {
        await fetch("/api/index", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ipId: reg.ipId,
            tier: "public",
            modality: "model",
            title,
            description: `Provenance parent — ${url.trim()} (${upstreamLicense.trim()})`,
            tags: ["oss", "provenance"],
            ipMetadataURI: reg.ipMetadataURI,
            licenseTermsId: reg.licenseTermsId,
            externalSource: url.trim(),
            createdTx: reg.createdTx,
          }),
        });
      } catch (idxErr) {
        // eslint-disable-next-line no-console
        console.warn("[oss-parent] self-index failed:", idxErr);
      }
      setResult({ ipId: reg.ipId, createdTx: reg.createdTx });
      onParent(reg.ipId, reg.licenseTermsId);
    } catch (e) {
      setError(
        e instanceof WalletNotConnectedError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Failed to import parent.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DisclosureStrip tone="gated" icon="external">
        Registers a <strong>PUBLIC</strong> provenance record of the upstream
        source. Does NOT claim ownership — must state the true upstream license.
      </DisclosureStrip>

      <label style={{ display: "block" }}>
        <span className="field-label">Source URL</span>
        <input
          className="input mono"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://huggingface.co/org/model"
        />
      </label>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <label style={{ display: "block" }}>
          <span className="field-label">Upstream license</span>
          <input
            className="input"
            value={upstreamLicense}
            onChange={(e) => setUpstreamLicense(e.target.value)}
            placeholder="apache-2.0"
          />
        </label>
        <label style={{ display: "block" }}>
          <span className="field-label">Authors (comma-separated)</span>
          <input
            className="input"
            value={authors}
            onChange={(e) => setAuthors(e.target.value)}
            placeholder="Jane Doe, Acme Lab"
          />
        </label>
      </div>

      {error ? (
        <DisclosureStrip tone="gated" icon="flag">
          {error}
        </DisclosureStrip>
      ) : null}

      {result ? (
        <DisclosureStrip tone="public" icon="check">
          Provenance parent registered <TxLink ipId={result.ipId} />{" "}
          <TxLink hash={result.createdTx} />
        </DisclosureStrip>
      ) : (
        <button
          type="button"
          className="btn btn-ghost"
          style={{ justifySelf: "start" }}
          disabled={!canImport || busy}
          onClick={handleImport}
        >
          {busy ? <Spinner /> : <Icon name="plus" size={14} />}
          {busy ? "Registering…" : "Register provenance parent"}
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
