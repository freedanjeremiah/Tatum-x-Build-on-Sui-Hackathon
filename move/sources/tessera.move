/// Tessera registry — the on-chain artifact record + Seal access gate for the
/// Tessera decentralized data/model marketplace.
///
/// Each artifact is its OWN shared object of type `ArtifactRegistry` (one shared
/// object per artifact). `seal_approve` is dry-run by Seal key servers with the
/// SessionKey's address as the tx sender; an ABORT means DENY (fail closed).
///
/// Seal identity contract (matched by `lib/crypto.ts`):
///   sealId (64 bytes) = artifactObjectId(32 bytes) ++ blake2b256(utf8(tier))(32 bytes)
/// A4's `buildSealApproveTx` calls:
///   ${PACKAGE}::registry::seal_approve(id: vector<u8>, registry: &ArtifactRegistry)
/// argument order: id first, the shared ArtifactRegistry second. This module
/// matches that signature exactly.
///
/// The five Tessera access tiers (replacing the Solidity read-conditions in
/// contracts/*.sol) map to the `tier: u8` field:
///   0 = public        — anyone may read (OwnerReadCondition-free; open)
///   1 = private-owner — only the owner (OwnerReadCondition)
///   2 = gated-license — license holders OR owner (LicenseReadCondition)
///   3 = group         — group members OR owner (GroupLicenseReadCondition)
///   4 = compute       — ONLY an allowlisted compute worker (ComputeWorkerReadCondition):
///                       consumers are denied -> "computable, not downloadable".
module tessera::registry;

use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::event;
use sui::hash;
use sui::sui::SUI;
use sui::vec_set::{Self, VecSet};

// ---- tiers ----
const TIER_PUBLIC: u8 = 0;
const TIER_PRIVATE: u8 = 1;
const TIER_GATED: u8 = 2;
const TIER_GROUP: u8 = 3;
const TIER_COMPUTE: u8 = 4;

// ---- errors ----
const EBadId: u64 = 1; // seal id's 32-byte prefix != this artifact's object id
const EBadTier: u64 = 2; // seal id's 32-byte tier-hash suffix != this artifact's tier
const ERevoked: u64 = 3; // sender is on the revocation list (always denied)
const ENotOwner: u64 = 4; // private-owner tier: sender is not the owner
const ENoLicense: u64 = 5; // gated/group tier: sender holds no license / not a member
const ENotWorker: u64 = 6; // compute tier: sender is not an allowlisted worker
const EUnknownTier: u64 = 7; // tier field is not one of the five known tiers
const EWrongCap: u64 = 8; // ArtifactCap does not match this artifact
const EInvalidTier: u64 = 9; // register() called with a tier outside 0..=4
const ENotForSale: u64 = 10; // buy_license() on a non-gated/non-group tier
const EWrongPrice: u64 = 11; // buy_license() payment != the artifact's price
const EEmptyRevenue: u64 = 12; // claim_revenue() with nothing accrued (no royalty path)
const EZeroPayment: u64 = 13; // pay_royalty() with a zero-value coin

// ---- objects ----

/// The shared, per-artifact IP record AND Seal policy object. Named
/// `ArtifactRegistry` to match A4/B1's `seal_approve(id, registry: &ArtifactRegistry)`.
/// Shared so `seal_approve` (dry-run) and consumers can reference it.
public struct ArtifactRegistry has key {
    id: UID,
    owner: address,
    tier: u8,
    /// gated/group tier: SUI price (in MIST) for a permissionless `buy_license`.
    /// 0 means "not for sale via buy_license" — the owner can still grant access
    /// for free via `add_license_holder`.
    price: u64,
    /// gated-license tier: addresses holding a valid license for this artifact.
    license_holders: VecSet<address>,
    /// group tier: the group this artifact belongs to (off-chain group registry id).
    /// Membership is enforced here via `license_holders` as the per-artifact
    /// fallback (documented): adding a group member == add_license_holder.
    group_id: Option<ID>,
    /// compute tier: allowlisted confidential-compute worker operators.
    compute_workers: VecSet<address>,
    /// forward-only revocation audit trail; revoked addresses are always denied.
    revoked: VecSet<address>,
    /// derivative lineage (royalties): the parent artifact this was derived from.
    parent: Option<ID>,
    /// accrued royalty revenue (SUI/MIST), paid in via `pay_royalty` and withdrawn
    /// by the owner via `claim_revenue`. The on-chain "royalty vault" for this
    /// artifact — empty until the first `pay_royalty`.
    revenue: Balance<SUI>,
    /// arbitration: forward-only dispute counter. Incremented by `raise_dispute`.
    /// `disputed == (dispute_count > 0)` after at least one report is filed.
    dispute_count: u64,
    /// true once any dispute has been raised against this artifact (sticky flag).
    disputed: bool,
}

