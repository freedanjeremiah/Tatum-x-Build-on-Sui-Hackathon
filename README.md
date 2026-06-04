# Reef

> A *reef* is a living structure — many organisms tiling together into one ecosystem, each sheltered yet
> connected. That is the product: the **license is the access credential**, and datasets tile into models
> tile into derivatives — a reef of provenance with royalties flowing back along every edge.

**Reef — a private data & model market on Sui/Walrus.** A decentralized Kaggle + Hugging Face. Datasets and ML models are
registered as on-chain **Sui Move objects**; their heavy files are **threshold-encrypted with Seal**
and stored on **Walrus**; and who may decrypt them is enforced **on-chain** by a Move `seal_approve`
policy — there is no auth server and no platform operator who can hand out access. RPC runs through the
**Tatum** Sui gateway. It targets **Sui testnet + Walrus testnet**.

> **The thesis:** access control is a property of the *data*, not the *platform*. The Seal identity you
> qualify for on-chain *is* the key that decrypts the blob. Lose the platform and the rule still holds.

---

## Built for the Tatum x Walrus hackathon

Four pieces of the Sui stack, each doing what only it can:

| Layer | Technology | Role in Reef |
|-------|-----------|-----------------|
| **Storage** | **Walrus** (`@mysten/walrus`) | Encrypted dataset/model blobs; owner pays + owns the `Blob` object; gasless public reads via the aggregator; renewable + deletable for storage GC. |
| **Confidentiality** | **Seal** (`@mysten/seal`) | Threshold IBE encryption. The decryption key is released by the key-server committee **only** when an on-chain `seal_approve` Move call succeeds. |
| **Coordination** | **Sui Move** (`reef::registry`) | One shared `ArtifactRegistry` object per artifact: tier, owner, license holders, compute allowlist, group, revenue vault, derivative lineage — and the `seal_approve` gate itself. |
| **Access (RPC)** | **Tatum** Sui gateway | All JSON-RPC routed through Tatum (`x-api-key`, 429 backoff), with the public fullnode as fallback. |

**The composability lives in the on-chain `seal_approve` policy.** Seal calls
`reef::registry::seal_approve(id, registry, ctx)` as a dry-run before releasing key shares; if the
Move call aborts, the read is denied. One Move function expresses all five access tiers, and the
identity is bound to the artifact's own object id (`sealId = artifactObjectId ++ blake2b256(tier)`), so
each artifact's policy is isolated and forgery is impossible.

**Composability beyond the gate:** a model trained on a dataset is registered as that dataset's
**derivative** (`register_derivative`, an on-chain `parent` edge), and a compute result is a derivative
of the data it ran on. Royalties accrue to each artifact's on-chain `Balance<SUI>` vault and flow
upstream along the lineage. Private data you cannot even download still earns its owner SUI — upload →
encrypt → gate → license → compute → derive → pay, end-to-end.

---

## Access tiers

Every artifact picks one tier at upload. The tier decides how its Seal policy gates decryption:

| Tier | Who can decrypt | Enforced by (`seal_approve` branch) |
|------|-----------------|-------------------------------------|
| **public** | anyone | open branch (encrypted for a uniform path; `seal_approve` always allows) |
| **private-owner** | only the owner address | `sender == owner` |
| **gated-license** | anyone holding a license | `sender == owner \|\| license_holders.contains(sender)` |
| **group** | one license unlocks a family | group membership (per-artifact `license_holders`) |
| **compute** | *nobody downloads* — only an allowlisted worker | `compute_workers.contains(sender)` only |

A license is purchased permissionlessly on-chain: `buy_license(registry, payment: Coin<SUI>)` pays the
owner the artifact's `price` and adds the buyer to `license_holders`. Universal pre-checks on every
branch: the `id` prefix must equal the artifact's object id, the suffix must equal `blake2b256(tier)`,
and a revoked address is always denied. Every denial is a Move `abort` — Seal fails **closed**.

For **compute**, the data is never returned. A worker on the artifact's on-chain `compute_workers`
allowlist decrypts in memory, runs only an allowlisted algorithm, registers the **result as a
derivative IP** of the dataset, wipes the plaintext, and returns **aggregate metrics only**.

---

## Honesty (please read)

Seal provides **threshold encryption + on-chain-gated key delivery** — nothing more. It does **not**
run user algorithms on plaintext. "Private but computable" is **Reef's own** compute worker, which
uses Seal only to decrypt. So the compute-privacy guarantee comes from **the worker's isolation + the
algorithm allowlist**, not from Seal.

The demo worker runs on an ordinary server (operator-trusted). A production deployment would run it
inside an attested **SGX/TDX enclave** (`WORKER_ISOLATION_MODE=enclave`); a deterministic
**enclave-sim** mode is provided for CI and is **honestly disclosed as not hardware-attested**. No
silent fallbacks — the worker refuses any algorithm not on the dataset's allowlist **before decrypting
a single byte** (`decryptCalled: false`), and on a Seal `NoAccessError` it reports denial rather than
faking a result.

