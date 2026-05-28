# Remove all mock — real-only OpenVault

**Date:** 2026-06-03
**Branch:** feat/openvault
**Status:** Approved (design)

## Goal

Eliminate every mock/simulated code path from the OpenVault codebase. The app,
scripts, worker, indexer, and tests must exercise only real implementations:
on-chain Story (Aeneid, chain 1315), real CDR threshold encryption + gated key
delivery, and real Pinata/IPFS storage. No `IS_MOCK` toggle, no synthetic data,
no deterministic stand-ins anywhere in runtime paths.

## Decisions (locked)

1. **Tests → live integration.** Tests are rewritten to hit live Aeneid + CDR +
   Pinata. No mock in tests. Gated behind `RUN_INTEGRATION=1` so a bare run does
   not spend gas, but the only implementation they touch is real.
2. **Compute = real data, honest isolation.** Remove the synthetic-row fallback.
   The worker decrypts the real CDR vault dataset via a real compute-license
   token or returns `failed`. No TEE exists, so `isolationMode` keeps the honest
   `"plain-server (operator-trusted, demo)"` disclosure — but the data is real.
3. **Require real creds.** App/scripts/worker fail loudly if any of
   `NEXT_PUBLIC_PRIVY_APP_ID`, `WALLET_PRIVATE_KEY`, `PINATA_JWT` is missing.
   No offline/no-key runtime.

## Removal map

**Delete files:**
- `lib/mock/story.ts`
- `lib/mock/cdr.ts`
- `lib/mock/seed.ts`
- `lib/compute.ts:runComputeJobInline` (dead second mock worker; keep the rest of
  the file — `allowlistCheck`, `submitJob`, `runJob`, types, `ALGO_NAMES`).

**Remove the `IS_MOCK` branch (keep only the real arm) in:**
- `lib/env.ts` — drop `IS_MOCK`; add `requireEnv()` (throws on missing creds).
- `lib/clients.ts` — `makeClientsFromKey`, `makeClientsFromProvider`,
  `makeReadOnlyCdr`.
- `lib/storage.ts` — `heliaProvider`, `pinJSON`, `pinFile` (delete mock provider).
- `lib/licensing.ts` — `mintLicense` mock tail.
- `indexer/listen.ts` — delete `runMock`/seed path; `main()` calls `runReal`.
- UI gates: `components/Providers.tsx`, `components/WalletButton.tsx`,
  `components/WasmGate.tsx`.
- `worker/compute-worker.ts` — `decryptDataset` synthetic-row fallback + demo().

## Per-subsystem real implementation

### env (`lib/env.ts`)
- Remove `IS_MOCK`.
- Keep `PRIVY_APP_ID`, `PINATA_JWT`.
- Add `requireEnv(name)`/`requireServerEnv()` helpers that throw a clear error
  (`Missing required env <NAME> — real mode needs it`) when a needed credential
  is absent. Server-only secrets (`WALLET_PRIVATE_KEY`, `PINATA_JWT`) must never
  be read from a browser bundle.

### clients (`lib/clients.ts`)
- Delete `makeMockClients` import and all `if (IS_MOCK) return ...` lines.
- Each factory always builds real viem (Aeneid) + CDR + wrapped Story.
- Missing `WALLET_PRIVATE_KEY` (key path) → throw via `requireServerEnv`.
- `makeReadOnlyCdr` stays real (read-only, no wallet) — used by browse.

### storage (`lib/storage.ts`)
- Delete the mock arm of `heliaProvider`, `pinJSON`, `pinFile`.
- Always Pinata (browser → server pin routes; node → direct JWT).
- Missing `PINATA_JWT` on a node/server path → throw.

### indexer (`indexer/listen.ts`)
- Delete `runMock` + `SEED_ARTIFACTS` import.
- Replace placeholder `IP_ASSET_REGISTRY = 0x000…000` and the hand-written event
  ABI with the Story SDK's real exports:
  `ipAssetRegistryAddress[1315]` (`0x77319B4031e6eF1250907aa00018B8B1c67a244b`)
  and the generated `ipAssetRegistryAbi` / `IPRegistered` event item.
