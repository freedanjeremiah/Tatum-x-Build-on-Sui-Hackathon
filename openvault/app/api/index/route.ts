// INDEX route.
// GET — serves PUBLIC artifact metadata for browse/search. NEVER accesses
// decryption keys, NEVER reads plaintext artifact bytes, NEVER gates access.
// POST — self-index handler: a client that just minted an IP Asset POSTs the
// resulting public Artifact descriptor here so the read model is consistent
// (the on-chain indexer eventually catches up too, but self-index is the
// authoritative writer for upload-time fields the event log doesn't carry —
// vaultUuid, tier, allowedAlgoHashes, computeLicenseTermsId, etc).
//
// SECURITY INVARIANT for POST:
// Only PUBLIC metadata is accepted. Decryption keys, plaintext, threshold
// shares — none of those ever exist server-side and the route rejects any body
// shape that doesn't match a public Artifact.

export const runtime = "nodejs"; // Edge unsupported for sqlite/CDR

import { openDb, getArtifact, listArtifacts, upsertArtifact } from "@/indexer/db";
import type { DB } from "@/indexer/db";
import type { Artifact, Tier, Modality } from "@/types/artifact";

let _db: DB | null = null;

function db(): DB {
  if (_db) return _db;
  // OPENVAULT_DB_PATH lets tests point at an isolated/in-memory DB so they never
  // write throwaway rows into the real index (indexer/openvault.db).
  _db = openDb(process.env.OPENVAULT_DB_PATH || undefined);
  return _db;
}

/** Read an integer env override; fall back to the supplied default. Used by the
 *  leaderboard scoring weights so an operator can re-tune without code edits. */
function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const v = Number(raw);
  return Number.isFinite(v) ? v : fallback;
}

