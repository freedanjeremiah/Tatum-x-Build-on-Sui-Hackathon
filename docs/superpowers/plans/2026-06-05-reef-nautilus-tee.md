# Reef × Nautilus real-TEE confidential compute — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Reef's HMAC TEE-simulator with a real AWS Nitro Enclave wrapped by Nautilus, and gate compute derivatives on-chain by having `reef::registry` verify the enclave attestation + enclave-signed result.

**Architecture:** Fork A — the stock Nautilus Rust enclave app owns attestation, the ephemeral signing keypair, BCS serialization, and vsock/HTTP forwarding; inside the same enclave it calls the existing TypeScript worker (`worker/compute-worker.ts`) over localhost for Seal-gated decrypt + the allowlisted algorithm, then BCS-signs the metrics. Reef's Move contract verifies that signature on-chain via the vendored Nautilus `enclave` module before registering the derivative. The TEE simulator stays as an honestly-disclosed CI/dev fallback; no silent fallback.

**Tech Stack:** Sui Move (vendored Nautilus `enclave` module + `sui::nitro_attestation`), `@mysten/sui` (Transaction PTBs, Ed25519), `@mysten/bcs`, TypeScript worker, Next.js API route, AWS Nitro Enclaves + Nautilus Rust template, vitest, `sui move test`.

**Priority / deadline ladder (submission 2026-06-06 17:00 UTC):** Implement in phase order. Each phase is a shippable stop.
- **Phase 1 (Move)** + **Phase 2 (TS lib)** = ladder step 1 (on-chain verification real, locally testable) — DO THESE FIRST.
- **Phase 3** wires the server path. **Phase 4** is the Nitro/Rust runbook (manual, not unit-testable on the dev box). **Phase 5** is the demo + docs.

**Exact Nautilus `enclave` module API (verified from MystenLabs/nautilus@main):**
```move
public struct Enclave<phantom T> has key { id: UID, pk: vector<u8>, config_version: u64, owner: address }
public struct EnclaveConfig<phantom T> has key { id, name, pcrs, capability_id, version }
public struct Cap<phantom T> has key, store { id: UID }
public fun new_cap<T: drop>(_: T, ctx: &mut TxContext): Cap<T>
public fun create_enclave_config<T: drop>(cap: &Cap<T>, name: String, pcr0, pcr1, pcr2, ctx)
public fun register_enclave<T>(enclave_config: &EnclaveConfig<T>, document: NitroAttestationDocument, ctx)
public fun verify_signature<T, P: drop>(enclave: &Enclave<T>, intent_scope: u8, timestamp_ms: u64, payload: P, signature: &vector<u8>): bool
public fun update_pcrs<T: drop>(config: &mut EnclaveConfig<T>, cap: &Cap<T>, pcr0, pcr1, pcr2)
#[test_only] public fun destroy<T>(enclave: Enclave<T>)
public fun pk<T>(enclave: &Enclave<T>): &vector<u8>   // accessor used by examples
```
App-side pattern (from twitter-example / seal-policy): declare a witness `public struct REEF has drop {}`, an intent const `const COMPUTE_RESULT_INTENT: u8 = 0;`, a payload struct with `copy, drop`, then `assert!(enclave::verify_signature<REEF, P>(enclave, COMPUTE_RESULT_INTENT, ts, P{...}, &sig), E…)`.

---

## File Structure

**Move (`move/`):**
- `move/sources/enclave.move` — **vendored** Nautilus enclave module + one added `#[test_only]` constructor. Responsibility: AWS-attestation verification + enclave-signed payload verification primitives.
- `move/sources/reef.move` — **modify**: add `REEF` witness, `COMPUTE_RESULT_INTENT`, `ComputeResultPayload` struct, and `register_derivative_attested` entry. Responsibility: gate compute derivatives on a verified enclave signature.
- `move/tests/attest_tests.move` — **create**: Move tests for the attested registration path.
- `move/Move.toml` — **modify**: ensure `sui` framework dep provides `nitro_attestation`.
- `scripts/gen-attest-vectors.mjs` — **create**: produce ed25519 test vectors (pk/sig/payload) matching the BCS intent layout, for the Move test.

**TS (`lib/`, `types/`, `worker/`, `app/`):**
- `types/artifact.ts` — **modify**: extend `AttestationInfo` with enclave fields; add `"enclave-nautilus"` to `workerIsolation` union.
- `lib/attestation.ts` — **modify**: support `"enclave-nautilus"` mode + disclosure string.
- `lib/registry.ts` — **modify**: add `registerDerivativeAttested(...)` + a `buildComputeResultPayloadBytes(...)` helper.
- `lib/enclaveClient.ts` — **create**: server-side client that POSTs a job to the enclave `process_data` endpoint and returns `{ payload, signature, timestampMs }`; honest throw if unreachable.
- `worker/compute-worker.ts` — **modify**: in `enclave-nautilus` mode skip the sim pre-step; expose a `runComputeJobForEnclave` entry returning metrics only.
- `app/api/compute/route.ts` — **modify**: after a `done` enclave run, execute `register_derivative_attested` and record `attestationTx`; fail closed if enclave configured-but-unreachable.

**Rust / infra (`nautilus/`):**
- `nautilus/` — **create** from Nautilus template: Rust enclave app (`process_data` → calls TS worker → BCS-signs), reproducible EIF build, `register_enclave.sh`. (Runbook, Phase 4.)

**Demo / docs:**
- `scripts/07-nautilus-attested-demo.ts` — **create**: end-to-end attested-compute demo.
- `README.md` — **modify**: update the Honesty section to describe the real enclave path + on-chain verification.

---

## Phase 1 — Move: on-chain attestation verification (ladder step 1)

### Task 1: Vendor the Nautilus `enclave` module with a test-only constructor