/// Owner capability — gates every mutating entry fun. Held by the registrant.
public struct ArtifactCap has key, store {
    id: UID,
    artifact: ID,
}

/// A shared group object: bundles a set of member artifact ids under one id.
/// Membership here is the on-chain source of truth for `distribute` (the
/// off-chain index mirrors it). Artifacts independently carry `group_id` so the
/// Seal `group` tier keeps working via each member's own `license_holders`.
public struct Group has key {
    id: UID,
    owner: address,
    /// member artifact ids bound to this group (insertion order preserved).
    members: VecSet<ID>,
}

/// Owner capability for a Group — gates `add_member`. Held by the group creator.
public struct GroupCap has key, store {
    id: UID,
    group: ID,
}

// ---- events ----

public struct ArtifactRegistered has copy, drop {
    artifact: ID,
    owner: address,
    tier: u8,
    parent: Option<ID>,
}
public struct AccessChanged has copy, drop {
    artifact: ID,
    who: address,
    /// 0=license added, 1=revoked, 2=compute worker added
    kind: u8,
}
/// Emitted when a buyer permissionlessly purchases a license via `buy_license`.
public struct LicensePurchased has copy, drop {
    artifact: ID,
    buyer: address,
    price: u64,
}
/// Emitted when royalty revenue is paid into an artifact's on-chain vault.
public struct RoyaltyPaid has copy, drop {
    artifact: ID,
    payer: address,
    amount: u64,
    /// total accrued revenue after this payment.
    accrued: u64,
}
/// Emitted when the owner withdraws the accrued revenue.
public struct RevenueClaimed has copy, drop {
    artifact: ID,
    owner: address,
    amount: u64,
}
/// Emitted when a Group is created (shared) by `create_group`.
public struct GroupCreated has copy, drop {
    group: ID,
    owner: address,
}
/// Emitted when a member artifact is added to a Group.
public struct GroupMemberAdded has copy, drop {
    group: ID,
    member: ID,
}
/// Emitted when a dispute (report) is raised against an artifact.
public struct Disputed has copy, drop {
    artifact: ID,
    reporter: address,
    /// Walrus blob id (or any opaque evidence pointer) as UTF-8 bytes.
    evidence: vector<u8>,
    /// running dispute count after this report.
    count: u64,
}
/// Emitted when counter-evidence is submitted against a raised dispute.
public struct CounterEvidence has copy, drop {
    artifact: ID,
    responder: address,
    evidence: vector<u8>,
}

// ---- registration / minting ----

/// Register a new artifact. Creates + SHARES an `ArtifactRegistry` and transfers
/// the owning `ArtifactCap` to the sender. Mirrors Tessera's
/// "register -> get object id -> then encrypt+store" invariant: the caller reads
/// the new object id from the tx effects, derives the sealId (A4), encrypts, and
/// stores the blob off-chain.
public entry fun register(tier: u8, price: u64, group_id: Option<ID>, ctx: &mut TxContext) {
    register_internal(tier, price, group_id, option::none<ID>(), ctx);
}

/// Register a derivative artifact whose lineage points at `parent` (royalties).
public entry fun register_derivative(
    tier: u8,
    price: u64,
    parent: ID,
    group_id: Option<ID>,
    ctx: &mut TxContext,
) {
    register_internal(tier, price, group_id, option::some(parent), ctx);
}

fun register_internal(
    tier: u8,
    price: u64,
    group_id: Option<ID>,
    parent: Option<ID>,
    ctx: &mut TxContext,
) {
    assert!(tier <= TIER_COMPUTE, EInvalidTier);
    let owner = ctx.sender();
    let artifact = ArtifactRegistry {
        id: object::new(ctx),
        owner,
        tier,
        price,
        license_holders: vec_set::empty<address>(),
        group_id,
        compute_workers: vec_set::empty<address>(),
        revoked: vec_set::empty<address>(),
        parent,
        revenue: balance::zero<SUI>(),
        dispute_count: 0,
        disputed: false,
    };
    let aid = object::id(&artifact);
    let cap = ArtifactCap { id: object::new(ctx), artifact: aid };
    event::emit(ArtifactRegistered { artifact: aid, owner, tier, parent });
    transfer::transfer(cap, owner);
    transfer::share_object(artifact);
}

