// Reef registry adapter — on-chain artifact registration via Sui Move.
//
// Backed by the `reef::registry` Move module: each artifact is its OWN shared
// object (`ArtifactRegistry`) whose object id IS the Seal id prefix (see
// lib/crypto.ts `sealIdBytes`). The owner receives an `ArtifactCap`.
//
// The register-before-encrypt invariant: callers MUST `register(...)` first,
// read the returned `artifactId` (the ArtifactRegistry object id) from the tx
// effects, derive the sealId from it, THEN encrypt + store the blob. This module
// returns that `artifactId` so lib/artifacts.ts can hold it.
//
// Adapted from sharegraph packages/core/src/chain.ts (SessionClient): the
// `exec()` fail-closed unwrap of the v2 tagged-union result, locating created
// object ids by matching `objectTypes` over `effects.changedObjects`, and the
// VecSet JSON parsing in getSessionState. Do NOT import from sharegraph.
//
// Never logs secrets. Throws on any failed/aborted tx (no silent fallbacks).

import { Transaction } from "@mysten/sui/transactions";

import type { SuiClient, Signer } from "./clients";
import { REEF_PACKAGE_ID } from "./constants";
import {
  buildSealApproveTx as cryptoBuildSealApproveTx,
  type ArtifactTier,
} from "./crypto";

const MOD = "registry";

// ---------------------------------------------------------------------------
// Tier <-> u8 mapping. The on-chain `tier: u8` field (registry.move):
//   0=public  1=private-owner  2=gated-license  3=group  4=compute
// ---------------------------------------------------------------------------

const TIER_TO_U8: Record<ArtifactTier, number> = {
  public: 0,
  "private-owner": 1,
  "gated-license": 2,
  group: 3,
  compute: 4,
};

const U8_TO_TIER: ArtifactTier[] = [
  "public",
  "private-owner",
  "gated-license",
  "group",
  "compute",
];

/** Map an ArtifactTier string to its on-chain u8 value. Throws on unknown tier. */
export function tierToU8(tier: ArtifactTier): number {
  const u = TIER_TO_U8[tier];
  if (u === undefined) throw new Error(`tierToU8: unknown tier "${tier}"`);
  return u;
}

/** Map an on-chain u8 tier value back to its ArtifactTier string. Throws if out of range. */
export function u8ToTier(u: number): ArtifactTier {
  const t = U8_TO_TIER[u];
  if (t === undefined) throw new Error(`u8ToTier: tier value ${u} out of range 0..4`);
  return t;
}

// ---------------------------------------------------------------------------
// Return / state types.
// ---------------------------------------------------------------------------

/** Result of register / registerDerivative — the created shared object + owner cap. */
export interface RegisterResult {
  /** ArtifactRegistry shared object id. This is the Seal id prefix (lib/crypto.ts). */
  artifactId: string;
  /** ArtifactCap object id — held by the owner; gates every mutating entry fun. */
  capId: string;
  /** Transaction digest. */
  digest: string;
}

/** Typed off-chain mirror of an on-chain ArtifactRegistry shared object. */
export interface ArtifactState {
  /** The ArtifactRegistry object id. */
  id: string;
  /** Owner address (the registrant). */
  owner: string;
  /** Access tier (string form of the on-chain u8). */
  tier: ArtifactTier;
  /** Raw on-chain u8 tier value. */
  tierU8: number;
  /** gated/group tier: SUI price (in MIST) for a permissionless `buy_license`.
   *  0 means "not for sale via buy_license" (owner can still grant for free). */
  price: bigint;
  /** Group id this artifact is bound to, or null (group tier). */
  groupId: string | null;
  /** Parent artifact id for derivatives, or null. */
  parent: string | null;
  /** gated-license / group tier: addresses holding a license. */
  licenseHolders: string[];
  /** compute tier: allowlisted compute-worker operators. */
  computeWorkers: string[];
  /** Forward-only revocation list — always denied. */
  revoked: string[];
  /** Accrued royalty revenue (MIST) in this artifact's on-chain vault. */
  revenue: bigint;
  /** True once any dispute has been raised against this artifact. */
  disputed: boolean;
  /** Number of disputes raised against this artifact. */
  disputeCount: bigint;
}

// ---------------------------------------------------------------------------
// RegistryClient.
// ---------------------------------------------------------------------------

