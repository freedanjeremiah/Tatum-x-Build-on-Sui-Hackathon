// INDEX-ONLY datastore.
// This module mirrors PUBLIC artifact metadata for browse/search. It NEVER
// stores decryption keys, NEVER stores plaintext artifact bytes, and NEVER
// gates access. It is a read model over public on-chain / registry data.

import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Artifact, Tier, Modality } from "../types/artifact";

export type DB = Database.Database;

const HERE = dirname(fileURLToPath(import.meta.url));
// In a `next build` + `next start` server, import.meta.url resolves to a bundled
// .next path — so the default DB would NOT be the indexer/reef.db the seed script
// (run via tsx) writes, and browse comes up empty. Set REEF_DB_PATH (absolute) so
// the seeder and the running server open the SAME file. Falls back to the
// source-relative path for local dev / tests.
const DEFAULT_DB_PATH =
  process.env.REEF_DB_PATH && process.env.REEF_DB_PATH.length > 0
    ? process.env.REEF_DB_PATH
    : join(HERE, "reef.db");

/** Open (and migrate) the index database. Pass ":memory:" in tests. */
export function openDb(path: string = DEFAULT_DB_PATH): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  const schema = readFileSync(join(HERE, "schema.sql"), "utf8");
  db.exec(schema);
  migrate(db);
  return db;
}

/**
 * Additive migrations for DBs created before a column existed. `CREATE TABLE IF
 * NOT EXISTS` never alters an existing table, so newly-added columns must be
 * backfilled with ALTER TABLE. Safe to run on every open (idempotent).
 */
function migrate(db: DB): void {
  const cols = new Set(
    (db.prepare("PRAGMA table_info(artifacts)").all() as Array<{ name: string }>).map((c) => c.name),
  );
  if (!cols.has("owner")) {
    db.exec("ALTER TABLE artifacts ADD COLUMN owner TEXT");
  }
}

// --- (de)serialization helpers ---

interface Row {
  ipId: string;
  tier: string | null;
  modality: string | null;
  title: string | null;
  description: string | null;
  tags: string | null;
  ipMetadataURI: string | null;
  vaultUuid: number | null;
  cid: string | null;
  licenseTermsId: string | null;
  parentIpId: string | null;
  groupId: string | null;
  ownerNftTokenId: string | null;
  owner: string | null;
  createdTx: string | null;
  computeEnabled: number | null;
  allowedAlgoHashes: string | null;
  computeLicenseTermsId: string | null;
  externalSource: string | null;
  score: number | null;
}

function toRow(a: Artifact): Row {
  return {
    ipId: a.ipId,
    tier: a.tier,
    modality: a.modality,
    title: a.title,
    description: a.description,
    tags: JSON.stringify(a.tags ?? []),
    ipMetadataURI: a.ipMetadataURI,
    vaultUuid: a.vaultUuid ?? null,
    cid: a.cid ?? null,
    licenseTermsId: a.licenseTermsId ?? null,
    parentIpId: a.parentIpId ?? null,
    groupId: a.groupId ?? null,
    ownerNftTokenId: a.ownerNftTokenId !== undefined ? a.ownerNftTokenId.toString() : null,
    owner: a.owner ?? null,
    createdTx: a.createdTx,
    computeEnabled: a.computeEnabled === undefined ? null : a.computeEnabled ? 1 : 0,
    allowedAlgoHashes: a.allowedAlgoHashes ? JSON.stringify(a.allowedAlgoHashes) : null,
    computeLicenseTermsId: a.computeLicenseTermsId ?? null,
    externalSource: a.externalSource ?? null,
    score: a.score ?? null,
  };
}

function fromRow(r: Row): Artifact {
  const a: Artifact = {
    ipId: r.ipId as `0x${string}`,
    tier: (r.tier ?? "public") as Tier,
    modality: (r.modality ?? "dataset") as Modality,
    title: r.title ?? "",
    description: r.description ?? "",
    tags: r.tags ? (JSON.parse(r.tags) as string[]) : [],
    ipMetadataURI: r.ipMetadataURI ?? "",
    createdTx: (r.createdTx ?? "") as `0x${string}`,
  };
  if (r.vaultUuid !== null) a.vaultUuid = r.vaultUuid;
  if (r.cid !== null) a.cid = r.cid;
  if (r.licenseTermsId !== null) a.licenseTermsId = r.licenseTermsId;
  if (r.parentIpId !== null) a.parentIpId = r.parentIpId as `0x${string}`;
  if (r.groupId !== null) a.groupId = r.groupId as `0x${string}`;
  if (r.ownerNftTokenId !== null) a.ownerNftTokenId = BigInt(r.ownerNftTokenId);
  if (r.owner !== null) a.owner = r.owner as `0x${string}`;
  if (r.computeEnabled !== null) a.computeEnabled = r.computeEnabled === 1;
  if (r.allowedAlgoHashes !== null) a.allowedAlgoHashes = JSON.parse(r.allowedAlgoHashes) as string[];
  if (r.computeLicenseTermsId !== null) a.computeLicenseTermsId = r.computeLicenseTermsId;
  if (r.externalSource !== null) a.externalSource = r.externalSource;
  if (r.score !== null) a.score = r.score;
  return a;
}

