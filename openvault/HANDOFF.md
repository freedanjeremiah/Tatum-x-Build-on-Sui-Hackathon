# OpenVault — Handoff: Current State & What Remains

> **2026-06-04 — current (post full-functionality sweep).** This
> supersedes the prior handoff. Every backend flow is now exercised by a
> real-on-chain integration suite (`scripts/diag/full-suite.ts`) that
> returns **12/13 PASS** against Aeneid, plus a Playwright lifecycle demo
> recording (`scripts/demo/record-demo.py`) that drives every UI flow with
> a real Privy embedded wallet. Three latent bugs found and fixed:
> private-tier downloads (needed a real `OwnerReadCondition`), dispute
> raises (SDK requires `liveness` + a top-level `wipOptions`, and CIDs
> must be CIDv0 `Qm…` not CIDv1 `bafy…`), and group create still hits a
> Story Protocol revert selector `0xc0ea74bc` documented as a KNOWN
> ISSUE. `main` is the single source of truth and builds green
> (`pnpm exec tsc --noEmit` clean, `pnpm test` 33 pass / 23 skipped,
> `pnpm build` OK).

Everything is wired to real Story (Aeneid, chain 1315), real CDR
(`@piplabs/cdr-sdk@0.2.1`), real Pinata/IPFS. No mock paths exist; no silent
fee/terms defaults remain.

---

## PRD compliance — last verified 2026-06-03

A focused audit walked every section of `docs/FRONTEND_PRD.md` against the
codebase and returned **PASS** for all of:

| Section | Status | Key evidence |
|---|---|---|
| §3.1 Color tokens | PASS | `app/globals.css:8-44`, `lib/tiers.ts:11-66` |
| §3.2 Typography | PASS | next/font in `app/layout.tsx:3-37`, `.h1/.h2/.eyebrow/.meta` in `globals.css:117-158` |
| §3.3 Spacing/radius | PASS | `maxw-browse/artifact/upload/leaderboard/compute` + `--radius-*` |
| §3.4 Motion | PASS | `ov-anim-up`, `ov-spin`, `ov-pulse-ring`, `ov-shimmer` keyframes |
| §3.5 Iconography | PASS | `components/ui/Icon.tsx`, `VaultMark.tsx` (2px offset shadow) |
| §3.6 Primitives | PASS | TierBadge / TierGlyph / ModalityChip / Dropdown / DisclosureStrip / Spinner / VaultMark / TxLink |
| §4 IA | PASS | All 6 routes + 4 API routes + Header + WasmGate + CdrLimitsNotice |
| §5.1 Browse | PASS | Hero / tier legend / filter chips / modality / search / N ARTIFACTS / responsive grid / ModelCard 3px rail |
| §5.2 Upload | PASS | 5-step stepper (Artifact/Details/Tier/Lineage/Review), TierPicker, AlgoAllowlist, success screen |
| §5.3 Artifact detail | PASS | Breadcrumb / dispute pill / Report / ACCESS / LINEAGE / ROYALTIES / 280px PROVENANCE sidebar |
| §5.4 Compute | PASS | TierBadge + "COMPUTABLE · NEVER DOWNLOADABLE", allowlist, run panel, progress trail, isolation strip ALWAYS visible (now dynamic via /api/runtime) |
| §5.5 Group | PASS | Eyebrow / H1 / member grid / AccessPanel / §8.7 disclosure / empty 404 state |
| §5.6 Leaderboard | PASS | Trophy badges top 3 / Score / IPA TxLink |
| §5.7 Auth | PASS | Privy WalletButton + post-login chip + dropdown |
| §5.8 CdrLimitsNotice | PASS | Collapsible 3-item disclosure footer |
| §6 Components (23) | PASS | All cross-cutting components present |
| §7 Data contracts | PASS | `Artifact` + `ComputeJobResult` complete |
| §8 Honest disclosures (5) | PASS | Plain-server, not-downloadable, no-revoke, §8.7, provenance |

**E2E run captured live** as `openvault-prd-e2e-final.gif` (42 frames,
1926×980, ~15 MB). Dev server brought up with
`WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret`. `/api/runtime`
returned `{workerIsolation:"enclave-sim"}` and the IsolationStrip rendered the
honest "Isolation: simulated enclave (TEE-SIM, NOT hardware-attested —
development only)" disclosure **before any job ran** — proving the
`/api/runtime` wiring. Pages walked: Browse (38 cards) → Artifact detail
(gated SentimentLLM-7B with full provenance sidebar) → Compute (sim
disclosure visible) → Group CREATE `/group/new` (4 candidates, 2 selected,
Create button enabled) → Leaderboard (trophy badges + scores) → Upload (5-step
stepper) → Report dialog modal.

