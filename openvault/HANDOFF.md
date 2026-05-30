# OpenVault — Handoff: What Needs To Happen

> **2026-06-03 update:** the frontend was reskinned to the **MECHATONE** look
> (cream paper, navy + orange-red 2-ink palette, Oswald/DM Sans/JetBrains Mono).
> See `docs/MECHATONE_HANDOFF.md` for the design-system reference + file map.
> Backend / read-model gaps below are unchanged by the reskin.

This document is a **forward-looking work plan**. The mock-removal refactor is done
(branch merged to `main`); every code path is wired to real Story (Aeneid, chain
1315), real CDR (`@piplabs/cdr-sdk@0.2.1`), and real Pinata/IPFS. What follows is
what a next engineer must do to make the app actually usable end-to-end, ordered by
priority, each with concrete file:line targets.

Design history: `docs/superpowers/specs/2026-06-03-remove-mock-real-only-design.md`.

---

## TL;DR — the one thing that blocks everything

**The app does not persist what it uploads.** `UploadWizard.handleSubmit`
(`components/UploadWizard.tsx:115-178`) receives a complete `Artifact` from
`uploadGated/uploadPrivate/uploadCompute/uploadPublic` but **never writes it to the
read model**. The only index writer is `indexer/listen.ts` watching the on-chain
`IPRegistered` event, and it writes a **bare shell** — hardcoded `tier:"public"`,
empty tags, and **no** `vaultUuid`, `cid`, `licenseTermsId`, `allowedAlgoHashes`,
`computeLicenseTermsId`, `groupId`, or `score` (`indexer/listen.ts:49-59`). There is
**no `POST /api/index` route** (`app/api/index/route.ts` exports only `GET`).

Consequence: after a real upload, the artifact appears (if at all) as an empty public
shell. Its detail page has no `vaultUuid`/`licenseTermsId`, so **Download and Compute
cannot operate** (`DownloadButton.tsx:77` defaults `uuid` to `0`; the compute route
rejects on missing `computeEnabled`). Browse and leaderboard are empty out of the box
(seeded `indexer/openvault.db` has 0 rows).

**Fix this first.** Everything else is secondary.

---

## P0 — Make uploads usable (the read-model gap)

1. **Add a write path for the index.**
   - Create `POST /api/index` (`app/api/index/route.ts`) that calls
     `upsertArtifact(db, artifact)` (already implemented in `indexer/db.ts:107-152`).
   - Have `UploadWizard.handleSubmit` POST the returned `Artifact` after a successful
     upload (`components/UploadWizard.tsx:115-178`). Same for `OssParentImport`
     (`components/OssParentImport.tsx:31-60`) and any compute-dataset upload.
   - Result: gated/private/compute artifacts carry their `vaultUuid` + terms ids, so
     Download and Compute work from the UI.
   - Security note: `/api/index` writes only PUBLIC metadata (never keys/plaintext) —
     keep that invariant; validate the body shape.