- Also watch `licenseRegistryAddress[1315]` and `royaltyModuleAddress[1315]`
  (already a real constant) to enrich license-terms / royalty fields.
- `main()` → always `runReal()`.

### compute worker (`worker/compute-worker.ts`)
- `decryptDataset`: remove the deterministic demo cohort. Real flow:
  1. resolve the dataset's `vaultUuid` (required; absent → `failed`).
  2. obtain/mint a **compute license token** for the dataset
     (`lib/licensing.mintLicense` with the dataset's `computeLicenseTermsId`).
  3. `accessAuxData = encodeAccessAuxData([licenseTokenId])`.
  4. real `consumer.downloadFile({ uuid, accessAuxData, requesterPubKey,
     storageProvider })`.
  5. `parseRows(plaintext)`; unrecognized shape → `failed`.
- Replace the mock `__mintFor` helper usage with the real compute-license token.
- No fake data on any branch. Any failure (no vault entry, license rejected,
  CDR rejects delegated key) → `status: "failed"` with the real error message.
- Delete the `demo()` CLI block (it depends on mock clients + seed).
- Keep the wipe + `isolationMode` honesty disclosure unchanged.

### licensing (`lib/licensing.ts`)
- `mintLicense`: delete the `if (IS_MOCK)` … mock tail; real-only with the WIP
  auto-wrap (`WIP_OPTIONS`) already wired.

## Tests → live integration

- Convert `*.test.ts` that currently rely on `makeMockClients`/`SEED_ARTIFACTS`
  into integration tests against live Aeneid + CDR + Pinata.
- Gate every network/chain test behind `RUN_INTEGRATION=1` (skip otherwise) so a
  bare `pnpm test` neither spends gas nor needs creds — but the only code under
  test is real. No mock fixtures reintroduced.
- Pure-function tests with no external dependency (e.g. `allowlistCheck`,
  `encodeAccessAuxData`, sha256, `algoRegistry` algos, `metadata` builders) stay
  as fast unit tests — they never used mock clients.
- Tests requiring writes use the funded `WALLET_PRIVATE_KEY`; reads use
  read-only clients.

## Error handling

- Missing credential → throw at construction with an explicit message naming the
  env var. No silent fallback.
- Compute: any missing prerequisite (vault entry, license, key delivery) →
  `status: "failed"`, real reason. Plaintext always wiped on the failure path.
- Storage/pin failures already surface real HTTP status + body; unchanged.

## Risks / external blockers (must hold to actually run)

1. **Pinata 403 "plan usage limit"** — blocks any upload + any integration test
   that pins. Must clear the account or supply a new JWT.
2. **Wallet funding** — writes + integration tests burn IP; re-faucet as needed
   (`https://aeneid.faucet.story.foundation/`).
3. **CDR vault provisioning** — real compute needs a dataset actually uploaded to
   a CDR vault; otherwise compute returns `failed` (by design).
4. **Compute delegated decryption (SPEC §C9)** — the worker must present a
   compute license CDR testnet accepts for delegated key collection. If rejected,
   compute fails loudly — no fake fallback.

## Out of scope

- Dispute bond WIP auto-wrap (separate concern; `raiseDispute` has no wipOptions).
- Building an actual TEE/enclave (no hardware) — isolation disclosure stays honest.
- New features beyond removing mock and making each existing path real.

## Acceptance

- No `IS_MOCK`, `lib/mock/`, `runComputeJobInline`, `runMock`, `SEED_ARTIFACTS`,
  `__mintFor`, or synthetic-row fallback anywhere in non-test runtime.
- `grep -rn "IS_MOCK\|mock/\|SEED_ARTIFACTS\|runComputeJobInline" lib app worker
  indexer components` returns nothing (tests excluded).
- `tsc --noEmit` clean.
- `pnpm test` (no `RUN_INTEGRATION`) passes on pure-function tests only.
- App boot with a missing cred throws a clear, named error.