fun assert_cap(cap: &ArtifactCap, self: &ArtifactRegistry) {
    assert!(cap.artifact == object::id(self), EWrongCap);
}

// ---- access management (owner-gated via ArtifactCap) ----

/// gated-license / group tier: grant `who` a license (or group membership).
public entry fun add_license_holder(cap: &ArtifactCap, self: &mut ArtifactRegistry, who: address) {
    assert_cap(cap, self);
    if (!self.license_holders.contains(&who)) {
        self.license_holders.insert(who);
        if (self.revoked.contains(&who)) { self.revoked.remove(&who); };
        event::emit(AccessChanged { artifact: object::id(self), who, kind: 0 });
    }
}

/// Permissionless license purchase. ANYONE may call this to buy a license for a
/// gated-license / group tier artifact: the exact `price` (in MIST) is paid to
/// the artifact owner, and the buyer (`ctx.sender()`) is added to
/// `license_holders` — which is exactly what `seal_approve` checks for the gated
/// branch. Aborts on a non-gated/non-group tier (ENotForSale) or a payment whose
/// value is not equal to the artifact's `price` (EWrongPrice). A revoked buyer is
/// un-revoked on purchase, mirroring `add_license_holder`.
public entry fun buy_license(
    self: &mut ArtifactRegistry,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    assert!(self.tier == TIER_GATED || self.tier == TIER_GROUP, ENotForSale);
    assert!(coin::value(&payment) == self.price, EWrongPrice);

    let buyer = ctx.sender();
    transfer::public_transfer(payment, self.owner);

    event::emit(LicensePurchased { artifact: object::id(self), buyer, price: self.price });
    if (!self.license_holders.contains(&buyer)) {
        self.license_holders.insert(buyer);
        if (self.revoked.contains(&buyer)) { self.revoked.remove(&buyer); };
        event::emit(AccessChanged { artifact: object::id(self), who: buyer, kind: 0 });
    }
}

/// Forward-only revocation: blocks future key issuance. Already-decrypted local
/// copies are NOT retracted. Also removes any current license / worker grant.
public entry fun revoke(cap: &ArtifactCap, self: &mut ArtifactRegistry, who: address) {
    assert_cap(cap, self);
    if (self.license_holders.contains(&who)) { self.license_holders.remove(&who); };
    if (self.compute_workers.contains(&who)) { self.compute_workers.remove(&who); };
    if (!self.revoked.contains(&who)) {
        self.revoked.insert(who);
        event::emit(AccessChanged { artifact: object::id(self), who, kind: 1 });
    }
}

/// compute tier: allowlist a confidential-compute worker operator.
public entry fun add_compute_worker(cap: &ArtifactCap, self: &mut ArtifactRegistry, who: address) {
    assert_cap(cap, self);
    if (!self.compute_workers.contains(&who)) {
        self.compute_workers.insert(who);
        if (self.revoked.contains(&who)) { self.revoked.remove(&who); };
        event::emit(AccessChanged { artifact: object::id(self), who, kind: 2 });
    }
}

/// group tier: (re)bind this artifact to a group id.
public entry fun set_group(cap: &ArtifactCap, self: &mut ArtifactRegistry, group_id: ID) {
    assert_cap(cap, self);
    self.group_id = option::some(group_id);
}

// ---- royalties (on-chain revenue vault) ----

/// Pay royalty revenue into this artifact's on-chain vault. Permissionless:
/// ANYONE may pay (a derivative's licensee tipping upstream, a marketplace
/// forwarding a cut, etc.). The whole `payment` coin is accrued to
/// `self.revenue`; the owner later withdraws it via `claim_revenue`. Aborts on a
/// zero-value payment (EZeroPayment) so callers cannot emit a no-op RoyaltyPaid.
public entry fun pay_royalty(
    self: &mut ArtifactRegistry,
    payment: Coin<SUI>,
    ctx: &mut TxContext,
) {
    let amount = coin::value(&payment);
    assert!(amount > 0, EZeroPayment);
    self.revenue.join(payment.into_balance());
    let accrued = self.revenue.value();
    event::emit(RoyaltyPaid {
        artifact: object::id(self),
        payer: ctx.sender(),
        amount,
        accrued,
    });
}

