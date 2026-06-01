# OpenVault — Handoff: Current State & What Remains

> **2026-06-03 — current.** This supersedes the older read-model-gap handoff. The P0
> read-model gap is **closed**, the frontend is on **MECHATONE**, a first slice of
> HuggingFace/Kaggle pages shipped, and the confidential-compute **TEE attestation
> layer is wired**. `main` is the single source of truth and builds green
> (`pnpm exec tsc --noEmit` clean, `pnpm test` 24 pass / 23 skipped, `pnpm build` OK).

Everything is wired to real Story (Aeneid, chain 1315), real CDR
(`@piplabs/cdr-sdk@0.2.1`), real Pinata/IPFS. No mock paths exist.

Design history:
- Mock removal: `docs/superpowers/specs/2026-06-03-remove-mock-real-only-design.md`
- Slice 1 pages: `docs/superpowers/specs/2026-06-03-openvault-slice1-pages-design.md`
  + plan `docs/superpowers/plans/2026-06-03-openvault-slice1-pages.md`

---

## DONE since the last handoff (do NOT re-do)

- **P0 read-model gap CLOSED.** `POST /api/index` (`app/api/index/route.ts`) exists and
  validates+upserts public metadata; `UploadWizard` self-indexes the returned `Artifact`
  after a successful upload (incl. `owner`, vault/terms ids). Browse/detail/compute now
  read real upload-time fields. Security invariant intact: POST accepts only public
  metadata, rejects secret-looking fields.
- **Leaderboard `score` populated.** `POST /api/index` seeds a tier baseline and bumps a
  parent's score on each fresh derivative (`app/api/index/route.ts`). No longer all-zero.
- **`owner` address indexed.** New `Artifact.owner` (EOA) flows type→schema→db→POST→upload;
  `/api/index` GET filters by `owner`/`tag`/`sort`. Powers wallet-derived profiles.
- **Slice 1 HF/Kaggle pages shipped.** Artifact tabs (`/artifact/[ipId]` + `/files`
  `/viewer` `/license` `/community`), `/profile/[owner]`, `/search`, `/tags/[tag]`,
  `/about`, branded `/not-found`, `/tokens` (on-chain License-NFT read). Honest empty/
  locked/placeholder states; no fabricated data. Header nav extended.
- **TEE validator-attestation wired** (`worker/compute-worker.ts` + `lib/attestation.ts`).
  The worker now passes `attestationConfig` + `onInvalidPartial` into the CDR download so
  each validator SGX enclave (MRENCLAVE/MRSIGNER/SVN) is verified and untrusted validators
  excluded; `result.attestation` (`AttestationInfo`) + a two-layer `isolationMode` string
  are surfaced. Gated by `CDR_ATTEST*` / `WORKER_ISOLATION_MODE` env (documented in
  `.env.local.example`). **Unconfigured → disclosure stays `plain-server`; no enclave is
  faked.** (NOTE: worker isolation itself is still plain-server unless run in a real
  enclave — see Disclosed-by-design.)
- **Pinata 403 cleared** + **test wallet funded (~41 IP)** — see memory `openvault-real-mode`.
- **`.env.local.example` de-staled** — `NEXT_PUBLIC_MOCK` and the unused
  `NEXT_PUBLIC_RPC_URL`/`NEXT_PUBLIC_STORY_API_URL` are gone; CDR_ATTEST/isolation documented.
- **Index-API test isolation** — `/api/index` honors `OPENVAULT_DB_PATH`; route tests use
  `:memory:` so they never pollute the real `indexer/openvault.db`.

The real `indexer/openvault.db` currently has **0 rows** (no real uploads done yet — honest
empty state, not a bug). Browse/leaderboard/profile show empty states until something is
uploaded or the indexer backfills.

---

## P1 — Real in `lib/` but unreachable / degraded in the UI

1. **Indexer still writes bare shells.** `indexer/listen.ts:51` hardcodes `tier:"public"`
   and sets no vault/terms fields. Self-index (POST on upload) is now the authoritative
   writer, so this matters less, but the indexer is still the only path for artifacts NOT
   uploaded through this UI. To make it a real reconciler it must fetch+parse the IP
   metadata JSON at `args.uri` and also watch **LicenseRegistry** (terms/mints),
   **RoyaltyModule** (payments → could feed `score`), **Group** events (set `groupId` +
   `tier:"group"`), **Dispute** events. Until then license/royalty/group/dispute state from
   non-UI registrations never reaches the read model.
