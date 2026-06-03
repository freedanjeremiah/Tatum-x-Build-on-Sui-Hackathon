#[test_only]
module tessera::registry_tests;

use sui::test_scenario as ts;
use tessera::registry::{Self, ArtifactRegistry, ArtifactCap};

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
    registry::register(TIER_PRIVATE, option::none(), sc.ctx());
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
    registry::register(TIER_PRIVATE, option::none(), sc.ctx());
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
#[expected_failure(abort_code = ::tessera::registry::ENotOwner)]
fun private_non_owner_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PRIVATE, option::none(), sc.ctx());
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
    registry::register(TIER_GATED, option::none(), sc.ctx());
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
#[expected_failure(abort_code = ::tessera::registry::ENoLicense)]
fun gated_non_holder_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, option::none(), sc.ctx());
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

// ---- revocation (forward-only) ----

#[test]
#[expected_failure(abort_code = ::tessera::registry::ERevoked)]
fun revoked_address_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_GATED, option::none(), sc.ctx());
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
    registry::register(TIER_COMPUTE, option::none(), sc.ctx());
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
#[expected_failure(abort_code = ::tessera::registry::ENotWorker)]
fun compute_consumer_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_COMPUTE, option::none(), sc.ctx());
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
#[expected_failure(abort_code = ::tessera::registry::ENotWorker)]
fun compute_owner_is_also_denied() {
    // owner must NOT be able to download a compute-tier artifact.
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_COMPUTE, option::none(), sc.ctx());
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
    registry::register(TIER_PUBLIC, option::none(), sc.ctx());
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

// ---- id binding ----

#[test]
#[expected_failure(abort_code = ::tessera::registry::EBadId)]
fun wrong_object_prefix_aborts() {
    let mut sc = ts::begin(OWNER);
    registry::register(TIER_PUBLIC, option::none(), sc.ctx());
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
