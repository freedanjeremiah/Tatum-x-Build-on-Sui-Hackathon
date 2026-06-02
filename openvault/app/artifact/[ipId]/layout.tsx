// Shared shell for an artifact's tab pages. Loads the PUBLIC index record
// server-side (index-only — no keys, no plaintext) and renders the breadcrumb,
// tier/modality badges, title, and the tab bar once. Tab bodies render as
// {children}. The title lives ONLY here — the Card body (ArtifactDetail) no
// longer renders its own title/badges/breadcrumb to avoid a duplicate H1.

export const runtime = "nodejs";

import Link from "next/link";
import type { ReactNode } from "react";
import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import ArtifactTabs from "@/components/ArtifactTabs";
import { ModalityChip, TierBadge } from "@/components/ui/TierBadge";
import Icon from "@/components/ui/Icon";

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

export default async function ArtifactLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ ipId: string }>;
}) {
  const { ipId } = await params;
  const artifact = getArtifact(db(), ipId) as Artifact | undefined;

  if (!artifact) {
    return (
      <div
        className="container maxw-artifact"
        style={{ paddingTop: 60, paddingBottom: 60 }}
      >
        <div
          style={{
            border: "2px dashed var(--ov-line-ink)",
            borderRadius: 18,
            padding: "52px 24px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
            background: "color-mix(in srgb, var(--ov-panel) 50%, transparent)",
          }}
        >
          <span style={{ color: "var(--ov-text-faint)" }}>
            <Icon name="search" size={30} />
          </span>
          <div
            className="font-display"
            style={{
              fontSize: 22,
              textTransform: "uppercase",
              fontWeight: 600,
              color: "var(--ov-text)",
            }}
          >
            Artifact not found
          </div>
          <p
            style={{
              margin: 0,
              color: "var(--ov-text-dim)",
              fontSize: 13,
              maxWidth: 420,
            }}
          >
            The IP asset{" "}
            <code className="font-mono" style={{ fontSize: 12 }}>
              {ipId}
            </code>{" "}
            is not in the index.
          </p>
          <Link href="/" className="btn btn-accent" style={{ marginTop: 6 }}>
            Back to browse
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container maxw-artifact"
      style={{ paddingTop: 26, paddingBottom: 60 }}
    >
      {/* breadcrumb */}
      <div className="meta anim-up" style={{ marginBottom: 18 }}>
        <Link href="/" style={{ color: "var(--ov-text-faint)" }}>
          Browse
        </Link>{" "}
        / {artifact.modality}
      </div>

      {/* header — shared across all tabs */}
      <div className="anim-up" style={{ animationDelay: "40ms" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            flexWrap: "wrap",
          }}
        >
          <TierBadge tier={artifact.tier} />
          <ModalityChip modality={artifact.modality} />
        </div>

        <h1
          className="h1"
          style={{
            fontSize: "clamp(28px, 4vw, 40px)",
            margin: "16px 0 18px",
            color: "var(--ov-text)",
          }}
        >
          {artifact.title}
        </h1>
      </div>

      <ArtifactTabs ipId={ipId} modality={artifact.modality} />

      {children}
    </div>
  );
}