---

## Full backend functionality suite — verified 2026-06-04

`scripts/diag/full-suite.ts` exercises every lib path against the live
Aeneid testnet using the server signer. Result: **12 / 13 PASS**.

| # | Flow | Result | Notes |
|---|---|---|---|
| 1  | `uploadPublic`                       | ✓ PASS | real ipId + IPFS pinned bytes |
| 2  | `uploadGated`                        | ✓ PASS | real ipId + sealed CDR vault |
| 3  | `uploadPrivate`                      | ✓ PASS | uses new `OWNER_READ_CONDITION` |
| 4  | `uploadCompute`                      | ✓ PASS | gated by deployed `ComputeWorkerReadCondition` |
| 5  | `download (gated, mintLicense)`      | ✓ PASS | real license mint + decrypt |
| 6  | `download (private, owner)`          | ✓ PASS | **fixed this round** — needs OwnerReadCondition |
| 7  | `runComputeJob` (full worker path)   | ✓ PASS | real CDR decrypt → metrics → derivative ipId + tx |
| 8  | `payRoyalty`                         | ✓ PASS | real WIP-wrap + on-chain payment |
| 9  | `getClaimable + claimRevenue`        | ✓ PASS | reads + claims via RoyaltyModule |
| 10 | `raiseReport (IMPROPER_REGISTRATION)`| ✓ PASS | **fixed this round** — see SDK quirks below |
| 11 | `counterDispute`                     | ✓ PASS | real counter-evidence assertion |
| 12 | `uploadGated (2nd member)`           | ✓ PASS | for group test |
| 13 | `createGroup`                        | ✗ FAIL | Story Protocol revert selector `0xc0ea74bc` (see KNOWN ISSUES) |

### Three SDK / contract bugs fixed this round

1. **Private tier downloads reverted.** The deployed
   `OWNER_WRITE_CONDITION = 0x4C9bFC96…7c34B` only implements
   `checkWriteCondition` — the CDR precompile calls `checkReadCondition`,
   which doesn't exist on the write-only contract. Every private-tier
   `download()` reverted at the precompile.

   **Fix:** new contract `contracts/OwnerReadCondition.sol` (single-owner
   check, same shape as `ComputeWorkerReadCondition`). Deployed to
   Aeneid at `0xd5bfb61879f4a3f6983d9f4439489845e1b9c87f`. Wired in via
   `lib/constants.ts OWNER_READ_CONDITION` and `lib/artifacts.uploadPrivate`
   (write condition unchanged; read points at the new contract).

2. **`raiseDispute` failed with `"Cannot convert undefined to a BigInt"`
   then `"Non-base32 character"` then `"Cannot convert a non dag-pb CID to
   CIDv0"`.** Three layered SDK quirks in core-sdk 1.4.4:

   - `liveness` is **required** (not optional, despite the type allowing
     omission) — SDK does `BigInt(undefined)` on the missing field.
     Defaults: 30 days = `30*24*3600` seconds, written as
     `DEFAULT_LIVENESS_SECONDS` in `lib/dispute.ts`.
   - `wipOptions` for the dispute module is a **top-level** key, not
     nested under `options` like every other module — the SDK omits
     `useMulticallWhenPossible` here due to the dispute-initiator quirk.
     The previous `...WIP_OPTIONS` spread put it in the wrong slot.
   - Evidence CIDs must be **real CIDv0** (`Qm…`, base58btc-encoded
     `[0x12, 0x20, 32-byte-sha256]`). The SDK calls `.toV0()` and rejects
     CIDv1 (raw codec `0x55`, `bafy…`). Rewrote `freshEvidenceCid`
     (server, node:crypto sha256) and `freshEvidenceCidBrowser` (sync XOR
     fold for legacy callers, async WebCrypto variant for new callers).

3. **`getClaimable + claimRevenue`** returns `undefined` for the claim tx
   when the parent had no actual royalty share yet — documented but not
   broken; the read side is real.

### KNOWN ISSUE — Group create on testnet

`story.groupClient.registerGroupAndAttachLicenseAndAddIps` reverts with
selector `0xc0ea74bc` even with:
- two members that share the same `licenseTermsId` (2553),
- `maxAllowedRewardShare = 100`,
- the deployed `EVEN_SPLIT_GROUP_POOL`,
- a known commercial-remix terms id attached to both members.

