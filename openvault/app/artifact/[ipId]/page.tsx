// Artifact detail. Loads the PUBLIC index record server-side (index-only — no
// keys, no plaintext) and renders the interactive detail client component.

export const runtime = "nodejs";

import Link from "next/link";
import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import ArtifactDetail from "@/components/ArtifactDetail";
import Icon from "@/components/ui/Icon";

let _db: DB | null = null;
function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

export default async function ArtifactPage({
  params,
}: {
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

  return <ArtifactDetail artifact={artifact} />;
}
