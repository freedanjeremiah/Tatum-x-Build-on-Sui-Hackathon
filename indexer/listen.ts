// Reef Sui event indexer (INDEX-ONLY).
//
// Mirrors PUBLIC on-chain `reef::registry` events into the local SQLite read
// model so the UI can browse/search and rank artifacts. It is a CACHE: it NEVER
// touches decryption keys, NEVER sees plaintext, NEVER gates access. The on-chain
// `seal_approve` policy is the only real gate.
//
// We poll `SuiClient.queryEvents`
// filtered to the registry module, cursor-paginate from the oldest unseen event,
// upsert into the read model, and persist the paging cursor so a restart resumes
// where it left off. Public RPC has no long-lived websocket subscription here, so
// polling is the portable, Tatum-gateway-friendly path.
//
// Event → read-model mapping (events emitted by move/sources/reef.move):
//   ArtifactRegistered{artifact, owner, tier, parent}
//       → upsert a new artifact row (tier from u8, owner, parentIpId, createdTx).
//   LicensePurchased{artifact, buyer, price}
//       → +2 score on the licensed artifact (active licensing signal).
//   AccessChanged{artifact, who, kind}
//       → +1 score (a grant/revoke/worker-add is real activity).
//   RoyaltyPaid{artifact, payer, amount, accrued}
//       → +3 score (revenue is the strongest economic ranking signal).
//   RevenueClaimed{artifact, owner, amount}
//       → no score change (a withdrawal, logged only).
//   GroupCreated{group, owner}
//       → logged (groups are not artifacts; no row of their own).
//   GroupMemberAdded{group, member}
//       → set groupId on the member artifact row (if already indexed).
//   Disputed{artifact, reporter, evidence, count}
//       → log (sticky on-chain flag; surfaced via the registry read, not scored).
//   CounterEvidence{artifact, responder, evidence}
//       → log only.
//
// NOTE on metadata: the Move events carry ids/tiers, not title/description/tags.
// Those come from the public IP-metadata JSON the upload flow self-indexes via
// /api/index. This indexer therefore catalogues the on-chain SHELL of each
// artifact (id/tier/owner/lineage) and lets the richer metadata layer over the
// top; it never invents titles. modality defaults to "dataset" until the
// metadata layer refines it (the row stays browsable in the meantime).

import type { SuiEvent } from "@mysten/sui/jsonRpc";

import { makeSuiClient, type SuiClient } from "../lib/clients";
import { REEF_PACKAGE_ID } from "../lib/constants";
import { u8ToTier } from "../lib/registry";
import {
  openDb,
  upsertArtifact,
  getArtifact,
  getCursor,
  setCursor,
  type DB,
  type EventCursor,
} from "./db";
import type { Artifact, Tier } from "../types/artifact";

const MODULE = "registry";

// Single logical stream — we query the whole registry module and route by the
// event's `type` suffix, so one cursor covers every registry event in order.
const STREAM = "reef::registry";

const PAGE_LIMIT = 50;
const POLL_INTERVAL_MS = Number(process.env.OV_INDEXER_POLL_MS ?? 4000);

/** Map the on-chain tier u8 to the app-facing Tier (types/artifact.ts). */
const CORE_TO_APP: Record<string, Tier> = {
  public: "public",
  "private-owner": "private",
  "gated-license": "gated",
  group: "group",
  compute: "compute",
};

function appTier(tierU8: number): Tier {
  const core = u8ToTier(tierU8); // throws on an out-of-range u8 (fail loud)
  return CORE_TO_APP[core] ?? "public";
}

// --- typed event payload shapes (parsedJson of each Move event struct) -------

interface ArtifactRegisteredJson {
  artifact: string;
  owner: string;
  tier: number | string;
  parent: { vec?: string[] } | string | null;
}
interface LicensePurchasedJson {
  artifact: string;
  buyer: string;
  price: number | string;
}
interface AccessChangedJson {
  artifact: string;
  who: string;
  kind: number | string;
}
interface RoyaltyPaidJson {
  artifact: string;
  payer: string;
  amount: number | string;
  accrued: number | string;
}
interface RevenueClaimedJson {
  artifact: string;
  owner: string;
  amount: number | string;
}
interface GroupMemberAddedJson {
  group: string;
  member: string;
}
interface DisputedJson {
  artifact: string;
  reporter: string;
  count: number | string;
}

/** Normalize a Move `Option<ID>` (rendered as `{ vec: [id?] }` or string/null). */
function parseOptionId(v: ArtifactRegisteredJson["parent"]): `0x${string}` | undefined {
  if (!v) return undefined;
  if (typeof v === "string") return v === "" ? undefined : (v as `0x${string}`);
  const first = v.vec?.[0];
  return first ? (first as `0x${string}`) : undefined;
}

/** Add `delta` to an artifact's leaderboard score (no-op if it is not indexed). */
function bumpScore(db: DB, artifactId: string, delta: number, label: string): void {
  const existing = getArtifact(db, artifactId);
  if (!existing) {
    console.warn(`[indexer] ${label} for unknown artifact=${artifactId} — skipping (not indexed yet)`);
    return;
  }
  existing.score = (existing.score ?? 0) + delta;
  upsertArtifact(db, existing);
  console.log(`[indexer] ${label} artifact=${artifactId} +${delta} score`);
}