// JSON.stringify replacer: bigint (ownerNftTokenId) → decimal string.
function jsonResponse(data: unknown, status = 200): Response {
  const body = JSON.stringify(data, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
  return new Response(body, {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const ipId = url.searchParams.get("ipId");

  if (ipId) {
    const artifact = getArtifact(db(), ipId);
    if (!artifact) return jsonResponse({ error: "not found" }, 404);
    return jsonResponse(artifact);
  }

  const sortParam = url.searchParams.get("sort");
  const artifacts = listArtifacts(db(), {
    tier: url.searchParams.get("tier") ?? undefined,
    modality: url.searchParams.get("modality") ?? undefined,
    q: url.searchParams.get("q") ?? undefined,
    owner: url.searchParams.get("owner") ?? undefined,
    tag: url.searchParams.get("tag") ?? undefined,
    sort: sortParam === "newest" || sortParam === "score" ? sortParam : undefined,
  });
  return jsonResponse(artifacts);
}

const VALID_TIERS: ReadonlySet<Tier> = new Set(["public", "private", "gated", "group", "compute"]);
const VALID_MODALITIES: ReadonlySet<Modality> = new Set(["dataset", "model"]);
const HEX_RE = /^0x[0-9a-fA-F]+$/;

function isHex(s: unknown): s is `0x${string}` {
  return typeof s === "string" && HEX_RE.test(s);
}

/**
 * Validate + coerce a JSON body into an Artifact. Rejects anything that looks
 * like a key, plaintext, or non-public field. Throws with a short message.
 */
function parseArtifact(body: unknown): Artifact {
  if (!body || typeof body !== "object") {
    throw new Error("body must be a JSON object");
  }
  const b = body as Record<string, unknown>;

  if (!isHex(b.ipId)) throw new Error("ipId must be a 0x-hex string");
  if (typeof b.tier !== "string" || !VALID_TIERS.has(b.tier as Tier))
    throw new Error("tier must be one of public|private|gated|group|compute");
  if (typeof b.modality !== "string" || !VALID_MODALITIES.has(b.modality as Modality))
    throw new Error("modality must be dataset|model");
  if (typeof b.title !== "string") throw new Error("title must be a string");
  if (typeof b.description !== "string") throw new Error("description must be a string");
  if (!Array.isArray(b.tags) || !b.tags.every((t) => typeof t === "string"))
    throw new Error("tags must be a string[]");
  if (typeof b.ipMetadataURI !== "string")
    throw new Error("ipMetadataURI must be a string");
  if (!isHex(b.createdTx)) throw new Error("createdTx must be a 0x-hex string");

  const a: Artifact = {
    ipId: b.ipId,
    tier: b.tier as Tier,
    modality: b.modality as Modality,
    title: b.title,
    description: b.description,
    tags: b.tags as string[],
    ipMetadataURI: b.ipMetadataURI,
    createdTx: b.createdTx,
  };

  if (b.vaultUuid !== undefined && b.vaultUuid !== null) {
    if (typeof b.vaultUuid !== "number" || !Number.isFinite(b.vaultUuid))
      throw new Error("vaultUuid must be a number");
    a.vaultUuid = b.vaultUuid;
  }
  if (typeof b.cid === "string") a.cid = b.cid;
  if (typeof b.licenseTermsId === "string") a.licenseTermsId = b.licenseTermsId;
  if (b.parentIpId !== undefined && b.parentIpId !== null) {
    if (!isHex(b.parentIpId)) throw new Error("parentIpId must be a 0x-hex string");
    a.parentIpId = b.parentIpId;
  }
  if (b.groupId !== undefined && b.groupId !== null) {
    if (!isHex(b.groupId)) throw new Error("groupId must be a 0x-hex string");
    a.groupId = b.groupId;
  }
  if (b.owner !== undefined && b.owner !== null) {
    if (!isHex(b.owner)) throw new Error("owner must be a 0x-hex string");
    a.owner = b.owner;
  }
  if (b.ownerNftTokenId !== undefined && b.ownerNftTokenId !== null) {
    const v = b.ownerNftTokenId;
    if (typeof v === "string" || typeof v === "number") {
      try { a.ownerNftTokenId = BigInt(v); } catch {
        throw new Error("ownerNftTokenId must be a numeric string or number");
      }
    } else {
      throw new Error("ownerNftTokenId must be a numeric string or number");
    }
  }
  if (typeof b.computeEnabled === "boolean") a.computeEnabled = b.computeEnabled;
  if (b.allowedAlgoHashes !== undefined && b.allowedAlgoHashes !== null) {
    if (!Array.isArray(b.allowedAlgoHashes) || !b.allowedAlgoHashes.every((t) => typeof t === "string"))
      throw new Error("allowedAlgoHashes must be a string[]");
    a.allowedAlgoHashes = b.allowedAlgoHashes as string[];
  }
  if (typeof b.computeLicenseTermsId === "string")
    a.computeLicenseTermsId = b.computeLicenseTermsId;
  if (typeof b.externalSource === "string") a.externalSource = b.externalSource;
  if (typeof b.score === "number") a.score = b.score;

  // Forbid any field that looks like a secret. Defensive — these are not part
  // of the Artifact type and should never reach the server.
  for (const forbidden of ["plaintext", "key", "secret", "privateKey", "decryptKey", "shares"]) {
    if (forbidden in b) throw new Error(`forbidden field: ${forbidden}`);
  }

  return a;
}

export async function POST(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid JSON body" }, 400);
  }

  let artifact: Artifact;
  try {
    artifact = parseArtifact(body);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }

  try {
    // If the artifact already exists, preserve a higher score (the indexer may
    // already have written a derived score we don't want to clobber).
    const existing = getArtifact(db(), artifact.ipId);
    if (existing?.score !== undefined && artifact.score === undefined) {
      artifact.score = existing.score;
    }
    // First-insert baseline by tier — gated/compute carry real fees, so they
    // start higher. Derivatives bump the parent score below. Weights are
    // env-overridable so an operator can re-tune the leaderboard without code
    // changes (e.g. OV_SCORE_BASELINE_PUBLIC=2).
    if (!existing && artifact.score === undefined) {
      const baseline: Record<string, number> = {
        public: numEnv("OV_SCORE_BASELINE_PUBLIC", 1),
        private: numEnv("OV_SCORE_BASELINE_PRIVATE", 1),
        gated: numEnv("OV_SCORE_BASELINE_GATED", 5),
        group: numEnv("OV_SCORE_BASELINE_GROUP", 3),
        compute: numEnv("OV_SCORE_BASELINE_COMPUTE", 10),
      };
      artifact.score = baseline[artifact.tier] ?? 1;
    }
    upsertArtifact(db(), artifact);

    // Bump the parent's score whenever a fresh derivative is indexed. The
    // leaderboard metric is "derivative count, weighted by tier" — gated and
    // compute parents score higher because licenses there cost gas+fees.
    if (artifact.parentIpId && !existing) {
      const parent = getArtifact(db(), artifact.parentIpId);
      if (parent) {
        const weight =
          parent.tier === "compute"
            ? numEnv("OV_SCORE_DERIV_COMPUTE", 3)
            : parent.tier === "gated"
              ? numEnv("OV_SCORE_DERIV_GATED", 2)
              : numEnv("OV_SCORE_DERIV_DEFAULT", 1);
        parent.score = (parent.score ?? 0) + weight;
        upsertArtifact(db(), parent);
      }
    }

    return jsonResponse({ ok: true, ipId: artifact.ipId });
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 500);
  }
}