**Files:**
- Create: `move/sources/enclave.move`
- Modify: `move/Move.toml`

- [ ] **Step 1: Vendor the module source**

Copy the upstream module verbatim into `move/sources/enclave.move`:
```bash
curl -sSL https://raw.githubusercontent.com/MystenLabs/nautilus/main/move/enclave/sources/enclave.move \
  -o move/sources/enclave.move
```
Then set its `module` declaration to live in this package, e.g. change the leading `module enclave::enclave;` (or `module <addr>::enclave;`) to `module reef::enclave;` so it shares the `reef` package address. Read the file top-to-bottom once; note the exact name of the intent-message builder (e.g. `create_intent_message`) and the `IntentMessage<P>` struct layout — Task 6 mirrors it in BCS.

- [ ] **Step 2: Add a test-only Enclave constructor**

Append to `move/sources/enclave.move` (the upstream ships only `#[test_only] destroy`; we add a constructor so `verify_signature` can be unit-tested with a known key):
```move
#[test_only]
public fun new_enclave_for_testing<T>(pk: vector<u8>, ctx: &mut TxContext): Enclave<T> {
    Enclave<T> { id: object::new(ctx), pk, config_version: 0, owner: ctx.sender() }
}
```
(If the struct field order/names differ from the verified API above, match the file's actual `Enclave` definition.)

- [ ] **Step 3: Confirm the framework provides `nitro_attestation`**

Ensure `move/Move.toml` `[dependencies]` pins a `Sui` framework recent enough to export `sui::nitro_attestation` (the custom-PCR release). If the existing pin builds `enclave.move`, leave it. Run:
```bash
cd move && sui move build
```
Expected: builds clean (the vendored module compiles against the framework). If it fails on a missing `nitro_attestation`, update the `Sui` git rev in `Move.toml` to `framework/testnet`.

- [ ] **Step 4: Commit**
```bash
git add move/sources/enclave.move move/Move.toml
git commit -m "feat(move): vendor Nautilus enclave module + test-only constructor"
```

---

### Task 2: Declare the Reef witness, intent, and compute-result payload

**Files:**
- Modify: `move/sources/reef.move`

- [ ] **Step 1: Add the witness, intent constant, payload struct, and error code**

Near the top of `module reef::registry` (after the existing `use` lines and error constants), add:
```move
use reef::enclave::{Self, Enclave};

/// One-time witness / type tag binding the on-chain Enclave to this package.
public struct REEF has drop {}

/// Intent scope for an enclave-signed confidential-compute result.
const COMPUTE_RESULT_INTENT: u8 = 0;

/// BCS payload the enclave signs. `dataset_id`/`metrics` are raw bytes so the
/// enclave and Move agree on the exact serialization (no address/ID parsing in
/// the enclave). `dataset_id` is the 32-byte object id of the parent dataset.
public struct ComputeResultPayload has copy, drop {
    dataset_id: vector<u8>,
    algo_hash: vector<u8>,
    metrics: vector<u8>,
}

/// Enclave signature failed to verify against the registered enclave.
const EBadEnclaveSig: u64 = 100;
/// Signed payload's dataset_id does not match the declared parent.
const EParentMismatch: u64 = 101;
```

- [ ] **Step 2: Build (no test yet)**
```bash
cd move && sui move build
```
Expected: builds clean. (Witness/struct/consts are unused for now — Move allows unused structs/consts; if the linter rejects an unused const, proceed to Task 3 which uses them in the same commit.)

- [ ] **Step 3: Commit**
```bash
git add move/sources/reef.move
git commit -m "feat(move): add REEF witness, compute-result intent + payload"
```

---

### Task 3: Add `register_derivative_attested` entry

**Files:**
- Modify: `move/sources/reef.move`

- [ ] **Step 1: Add the entry function**

Add below the existing `register_derivative` entry:
```move
/// Register a derivative whose lineage points at `parent`, but ONLY if the
/// supplied enclave-signed compute result verifies on-chain. The enclave signs
/// ComputeResultPayload { dataset_id = parent's object id bytes, algo_hash,
/// metrics }. Aborts (no derivative created) on a bad signature or a payload
/// whose dataset_id does not equal `parent`.
public entry fun register_derivative_attested(
    tier: u8,
    price: u64,
    parent: ID,
    group_id: Option<ID>,
    enclave: &Enclave<REEF>,
    timestamp_ms: u64,
    algo_hash: vector<u8>,
    metrics: vector<u8>,
    signature: vector<u8>,
    ctx: &mut TxContext,
) {
    let dataset_id = object::id_to_bytes(&parent);
    let payload = ComputeResultPayload { dataset_id, algo_hash, metrics };
    let ok = enclave::verify_signature<REEF, ComputeResultPayload>(
        enclave, COMPUTE_RESULT_INTENT, timestamp_ms, payload, &signature,
    );
    assert!(ok, EBadEnclaveSig);
    register_internal(tier, price, group_id, option::some(parent), ctx);
}
```
(If `object::id_to_bytes` is not the exact helper available, use the package's existing id→bytes conversion — check how `seal_approve`/`test_seal_id` derive id bytes in this same file and reuse that.)

- [ ] **Step 2: Build**
```bash
cd move && sui move build
```
Expected: builds clean.

- [ ] **Step 3: Commit**
```bash
git add move/sources/reef.move
git commit -m "feat(move): register_derivative_attested gated on enclave signature"
```

---

### Task 4: Generate ed25519 test vectors for the Move test

**Files:**
- Create: `scripts/gen-attest-vectors.mjs`

- [ ] **Step 1: Read the vendored intent layout**

Open `move/sources/enclave.move` and read `verify_signature` + its intent-message builder. Record the exact byte layout it hashes/verifies. The expected layout (confirm against source) is the BCS serialization of `IntentMessage { intent_scope: u8, timestamp_ms: u64, payload: P }`, i.e. `u8` then `u64` little-endian then the BCS of `ComputeResultPayload { dataset_id: vector<u8>, algo_hash: vector<u8>, metrics: vector<u8> }` (each `vector<u8>` is ULEB128 length-prefixed).

- [ ] **Step 2: Write the generator**
```js
// scripts/gen-attest-vectors.mjs
// Produces a known ed25519 keypair + a signature over the BCS IntentMessage so
// move/tests/attest_tests.move can assert verify_signature accepts it.
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { bcs } from "@mysten/bcs";

const SEED = new Uint8Array(32).fill(7); // deterministic test key
const kp = Ed25519Keypair.fromSecretKey(SEED);
const pk = kp.getPublicKey().toRawBytes(); // 32 bytes

const datasetId = new Uint8Array(32).fill(0xab);
const algoHash = new TextEncoder().encode("sha256:mean-aggregate");
const metrics = new TextEncoder().encode(JSON.stringify({ columnMeans_0: 3, n: 5 }));

const Payload = bcs.struct("ComputeResultPayload", {
  dataset_id: bcs.vector(bcs.u8()),
  algo_hash: bcs.vector(bcs.u8()),
  metrics: bcs.vector(bcs.u8()),
});
const Intent = bcs.struct("IntentMessage", {
  intent_scope: bcs.u8(),
  timestamp_ms: bcs.u64(),
  payload: Payload,
});

const timestampMs = 1_717_000_000_000n;
const msg = Intent.serialize({
  intent_scope: 0,
  timestamp_ms: timestampMs,
  payload: { dataset_id: [...datasetId], algo_hash: [...algoHash], metrics: [...metrics] },
}).toBytes();

const { signature } = await kp.signPersonalMessage(msg); // raw ed25519 over msg
// NOTE: enclave.move verifies a RAW ed25519 over the intent bytes. If signPersonalMessage
// wraps/encodes, sign raw instead via kp.sign(msg). Confirm against verify_signature.

const hex = (u8) => "0x" + Buffer.from(u8).toString("hex");
console.log("pk        =", hex(pk));
console.log("dataset_id=", hex(datasetId));
console.log("algo_hash =", hex(algoHash));
console.log("metrics   =", hex(metrics));
console.log("timestamp =", timestampMs.toString());
console.log("signature =", hex(typeof signature === "string" ? Buffer.from(signature, "base64") : signature));
```

- [ ] **Step 3: Run it and capture output**
```bash
node scripts/gen-attest-vectors.mjs
```
Expected: prints `pk`, `dataset_id`, `algo_hash`, `metrics`, `timestamp`, `signature` hex. Keep this output for Task 5. If `verify_signature` rejects in Task 5, switch `signPersonalMessage` → raw `kp.sign(msg)` here and regenerate.

- [ ] **Step 4: Commit**
```bash
git add scripts/gen-attest-vectors.mjs
git commit -m "test(move): ed25519 vector generator for attested registration"
```

---

### Task 5: Move test — attested registration accepts good sig, aborts on bad

**Files:**
- Create: `move/tests/attest_tests.move`

- [ ] **Step 1: Write the failing test**

Paste the Task 4 vector values into the byte literals below:
```move
#[test_only]
module reef::attest_tests;

use reef::registry::{Self, REEF};
use reef::enclave;
use sui::test_scenario as ts;

const OWNER: address = @0xA;

#[test]
fun attested_registration_accepts_valid_signature() {
    let mut scenario = ts::begin(OWNER);
    {
        let ctx = ts::ctx(&mut scenario);
        // pk from gen-attest-vectors.mjs
        let pk: vector<u8> = x"<PK_HEX_NO_0x>";
        let enclave = enclave::new_enclave_for_testing<REEF>(pk, ctx);

        let algo_hash: vector<u8> = x"<ALGO_HASH_HEX>";
        let metrics: vector<u8> = x"<METRICS_HEX>";
        let signature: vector<u8> = x"<SIGNATURE_HEX>";
        // parent ID whose id_to_bytes == dataset_id (0xab * 32) used in the vectors.
        let parent = object::id_from_bytes(x"abababababababababababababababababababababababababababababababab");

        registry::register_derivative_attested(
            0, 0, parent, option::none<sui::object::ID>(),
            &enclave, 1717000000000, algo_hash, metrics, signature, ctx,
        );
        enclave::destroy(enclave);
    };
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = registry::EBadEnclaveSig)]
fun attested_registration_aborts_on_bad_signature() {
    let mut scenario = ts::begin(OWNER);
    {
        let ctx = ts::ctx(&mut scenario);
        let pk: vector<u8> = x"<PK_HEX_NO_0x>";
        let enclave = enclave::new_enclave_for_testing<REEF>(pk, ctx);
        let algo_hash: vector<u8> = x"<ALGO_HASH_HEX>";
        let metrics: vector<u8> = x"<METRICS_HEX>";
        let bad_sig: vector<u8> = x"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000";
        let parent = object::id_from_bytes(x"abababababababababababababababababababababababababababababababab");
        registry::register_derivative_attested(
            0, 0, parent, option::none<sui::object::ID>(),
            &enclave, 1717000000000, algo_hash, metrics, bad_sig, ctx,
        );
        enclave::destroy(enclave);
    };
    ts::end(scenario);
}
```
Make `REEF` and `EBadEnclaveSig` visible: in `reef.move` add `public use` or mark the const `public` as needed (Move test modules can reference `registry::EBadEnclaveSig` only if exposed — if not, use `#[expected_failure(abort_code = ...)]` with the numeric literal `100` and a comment).

- [ ] **Step 2: Run — expect FAIL (functions/visibility missing)**
```bash
cd move && sui move test attest
```
Expected: FAIL (e.g. unresolved `new_enclave_for_testing` or visibility).

- [ ] **Step 3: Fix visibility until it compiles, then passes**

Resolve any visibility errors (expose `REEF`, the test constructor, and the abort code). Re-run:
```bash
cd move && sui move test attest
```
Expected: both tests PASS. If `accepts_valid_signature` fails on the signature, regenerate vectors with raw `kp.sign` (Task 4 Step 3 note) and repaste.

- [ ] **Step 4: Run the full Move suite (no regressions)**
```bash
cd move && sui move test
```
Expected: all existing tests + the 2 new ones PASS.

- [ ] **Step 5: Commit**
```bash
git add move/tests/attest_tests.move move/sources/reef.move
git commit -m "test(move): verify register_derivative_attested accepts/rejects enclave sigs"
```

---

## Phase 2 — TS lib: types, disclosure, PTB builder

### Task 6: Extend `AttestationInfo` + isolation union

**Files:**
- Modify: `types/artifact.ts:85-96`

- [ ] **Step 1: Edit the type**

Replace the `AttestationInfo` interface body to add the enclave mode + fields:
```ts
export interface AttestationInfo {
  validatorAttestationEnabled: boolean;
  enforced: boolean;
  untrustedValidators: number;
  /** "enclave-nautilus" = real AWS Nitro enclave, attestation verified on-chain.
   *  "enclave-sim" = simulated TEE (honestly NOT hardware-attested).
   *  "enclave" = generic attested SGX/TDX. "plain-server" = no isolation. */
  workerIsolation: "enclave" | "enclave-nautilus" | "enclave-sim" | "plain-server";
  simQuote?: SimulatedQuoteInfo;
  simVerified?: boolean;
  /** enclave-nautilus: on-chain Enclave object id used for verification. */
  enclaveObjectId?: `0x${string}`;
  /** enclave-nautilus: tx digest where reef::registry verified the enclave sig. */
  attestationTx?: `0x${string}`;
  /** enclave-nautilus: hex of the enclave's ed25519 signature over the result. */
  enclaveSig?: `0x${string}`;
}
```

- [ ] **Step 2: Typecheck**
```bash
pnpm exec tsc --noEmit
```
Expected: passes (existing `workerIsolation()` returns a subset of the union; widening is safe).

- [ ] **Step 3: Commit**
```bash
git add types/artifact.ts
git commit -m "feat(types): AttestationInfo gains enclave-nautilus mode + fields"
```

---

### Task 7: `enclave-nautilus` isolation mode + disclosure

**Files:**
- Modify: `lib/attestation.ts:40-68`
- Test: `lib/attestation.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**
```ts
// lib/attestation.test.ts
import { describe, it, expect } from "vitest";
import { isolationDisclosure } from "./attestation";

describe("isolationDisclosure", () => {
  it("reports the real Nitro enclave with the on-chain verify tx", () => {
    const s = isolationDisclosure({
      validatorAttestationEnabled: false,
      enforced: false,
      untrustedValidators: 0,
      workerIsolation: "enclave-nautilus",
      attestationTx: "0xabc",
    });
    expect(s).toContain("AWS Nitro enclave");
    expect(s).toContain("verified on-chain");
    expect(s).toContain("0xabc");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
```bash
pnpm exec vitest run lib/attestation.test.ts
```
Expected: FAIL (disclosure has no enclave-nautilus branch).

- [ ] **Step 3: Implement**

In `lib/attestation.ts`, extend the `workerIsolation()` return type and the `worker` ternary in `isolationDisclosure`:
```ts
export function workerIsolation(): "enclave" | "enclave-nautilus" | "enclave-sim" | "plain-server" {
  const mode = process.env.WORKER_ISOLATION_MODE;
  if (mode === "enclave-nautilus" || mode === "nautilus") return "enclave-nautilus";
  if (mode === "enclave") return "enclave";
  if (mode === "enclave-sim" || mode === "sim") return "enclave-sim";
  return "plain-server";
}
```
And in `isolationDisclosure`, add the branch before the existing `enclave` check:
```ts
  const worker =
    info.workerIsolation === "enclave-nautilus"
      ? `compute worker in AWS Nitro enclave — attestation verified on-chain${info.attestationTx ? ` (tx ${info.attestationTx})` : ""}`
      : info.workerIsolation === "enclave"
        ? "compute worker in attested enclave"
        : info.workerIsolation === "enclave-sim"
          ? /* existing enclave-sim branch unchanged */ (
              info.simVerified === true
                ? "compute worker in SIMULATED enclave (TEE-SIM, sim-signature verified — NOT hardware-attested)"
                : info.simVerified === false
                  ? "compute worker in SIMULATED enclave (TEE-SIM, sim-signature INVALID — NOT hardware-attested)"
                  : "compute worker in SIMULATED enclave (TEE-SIM declared but no sim-attestation step reached — NOT hardware-attested)"
            )
          : "compute worker on plain server (operator-trusted, demo)";
```

- [ ] **Step 4: Run — expect PASS**
```bash
pnpm exec vitest run lib/attestation.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/attestation.ts lib/attestation.test.ts
git commit -m "feat(attestation): enclave-nautilus mode + on-chain-verified disclosure"
```

---

### Task 8: `registerDerivativeAttested` PTB on RegistryClient

**Files:**
- Modify: `lib/registry.ts` (add method near `registerDerivative`, ~line 219)
- Test: `lib/registry.test.ts` (add a case; create if absent)

- [ ] **Step 1: Write the failing test (builds the PTB, asserts the moveCall target + args)**
```ts
// lib/registry.test.ts (add)
import { describe, it, expect, vi } from "vitest";
import { RegistryClient } from "./registry";

describe("registerDerivativeAttested", () => {
  it("calls register_derivative_attested with the enclave object + signature", async () => {
    const fakeClient: any = {
      core: {
        signAndExecuteTransaction: vi.fn(async ({ transaction }) => {
          const data = transaction.getData?.() ?? transaction.blockData;
          const cmds = JSON.stringify(data);
          expect(cmds).toContain("register_derivative_attested");
          return { digest: "0xdig", effects: {}, objectTypes: {} };
        }),
      },
    };
    const rc = new RegistryClient(fakeClient, "0x123");
    const digest = await rc.registerDerivativeAttested(
      {
        tier: "public",
        parentId: "0xparent",
        enclaveObjectId: "0xenc",
        timestampMs: 1717000000000n,
        algoHash: "sha256:mean-aggregate",
        metrics: new Uint8Array([1, 2, 3]),
        signature: new Uint8Array(64).fill(9),
      },
      {} as any,
    );
    expect(digest).toBe("0xdig");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
```bash
pnpm exec vitest run lib/registry.test.ts -t registerDerivativeAttested
```
Expected: FAIL (`registerDerivativeAttested` undefined).

- [ ] **Step 3: Implement the method**

Add to `class RegistryClient` (mirrors the existing `registerDerivative` PTB style; `MOD`/`tierToU8`/`this.target`/`this.exec` already exist in the file):
```ts
  /**
   * Register a compute-result derivative gated on an enclave signature. Builds
   * `register_derivative_attested(tier, price, parent, group_id, enclave,
   * timestamp_ms, algo_hash, metrics, signature)` and executes it. The Move call
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
        args.groupId
          ? tx.pure.option("id", args.groupId)
          : tx.pure.option("id", null),
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
```
(If `tx.pure.option("id", …)` is not how this `@mysten/sui` version encodes `Option<ID>`, mirror exactly how the existing `register`/`registerDerivative` methods pass `group_id` — reuse that idiom.)

- [ ] **Step 4: Run — expect PASS**
```bash
pnpm exec vitest run lib/registry.test.ts -t registerDerivativeAttested
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/registry.ts lib/registry.test.ts
git commit -m "feat(registry): registerDerivativeAttested PTB builder"
```

---

## Phase 3 — Server path: enclave client + worker mode + route

### Task 9: Enclave client (server → enclave `process_data`)

**Files:**
- Create: `lib/enclaveClient.ts`
- Test: `lib/enclaveClient.test.ts`

- [ ] **Step 1: Write the failing test**
```ts
// lib/enclaveClient.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { callEnclave, ENCLAVE_URL_ENV } from "./enclaveClient";

describe("callEnclave", () => {
  beforeEach(() => { process.env[ENCLAVE_URL_ENV] = "https://enc.local"; });

  it("returns the signed payload from process_data", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      response: { intent: 0, timestamp_ms: 1717000000000, data: { metrics: { n: 5 } } },
      signature: "00".repeat(64),
    }), { status: 200 })) as any;
    const out = await callEnclave({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" });
    expect(out.metrics).toEqual({ n: 5 });
    expect(out.timestampMs).toBe(1717000000000n);
    expect(out.signature).toHaveLength(64);
  });

  it("throws (no silent fallback) when the enclave is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("ECONNREFUSED"); }) as any;
    await expect(callEnclave({ datasetIpId: "0x1", algoHash: "x" })).rejects.toThrow(/enclave/i);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
```bash
pnpm exec vitest run lib/enclaveClient.test.ts
```
Expected: FAIL (module missing).

- [ ] **Step 3: Implement**
```ts
// lib/enclaveClient.ts — SERVER ONLY. POSTs a compute job to the Nautilus
// enclave's process_data endpoint and returns the enclave-signed result.
export const ENCLAVE_URL_ENV = "ENCLAVE_PROCESS_URL";

export interface EnclaveJob {
  datasetIpId: string;
  algoHash: string;
  params?: Record<string, unknown>;
}

export interface EnclaveSignedResult {
  metrics: Record<string, number>;
  timestampMs: bigint;
  /** raw ed25519 signature bytes (64). */
  signature: Uint8Array;
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export async function callEnclave(job: EnclaveJob): Promise<EnclaveSignedResult> {
  const url = process.env[ENCLAVE_URL_ENV];
  if (!url) throw new Error(`enclave: ${ENCLAVE_URL_ENV} is not set — cannot run attested compute`);
  let res: Response;
  try {
    res = await fetch(`${url.replace(/\/$/, "")}/process_data`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(job),
    });
  } catch (e) {
    throw new Error(`enclave: process_data unreachable — ${(e as Error).message}`);
  }
  if (!res.ok) throw new Error(`enclave: process_data returned ${res.status}`);
  const j = (await res.json()) as {
    response: { intent: number; timestamp_ms: number; data: { metrics: Record<string, number> } };
    signature: string;
  };
  return {
    metrics: j.response.data.metrics,
    timestampMs: BigInt(j.response.timestamp_ms),
    signature: hexToBytes(j.signature),
  };
}
```

- [ ] **Step 4: Run — expect PASS**
```bash
pnpm exec vitest run lib/enclaveClient.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add lib/enclaveClient.ts lib/enclaveClient.test.ts
git commit -m "feat(enclave): server client for Nautilus process_data (fail-closed)"
```

---

### Task 10: Worker skips the sim pre-step under `enclave-nautilus`

**Files:**
- Modify: `worker/compute-worker.ts:256-283`
- Test: `worker/compute-worker.test.ts` (add a case)

- [ ] **Step 1: Write the failing test**
```ts
// worker/compute-worker.test.ts (add)
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { runComputeJob } from "./compute-worker";

describe("enclave-nautilus mode", () => {
  beforeEach(() => { process.env.WORKER_ISOLATION_MODE = "enclave-nautilus"; });
  afterEach(() => { delete process.env.WORKER_ISOLATION_MODE; });

  it("rejects an off-allowlist algo without generating a sim quote", async () => {
    const r = await runComputeJob({
      datasetIpId: "0xdead" as `0x${string}`,
      algoHash: "sha256:dump-all-rows",
      allowedAlgoHashes: ["sha256:mean-aggregate"],
    });
    expect(r.status).toBe("rejected");
    expect(r.attestation?.simQuote).toBeUndefined();
    expect(r.isolationMode).toContain("AWS Nitro enclave");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**
```bash
pnpm exec vitest run worker/compute-worker.test.ts -t "enclave-nautilus"
```
Expected: FAIL (rejected path currently reports plain disclosure / may still attempt sim only under enclave-sim; isolationMode string mismatch).

- [ ] **Step 3: Implement**

In `runComputeJob`, the sim pre-step is already guarded by `if (isolationModeNow === "enclave-sim")`, so `enclave-nautilus` already skips quote generation — the only gap is the rejected-path disclosure. Confirm `currentIsolationDisclosure()` (which calls `workerIsolation()` → now returns `"enclave-nautilus"`) yields the Nitro string. No code change may be needed beyond Task 7; if the test still fails because the rejected branch passes no `AttestationInfo`, update the `rejected` return to call `currentIsolationDisclosure()` (it already does). Make the minimal change required for green.

- [ ] **Step 4: Run — expect PASS**
```bash
pnpm exec vitest run worker/compute-worker.test.ts -t "enclave-nautilus"
```
Expected: PASS.

- [ ] **Step 5: Full worker suite (no regressions)**
```bash
pnpm exec vitest run worker/compute-worker.test.ts
```
Expected: all PASS.

- [ ] **Step 6: Commit**
```bash
git add worker/compute-worker.ts worker/compute-worker.test.ts
git commit -m "feat(worker): enclave-nautilus skips sim pre-step, honest disclosure"
```

---

### Task 11: Route executes attested registration after a real enclave run

**Files:**
- Modify: `app/api/compute/route.ts`
- Test: `app/api/compute/route.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**
```ts
// app/api/compute/route.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/enclaveClient", () => ({
  ENCLAVE_URL_ENV: "ENCLAVE_PROCESS_URL",
  callEnclave: vi.fn(async () => ({
    metrics: { columnMeans_0: 3, n: 5 },
    timestampMs: 1717000000000n,
    signature: new Uint8Array(64).fill(9),
  })),
}));

describe("/api/compute attested path", () => {
  beforeEach(() => {
    process.env.WORKER_ISOLATION_MODE = "enclave-nautilus";
    process.env.ENCLAVE_PROCESS_URL = "https://enc.local";
    process.env.REEF_ENCLAVE_OBJECT_ID = "0xenc";
  });
  afterEach(() => {
    delete process.env.WORKER_ISOLATION_MODE;
    delete process.env.ENCLAVE_PROCESS_URL;
    delete process.env.REEF_ENCLAVE_OBJECT_ID;
  });

  it("returns failed (no silent fallback) when enclave mode is set but URL missing", async () => {
    delete process.env.ENCLAVE_PROCESS_URL;
    const { POST } = await import("./route");
    const res = await POST(new Request("http://x/api/compute", {
      method: "POST",
      body: JSON.stringify({ datasetIpId: "0x1", algoHash: "sha256:mean-aggregate" }),
    }));
    const body = await res.json();
    expect(body.status).toBe("failed");
  });
});
```
(This route depends on the SQLite indexer; if importing the route pulls in `@/indexer/db`, mock it too — mirror how `app/api/index/route.test.ts` mocks the db in the CDR/Reef codebase.)

- [ ] **Step 2: Run — expect FAIL**
```bash
pnpm exec vitest run app/api/compute/route.test.ts
```
Expected: FAIL (attested branch not implemented / no fail-closed guard).

- [ ] **Step 3: Implement the attested branch**

In `app/api/compute/route.ts`, after loading `dataset` and confirming the compute tier, branch on isolation mode:
```ts
import { workerIsolation } from "@/lib/attestation";
import { callEnclave } from "@/lib/enclaveClient";
import { makeClientsFromKey } from "@/lib/clients";
import { RegistryClient } from "@/lib/registry";

// ... inside POST, replacing the single runComputeJob call when attested:
const isolation = workerIsolation();
if (isolation === "enclave-nautilus") {
  const enclaveObjectId = process.env.REEF_ENCLAVE_OBJECT_ID;
  if (!process.env.ENCLAVE_PROCESS_URL || !enclaveObjectId) {
    return json({
      status: "failed",
      reason: "enclave-nautilus mode set but ENCLAVE_PROCESS_URL / REEF_ENCLAVE_OBJECT_ID missing — refusing to fall back to plain server",
      decryptCalled: false,
    }, 500);
  }
  // gate: off-allowlist algorithms never reach the enclave.
  if (!allowed.includes(algoHash)) {
    return json({ status: "rejected", reason: "algorithm not on dataset allowlist", decryptCalled: false }, 200);
  }
  let signed;
  try {
    signed = await callEnclave({ datasetIpId, algoHash, params });
  } catch (e) {
    return json({ status: "failed", reason: (e as Error).message, decryptCalled: true }, 500);
  }
  const pk = process.env.WALLET_PRIVATE_KEY;
  if (!pk) return json({ status: "failed", reason: "WALLET_PRIVATE_KEY not set" }, 500);
  const clients = await makeClientsFromKey(pk);
  const rc = new RegistryClient(clients.client);
  const metricsBytes = new TextEncoder().encode(JSON.stringify({ metrics: signed.metrics }));
  let attestationTx: string;
  try {
    attestationTx = await rc.registerDerivativeAttested({
      tier: "public",
      parentId: datasetIpId,
      enclaveObjectId,
      timestampMs: signed.timestampMs,
      algoHash,
      metrics: metricsBytes,
      signature: signed.signature,
    }, clients.signer as any);
  } catch (e) {
    return json({ status: "failed", reason: `on-chain attestation verify failed: ${(e as Error).message}`, decryptCalled: true }, 500);
  }
  return json({
    status: "done",
    metrics: signed.metrics,
    resultTx: attestationTx as `0x${string}`,
    decryptCalled: true,
    isolationMode: `compute worker in AWS Nitro enclave — attestation verified on-chain (tx ${attestationTx})`,
    attestation: {
      validatorAttestationEnabled: false, enforced: false, untrustedValidators: 0,
      workerIsolation: "enclave-nautilus",
      enclaveObjectId: enclaveObjectId as `0x${string}`,
      attestationTx: attestationTx as `0x${string}`,
    },
  }, 200);
}
// else: existing runComputeJob path (sim / plain) unchanged below.
```
Keep the existing `runComputeJob` delegation as the `else` branch (sim/plain modes) and the existing self-index block.

- [ ] **Step 4: Run — expect PASS**
```bash
pnpm exec vitest run app/api/compute/route.test.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**
```bash
git add app/api/compute/route.ts app/api/compute/route.test.ts
git commit -m "feat(api): attested compute path executes on-chain enclave verification, fail-closed"
```

---

## Phase 4 — Nitro enclave + Rust shim (RUNBOOK, manual — not unit-tested on the dev box)

> Requires a Nitro-enabled EC2 instance (e.g. `m5.xlarge`, enclave option enabled), AWS CLI, `nitro-cli`, Docker, Rust. These steps are operational; verification is "the enclave returns a signed result the Move contract accepts" (Task 5 already proves the verifier).

### Task 12: Scaffold the Nautilus enclave app calling the TS worker

**Files:**
- Create: `nautilus/` (from template)

- [ ] **Step 1: Clone the Nautilus template into `nautilus/`**
```bash
git clone https://github.com/MystenLabs/nautilus tmp-nautilus
cp -r tmp-nautilus/src nautilus/ && cp tmp-nautilus/Makefile tmp-nautilus/*.sh nautilus/ 2>/dev/null || true
rm -rf tmp-nautilus
```
Read `nautilus/UsingNautilus.md` (or the upstream README) for the exact template layout.

- [ ] **Step 2: Implement `process_data` to call the in-enclave TS worker**

In the Rust app's `process_data` handler: parse `{ datasetIpId, algoHash, params }`, POST to the in-enclave TS worker at `http://127.0.0.1:$WORKER_PORT/run`, receive `{ metrics }`, build the payload `ComputeResultPayload { dataset_id = bytes of datasetIpId, algo_hash = bytes, metrics = bcs/json bytes }`, sign `create_intent_message(COMPUTE_RESULT_INTENT=0, timestamp_ms, payload)` with the ephemeral key, and return `{ response: { intent: 0, timestamp_ms, data: { metrics } }, signature }`. **The BCS layout of `ComputeResultPayload` MUST byte-match Task 4 / `reef.move`.**

- [ ] **Step 3: Add the TS worker as an in-enclave service**

Add a tiny HTTP listener that wraps `runComputeJobForEnclave` (Task 13) on `127.0.0.1:$WORKER_PORT`, returning metrics-only JSON. Bundle Node + the worker into the EIF (multi-stage Docker → EIF). Ensure outbound HTTPS to the Seal key servers + Walrus aggregator is allowed via the Nautilus proxy config.

- [ ] **Step 4: Reproducible build + record PCRs**
```bash
cd nautilus && make   # or the template's EIF build target
nitro-cli describe-eif --eif-path <built>.eif   # capture PCR0/PCR1/PCR2
```
Record PCR0/1/2 for Task 14. Commit the `nautilus/` source (not the EIF).
```bash
git add nautilus
git commit -m "feat(nautilus): Rust enclave app forwarding to in-enclave TS worker"
```

---

### Task 13: TS worker HTTP entry for in-enclave use

**Files:**
- Create: `worker/enclave-server.ts`

- [ ] **Step 1: Implement the listener**
```ts
// worker/enclave-server.ts — runs INSIDE the enclave only. Exposes the existing
// runComputeJob over localhost so the Rust shim can call it. Metrics only.
import { createServer } from "node:http";
import { runComputeJob } from "./compute-worker";

const PORT = Number(process.env.WORKER_PORT ?? 7070);
createServer((req, res) => {
  if (req.method !== "POST" || !req.url?.endsWith("/run")) { res.statusCode = 404; return res.end(); }
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    try {
      const { datasetIpId, algoHash, params, dataset, allowedAlgoHashes } = JSON.parse(body);
      const r = await runComputeJob({ datasetIpId, algoHash, params, dataset, allowedAlgoHashes });
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ status: r.status, metrics: r.metrics ?? {}, reason: r.reason }));
    } catch (e) {
      res.statusCode = 500; res.end(JSON.stringify({ status: "failed", reason: (e as Error).message }));
    }
  });
}).listen(PORT, "127.0.0.1");
```

- [ ] **Step 2: Smoke-run locally (outside enclave) to confirm it boots**
```bash
WORKER_PORT=7070 pnpm exec tsx worker/enclave-server.ts &
sleep 1 && curl -s -X POST localhost:7070/run -d '{"datasetIpId":"0x1","algoHash":"x","allowedAlgoHashes":[]}'
kill %1
```
Expected: a JSON `{"status":"rejected",...}` (off-allowlist), proving the listener wiring.

- [ ] **Step 3: Commit**
```bash
git add worker/enclave-server.ts
git commit -m "feat(worker): localhost HTTP entry for in-enclave invocation"
```

---

### Task 14: Deploy enclave package + register the enclave on-chain

- [ ] **Step 1: Publish the Move package (includes vendored enclave + reef)**
```bash
cd move && sui client publish --gas-budget 200000000
```
Record the package id → set `REEF_PACKAGE_ID` (and `NEXT_PUBLIC_OV_REEF_PACKAGE_ID`).

- [ ] **Step 2: Create the EnclaveConfig + register PCRs**

Using the Nautilus `register_enclave.sh` (or PTBs): call `new_cap<REEF>(REEF{})`, `create_enclave_config<REEF>(cap, "reef-compute", pcr0, pcr1, pcr2)` with the Task 12 PCRs.

- [ ] **Step 3: Register the running enclave's attestation**
```bash
cd nautilus && ./register_enclave.sh   # fetches get_attestation, submits document on-chain
```
Record the created `Enclave<REEF>` object id → set `REEF_ENCLAVE_OBJECT_ID`.

- [ ] **Step 4: Probe end-to-end**
```bash
WORKER_ISOLATION_MODE=enclave-nautilus ENCLAVE_PROCESS_URL=https://<enclave-host> \
REEF_ENCLAVE_OBJECT_ID=0x… WALLET_PRIVATE_KEY=0x… pnpm exec tsx scripts/07-nautilus-attested-demo.ts
```
Expected: prints the enclave-signed payload + the `register_derivative_attested` tx digest (the on-chain verify). If Move aborts with `EBadEnclaveSig`, the BCS layout in the Rust shim does not match `reef.move` — reconcile (Task 12 Step 2).

---

## Phase 5 — Demo + docs

### Task 15: `scripts/07-nautilus-attested-demo.ts`

**Files:**
- Create: `scripts/07-nautilus-attested-demo.ts`

- [ ] **Step 1: Implement (mirrors CDR's `scripts/06-enclave-sim-demo.ts` structure)**
```ts
// End-to-end attested-compute demo. Drives the real enclave path and prints the
// on-chain verification tx — the WOW evidence. Falls back to a clear message if
// the enclave env is not configured (never fakes a result).
import { callEnclave, ENCLAVE_URL_ENV } from "../lib/enclaveClient";
import { makeClientsFromKey } from "../lib/clients";
import { RegistryClient } from "../lib/registry";

async function main() {
  if (!process.env[ENCLAVE_URL_ENV]) {
    console.error(`[demo] ${ENCLAVE_URL_ENV} not set. Set it to the running Nitro enclave host.`);
    process.exit(1);
  }
  const datasetIpId = (process.env.DEMO_DATASET_ID ?? "0x0") as `0x${string}`;
  const algoHash = "sha256:mean-aggregate";
  console.log("=== 1. Call enclave process_data ===");
  const signed = await callEnclave({ datasetIpId, algoHash });
  console.log("enclave metrics:", signed.metrics);
  console.log("enclave sig (hex):", "0x" + Buffer.from(signed.signature).toString("hex"));

  console.log("\n=== 2. Verify on-chain via register_derivative_attested ===");
  const clients = await makeClientsFromKey(process.env.WALLET_PRIVATE_KEY!);
  const rc = new RegistryClient(clients.client);
  const tx = await rc.registerDerivativeAttested({
    tier: "public",
    parentId: datasetIpId,
    enclaveObjectId: process.env.REEF_ENCLAVE_OBJECT_ID!,
    timestampMs: signed.timestampMs,
    algoHash,
    metrics: new TextEncoder().encode(JSON.stringify({ metrics: signed.metrics })),
    signature: signed.signature,
  }, clients.signer as never);
  console.log("on-chain verify tx:", tx);
  console.log("\n=== Done — Sui Move verified the enclave. ===");
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Lint/typecheck**
```bash
pnpm exec tsc --noEmit
```
Expected: passes.

- [ ] **Step 3: Commit**
```bash
git add scripts/07-nautilus-attested-demo.ts
git commit -m "feat(demo): end-to-end Nautilus attested-compute demo script"
```

---

### Task 16: Update README honesty section

**Files:**
- Modify: `README.md` (the "Honesty (please read)" section + the compute tier description)

- [ ] **Step 1: Rewrite the disclosure**

Replace the paragraph describing the demo worker on an ordinary server / TEE-SIM with: the compute worker now runs inside an **AWS Nitro Enclave wrapped by Nautilus**; results are signed by the enclave's ephemeral key and **verified on-chain by `reef::registry::register_derivative_attested`** against the registered enclave (PCRs + pubkey) before a compute derivative is accepted. State plainly that `enclave-sim` remains as an **honestly-disclosed CI/dev fallback** with no silent fallback, and that testnet is the deployment target. Do not claim mainnet-grade confidentiality.

- [ ] **Step 2: Commit**
```bash
git add README.md
git commit -m "docs(readme): real Nitro+Nautilus enclave, on-chain-verified compute"
```

---

## Self-Review notes (author)

- **Spec coverage:** enclave.move vendor (T1), Move entry + verify (T2/T3/T5), AttestationInfo (T6), disclosure (T7), PTB (T8), enclave client (T9), worker mode (T10), route fail-closed (T11), Rust shim/Nitro (T12–T14), demo (T15), README honesty (T16). Deadline ladder honored: Phases 1–2 are the on-chain-verification floor.
- **Known reconciliation points (flagged inline, not placeholders):** exact intent-message BCS layout (read from vendored source in T1/T4); `Option<ID>` pure encoding (mirror existing `register` in T8); `object::id_to_bytes` helper name (T3); ed25519 raw-vs-personal signing (T4 Step 3). Each has a concrete fallback instruction.
- **No silent fallback** enforced in T11 and T9; sim path retained and honestly disclosed (T7, T16).
