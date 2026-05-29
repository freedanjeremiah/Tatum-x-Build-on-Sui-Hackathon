# OpenVault — Handoff

**Status:** Real-only. Every mock / simulated / synthetic-data path was removed
(branch `feat/openvault`, 14-commit refactor on 2026-06-03). The app, scripts,
worker, indexer, and tests exercise only real implementations: on-chain Story
(Aeneid, chain 1315), real CDR threshold encryption + gated key delivery, and
real Pinata/IPFS storage.

Design spec: `docs/superpowers/specs/2026-06-03-remove-mock-real-only-design.md`.

## What "real-only" means here

- No `IS_MOCK` toggle, no `lib/mock/`, no `runComputeJobInline`, no `__mintFor`,
  no synthetic rows, no fabricated UI data.
- Missing credentials fail **loudly** (a thrown error naming the env var), never a
  silent mock fallback.
- Compute decrypts the real CDR vault via a minted compute-license token or
  returns `status:"failed"` — it never invents data. Plaintext is wiped on every
  path.

## Required environment

Real secrets live in `openvault/.env.local` (gitignored; `.env.local.example`
holds placeholders only). The app/scripts/worker will not function without:

| Var | Used by | Effect if missing |
|-----|---------|-------------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | browser wallet auth | Privy provider absent; wallet unavailable |
| `WALLET_PRIVATE_KEY` | scripts + compute worker (server signer) | `makeClientsFromKey` / worker throw |
| `PINATA_JWT` | server-side IPFS pinning | `pinJSON` / `pinFile` (node path) throw |

Chain: Story **Aeneid** testnet (id 1315), RPC `https://aeneid.storyrpc.io`.
Test wallet: `0x29bCb9811A60434514c245629DCE2FE4843E3C50` (key in `.env.local`).
Real IPAssetRegistry: `0x77319B4031e6eF1250907aa00018B8B1c67a244b`.

## Running

- **Web app:** `pnpm dev` (Next loads `.env.local` itself).
- **Scripts/worker/indexer (tsx hoists `lib/env` before dotenv):** must preload env —
  `node --env-file=.env.local --import tsx <file>`, or the npm aliases:
  `pnpm real <file>`, `pnpm probe:real`, `pnpm worker:real`, `pnpm indexer:real`.

## Tests

- `pnpm test` — pure unit tests only (no creds, no gas). Currently 20 pass.
- `RUN_INTEGRATION=1 pnpm test` — also runs live integration tests against Aeneid +
  CDR + Pinata (needs a funded `WALLET_PRIVATE_KEY` and a working `PINATA_JWT`).
  Helper: `lib/itest.ts` (`RUN_INTEGRATION`, `realClients()`). 23 such tests are
  skipped by default.

## External blockers (must clear to actually run end-to-end)

1. **Pinata 403 "plan usage limit"** — JWT authenticates but pinning is blocked.
   Clear the account or supply a new JWT before any upload or integration test.
2. **Wallet funding** — writes + integration tests spend IP. Re-faucet at
   https://aeneid.faucet.story.foundation/ (Cloudflare-gated, manual).
3. **CDR vault provisioning** — compute needs a dataset actually uploaded to a CDR
   vault; otherwise compute returns `status:"failed"` (by design).

## Honest gaps (not mock — disclosed, not faked)

- **No TEE/enclave hardware.** The compute worker runs on a plain server; results
  carry `isolationMode = "plain-server (operator-trusted, demo)"`. The operator can
  read plaintext in memory. Production would attest an SGX/TDX enclave; the contract
  is unchanged. Data is real; only the isolation is not enclave-grade.
- **SPEC §8.7 group license → member vault unlock** is unconfirmed in CDR. The group
  page lists real members (filtered by `groupId`) and governs the reward split, but
  each member vault is still unlocked by its own per-IP LicenseReadCondition. The UI
  discloses this prominently.
- **Indexer enrichment TODO** — `indexer/listen.ts` watches the real `IPRegistered`
  event; LicenseRegistry / RoyaltyModule enrichment watchers are a marked TODO (not
  mock — simply not yet implemented).

## Known follow-ups

- Compute worker mints a fresh compute-license token on every run (real cost). Consider
  reusing a valid token per (dataset, operator).
- `scripts/08-compute-job.ts` uploads a fresh compute dataset each run; could reuse a
  saved dataset from `.last-upload.json`.
