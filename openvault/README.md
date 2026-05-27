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

## Run it

### Mock mode (no credentials — for demo/verification)
```bash
cd openvault
pnpm install
NEXT_PUBLIC_MOCK=1 pnpm dev        # http://localhost:3000
```
Deterministic data, fake tx hashes, in-memory vault. Every flow works end-to-end.

### Real mode (Story Aeneid testnet)
```bash
cp .env.local.example .env.local   # fill NEXT_PUBLIC_PRIVY_APP_ID, PINATA_JWT, WALLET_PRIVATE_KEY
pnpm dev
```
Real mode is wired against the installed SDKs; the few call sites that still need live testnet
confirmation are marked `// VERIFY:` (see `../docs/RUN-LOG.md` and the open items below). Real-mode
IPFS storage is **Pinata** (set `PINATA_JWT`) — chosen over an in-process Helia node so uploads
survive across processes (worker/consumer can retrieve them). **Node 22+** required.

## Headless flow proofs (run before trusting the UI)
```bash
NEXT_PUBLIC_MOCK=1 pnpm tsx scripts/01-upload-gated.ts     # … 02..08
NEXT_PUBLIC_MOCK=1 pnpm worker                             # compute worker demo
pnpm test                                                  # 47 unit tests
```

## Architecture
- `lib/clients.ts` — mock or real Story + CDR clients (same interface).
- `lib/artifacts.ts` — high-level upload*/download/derivative API; enforces register → ipId → upload.
- `lib/{licensing,royalty,dispute,group,compute,storage,metadata}.ts` — focused helpers.
- `indexer/` — **index-only** SQLite mirror; `app/api/index` (read-only) + `app/api/pin` (public JSON).
- `worker/` — confidential-compute worker: allowlist gate → decrypt-in-worker → run algo → derivative
  → wipe plaintext → metrics only.
- `app/` + `components/` — Next.js App Router UI (browse, upload wizard, artifact, compute, group,
  leaderboard) wrapped in `WasmGate` (no CDR call before `initWasm()`).

## Invariants enforced
Backend never holds keys/plaintext/gating · CDR crypto client-side · register before upload ·
`licenseTermsId` always threaded (never hardcoded) · fresh dispute CID each report · every tx/ipId
surfaced via `TxLink` · no localStorage · compute-only has no download path.

## Open items (verify against live SDKs)
1. `registerIpAsset` license-terms-id return field · 2. `mintLicenseTokens` response shape ·
3. group-license → member-vault read condition (currently per-IP gating fallback) · 4. min dispute
bond · 5. CDR delegated decryption vs worker-holds-token · 6. compute vs download license encoding.

## Out of scope (testnet prototype)
Mainnet/production confidentiality · hiding metadata (CIDs/vault ids public by design) · decryption
revocation (rotate by re-encrypting).