2. **Group flow half-wired.** No UI creates groups (`lib/group.ts`, `scripts/05-group.ts`
   are script-only). `app/group/[groupId]/page.tsx` filters members by `groupId`, which the
   indexer never sets (depends on #1) → members render empty. "Subscribe to unlock family"
   is a stub `alert()` — wire to a real group-pool mint or remove.
3. **Royalty actions have no UI.** `payRoyalty`/`claimRevenue`/`getClaimable`
   (`lib/royalty.ts`) are real but script-only. Add owner-facing claim/pay controls (good
   home: the artifact detail "Card" tab or a profile section).
4. **Counter-dispute has no UI.** `counterDispute` (`lib/dispute.ts:40-57`) is real but
   script-only; UI only raises reports (`components/ReportDialog.tsx`).

---

## P2 — Correctness / cost / config

5. **Compute double-mints a license.** `ComputeJobPanel.tsx` mints a compute license
   client-side (display), then `compute-worker.ts` mints **again** server-side — two mints
   + two fees per run. Mint once server-side and pass the id back, or skip the client mint.
6. **Dispute bond partly hardcoded.** `ReportDialog.tsx` / `scripts/04-dispute.ts` still
   carry a `0.1 WIP` constant in places; prefer reading `OptimisticOracleV3.getMinimumBond(WIP)`
   everywhere. `raiseDispute` doesn't spread `WIP_OPTIONS` (unlike mint/royalty) — add
   auto-wrap or pre-wrap (`lib/dispute.ts:29-36`). (Bond *read* was added in `aa694d9`;
   confirm all call sites use it.)
7. **Worker derivative-registration failure swallowed.** `worker/compute-worker.ts` catches
   and drops the derivative-register error "best-effort in the demo" — surface a non-fatal
   warning in `ComputeJobResult` instead of silent loss.
8. **Magic terms-id fallback.** Worker falls back to terms id `"1"` when a dataset has none —
   could register a derivative under wrong terms. Fail loudly or resolve the real id.
9. **Constants testnet-pinned.** `lib/constants.ts` hardcodes the RPC, 9 Aeneid contract
   addresses, and the CDR endpoint `http://172.192.41.96:1317` (raw IP, plain HTTP). Make
   env-overridable for non-Aeneid/prod; confirm the CDR host is stable/owned.
10. **Lint debt.** `pnpm lint` reports ~223 problems, almost all pre-existing
    `@typescript-eslint/no-explicit-any` in `scripts/` + `worker/` (predate Slice 1). Not a
    green gate today. Slice 1 app files are lint-clean. Clean the script `any`s in a
    dedicated pass (low risk but tedious; verify scripts still run after).

---

## Deferred page slices (not started)

Slice 1 covered the Critical pages. Later slices (each its own spec→plan→build): competitions
(`/competitions/*`), docs/API/FAQ, compute-hub (`/compute` listing), orgs (`/orgs/*`),
notifications, owner analytics, settings, profile sub-routes, and a profile DB
(bio/avatar/username map). Pages needing a backend that doesn't exist (community threads,
competitions, notifications) are currently honest placeholders.

---

## Disclosed-by-design (NOT bugs — do not "fix" silently)

- **Worker isolation is plain-server unless run in a real enclave.** TEE *validator*
  attestation is now verified (above), but the compute worker process itself still runs on
  a plain server unless deployed in an attested SGX/TDX enclave with `WORKER_ISOLATION_MODE=enclave`.
  Unconfigured, `result.isolationMode` honestly says plain-server and the operator can read
  plaintext in memory. **Production:** run the worker in an attested enclave; the
  `runComputeJob` contract is unchanged.
- **SPEC §8.7 — group license → member-vault unlock unconfirmed in CDR** (`lib/group.ts`,
  surfaced in `app/group/[groupId]/page.tsx`). Each member vault is unlocked by its own
  per-IP `LicenseReadCondition`; the group only governs the reward split. Confirm the CDR
  read-condition path, then drop the fallback.