/// Owner-only: withdraw ALL accrued royalty revenue to the owner. Cap-gated
/// (the ArtifactCap proves ownership). Aborts if nothing has accrued
/// (EEmptyRevenue) — the honest "no royalty path / NoRoyaltyVault" signal.
public entry fun claim_revenue(
    cap: &ArtifactCap,
    self: &mut ArtifactRegistry,
    ctx: &mut TxContext,
) {
    assert_cap(cap, self);
    let amount = self.revenue.value();
    assert!(amount > 0, EEmptyRevenue);
    let withdrawn = self.revenue.withdraw_all();
    let payout = coin::from_balance(withdrawn, ctx);
    transfer::public_transfer(payout, self.owner);
    event::emit(RevenueClaimed { artifact: object::id(self), owner: self.owner, amount });
}

// ---- groups (shared bundle object) ----

/// Create + SHARE a new `Group`, transferring the owning `GroupCap` to the
/// sender. The caller reads the new Group object id from the tx effects and
/// binds member artifacts to it (via `set_group` / `add_member`).
public entry fun create_group(ctx: &mut TxContext) {
    let owner = ctx.sender();
    let group = Group { id: object::new(ctx), owner, members: vec_set::empty<ID>() };
    let gid = object::id(&group);
    let cap = GroupCap { id: object::new(ctx), group: gid };
    event::emit(GroupCreated { group: gid, owner });
    transfer::transfer(cap, owner);
    transfer::share_object(group);
}

/// Record a member artifact id in a Group. Cap-gated by the GroupCap. Idempotent.
public entry fun add_member(cap: &GroupCap, group: &mut Group, member: ID) {
    assert!(cap.group == object::id(group), EWrongCap);
    if (!group.members.contains(&member)) {
        group.members.insert(member);
        event::emit(GroupMemberAdded { group: object::id(group), member });
    }
}

// ---- disputes / arbitration ----

/// Raise a dispute (report) against this artifact. Permissionless: anyone may
/// file evidence. Sets the sticky `disputed` flag, bumps `dispute_count`, and
/// emits a `Disputed` event carrying the opaque evidence pointer (CID bytes).
public entry fun raise_dispute(
    self: &mut ArtifactRegistry,
    evidence: vector<u8>,
    ctx: &mut TxContext,
) {
    self.dispute_count = self.dispute_count + 1;
    self.disputed = true;
    event::emit(Disputed {
        artifact: object::id(self),
        reporter: ctx.sender(),
        evidence,
        count: self.dispute_count,
    });
}

/// Submit counter-evidence against a raised dispute. Permissionless (typically
/// the owner). Emits a `CounterEvidence` event; does not clear `disputed`
/// (resolution is an off-chain arbitration decision, intentionally not modeled).
public entry fun counter_dispute(
    self: &ArtifactRegistry,
    evidence: vector<u8>,
    ctx: &TxContext,
) {
    event::emit(CounterEvidence {
        artifact: object::id(self),
        responder: ctx.sender(),
        evidence,
    });
}

// ---- the Seal gate ----

/// Returns true iff `id` (>= 64 bytes) starts with this artifact's 32-byte object
/// id prefix.
fun has_id_prefix(self: &ArtifactRegistry, id: &vector<u8>): bool {
    let prefix = object::id(self).to_bytes(); // 32 bytes
    if (id.length() < 64) return false; // sealId is exactly prefix(32) ++ tierHash(32)
    let mut i = 0;
    while (i < 32) {
        if (id[i] != prefix[i]) return false;
        i = i + 1;
    };
    true
}

/// Returns true iff bytes [32, 64) of `id` equal blake2b256(utf8(tier_label)),
/// binding the ciphertext to a specific tier (prevents decrypting a public-tier
/// blob under the private-tier branch, etc.). Mirrors A4's
/// sealId = objId ++ blake2b256(utf8(tier)).
fun has_tier_suffix(id: &vector<u8>, tier: u8): bool {
    let want = hash::blake2b256(&tier_label(tier));
    let mut i = 0;
    while (i < 32) {
        if (id[32 + i] != want[i]) return false;
        i = i + 1;
    };
    true
}

