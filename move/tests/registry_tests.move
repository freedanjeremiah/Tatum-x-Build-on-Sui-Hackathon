#[test_only]
module reef::registry_tests;

use sui::coin;
use sui::sui::SUI;
use sui::test_scenario as ts;
use reef::registry::{Self, ArtifactRegistry, ArtifactCap, Group, GroupCap};

const OWNER: address = @0xA;
const BOB: address = @0xB; // license holder / worker
const EVE: address = @0xE; // outsider / consumer

// tiers
const TIER_PUBLIC: u8 = 0;
const TIER_PRIVATE: u8 = 1;
const TIER_GATED: u8 = 2;
const TIER_COMPUTE: u8 = 4;

// ---- registration ----

#[test]
fun register_shares_and_sets_owner() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PRIVATE, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    assert!(registry::owner(&art) == OWNER, 0);
    assert!(registry::tier(&art) == TIER_PRIVATE, 1);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.end();
}

// ---- private-owner tier ----

#[test]
fun private_owner_can_decrypt() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PRIVATE, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    let id = registry::test_seal_id(&art);
    registry::test_seal_approve(id, &art, sc.ctx()); // owner -> must NOT abort
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::ENotOwner)]
fun private_non_owner_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PRIVATE, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    let id = registry::test_seal_id(&art);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.next_tx(EVE); // EVE is not the owner
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art2, sc.ctx()); // -> ENotOwner
    ts::return_shared(art2);
    sc.end();
}

// ---- gated-license tier ----

#[test]
fun gated_license_holder_passes() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    registry::add_license_holder(&cap, &mut art, BOB);
    let id = registry::test_seal_id(&art);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.next_tx(BOB); // BOB holds a license
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art2, sc.ctx()); // -> must NOT abort
    ts::return_shared(art2);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::ENoLicense)]
fun gated_non_holder_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    let id = registry::test_seal_id(&art);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.next_tx(EVE); // EVE holds no license
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art2, sc.ctx()); // -> ENoLicense
    ts::return_shared(art2);
    sc.end();
}

// ---- buy_license (permissionless purchase) ----

const PRICE: u64 = 1_000_000_000; // 1 SUI in MIST

#[test]
fun buy_license_pays_owner_and_adds_holder() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, PRICE, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    assert!(registry::price(&art) == PRICE, 0);
    ts::return_shared(art);
    sc.return_to_sender(cap);

    // BOB buys a license with an exact-price SUI coin.
    sc.next_tx(BOB);
    let mut art2 = sc.take_shared<ArtifactRegistry>();
    let pay = coin::mint_for_testing<SUI>(PRICE, sc.ctx());
    registry::buy_license(&mut art2, pay, sc.ctx());
    assert!(registry::is_license_holder(&art2, BOB), 1); // holder added
    let id = registry::test_seal_id(&art2);
    ts::return_shared(art2);

    // BOB now satisfies seal_approve for the gated tier.
    sc.next_tx(BOB);
    let art3 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art3, sc.ctx()); // -> must NOT abort
    ts::return_shared(art3);

    // Payment moved to the owner: OWNER now holds a Coin<SUI> of value PRICE.
    sc.next_tx(OWNER);
    let received = sc.take_from_sender<coin::Coin<SUI>>();
    assert!(coin::value(&received) == PRICE, 2);
    sc.return_to_sender(received);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::ENotForSale)]
fun buy_license_on_public_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PUBLIC, PRICE, option::none(), sc.ctx());
    sc.next_tx(BOB);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let pay = coin::mint_for_testing<SUI>(PRICE, sc.ctx());
    registry::buy_license(&mut art, pay, sc.ctx()); // public tier -> ENotForSale
    ts::return_shared(art);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::EWrongPrice)]
fun buy_license_wrong_price_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, PRICE, option::none(), sc.ctx());
    sc.next_tx(BOB);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let pay = coin::mint_for_testing<SUI>(PRICE - 1, sc.ctx()); // underpay
    registry::buy_license(&mut art, pay, sc.ctx()); // -> EWrongPrice
    ts::return_shared(art);
    sc.end();
}