/** Dispatch one Sui event into the read model. Routes by the event type suffix. */
function handleEvent(db: DB, ev: SuiEvent): void {
  // ev.type looks like `${pkg}::registry::ArtifactRegistered`.
  const name = ev.type.split("::").pop() ?? "";
  const json = ev.parsedJson;
  const tx = (ev.id?.txDigest ?? "0x") as `0x${string}`;

  switch (name) {
    case "ArtifactRegistered": {
      const a = json as ArtifactRegisteredJson;
      const tierU8 = Number(a.tier);
      const row: Artifact = {
        ipId: a.artifact as `0x${string}`,
        tier: appTier(tierU8),
        // The on-chain event carries no modality/title — default to a browsable
        // shell that the /api/index metadata layer refines. No invented titles.
        modality: "dataset",
        title: a.artifact,
        description: "",
        tags: [],
        ipMetadataURI: "",
        createdTx: tx,
        owner: a.owner as `0x${string}`,
        score: 0,
      };
      const parent = parseOptionId(a.parent);
      if (parent) row.parentIpId = parent;
      // Preserve any richer metadata a prior /api/index upsert already wrote.
      const existing = getArtifact(db, row.ipId);
      if (existing) {
        upsertArtifact(db, {
          ...existing,
          tier: row.tier,
          owner: row.owner,
          createdTx: existing.createdTx || row.createdTx,
          parentIpId: row.parentIpId ?? existing.parentIpId,
        });
      } else {
        upsertArtifact(db, row);
      }
      console.log(`[indexer] ArtifactRegistered ${row.ipId} tier=${row.tier} owner=${row.owner}`);
      break;
    }
    case "LicensePurchased": {
      const a = json as LicensePurchasedJson;
      bumpScore(db, a.artifact, 2, "LicensePurchased");
      break;
    }
    case "AccessChanged": {
      const a = json as AccessChangedJson;
      bumpScore(db, a.artifact, 1, `AccessChanged(kind=${a.kind})`);
      break;
    }
    case "RoyaltyPaid": {
      const a = json as RoyaltyPaidJson;
      bumpScore(db, a.artifact, 3, "RoyaltyPaid");
      break;
    }
    case "RevenueClaimed": {
      const a = json as RevenueClaimedJson;
      console.log(`[indexer] RevenueClaimed artifact=${a.artifact} amount=${a.amount} (no score change)`);
      break;
    }
    case "GroupCreated": {
      // Groups are not artifacts — nothing to upsert; membership arrives via
      // GroupMemberAdded. Logged for observability.
      console.log(`[indexer] GroupCreated ${JSON.stringify(json)}`);
      break;
    }
    case "GroupMemberAdded": {
      const a = json as GroupMemberAddedJson;
      const member = getArtifact(db, a.member);
      if (member) {
        member.groupId = a.group as `0x${string}`;
        upsertArtifact(db, member);
        console.log(`[indexer] GroupMemberAdded group=${a.group} member=${a.member}`);
      } else {
        console.warn(`[indexer] GroupMemberAdded for unknown member=${a.member} — skipping`);
      }
      break;
    }
    case "Disputed": {
      const a = json as DisputedJson;
      console.log(`[indexer] Disputed artifact=${a.artifact} count=${a.count} reporter=${a.reporter}`);
      break;
    }
    case "CounterEvidence": {
      console.log(`[indexer] CounterEvidence ${JSON.stringify(json)}`);
      break;
    }
    default:
      // Unknown / future event — ignore but keep the cursor advancing.
      break;
  }
}

/**
 * Drain every event newer than the saved cursor in ascending (oldest-first)
 * order, upserting each into the read model and advancing the persisted cursor
 * page by page. Returns the number of events consumed this drain.
 */
async function drainOnce(client: SuiClient, db: DB): Promise<number> {
  let cursor: EventCursor | null = getCursor(db, STREAM);
  let consumed = 0;

  for (;;) {
    const page = await client.queryEvents({
      query: { MoveModule: { package: REEF_PACKAGE_ID, module: MODULE } },
      cursor: cursor ?? undefined,
      limit: PAGE_LIMIT,
      order: "ascending",
    });

    for (const ev of page.data) {
      try {
        handleEvent(db, ev);
      } catch (e) {
        console.warn(`[indexer] failed to handle ${ev.type}: ${(e as Error).message}`);
      }
      consumed++;
    }

    if (page.nextCursor) {
      cursor = { txDigest: page.nextCursor.txDigest, eventSeq: page.nextCursor.eventSeq };
      setCursor(db, STREAM, cursor);
    }
    if (!page.hasNextPage) break;
  }

  return consumed;
}

async function runReal(): Promise<void> {
  if (!REEF_PACKAGE_ID || REEF_PACKAGE_ID.trim() === "") {
    throw new Error(
      "REEF_PACKAGE_ID is unset — cannot index. Set OV_REEF_PACKAGE_ID (or " +
        "NEXT_PUBLIC_OV_REEF_PACKAGE_ID) to the published Reef package id.",
    );
  }

  const db = openDb();
  const client = makeSuiClient();

  console.log(
    `[indexer] polling reef::registry events (package=${REEF_PACKAGE_ID}, interval=${POLL_INTERVAL_MS}ms)`,
  );

  // Poll forever. Each tick drains all new events; errors are logged and retried
  // on the next tick (the cursor only advances on a successful page).
  for (;;) {
    try {
      const n = await drainOnce(client, db);
      if (n > 0) console.log(`[indexer] consumed ${n} event(s)`);
    } catch (e) {
      console.warn(`[indexer] poll error: ${(e as Error).message}`);
    }
    await new Promise<void>((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
}

async function main(): Promise<void> {
  await runReal();
}

main().catch((err) => {
  console.error("[indexer] fatal:", err);
  process.exit(1);
});
