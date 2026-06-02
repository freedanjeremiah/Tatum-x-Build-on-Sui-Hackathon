// Artifact "Card" tab. Loads the PUBLIC index record server-side (index-only —
// no keys, no plaintext) and renders the interactive detail body. The shared
// header (title / tier / breadcrumb / tab bar) and the not-found state live in
// the sibling layout.tsx — this page renders only the Card body.

export const runtime = "nodejs";

import { getArtifact, openDb } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact } from "@/types/artifact";
import ArtifactDetail from "@/components/ArtifactDetail";

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

  // Not-found is handled by layout.tsx (which renders the fallback and omits
  // children). Guard here so this body never renders without an artifact.
  if (!artifact) return null;

  return <ArtifactDetail artifact={artifact} />;
}