// ---- revocation (forward-only) ----

#[test]
#[expected_failure(abort_code = ::reef::registry::ERevoked)]
fun revoked_address_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    registry::add_license_holder(&cap, &mut art, BOB);
    registry::revoke(&cap, &mut art, BOB); // BOB granted then revoked
    let id = registry::test_seal_id(&art);
    assert!(registry::is_revoked(&art, BOB), 0);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.next_tx(BOB);
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art2, sc.ctx()); // -> ERevoked
    ts::return_shared(art2);
    sc.end();
}

// ---- compute tier: worker passes, plain consumer aborts ----

#[test]
fun compute_worker_passes() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_COMPUTE, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    registry::add_compute_worker(&cap, &mut art, BOB);
    let id = registry::test_seal_id(&art);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.next_tx(BOB); // BOB is the allowlisted worker
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art2, sc.ctx()); // -> must NOT abort
    ts::return_shared(art2);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::ENotWorker)]
fun compute_consumer_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_COMPUTE, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    registry::add_compute_worker(&cap, &mut art, BOB);
    let id = registry::test_seal_id(&art);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.next_tx(EVE); // EVE is a plain consumer, not a worker
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art2, sc.ctx()); // -> ENotWorker
    ts::return_shared(art2);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::ENotWorker)]
fun compute_owner_is_also_denied() {
    // owner must NOT be able to download a compute-tier artifact.
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_COMPUTE, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    let id = registry::test_seal_id(&art);
    registry::test_seal_approve(id, &art, sc.ctx()); // owner, not worker -> ENotWorker
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.end();
}

// ---- public tier: anyone passes ----

#[test]
fun public_allows_outsider() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PUBLIC, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    let id = registry::test_seal_id(&art);
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.next_tx(EVE);
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::test_seal_approve(id, &art2, sc.ctx()); // public -> must NOT abort
    ts::return_shared(art2);
    sc.end();
}

// ---- royalties (on-chain revenue vault) ----

#[test]
fun pay_royalty_accrues_and_claim_withdraws_to_owner() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art0 = sc.take_shared<ArtifactRegistry>();
    assert!(registry::revenue(&art0) == 0, 0); // empty vault to start
    ts::return_shared(art0);

    // BOB pays royalties into the artifact's vault.
    sc.next_tx(BOB);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let pay = coin::mint_for_testing<SUI>(PRICE, sc.ctx());
    registry::pay_royalty(&mut art, pay, sc.ctx());
    assert!(registry::revenue(&art) == PRICE, 1); // accrued
    ts::return_shared(art);

    // Owner claims the accrued revenue.
    sc.next_tx(OWNER);
    let mut art2 = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    registry::claim_revenue(&cap, &mut art2, sc.ctx());
    assert!(registry::revenue(&art2) == 0, 2); // vault drained
    ts::return_shared(art2);
    sc.return_to_sender(cap);

    // Owner received a Coin<SUI> of value PRICE.
    sc.next_tx(OWNER);
    let received = sc.take_from_sender<coin::Coin<SUI>>();
    assert!(coin::value(&received) == PRICE, 3);
    sc.return_to_sender(received);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::EZeroPayment)]
fun pay_royalty_zero_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(BOB);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let pay = coin::mint_for_testing<SUI>(0, sc.ctx());
    registry::pay_royalty(&mut art, pay, sc.ctx()); // -> EZeroPayment
    ts::return_shared(art);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::EEmptyRevenue)]