export class RegistryClient {
  constructor(
    readonly client: SuiClient,
    readonly packageId: string = REEF_PACKAGE_ID,
  ) {
    if (!packageId || packageId.trim() === "") {
      throw new Error(
        "RegistryClient: missing packageId (REEF_PACKAGE_ID is unset). " +
          "Set NEXT_PUBLIC_OV_REEF_PACKAGE_ID or OV_REEF_PACKAGE_ID.",
      );
    }
  }

  private target(fn: string): `${string}::${string}::${string}` {
    return `${this.packageId}::${MOD}::${fn}`;
  }

  // -------------------------------------------------------------------------
  // exec — execute a signed tx, unwrap the v2 tagged-union result, fail closed.
  // Adapted from sharegraph chain.ts `exec`. Returns the digest, effects, and
  // the per-object type map used to locate created objects.
  // -------------------------------------------------------------------------
  private async exec(
    tx: Transaction,
    signer: Signer,
  ): Promise<{ digest: string; effects: any; objectTypes: Record<string, string> }> {
    const r = await this.client.core.signAndExecuteTransaction({
      transaction: tx,
      signer,
      include: { effects: true, objectTypes: true, events: true },
    });
    if (r.$kind !== "Transaction" || !r.Transaction) {
      const f = (r as any).FailedTransaction;
      throw new Error(
        `registry tx failed: ${JSON.stringify(f?.effects?.status?.error ?? r.$kind)}`,
      );
    }
    const t = r.Transaction;
    if (t.effects && !t.effects.status.success) {
      throw new Error(`registry tx aborted: ${JSON.stringify(t.effects.status.error)}`);
    }
    await this.client.core.waitForTransaction({ digest: t.digest });
    return {
      digest: t.digest,
      effects: t.effects,
      objectTypes: (t.objectTypes ?? {}) as Record<string, string>,
    };
  }

  /**
   * Locate the created ArtifactRegistry + ArtifactCap object ids from tx effects.
   * Matches the per-object type strings in `objectTypes` against the Move type
   * suffixes (sharegraph's technique). Throws if either is missing.
   */
  private locateCreated(
    effects: any,
    objectTypes: Record<string, string>,
  ): { artifactId: string; capId: string } {
    let artifactId: string | undefined;
    let capId: string | undefined;
    for (const o of effects?.changedObjects ?? []) {
      if (o.idOperation !== "Created") continue;
      const ty = objectTypes[o.objectId] ?? "";
      if (ty.endsWith("::registry::ArtifactRegistry")) artifactId = o.objectId;
      else if (ty.endsWith("::registry::ArtifactCap")) capId = o.objectId;
    }
    if (!artifactId || !capId) {
      throw new Error(
        "registry: could not locate created ArtifactRegistry/ArtifactCap in tx effects",
      );
    }
    return { artifactId, capId };
  }

