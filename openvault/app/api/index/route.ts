// INDEX-ONLY, READ-ONLY route.
// This endpoint serves PUBLIC artifact metadata for browse/search. It NEVER
// accesses decryption keys, NEVER reads plaintext artifact bytes, and NEVER
// gates access. It only reads the local index (a mirror of public on-chain /
// registry data).

export const runtime = "nodejs"; // Edge unsupported for sqlite/CDR

import { openDb, getArtifact, listArtifacts } from "@/indexer/db";
import type { DB } from "@/indexer/db";

let _db: DB | null = null;

function db(): DB {
  if (_db) return _db;
  _db = openDb();
  return _db;
}

// JSON.stringify replacer: bigint (ownerNftTokenId) → decimal string.
function jsonResponse(data: unknown): Response {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ipId = url.searchParams.get("ipId");

  if (ipId) {
    const artifact = getArtifact(db(), ipId);
    if (!artifact) return jsonResponse({ error: "not found" });
    return jsonResponse(artifact);
  }

  const artifacts = listArtifacts(db(), {
    tier: url.searchParams.get("tier") ?? undefined,
    modality: url.searchParams.get("modality") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
  });
  return jsonResponse(artifacts);
}