fun claim_empty_revenue_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let mut art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    registry::claim_revenue(&cap, &mut art, sc.ctx()); // nothing accrued -> EEmptyRevenue
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::EWrongCap)]
fun claim_revenue_wrong_cap_aborts() {
    // Two artifacts; claim_revenue on artifact #2 with artifact #1's cap aborts.
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let cap1 = sc.take_from_sender<ArtifactCap>(); // cap for artifact #1
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(BOB);
    // Fund artifact #2 so the abort is the cap check, not EEmptyRevenue.
    let mut art2 = sc.take_shared<ArtifactRegistry>();
    let pay = coin::mint_for_testing<SUI>(PRICE, sc.ctx());
    registry::pay_royalty(&mut art2, pay, sc.ctx());
    registry::claim_revenue(&cap1, &mut art2, sc.ctx()); // wrong cap -> EWrongCap
    ts::return_shared(art2);
    transfer::public_transfer(cap1, OWNER);
    sc.end();
}

// ---- groups (shared bundle object) ----

#[test]
fun create_group_and_add_member() {
    let mut sc = ts::begin(OWNER);
    // A member artifact to bind.
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let acap = sc.take_from_sender<ArtifactCap>();
    let member_id = object::id(&art);
    ts::return_shared(art);
    sc.return_to_sender(acap);

    // Create the group.
    registry::create_group(sc.ctx());
    sc.next_tx(OWNER);
    let mut group = sc.take_shared<Group>();
    let gcap = sc.take_from_sender<GroupCap>();
    assert!(registry::group_owner(&group) == OWNER, 0);
    assert!(registry::group_size(&group) == 0, 1);

    registry::add_member(&gcap, &mut group, member_id);
    assert!(registry::group_has_member(&group, member_id), 2);
    assert!(registry::group_size(&group) == 1, 3);
    // Idempotent: adding again does not grow the set.
    registry::add_member(&gcap, &mut group, member_id);
    assert!(registry::group_size(&group) == 1, 4);

    ts::return_shared(group);
    sc.return_to_sender(gcap);
    sc.end();
}

#[test]
#[expected_failure(abort_code = ::reef::registry::EWrongCap)]
fun add_member_wrong_cap_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::create_group(sc.ctx()); // group #1
    sc.next_tx(OWNER);
    let gcap1 = sc.take_from_sender<GroupCap>();
    registry::create_group(sc.ctx()); // group #2
    sc.next_tx(OWNER);
    let mut group2 = sc.take_shared<Group>();
    let g2id = object::id(&group2);
    registry::add_member(&gcap1, &mut group2, g2id); // wrong cap -> EWrongCap
    ts::return_shared(group2);
    sc.return_to_sender(gcap1);
    sc.end();
}

// ---- disputes / arbitration ----

#[test]
fun raise_dispute_sets_flag_and_counts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, 0, option::none(), sc.ctx());
    sc.next_tx(EVE); // anyone can report
    let mut art = sc.take_shared<ArtifactRegistry>();
    assert!(!registry::is_disputed(&art), 0);
    registry::raise_dispute(&mut art, b"QmEvidence1", sc.ctx());
    assert!(registry::is_disputed(&art), 1);
    assert!(registry::dispute_count(&art) == 1, 2);
    registry::raise_dispute(&mut art, b"QmEvidence2", sc.ctx());
    assert!(registry::dispute_count(&art) == 2, 3);
    ts::return_shared(art);

    // Owner counters — does not clear the flag (off-chain resolution).
    sc.next_tx(OWNER);
    let art2 = sc.take_shared<ArtifactRegistry>();
    registry::counter_dispute(&art2, b"QmCounter1", sc.ctx());
    assert!(registry::is_disputed(&art2), 4);
    ts::return_shared(art2);
    sc.end();
}

// ---- id binding ----

#[test]
#[expected_failure(abort_code = ::reef::registry::EBadId)]
fun wrong_object_prefix_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PUBLIC, 0, option::none(), sc.ctx());
    sc.next_tx(OWNER);
    let art = sc.take_shared<ArtifactRegistry>();
    let cap = sc.take_from_sender<ArtifactCap>();
    // 64 bytes that do NOT start with this artifact's object id.
    let bad: vector<u8> = b"0000000000000000000000000000000000000000000000000000000000000000";
    registry::test_seal_approve(bad, &art, sc.ctx()); // -> EBadId
    ts::return_shared(art);
    sc.return_to_sender(cap);
    sc.end();
}