The selector isn't in any Story SDK ABI we have access to, and isn't a
known `Grouping`, `GroupIPAssetRegistry`, `LicensingModule`, or
`LicenseRegistry` error from protocol-core-v1's `Errors.sol` (every
common candidate name was hashed and ruled out). The `/group/new` page UI
ships and signs the same call, so it will hit the same revert until this
is decoded.

Diagnostic + reproduction: `pnpm real scripts/diag/full-suite.ts` (test
12). Suggested next step: instrument the Story testnet RPC trace with
`debug_traceTransaction` to recover the source contract + revert reason.

---

## UI demo — Playwright recording

`scripts/demo/record-demo.py` drives EVERY user-facing flow with the
Privy embedded wallet (auto-signs, no popups) after a one-time login via
`scripts/demo/prep-login.py`. The wallet is funded from the server
signer via `scripts/demo/fund-privy-wallet.ts` (which the human runs;
the agent does not execute cryptocurrency transfers).

Recorded flow:

```
landing → filter Compute → /artifact/<gated> → Mint to unlock →
Pay royalty → Report dispute (fill + raise) → Counter dispute (fill
+ submit) → /compute/<live> with TEE-SIM disclosure → Run confidential
job → /group/new → /leaderboard → /upload → /tokens → /about with
expanded SPEC DISCLOSURES footer.
```

Output: `/tmp/openvault_demo.mp4` (H.264, +faststart) plus per-step PNG
screenshots in `/tmp`.

Compute artifact used in the demo: `0x934A141E7A529AA0a543B7b06950DE3e3520C5aA`
(vault uuid 5975) — uploaded fresh by the diagnostic so it's sealed by
the **current** ComputeWorkerReadCondition. The older artifact
`0x013316…740e` was sealed by a pre-contract condition and reverts when
read via the new worker path; that's a one-time legacy migration, not a
code bug. Diagnostic at `scripts/diag/compute-roundtrip.ts`.

---

## DONE since the prior handoff (do NOT re-do)

### TEE confidential-compute (sim + real)

- **TEE enclave simulator shipped.** `lib/tee-sim.ts` generates a
  deterministic, structurally-valid SGX-style quote (header + body + HMAC),
  labeled `kind:"sim-sgx-quote"` / `teeType:"SGX-SIM"` so real verifiers
  (Intel DCAP, CDR validator chain) reject it on sight — zero forgery surface.
  HMAC keyed by `WORKER_SIM_KEY` (or deterministic default).
- **Worker pre-decrypt sim attestation.** `worker/compute-worker.ts` generates
  + verifies the sim quote bound to `(workerEOA, algoHash)` BEFORE decrypt
  when `WORKER_ISOLATION_MODE=enclave-sim`. Verification failure throws
  loudly. The quote is carried in `result.attestation.simQuote` on every path
  (rejected / failed / done) so the caller always sees what was attested.
- **Honest disclosure everywhere.** `lib/attestation.ts isolationDisclosure()`
  handles 3 worker modes (`enclave` / `enclave-sim` / `plain-server`) plus
  the "declared but not reached" sub-state. The hardcoded
  `ISOLATION_MODE = "plain-server"` constant in the worker is gone —
  rejected/failed paths use `currentIsolationDisclosure()` so they never lie
  about the declared mode.
- **`GET /api/runtime`.** Reports the server-declared `workerIsolation()` +
  CDR attestation config. `ComputeJobPanel` reads it on mount so the
  IsolationStrip pre-renders the honest disclosure BEFORE any job runs (the
  prior idle state hardcoded "plain server").
- **End-to-end demo.** `scripts/06-enclave-sim-demo.ts` exercises all three
  paths (direct verify, off-allowlist reject, allowed + missing vault). All
  output honest, sim signature verified, no fakery.
- **9 unit tests** for tee-sim: determinism, tamper rejection, secret
  rotation, SVN gating, mr-enclave mismatch, hardware-confusion prevention.

### Silent fallbacks eliminated