const COLUMNS = [
  "ipId", "tier", "modality", "title", "description", "tags", "ipMetadataURI",
  "vaultUuid", "cid", "licenseTermsId", "parentIpId", "groupId", "ownerNftTokenId",
  "owner", "createdTx", "computeEnabled", "allowedAlgoHashes", "computeLicenseTermsId",
  "externalSource", "score",
] as const;

/** Insert or replace one artifact (idempotent on ipId). */
export function upsertArtifact(db: DB, a: Artifact): void {
  const cols = COLUMNS.join(", ");
  const placeholders = COLUMNS.map((c) => "@" + c).join(", ");
  const updates = COLUMNS.filter((c) => c !== "ipId")
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  const sql =
    `INSERT INTO artifacts (${cols}) VALUES (${placeholders}) ` +
    `ON CONFLICT(ipId) DO UPDATE SET ${updates}`;
  db.prepare(sql).run(toRow(a));
}

/** Fetch a single artifact by ipId. */
export function getArtifact(db: DB, ipId: string): Artifact | undefined {
  const row = db.prepare("SELECT * FROM artifacts WHERE ipId = ?").get(ipId) as Row | undefined;
  return row ? fromRow(row) : undefined;
}

// --- Indexer cursor (resumable Sui event polling) -----------------------
//
// The Sui event indexer (indexer/listen.ts) paginates queryEvents and persists
// the last consumed EventId so a restart resumes where it left off. The cursor
// is keyed by a logical stream name (e.g. the Move event type). Stored as the
// {txDigest, eventSeq} pair the Sui RPC expects back as a paging cursor.

/** A Sui EventId paging cursor ({ txDigest, eventSeq }). */
export interface EventCursor {
  txDigest: string;
  eventSeq: string;
}

function ensureCursorTable(db: DB): void {
  db.exec(
    "CREATE TABLE IF NOT EXISTS indexer_cursor (" +
      "stream TEXT PRIMARY KEY, txDigest TEXT NOT NULL, eventSeq TEXT NOT NULL)",
  );
}

/** Read the saved cursor for `stream`, or null if none has been persisted. */
export function getCursor(db: DB, stream: string): EventCursor | null {
  ensureCursorTable(db);
  const row = db
    .prepare("SELECT txDigest, eventSeq FROM indexer_cursor WHERE stream = ?")
    .get(stream) as EventCursor | undefined;
  return row ?? null;
}

/** Persist the cursor for `stream` (idempotent upsert on the stream name). */
export function setCursor(db: DB, stream: string, cursor: EventCursor): void {
  ensureCursorTable(db);
  db.prepare(
    "INSERT INTO indexer_cursor (stream, txDigest, eventSeq) VALUES (@stream, @txDigest, @eventSeq) " +
      "ON CONFLICT(stream) DO UPDATE SET txDigest = excluded.txDigest, eventSeq = excluded.eventSeq",
  ).run({ stream, txDigest: cursor.txDigest, eventSeq: cursor.eventSeq });
}

export interface ListFilter {
  tier?: string;
  modality?: string;
  q?: string;
  owner?: string;
  tag?: string;
  sort?: "newest" | "score";
}

/** List artifacts with optional tier/modality filters and a free-text query. */
export function listArtifacts(db: DB, filter: ListFilter): Artifact[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.tier) {
    where.push("tier = ?");
    params.push(filter.tier);
  }
  if (filter.modality) {
    where.push("modality = ?");
    params.push(filter.modality);
  }
  if (filter.q) {
    // Case-insensitive substring over title/description/tags JSON.
    where.push("(LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(tags) LIKE ?)");
    const like = "%" + filter.q.toLowerCase() + "%";
    params.push(like, like, like);
  }
  if (filter.owner) {
    where.push("LOWER(owner) = ?");
    params.push(filter.owner.toLowerCase());
  }
  if (filter.tag) {
    // tags is a JSON array string; match a quoted token, case-insensitive.
    where.push("LOWER(tags) LIKE ?");
    params.push('%"' + filter.tag.toLowerCase() + '"%');
  }
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const order =
    filter.sort === "newest"
      ? " ORDER BY rowid DESC"
      : filter.sort === "score"
        ? " ORDER BY score DESC"
        : "";
  const rows = db.prepare(`SELECT * FROM artifacts${clause}${order}`).all(...params) as Row[];
  return rows.map(fromRow);
}