2. **Or (alternative) enrich the indexer instead of self-indexing.**
   - `indexer/listen.ts:46-48` TODO: fetch + parse the IP metadata JSON at `args.uri`
     to reconstruct `tier`, `modality`, `tags`, and the vault/terms fields.
   - This is harder (the vault uuid + allowlist aren't on-chain in the IPRegistered
     event) — self-indexing (#1) is the pragmatic path; the indexer can remain the
     backfill/source-of-truth reconciler.

3. **Decide and document the canonical read model.** Right now browse reads SQLite via
   `/api/index` but nothing reliably populates it. Pick one writer story (self-index on
   action, vs. indexer-only) and make it consistent across upload/group/derivative.

---

## P1 — Features that are real in `lib/` but unreachable or degraded in the UI

4. **Leaderboard ranking is fake-empty.** `score` is never set by any code path
   (`indexer/db.ts` schema has it; nothing writes it), so `app/leaderboard/page.tsx:15-31`
   sorts everything at 0. Define a real metric (e.g. royalty volume, license-mint count,
   derivative count) and populate `score` — likely via the enriched indexer watching
   RoyaltyModule/LicenseRegistry.

5. **Indexer watches only `IPRegistered`.** `indexer/listen.ts:65-66` TODO: also watch
   **LicenseRegistry** (license terms attached / tokens minted), **RoyaltyModule**
   (payments — feeds `score`), **Group** events (sets `groupId` + `tier:"group"`), and
   **Dispute** events. Until then, license/royalty/group/dispute state never reaches the
   read model.

6. **Group flow is half-wired.**
   - No UI creates groups; `createGroup`/`addToGroup` are script-only
     (`lib/group.ts:12-32`, `scripts/05-group.ts`). Add a create-group UI if groups are
     a product surface.
   - Group member resolution (`app/group/[groupId]/page.tsx:43-52`) filters by
     `a.groupId === groupKey`, but the indexer never sets `groupId` (depends on P1 #5),
     so members render empty.
   - "Subscribe to unlock family" CTA is a stub `alert()`
     (`app/group/[groupId]/page.tsx:191-200`) — wire it to a real group-pool license mint
     or remove it.

7. **Royalty actions have no UI.** `payRoyalty`/`claimRevenue`/`getClaimable`
   (`lib/royalty.ts`) are real but only reachable via `scripts/03-derivative-royalty.ts`.
   Add user-facing claim/pay controls (e.g. on the artifact detail page for owners).

8. **Counter-dispute has no UI.** `counterDispute` (`lib/dispute.ts:40-57`) is real but
   script-only; the UI only raises reports (`components/ReportDialog.tsx`). Add a counter
   path if disputes are interactive.

---

## P2 — Correctness / cost / config hardening

9. **Compute double-mints a license.** `ComputeJobPanel.tsx:36-42` mints a compute
   license client-side (for display), then `compute-worker.ts:66` mints **again**
   server-side — two on-chain mints + two fees per run. Mint once (server-side) and pass
   the token id back, or skip the client mint.

10. **Dispute bond is hardcoded.** `components/ReportDialog.tsx:16-17` and
    `scripts/04-dispute.ts:32-34` hardcode `0.1 WIP` + 30-day liveness. `scripts/04`'s own
    comment says real mode should read `OptimisticOracleV3.getMinimumBond(WIP)` — implement
    that read instead of the magic constant. Also: `raiseDispute` does **not** spread
    `WIP_OPTIONS` (unlike mint/royalty), so the bond relies on pre-existing WIP — add
    auto-wrap or pre-wrap explicitly (`lib/dispute.ts:29-36`).

11. **Worker derivative-registration failure is swallowed.**
    `worker/compute-worker.ts:193-195` catches and drops the error "best-effort in the
    demo" — so `resultIpId`/royalty linkage can silently fail. Decide whether this should
    surface (recommended: include a non-fatal warning field in `ComputeJobResult`).

12. **Magic terms-id fallback.** `worker/compute-worker.ts:168` falls back to terms id
    `"1"` if the dataset has none — could register the derivative under wrong terms. Fail
    loudly or resolve the real terms id.

13. **Constants are testnet-pinned, not configurable.** `lib/constants.ts:3-21` hardcodes
    the RPC, all 9 Aeneid contract addresses, and the CDR endpoint
    `http://172.192.41.96:1317` (raw IP, plain HTTP — looks like a throwaway demo node).
    For any non-Aeneid/prod deployment, make these env-overridable. Confirm the CDR host is
    stable/owned, not ephemeral.

14. **Fix the stale env example + README (correctness, not cosmetic).**
    `.env.local.example` still ships `NEXT_PUBLIC_MOCK=1` and documents "deterministic mock
    mode", and lists `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_STORY_API_URL` — **none of which
    the code reads anymore** (mock was removed; RPC/CDR are hardcoded in constants). The
    README "Mock mode" section is likewise stale. Update both to the real 3-var contract
    below, or a new operator will be misled.

---

## Disclosed-by-design (NOT bugs — do not "fix" silently)

- **No TEE/enclave.** The compute worker runs on a plain server; results carry
  `isolationMode = "plain-server (operator-trusted, demo)"` (`worker/compute-worker.ts:23`)
  and the UI says so (`ComputeJobPanel.tsx:282-307`, `UploadWizard.tsx:299`). The operator
  can read plaintext in memory. **Production work:** run the worker in an attested SGX/TDX
  enclave; the `runComputeJob` contract stays the same. Data is already real — only the
  isolation is not enclave-grade.
- **SPEC §8.7 — group license → member-vault unlock is unconfirmed in CDR**
  (`lib/group.ts:4-6`, surfaced in `app/group/[groupId]/page.tsx:277-294`). Today each
  member vault is unlocked by its own per-IP `LicenseReadCondition`; the group only governs
  the reward split. **Production work:** confirm the CDR read-condition path and implement
  it, then drop the fallback.
- **CDR has no decryption revocation** (`components/CdrLimitsNotice.tsx:15-16`) — once a
  reader collects the key, access can't be retroactively revoked. Inherent to CDR; disclosed.

---

## External blockers (must clear before any real end-to-end run)

1. **Pinata 403 "plan usage limit"** — JWT authenticates but pinning is blocked. Clear the
   account or supply a new JWT. Blocks all uploads + every integration test that pins.
2. **Wallet funding** — writes + integration tests spend IP. Faucet:
   https://aeneid.faucet.story.foundation/ (Cloudflare-gated, manual). Test wallet:
   `0x29bCb9811A60434514c245629DCE2FE4843E3C50` (key in `.env.local`).
3. **CDR vault provisioning** — compute needs a dataset actually uploaded to a CDR vault;
   otherwise `decryptDataset` throws → `status:"failed"` (`worker/compute-worker.ts:54-56`).
4. **CDR endpoint reachability** — `http://172.192.41.96:1317` must be reachable; if down,
   all decrypt/compute fails (`lib/constants.ts:4`).

---

## Run surface (current, real-only)

**Required env (the ONLY three the code reads):**

| Var | Scope | Missing → |
|-----|-------|-----------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | public | wallet auth unavailable (`lib/env.ts:1`) |
| `WALLET_PRIVATE_KEY` | server secret | scripts/worker throw (`lib/clients.ts:14`, `worker/compute-worker.ts:144`) |
| `PINATA_JWT` | server secret | node-side pinning throws (`lib/storage.ts:178,208,254`) |

(Ignore `NEXT_PUBLIC_MOCK` / `NEXT_PUBLIC_RPC_URL` / `NEXT_PUBLIC_STORY_API_URL` in
`.env.local.example` — stale, not read. See P2 #14.)

**Commands** (`package.json`):
- Web app: `pnpm dev` (Next loads `.env.local` itself).
- Scripts/worker/indexer must preload env (tsx hoists `lib/env` before dotenv):
  `pnpm real <file>`, `pnpm probe:real`, `pnpm worker:real`, `pnpm indexer:real`
  (all = `node --env-file=.env.local --import tsx <file>`).
- Connectivity check (no gas): `pnpm probe:real`.

**Tests:**
- `pnpm test` — pure unit tests only (no creds/gas); 20 pass.
- `RUN_INTEGRATION=1 pnpm test` — also runs 23 live tests against Aeneid + CDR + Pinata
  (need funded wallet + working JWT). Helper: `lib/itest.ts`.

**Key infra facts:** Node 22+. Chain `aeneid` id 1315 (`lib/chains.ts`). All API routes are
`runtime="nodejs"` (Edge unsupported — sqlite/CDR/secrets). CDR crypto is WASM —
`initWasm()` gates the browser via `WasmGate`. Read model = SQLite at
`indexer/openvault.db` (`indexer/db.ts:14`). Storage is Pinata despite the historical
`heliaProvider` name (`lib/storage.ts:165-181`); `helia`/`@helia/*` deps are vestigial and
could be pruned.

---

## Suggested order of work

1. P0 #1 — `POST /api/index` + self-index on upload. (Unblocks the whole UI.)
2. P2 #14 — fix stale `.env.local.example` + README. (Cheap; prevents onboarding errors.)
3. P1 #5 — indexer enrichment (license/royalty/group/dispute watchers) → feeds #4, #6.
4. P1 #4 — real leaderboard score.
5. P2 #9, #10, #11, #12 — compute double-mint, dispute bond, swallowed failure, terms-id.
6. P1 #6, #7, #8 — group create UI / royalty UI / counter-dispute UI (if in product scope).
7. Production track (separate effort): TEE enclave for compute (§ disclosed), confirm CDR
   group read-condition (§8.7), make constants env-configurable for non-testnet.