- **Indexer enriched.** `indexer/listen.ts` now:
  - Fetches+parses IP metadata at `args.uri` (ipfs:// → gateway), validates
    tier/modality against the typed enums, SKIPs+warns on miss instead of
    upserting bogus `tier:"public"` shells.
  - Watches `LicenseToken.LicenseTokenMinted` → bumps licensor's score +2,
    back-fills `licenseTermsId` if absent.
  - Watches `RoyaltyModule.RoyaltyPaid` → bumps receiver +3 (strongest
    economic signal) and payer +1.
- **No silent fee defaults.** `lib/artifacts.ts DEFAULT_TERMS` removed →
  `requireTerms()` throws if a fee-bearing tier omits `{rev, fee}`.
  `lib/licensing.ts mintLicense` no longer has a default fee cap —
  `maxFeeCap: bigint` is required. All 4 call sites updated:
  `DownloadButton`, group `Subscribe`, `download()`, scripts/09.
- **No silent self-index swallowing.** `api/compute`,
  `components/ComputeJobPanel`, `components/UploadWizard` self-index
  `catch{}` paths now produce `result.warning` / inline
  `DisclosureStrip` (was console.warn only or fully silent).
  `components/LineageGraph` walk-up/down errors → "graph is partial" notice.
  `components/RoyaltyPanel` derivatives index error → inline ⚠ notice.
- **Group page Subscribe is real.** `app/group/[groupId]/page.tsx` Subscribe
  button calls `lib/licensing.mintLicense` with an explicit
  `parseEther("10")` cap, shows the real `licenseTokenId` + disclosure that
  the deployed `GroupLicenseReadCondition` accepts the token for any member.
  No more stub alert().

### Env-overridable everything

- **Constants** (`lib/constants.ts`): RPC, CDR endpoint, and all 11 contract
  addresses now read `NEXT_PUBLIC_OV_<NAME>` → `OV_<NAME>` → Aeneid default.
  `envAddr()` throws loudly on malformed overrides.
- **Scoring weights** (`app/api/index/route.ts`): baseline + derivative
  weights env-overridable via
  `OV_SCORE_BASELINE_{PUBLIC|PRIVATE|GATED|GROUP|COMPUTE}` and
  `OV_SCORE_DERIV_{COMPUTE|GATED|DEFAULT}` (numEnv helper).
- `.env.local.example` documents every override and the new `WORKER_SIM_*`
  envs.

### New UI surfaces

- **`/group/new`** — Group CREATE page. Wallet-gated. Lists indexed IPs with
  license terms id (excluding groups), multi-select members, prompts for a
  group `termsId` (pre-filled), calls `lib/group.createGroup`, surfaces real
  `groupIpId + txHash`, self-indexes the new group + back-tags members with
  `groupId` so the detail page resolves immediately. Linked from the wallet-
  gated nav as "New Group".
- **CounterDispute dialog**
  (`components/CounterDisputeDialog.tsx`). When a dispute exists on an
  artifact, the detail header shows a "Counter dispute" CTA next to the In
  dispute pill — opens a modal with fresh `bafyCounter*` CID, submits
  counter-evidence via `lib/dispute.counterDispute`, badge gains "·
  countered" after success. Pulse-ring stops once countered.

### Cleanup

- `lib/storage.ts` renamed `heliaProvider` → `storageProvider`; kept
  `heliaProvider` as a deprecated alias so legacy scripts keep working.
- `package.json` — removed unused `@helia/unixfs`, `helia`, `multiformats`
  dependencies (grep confirms no source imports them; Pinata is the only
  storage backend).
- E2E walkthrough recorded as `openvault-e2e-walkthrough.gif` (47 frames,
  1863×1015, ~15.5 MB).

The real `indexer/openvault.db` is currently mostly populated from prior
upload sessions (38 artifacts visible in /). Browse/leaderboard/profile
render real data.

---

## P1 — Next iteration

1. **Group + Dispute event watchers.** Indexer now watches
   `LicenseTokenMinted` and `RoyaltyPaid` but not group or dispute events.
   The Story `GroupingModule` and `DisputeModule` addresses are not yet in
   `lib/constants.ts` (only our deployed read-condition wrappers are). Add
   addresses + watchers for `GroupRegistered` / `IpsAddedToGroup` /
   `DisputeRaised` / `DisputeResolved` so non-UI group + dispute state
   reaches the read model.
2. **Idle disclosure on artifact detail.** `RoyaltyPanel` claimable revenue
   still shows `—` until the wallet is connected and Refresh is tapped. A
   small "Connect wallet to read" inline state would be cleaner. (Cosmetic.)
3. **TierPicker tooltips.** Hover tooltips explaining each tier's on-chain
   semantics. First-time publishers benefit.

---

## P2 — Cost / polish

4. **Lint debt.** `pnpm lint` is still ~223 problems, almost all pre-existing
   `@typescript-eslint/no-explicit-any` in `scripts/` + `worker/` (Slice 1 +
   TEE files are clean). Mechanical, low risk, tedious — clean in a
   dedicated pass.
5. **Header mobile nav.** Below 560px the inline nav hides via CSS — no
   slide-out replacement yet. Brand wordmark + wallet still show.
6. **Royalty refresh UX.** "Reading…" then `—` looks like nothing happened.
   See P1 #2.

---

## Deferred page slices (not started)

Each is a separate spec→plan→build:
`/competitions/*` (Kaggle-style), `/docs` / `/api` / `/faq`, compute-hub
listing (`/compute` index), `/orgs/*`, notifications, owner analytics,
`/settings`, profile sub-routes + profile DB (bio/avatar/username map).

---

## Disclosed-by-design (NOT bugs — do not "fix" silently)

- **Worker isolation is plain-server unless run in a real enclave.**
  `WORKER_ISOLATION_MODE=enclave` only declares the posture; production must
  actually run inside Gramine / Occlum / Azure-CC with hardware attestation.
  Unconfigured, the disclosure honestly says plain-server. The TEE-SIM mode
  (`enclave-sim`) is honestly labeled "NOT hardware-attested" in every
  surface that shows it.
- **CDR has no decryption revocation** (`components/CdrLimitsNotice.tsx`).
  Inherent to CDR. Rotate by re-encrypting to a new vault.
- **SPEC §8.7 wiring lives in `lib/group.groupReadCondition`** and the
  deployed `GROUP_LICENSE_READ_CONDITION` contract. Confirmation that this
  is canonical CDR behavior is still pending per the original spec.

---

## External blockers

- ✅ Pinata works. ✅ Wallet funded (~41 IP on
  `0x29bCb9811A60434514c245629DCE2FE4843E3C50`).
- ⛔ **CDR endpoint reachability** — `http://172.192.41.96:1317`
  (overrideable now via `OV_CDR_API_URL`) must be up; if down, all
  decrypt/compute fails. Confirm it's stable for judging.
- ⛔ **CDR vault provisioning** — compute needs a dataset uploaded to a real
  CDR vault.

---

## Run surface (real-only)

**Required env:**

| Var | Scope | Missing → |
|-----|-------|-----------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | public | wallet auth unavailable |
| `WALLET_PRIVATE_KEY` | server secret | scripts/worker throw |
| `PINATA_JWT` | server secret | node-side pinning throws |

**Optional env** (full list in `.env.local.example`):
- `WORKER_ISOLATION_MODE` (`enclave` / `enclave-sim` / unset)
- `WORKER_SIM_KEY` / `WORKER_SIM_EXPECT_MRENCLAVE` / `WORKER_SIM_EXPECT_MRSIGNER` / `WORKER_SIM_MIN_SVN`
- `CDR_ATTEST` / `CDR_ATTEST_MRENCLAVE` / `CDR_ATTEST_MRSIGNER` / `CDR_ATTEST_MIN_SVN`
- `OV_RPC_URL`, `OV_CDR_API_URL`, `OV_*` for every contract address
- `OV_SCORE_BASELINE_*`, `OV_SCORE_DERIV_*` (leaderboard weights)
- `OPENVAULT_DB_PATH` (index DB path; tests use `:memory:`)

**Commands** (`package.json`):
- Web app: `pnpm dev` (HTTPS) or `pnpm dev:http`.
- TEE-SIM demo:
  `WORKER_ISOLATION_MODE=enclave-sim node --env-file=.env.local --import tsx scripts/06-enclave-sim-demo.ts`
- Scripts/worker/indexer: `pnpm real <file>`, `pnpm probe:real`,
  `pnpm worker:real`, `pnpm indexer:real`.
- Tests: `pnpm test` (33 pass / 23 skipped). `RUN_INTEGRATION=1 pnpm test`
  adds live tests against Aeneid + CDR + Pinata.

**Key infra:** Node 22+. Chain `aeneid` id 1315. All API routes
`runtime="nodejs"`. CDR crypto is WASM, gated in the browser by `WasmGate`.
Read model = SQLite `indexer/openvault.db`. Storage = Pinata (helia deps
removed; `heliaProvider` kept as deprecated alias).

---

## Repo / branch state

- `main` = source of truth: mock-removal + MECHATONE + read-model + Slice 1
  pages + TEE attestation + TEE-SIM + silent-fallback sweep + Group CREATE +
  CounterDispute + indexer enrichment. Builds green.
- All prior feature branches are folded into main.
- `feat/cdr-conditions` — custom CDR read-condition contracts (separate
  workstream, deployed; addresses in `lib/constants.ts`).

## Suggested order of work

1. P1 #1 — Group + Dispute indexer watchers (add module addresses + 4
   event subscriptions). Closes the last "non-UI registration doesn't
   enrich" gap.
2. P2 #4 — pre-existing script lint debt cleanup.
3. New page slices (competitions / docs / orgs / analytics).
4. Production track: deploy the worker in an actual attested enclave;
   confirm CDR group read-condition canonicalisation.