**One known gap, disclosed:** the **browser** write-signer (signing Sui transactions through the
Privy-embedded wallet) is stubbed with an honest throw — server-side flows (scripts, worker, the
`real` family) sign with an Ed25519 keypair and work end-to-end today. Wiring the Privy→Sui browser
signer is the next step; the UI surfaces a real "wallet not connected" error rather than a fake
signature.

---

## Quick start (Sui + Walrus testnet)

Requires **Node 20+** and **pnpm**, plus the **Sui CLI** (1.65+) to publish the Move package.

```bash
pnpm install
cp .env.local.example .env.local       # fill Privy, Tatum, Seal key servers, signer

# publish the Move package, then put the package id in REEF_PACKAGE_ID
cd move && sui move build && sui client publish --gas-budget 200000000
cd ..

pnpm dev                               # https://localhost:3000 (dev uses experimental HTTPS)
```

### What each env var is for

See `.env.local.example` for the full annotated list. The ones you must set to run real flows:
`NEXT_PUBLIC_PRIVY_APP_ID`, `TATUM_API_KEY`, `MASTER_SUI_PRIVKEY` (+ `MASTER_SUI_ADDRESS`),
`REEF_PACKAGE_ID`, and `SEAL_KEY_SERVER_IDS`. Walrus/Sui/Tatum endpoints default to testnet.
Optional `INFERENCE_*` powers the model **Run** tab (omit → honest 503).

---

## Scripts, worker, indexer

```bash
pnpm probe:real                        # Sui connectivity check via Tatum (gas price, balance, package)
pnpm real scripts/01-upload-gated.ts   # run any flow script against Sui testnet
pnpm worker:real                       # confidential-compute worker (Seal-gated decrypt, long-running)
pnpm indexer:real                      # SQLite read-model indexer over Sui Move events (long-running)
pnpm test                              # unit tests — no creds, no gas
RUN_INTEGRATION=1 pnpm test            # also runs live on-chain integration tests
cd move && sui move test               # Move contract tests (21 tests: the full access matrix)
```

The `real` family preloads `.env.local` via `node --env-file`.

---

## Project layout

```
.
├─ app/            Next.js App Router — pages + API routes (/api/run, /api/compute, /api/index, …)
├─ components/     React UI (browse, upload wizard, artifact tabs, compute panel, Run tab, wallet)
├─ lib/            core: clients (Sui+Tatum), registry (Move calls), crypto (Seal), storage (Walrus),
│                  artifacts, licensing, royalty, group, dispute, compute, attestation, tee-sim
├─ move/           Sui Move package `reef::registry` — the Artifact object + tiered seal_approve gate
├─ worker/         confidential-compute worker + the algorithm allowlist registry (worker/algos/)
├─ indexer/        SQLite read-model over Sui Move events (cache only — never keys or plaintext)
├─ scripts/        flow scripts (00..09), diagnostics (diag/), seed corpus (sample/)
├─ e2e/            Playwright verification harness (own package.json)
└─ docs/           design specs, pitch, demo script
```

### How the layers fit

- `lib/clients.ts` — Sui client routed through the Tatum gateway; server signer = Ed25519 keypair,
  browser signer = Privy (write path in progress).
- `lib/registry.ts` — the `RegistryClient`: `register` (→ get object id → **then** encrypt+store),
  `buyLicense`, `payRoyalty`/`claimRevenue`, `createGroup`, `raiseDispute`, and `buildSealApproveTx`.
- `lib/crypto.ts` (Seal) + `lib/storage.ts` (Walrus) — encrypt-before-publish always; a ciphertext
  guard refuses to publish anything that looks like plaintext.
- `worker/` — allowlist gate → Seal decrypt-in-worker → run the one approved algorithm → register a
  derivative → wipe plaintext → return metrics only.

---

## Invariants the code enforces

- The backend never holds keys, plaintext, or gating power — Seal crypto runs against the key-server
  committee and the Move policy decides access.
- Register before upload; the Seal identity is bound to the real on-chain object id.
- Encrypt-before-publish; Walrus writes are refused if the payload looks like plaintext.
- Compute-tier artifacts have **no download path** at all; the worker returns aggregate metrics only.
- Fail closed on Seal `NoAccessError` — never retried, never faked.
- `/api/index` stores only **public** descriptors — never keys or plaintext.

---

## Out of scope (testnet prototype)

Mainnet-grade confidentiality · hiding metadata (object ids and blob ids are public by design) ·
decryption revocation beyond forward-only (rotate by re-encrypting) · a production event indexer for
full per-wallet license enumeration · the attested-enclave compute deployment (designed for, simulated
here) · the Privy→Sui browser write-signer (server signing works today).

Reef is built natively on Sui, Walrus, Seal, and Tatum — every layer chosen for the job it
alone can do.
