# OpenVault

A decentralized Kaggle + Hugging Face. Datasets and ML models are Story Protocol **IP Assets**;
heavy files are **threshold-encrypted on IPFS** via CDR; access tiers are enforced **on-chain** —
no auth server, no platform that can hand out access. Testnet (Story **Aeneid**) prototype.

> **The thesis:** access control is a property of the *data*, not the *platform*. The license token
> *is* the decryption credential.

## Access tiers
- **Public** — open; IP Asset registered for provenance, attribution-only license.
- **Private** — owner-only; vault gated to the owner's wallet (EOA condition).
- **Gated** — pay/license to decrypt; CDR vault + `LicenseReadCondition(LICENSE_TOKEN, ipId)`.
- **Group** — one license unlocks a family (per-IP gating fallback; see open item below).
- **Compute** — *computable, never downloadable*. A consumer runs an **allowlisted** algorithm on the
  data inside a worker; only the result (a derivative IP) leaves. Royalties route to the data owner.

## Honesty (read this)
CDR does **threshold encryption + on-chain-gated key delivery** only. It does **not** run user
algorithms on plaintext. "Private but computable" is OpenVault's **own** compute worker that uses CDR
for gated decryption; the compute-privacy guarantee comes from the worker's isolation + the algorithm
allowlist, **not** CDR. The demo worker runs on a plain server (operator-trusted) — a production
deployment would run in an attested SGX/TDX enclave. The UI discloses this everywhere it matters.

## Run it (Story Aeneid testnet — real only)

```bash
cd openvault
pnpm install
cp .env.local.example .env.local   # fill NEXT_PUBLIC_PRIVY_APP_ID, PINATA_JWT, WALLET_PRIVATE_KEY
pnpm dev                           # http://localhost:3000
```

Required env (these are the **only three** the code reads — RPC and contract addresses
are hardcoded in `lib/constants.ts`):

| Var | Scope | Missing → |
|-----|-------|-----------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | public | wallet auth unavailable |
| `WALLET_PRIVATE_KEY` | server secret | scripts/worker throw |
| `PINATA_JWT` | server secret | node-side pinning throws |

**Node 22+** required. Real-mode IPFS storage is **Pinata** (set `PINATA_JWT`) — chosen
over an in-process Helia node so uploads survive across processes (worker/consumer can
retrieve them).

## Scripts, worker, indexer

```bash
pnpm probe:real                                    # connectivity check (no gas)
pnpm real scripts/01-upload-gated.ts               # … 02..08
pnpm worker:real                                   # confidential-compute worker
pnpm indexer:real                                  # SQLite read-model indexer
pnpm test                                          # unit tests (no creds/gas)
RUN_INTEGRATION=1 pnpm test                        # also runs live integration tests
```

The `real` family preloads `.env.local` via `node --env-file` so `tsx`-hoisted
modules see env at module-init time.

## Architecture
- `lib/clients.ts` — Story + CDR clients backed by a wallet or EIP-1193 provider.
- `lib/artifacts.ts` — high-level upload*/download/derivative API; enforces register → ipId → upload.
- `lib/{licensing,royalty,dispute,group,compute,storage,metadata}.ts` — focused helpers.
- `indexer/` — **index-only** SQLite mirror; `app/api/index` (GET + POST self-index) + `app/api/pin` (public JSON).
- `worker/` — confidential-compute worker: allowlist gate → decrypt-in-worker → run algo → derivative
  → wipe plaintext → metrics only.
- `app/` + `components/` — Next.js App Router UI (browse, upload wizard, artifact, compute, group,
  leaderboard) wrapped in `WasmGate` (no CDR call before `initWasm()`).

## Invariants enforced
Backend never holds keys/plaintext/gating · CDR crypto client-side · register before upload ·
`licenseTermsId` always threaded (never hardcoded) · fresh dispute CID each report · every tx/ipId
surfaced via `TxLink` · no localStorage · compute-only has no download path · `/api/index` POST
accepts only public Artifact descriptors (never keys/plaintext).

## Out of scope (testnet prototype)
Mainnet/production confidentiality · hiding metadata (CIDs/vault ids public by design) · decryption
revocation (rotate by re-encrypting).
