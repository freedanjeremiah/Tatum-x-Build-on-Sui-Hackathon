"use client";

import { useState } from "react";
import type { Artifact } from "@/types/artifact";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import { WALRUS_AGGREGATOR } from "@/lib/constants";
import { tierMeta } from "@/lib/tiers";
import DecryptProgress from "./DecryptProgress";
import DisclosureStrip from "./ui/DisclosureStrip";
import Icon from "./ui/Icon";
import Spinner from "./ui/Spinner";

interface DownloadButtonProps {
  artifact: Artifact;
}

type Phase = "idle" | "decrypting" | "done" | "timeout" | "error";

function isTimeout(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /timed out|PartialCollectionTimeout/i.test(e.message);
}

function isGateError(e: unknown): boolean {
  return e instanceof Error && e.name === "DownloadGateError";
}

export default function DownloadButton({ artifact }: DownloadButtonProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  const meta = tierMeta(artifact.tier);
  const isPublic = artifact.tier === "public";
  const isPrivate = artifact.tier === "private";
  const isGated = artifact.tier === "gated";

  function triggerBrowserDownload(bytes: Uint8Array) {
    const ab = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength,
    ) as ArrayBuffer;
    const blob = new Blob([ab], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug(artifact.title)}.bin`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function handlePublic() {
    setError(null);
    setPhase("decrypting");
    try {
      // Public artifacts: the descriptor's `cid` is the Walrus blobId. Fetch the
      // blob bytes straight from the Walrus aggregator (no IPFS gateway).
      const blobId = artifact.cid ?? "";
      if (!blobId) throw new Error("This artifact has no Walrus blobId to download.");
      const base = WALRUS_AGGREGATOR.replace(/\/+$/, "");
      const res = await fetch(`${base}/v1/blobs/${blobId}`);
      if (!res.ok) throw new Error(`Walrus aggregator fetch failed (${res.status})`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      triggerBrowserDownload(bytes);
      setPhase("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Download failed.");
      setPhase("error");
    }
  }

  async function handleGated() {
    setError(null);
    setPhase("decrypting");
    try {
      const clients = await getClients();
      const { download } = await import("@/lib/artifacts");
      // Gated (not private): purchase a license first — pay the artifact's
      // on-chain `price` in MIST via buy_license, which adds the buyer to
      // license_holders so seal_approve admits the decrypt below. Private (owner)
      // needs no purchase — the owner already satisfies seal_approve.
      if (isGated) {
        const { mintLicense } = await import("@/lib/licensing");
        // No explicit price → mintLicense reads the artifact's on-chain price and
        // pays exactly that (no fake default; a mismatch aborts loudly on-chain).
        await mintLicense(clients, artifact.ipId);
      }
      const bytes = await download(clients, {
        ipId: artifact.ipId,
        cid: artifact.cid,
        tier: artifact.tier,
        licenseTermsId: artifact.licenseTermsId ?? "",
        mint: !isPrivate,
      });
      triggerBrowserDownload(bytes);
      setPhase("done");
    } catch (e) {
      if (e instanceof WalletNotConnectedError) {
        setError(e.message);
        setPhase("error");
        return;
      }
      if (isTimeout(e)) {
        setPhase("timeout");
        return;
      }
      if (isGateError(e)) {
        setError("You need a license to unlock this.");
        setPhase("error");
        return;
      }
      setError(e instanceof Error ? e.message : "Download failed.");
      setPhase("error");
    }
  }

  const onClick = isPublic ? handlePublic : handleGated;

  if (phase === "done") {
    return (
      <div>
        <DisclosureStrip tone="public" icon="check">
          ✓ Decrypted. <strong>{slug(artifact.title)}.bin</strong> downloaded to
          your device.
        </DisclosureStrip>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => setPhase("idle")}
        >
          <Icon name="download" size={13} />
          Download again
        </button>
      </div>
    );
  }

  const label = (() => {
    if (isPublic) return "Download";
    if (isPrivate) return "Decrypt (owner)";
    if (isGated) return "Mint to unlock";
    return "Download";
  })();

  const decrypting = phase === "decrypting";

  return (
    <div>
      <button
        type="button"
        className="btn"
        disabled={decrypting}
        onClick={onClick}
        style={{
          background: meta.color,
          color: "#fff",
          boxShadow: "3px 3px 0 var(--ov-navy)",
          width: "100%",
        }}
      >
        {decrypting ? (
          <Spinner />
        ) : (
          <Icon name={isGated ? "key" : "download"} size={15} />
        )}
        {decrypting ? "Decrypting…" : label}
      </button>

      {(decrypting || phase === "timeout") && (
        <DecryptProgress
          timedOut={phase === "timeout"}
          onRetry={isPublic ? handlePublic : handleGated}
        />
      )}

      {phase === "error" && error ? (
        <div style={{ marginTop: 10 }}>
          <DisclosureStrip tone="gated" icon="flag">
            {error}
          </DisclosureStrip>
        </div>
      ) : null}
    </div>
  );
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "artifact"
  );
}
