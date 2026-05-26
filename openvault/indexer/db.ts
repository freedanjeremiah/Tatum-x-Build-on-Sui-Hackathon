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
const DEFAULT_DB_PATH = join(HERE, "openvault.db");

/** Open (and migrate) the index database. Pass ":memory:" in tests. */
export function openDb(path: string = DEFAULT_DB_PATH): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  const schema = readFileSync(join(HERE, "schema.sql"), "utf8");
  db.exec(schema);
  return db;
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
  "createdTx", "computeEnabled", "allowedAlgoHashes", "computeLicenseTermsId",
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

export interface ListFilter {
  tier?: string;
  modality?: string;
  q?: string;
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
  const clause = where.length ? " WHERE " + where.join(" AND ") : "";
  const rows = db.prepare(`SELECT * FROM artifacts${clause}`).all(...params) as Row[];
  return rows.map(fromRow);
}
