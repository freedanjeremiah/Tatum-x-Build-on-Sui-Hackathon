"use client";

import { useState } from "react";
import type { Artifact } from "@/types/artifact";
import { getClients, WalletNotConnectedError } from "@/lib/useClients";
import { tierMeta } from "@/lib/tiers";
import DecryptProgress from "./DecryptProgress";

interface DownloadButtonProps {
  artifact: Artifact;
}

type Phase = "idle" | "decrypting" | "done" | "timeout" | "error";

/** A vault timeout surfaces with this label and should offer Retry, not alarm. */
function isTimeout(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return /timed out|PartialCollectionTimeout/i.test(e.message);
}

/** DownloadGateError is detected by name (the class is dynamically imported). */
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
      bytes.byteOffset + bytes.byteLength
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
      const ref = artifact.cid ?? "";
      if (!ref) throw new Error("This artifact has no CID to download.");
      const cidHash = ref.replace(/^ipfs:\/\//, "");
      const res = await fetch(`https://gateway.pinata.cloud/ipfs/${cidHash}`);
      if (!res.ok) throw new Error(`Gateway fetch failed (${res.status})`);
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
      const bytes = await download(clients, {
        ipId: artifact.ipId,
        uuid: artifact.vaultUuid ?? 0,
        licenseTermsId: artifact.licenseTermsId ?? "",
        // Owner-only private vaults are read by the owner without minting.
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

  const label = (() => {
    if (phase === "done") return "Downloaded";
    if (isPublic) return "Download";
    if (isPrivate) return "Decrypt (owner)";
    if (isGated) return "Mint to unlock";
    return "Download";
  })();

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={onClick}
        disabled={phase === "decrypting"}
        className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-[14px] font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60"
        style={{
          background: meta.color,
          color: "var(--ov-accent-ink)",
        }}
      >
        {phase === "decrypting" ? (
          <Spinner />
        ) : phase === "done" ? (
          <CheckIcon />
        ) : (
          <LockIcon open={isPublic} />
        )}
        {label}
      </button>

      {(phase === "decrypting" || phase === "timeout") && (
        <DecryptProgress
          timedOut={phase === "timeout"}
          onRetry={handleGated}
        />
      )}

      {phase === "error" && error && (
        <div className="rounded-lg border border-[var(--tier-gated)]/40 bg-[var(--tier-gated)]/10 px-3 py-2.5 text-[12.5px] text-[var(--tier-gated)]">
          {error}
        </div>
      )}
    </div>
  );
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "artifact";
}

function Spinner() {
  return (
    <span
      className="h-3.5 w-3.5 rounded-full border-2 border-[var(--ov-accent-ink)]/40 border-t-[var(--ov-accent-ink)]"
      style={{ animation: "ov-spin 0.7s linear infinite" }}
    />
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function LockIcon({ open }: { open?: boolean }) {
  if (open) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M7 10l5 5 5-5M12 15V3" />
      </svg>
    );
  }
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