  /**
   * Register a new artifact. Builds the `register(tier, group_id, ctx)` moveCall,
   * passing `group_id` as `Option<ID>` (`none` unless `opts.groupId` is given),
   * executes, and returns the created `ArtifactRegistry` id (`artifactId`) plus
   * the owner `ArtifactCap` id. `artifactId` is the Seal id prefix — derive the
   * sealId from it (lib/crypto.ts) BEFORE encrypting (register-before-encrypt).
   */
  async register(
    tier: ArtifactTier,
    opts: { groupId?: string; price?: bigint },
    signer: Signer,
  ): Promise<RegisterResult> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("register"),
      arguments: [
        tx.pure.u8(tierToU8(tier)),
        tx.pure.u64(opts.price ?? 0n),
        tx.pure.option("id", opts.groupId ?? null),
      ],
    });
    const { digest, effects, objectTypes } = await this.exec(tx, signer);
    const { artifactId, capId } = this.locateCreated(effects, objectTypes);
    return { artifactId, capId, digest };
  }

  /**
   * Register a derivative artifact whose lineage points at `parentId` (royalties).
   * Builds `register_derivative(tier, parent, group_id, ctx)`. Same return shape
   * as `register`.
   */
  async registerDerivative(
    tier: ArtifactTier,
    parentId: string,
    opts: { groupId?: string; price?: bigint },
    signer: Signer,
  ): Promise<RegisterResult> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("register_derivative"),
      arguments: [
        tx.pure.u8(tierToU8(tier)),
        tx.pure.u64(opts.price ?? 0n),
        tx.pure.id(parentId),
        tx.pure.option("id", opts.groupId ?? null),
      ],
    });
    const { digest, effects, objectTypes } = await this.exec(tx, signer);
    const { artifactId, capId } = this.locateCreated(effects, objectTypes);
    return { artifactId, capId, digest };
  }

  /**
   * Register a compute-result derivative gated on an enclave signature. Builds
   * register_derivative_attested(tier, price, parent, group_id, enclave,
   * timestamp_ms, algo_hash, metrics, signature) and executes it. The Move call
   * aborts (and this rejects) if the enclave signature does not verify on-chain.
   */
  async registerDerivativeAttested(
    args: {
      tier: ArtifactTier;
      parentId: string;
      enclaveObjectId: string;
      timestampMs: bigint;
      algoHash: string;
      metrics: Uint8Array;
      signature: Uint8Array;
      price?: bigint;
      groupId?: string;
    },
    signer: Signer,
  ): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("register_derivative_attested"),
      arguments: [
        tx.pure.u8(tierToU8(args.tier)),
        tx.pure.u64(args.price ?? 0n),
        tx.pure.id(args.parentId),
        tx.pure.option("id", args.groupId ?? null),
        tx.object(args.enclaveObjectId),
        tx.pure.u64(args.timestampMs),
        tx.pure.vector("u8", Array.from(new TextEncoder().encode(args.algoHash))),
        tx.pure.vector("u8", Array.from(args.metrics)),
        tx.pure.vector("u8", Array.from(args.signature)),
      ],
    });
    const { digest } = await this.exec(tx, signer);
    return digest;
  }

  // -------------------------------------------------------------------------
  // Cap-gated mutating entry funs. Each takes the ArtifactCap and the shared
  // ArtifactRegistry by object ref, plus the target address.
  // -------------------------------------------------------------------------

  /** gated-license / group tier: grant `who` a license (or group membership). */
  async addLicenseHolder(
    capId: string,
    artifactId: string,
    who: string,
    signer: Signer,
  ): Promise<string> {
    return this.capCall("add_license_holder", capId, artifactId, who, signer);
  }

  /**
   * Permissionless license purchase (gated/group tier only). The `signer` (buyer)
   * pays exactly `price` MIST to the artifact owner and is added to
   * `license_holders` — satisfying `seal_approve` for the gated branch. Splits the
   * payment off the gas coin so any signer with enough SUI can buy. The on-chain
   * `buy_license` aborts on a non-gated tier or a payment != the artifact's price.
   * Returns the tx digest.
   */
  async buyLicense(artifactId: string, price: bigint, signer: Signer): Promise<string> {
    const tx = new Transaction();
    const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(price)]);
    tx.moveCall({
      target: this.target("buy_license"),
      arguments: [tx.object(artifactId), payment],
    });
    return (await this.exec(tx, signer)).digest;
  }

  /** Forward-only revocation: blocks future key issuance for `who`. */
  async revoke(
    capId: string,
    artifactId: string,
    who: string,
    signer: Signer,
  ): Promise<string> {
    return this.capCall("revoke", capId, artifactId, who, signer);
  }

  /** compute tier: allowlist a confidential-compute worker operator `who`. */
  async addComputeWorker(
    capId: string,
    artifactId: string,
    who: string,
    signer: Signer,
  ): Promise<string> {
    return this.capCall("add_compute_worker", capId, artifactId, who, signer);
  }

  /** group tier: (re)bind this artifact to a group id. */
  async setGroup(
    capId: string,
    artifactId: string,
    groupId: string,
    signer: Signer,
  ): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("set_group"),
      arguments: [tx.object(capId), tx.object(artifactId), tx.pure.id(groupId)],
    });
    return (await this.exec(tx, signer)).digest;
  }

  private async capCall(
    fn: string,
    capId: string,
    artifactId: string,
    who: string,
    signer: Signer,
  ): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target(fn),
      arguments: [tx.object(capId), tx.object(artifactId), tx.pure.address(who)],
    });
    return (await this.exec(tx, signer)).digest;
  }

  // -------------------------------------------------------------------------
  // getArtifact — read the shared ArtifactRegistry object into a typed mirror.
  // Adapted from sharegraph chain.ts `getSessionState` (VecSet JSON parsing).
  // -------------------------------------------------------------------------

  async getArtifact(artifactId: string): Promise<ArtifactState> {
    const res = await this.client.core.getObject({
      objectId: artifactId,
      include: { json: true },
    });
    const j = ((res as any).object?.json ?? {}) as any;

    const tierU8 = Number(j.tier ?? 0);
    return {
      id: artifactId,
      owner: String(j.owner ?? ""),
      tier: u8ToTier(tierU8),
      tierU8,
      price: BigInt(j.price ?? 0),
      groupId: parseOptionId(j.group_id),
      parent: parseOptionId(j.parent),
      licenseHolders: vecSetAddrs(j.license_holders),
      computeWorkers: vecSetAddrs(j.compute_workers),
      revoked: vecSetAddrs(j.revoked),
      revenue: parseBalance(j.revenue),
      disputed: Boolean(j.disputed ?? false),
      disputeCount: BigInt(j.dispute_count ?? 0),
    };
  }

  // -------------------------------------------------------------------------
  // Royalties — on-chain revenue vault (reef::registry pay/claim).
  // -------------------------------------------------------------------------

  /**
   * Pay royalty revenue into an artifact's on-chain vault. Permissionless: the
   * `signer` pays `amount` MIST (split off the gas coin) into `self.revenue` via
   * the Move `pay_royalty` entry fun. Throws on a zero amount before signing.
   * Returns the tx digest.
   */
  async payRoyalty(artifactId: string, amount: bigint, signer: Signer): Promise<string> {
    if (amount <= 0n) throw new Error("payRoyalty: amount must be > 0");
    const tx = new Transaction();
    const [payment] = tx.splitCoins(tx.gas, [tx.pure.u64(amount)]);
    tx.moveCall({
      target: this.target("pay_royalty"),
      arguments: [tx.object(artifactId), payment],
    });
    return (await this.exec(tx, signer)).digest;
  }

  /** Read an artifact's accrued (claimable) royalty revenue, in MIST. */
  async getRevenue(artifactId: string): Promise<bigint> {
    return (await this.getArtifact(artifactId)).revenue;
  }

  /**
   * Owner-only: withdraw ALL accrued royalty revenue to the owner. Cap-gated by
   * the ArtifactCap. The Move `claim_revenue` aborts (EEmptyRevenue) if nothing
   * has accrued. Returns the tx digest.
   */
  async claimRevenue(capId: string, artifactId: string, signer: Signer): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("claim_revenue"),
      arguments: [tx.object(capId), tx.object(artifactId)],
    });
    return (await this.exec(tx, signer)).digest;
  }

  // -------------------------------------------------------------------------
  // Groups — shared Group bundle object (reef::registry create_group/add_member).
  // -------------------------------------------------------------------------

  /**
   * Create + share a new `Group`, returning its object id and the owning
   * `GroupCap` id. Locates both from the tx effects by Move type suffix.
   */
  async createGroup(signer: Signer): Promise<{ groupId: string; capId: string; digest: string }> {
    const tx = new Transaction();
    tx.moveCall({ target: this.target("create_group"), arguments: [] });
    const { digest, effects, objectTypes } = await this.exec(tx, signer);
    let groupId: string | undefined;
    let capId: string | undefined;
    for (const o of effects?.changedObjects ?? []) {
      if (o.idOperation !== "Created") continue;
      const ty = objectTypes[o.objectId] ?? "";
      if (ty.endsWith("::registry::Group")) groupId = o.objectId;
      else if (ty.endsWith("::registry::GroupCap")) capId = o.objectId;
    }
    if (!groupId || !capId) {
      throw new Error("registry: could not locate created Group/GroupCap in tx effects");
    }
    return { groupId, capId, digest };
  }

  /** Record `memberArtifactId` in a Group. Cap-gated by the GroupCap. */
  async addMember(
    groupCapId: string,
    groupId: string,
    memberArtifactId: string,
    signer: Signer,
  ): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("add_member"),
      arguments: [tx.object(groupCapId), tx.object(groupId), tx.pure.id(memberArtifactId)],
    });
    return (await this.exec(tx, signer)).digest;
  }

  // -------------------------------------------------------------------------
  // Disputes — on-chain flag + events (reef::registry raise/counter_dispute).
  // -------------------------------------------------------------------------

  /**
   * Raise a dispute (report) against an artifact with opaque `evidence` (a CID,
   * UTF-8 encoded). Permissionless. Sets the sticky on-chain `disputed` flag and
   * emits a `Disputed` event. Returns the tx digest.
   */
  async raiseDispute(artifactId: string, evidence: Uint8Array, signer: Signer): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("raise_dispute"),
      arguments: [tx.object(artifactId), tx.pure.vector("u8", Array.from(evidence))],
    });
    return (await this.exec(tx, signer)).digest;
  }

  /**
   * Submit counter-evidence against a raised dispute. Permissionless (typically
   * the owner). Emits a `CounterEvidence` event; does not clear `disputed`.
   * Returns the tx digest.
   */
  async counterDispute(artifactId: string, evidence: Uint8Array, signer: Signer): Promise<string> {
    const tx = new Transaction();
    tx.moveCall({
      target: this.target("counter_dispute"),
      arguments: [tx.object(artifactId), tx.pure.vector("u8", Array.from(evidence))],
    });
    return (await this.exec(tx, signer)).digest;
  }

  // -------------------------------------------------------------------------
  // Seal download path — single import site for B2. Wraps lib/crypto.ts
  // buildSealApproveTx, binding the package id this client was constructed with.
  // -------------------------------------------------------------------------

  /**
   * Build the `seal_approve` transaction kind for decrypting `(artifactId, tier)`.
   * Caller supplies the 64-byte sealId (from lib/crypto.ts `sealIdBytes`).
   * Returns BCS-encoded transaction-kind bytes for `Crypto.decrypt`.
   */
  buildSealApproveTx(artifactId: string, sealId: Uint8Array): Promise<Uint8Array> {
    return cryptoBuildSealApproveTx(artifactId, sealId, this.client, this.packageId);
  }
}