- **CDR has no decryption revocation** (`components/CdrLimitsNotice.tsx`) — once a reader
  collects the key, access can't be retroactively revoked. Inherent to CDR; disclosed.

---

## External blockers

- ✅ **Pinata** — works (403 plan-limit cleared). ✅ **Wallet** — funded ~41 IP
  (`0x29bCb9811A60434514c245629DCE2FE4843E3C50`).
- ⛔ **CDR vault provisioning** — compute needs a dataset actually uploaded to a CDR vault;
  else `decryptDataset` throws → `status:"failed"`.
- ⛔ **CDR endpoint reachability** — `http://172.192.41.96:1317` must be up; if down, all
  decrypt/compute fails (`lib/constants.ts`). Confirm it's not ephemeral.

---

## Run surface (real-only)

**Required env (the three the code always reads):**

| Var | Scope | Missing → |
|-----|-------|-----------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | public | wallet auth unavailable (`lib/env.ts`) |
| `WALLET_PRIVATE_KEY` | server secret | scripts/worker throw (`lib/clients.ts`, `worker/compute-worker.ts`) |
| `PINATA_JWT` | server secret | node-side pinning throws (`lib/storage.ts`) |

**Optional env:** `CDR_ATTEST` / `CDR_ATTEST_MRENCLAVE` / `CDR_ATTEST_MRSIGNER` /
`CDR_ATTEST_MIN_SVN` / `WORKER_ISOLATION_MODE` (TEE attestation — see `.env.local.example`);
`OPENVAULT_DB_PATH` (override the index DB path; tests set `:memory:`).

**Commands** (`package.json`):
- Web app: `pnpm dev` (HTTPS, `--experimental-https`) or `pnpm dev:http`. Next loads
  `.env.local` itself. Single-instance: a second `next dev` refuses to start.
- Scripts/worker/indexer preload env (tsx hoists `lib/env` before dotenv):
  `pnpm real <file>`, `pnpm probe:real`, `pnpm worker:real`, `pnpm indexer:real`.
- Connectivity check (no gas): `pnpm probe:real`.

**Tests:** `pnpm test` — unit only (no creds/gas), 24 pass / 23 skipped. Route/index tests
use an in-memory DB (`OPENVAULT_DB_PATH=:memory:`). `RUN_INTEGRATION=1 pnpm test` adds live
tests against Aeneid + CDR + Pinata (need funded wallet + working JWT; helper `lib/itest.ts`).

**Key infra:** Node 22+. Chain `aeneid` id 1315 (`lib/chains.ts`). All API routes
`runtime="nodejs"` (Edge unsupported — sqlite/CDR/secrets). CDR crypto is WASM, gated in the
browser by `WasmGate`. Read model = SQLite `indexer/openvault.db` (`indexer/db.ts`); an
idempotent `migrate()` ALTERs in new columns (e.g. `owner`) on open. Storage is Pinata
despite the historical `heliaProvider` name; `helia`/`@helia/*` deps are vestigial.

---

## Repo / branch state

- `main` = source of truth: mock-removal + MECHATONE + read-model + Slice 1 pages + TEE
  attestation + post-merge fixes. Builds green.
- Superseded branches (now folded into main, safe to archive/delete after confirming):
  `feat/openvault-slice1-pages` (merged), `feat/tee-attestation` / `feat/tee-compute-v2`
  (the real TEE wiring was brought onto main from `5948eb0`).
- `feat/cdr-conditions` — custom CDR read-condition contracts (separate workstream, not merged).

## Suggested order of work

1. P1 #1 — indexer enrichment (parse IP metadata + watch License/Royalty/Group/Dispute) →
   makes non-UI registrations and group membership real.
2. P2 #5–#8 — compute double-mint, dispute bond/auto-wrap, swallowed failure, terms-id.
3. P1 #2–#4 — group create UI / royalty UI / counter-dispute UI (if in product scope).
4. P2 #9 — env-configurable constants for non-testnet.
5. P2 #10 — clear pre-existing script lint debt.
6. Next page slices (competitions / docs / orgs / analytics) — one spec→plan→build each.
7. Production track: run the compute worker in an attested enclave (`WORKER_ISOLATION_MODE=enclave`);
   confirm CDR group read-condition (§8.7).