/// The exact tier label strings A4 hashes (`ArtifactTier` union in lib/crypto.ts).
fun tier_label(tier: u8): vector<u8> {
    if (tier == TIER_PUBLIC) { b"public" }
    else if (tier == TIER_PRIVATE) { b"private-owner" }
    else if (tier == TIER_GATED) { b"gated-license" }
    else if (tier == TIER_GROUP) { b"group" }
    else if (tier == TIER_COMPUTE) { b"compute" }
    else { abort EUnknownTier }
}

/// Seal policy gate. Key servers dry-run this with the SessionKey's address as
/// sender; an ABORT means DENY (fail closed). Grants a key iff:
///   1. the id's 32-byte prefix is this artifact's object id (binding), and
///   2. the id's 32-byte suffix is blake2b256(utf8(tier)) for THIS artifact's
///      stored tier (tier binding), and
///   3. the sender is NOT revoked, and
///   4. the per-tier rule passes:
///        public        -> always allow
///        private-owner -> sender == owner
///        gated-license -> license_holders.contains(sender) || sender == owner
///        group         -> license_holders.contains(sender) || sender == owner
///        compute       -> compute_workers.contains(sender) ONLY (owner/consumer denied)
entry fun seal_approve(id: vector<u8>, registry: &ArtifactRegistry, ctx: &TxContext) {
    assert!(has_id_prefix(registry, &id), EBadId);
    assert!(has_tier_suffix(&id, registry.tier), EBadTier);

    let sender = ctx.sender();
    assert!(!registry.revoked.contains(&sender), ERevoked);

    let tier = registry.tier;
    if (tier == TIER_PUBLIC) {
        // open: allow
    } else if (tier == TIER_PRIVATE) {
        assert!(sender == registry.owner, ENotOwner);
    } else if (tier == TIER_GATED || tier == TIER_GROUP) {
        assert!(
            sender == registry.owner || registry.license_holders.contains(&sender),
            ENoLicense,
        );
    } else if (tier == TIER_COMPUTE) {
        // "computable, not downloadable": ONLY an allowlisted worker, never the
        // owner or a consumer.
        assert!(registry.compute_workers.contains(&sender), ENotWorker);
    } else {
        abort EUnknownTier
    }
}

// ---- read-only accessors (tests / off-chain mirrors) ----
public fun owner(self: &ArtifactRegistry): address { self.owner }
public fun tier(self: &ArtifactRegistry): u8 { self.tier }
public fun price(self: &ArtifactRegistry): u64 { self.price }
public fun group_id(self: &ArtifactRegistry): Option<ID> { self.group_id }
public fun parent(self: &ArtifactRegistry): Option<ID> { self.parent }
public fun is_license_holder(self: &ArtifactRegistry, who: address): bool {
    self.license_holders.contains(&who)
}
public fun is_compute_worker(self: &ArtifactRegistry, who: address): bool {
    self.compute_workers.contains(&who)
}
public fun is_revoked(self: &ArtifactRegistry, who: address): bool {
    self.revoked.contains(&who)
}
/// Accrued royalty revenue (MIST) currently held in this artifact's vault.
public fun revenue(self: &ArtifactRegistry): u64 { self.revenue.value() }
/// True once any dispute has been raised against this artifact.
public fun is_disputed(self: &ArtifactRegistry): bool { self.disputed }
/// Number of disputes raised against this artifact.
public fun dispute_count(self: &ArtifactRegistry): u64 { self.dispute_count }
/// Group owner address.
public fun group_owner(group: &Group): address { group.owner }
/// True iff `member` is recorded in this Group.
public fun group_has_member(group: &Group, member: ID): bool {
    group.members.contains(&member)
}
/// Number of members recorded in this Group.
public fun group_size(group: &Group): u64 { group.members.length() }

// ---- test-only helpers ----
#[test_only]
/// Build a valid 64-byte sealId (objId ++ blake2b256(tier_label)) for `self`.
public fun test_seal_id(self: &ArtifactRegistry): vector<u8> {
    let mut id = object::id(self).to_bytes();
    id.append(hash::blake2b256(&tier_label(self.tier)));
    id
}

#[test_only]
public fun test_seal_approve(id: vector<u8>, registry: &ArtifactRegistry, ctx: &TxContext) {
    seal_approve(id, registry, ctx)
}