// ---------------------------------------------------------------------------
// Re-export buildSealApproveTx from lib/crypto.ts so B2 has one import site
// (either the standalone fn or the RegistryClient method above).
// ---------------------------------------------------------------------------

export { buildSealApproveTx } from "./crypto";

export type { ArtifactTier } from "./crypto";

// ---------------------------------------------------------------------------
// JSON parsing helpers (Move VecSet + Option over the v2 core JSON view).
// ---------------------------------------------------------------------------

/**
 * A Move `Option<T>` renders, over the JSON view, as either the inner value /
 * `null` (flattened), or a `{ vec: [v?] }` wrapper, or a VecSet-style
 * `{ fields: { vec: [...] } }`. Normalize all of these to `value | null`.
 */
function parseOptionId(v: any): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v === "" ? null : v;
  // { vec: [...] } or { fields: { vec: [...] } }
  const vec = v?.vec ?? v?.fields?.vec;
  if (Array.isArray(vec)) {
    const first = vec[0];
    if (first === undefined || first === null) return null;
    return typeof first === "string" ? first : String(first?.fields?.id ?? first);
  }
  // { Some: id } / { some: id }
  const some = v?.Some ?? v?.some;
  if (typeof some === "string") return some;
  return null;
}

/**
 * A Move `VecSet<address>` renders as `{ fields: { contents: [...] } }` (or
 * `{ contents: [...] }`, or a bare array) over the JSON view. Extract the
 * address strings.
 */
function vecSetAddrs(v: any): string[] {
  const contents: any[] = v?.fields?.contents ?? v?.contents ?? (Array.isArray(v) ? v : []);
  return contents.map((x: any) => (typeof x === "string" ? x : x?.fields?.key ?? String(x)));
}

/**
 * A Move `Balance<SUI>` renders over the JSON view as either the bare u64 value
 * (string/number), or `{ value: "..." }`, or `{ fields: { value: "..." } }`.
 * Normalize all of these to a bigint MIST amount (0n on absence).
 */
function parseBalance(v: any): bigint {
  if (v === null || v === undefined) return 0n;
  if (typeof v === "string" || typeof v === "number" || typeof v === "bigint") {
    return BigInt(v);
  }
  const inner = v?.value ?? v?.fields?.value;
  if (inner === undefined || inner === null) return 0n;
  return BigInt(inner);
}
