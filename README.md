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

Five pieces of the Sui stack, each doing what only it can:

| Layer | Technology | Role in Reef |
|-------|-----------|-----------------|
| **Storage** | **Walrus** (`@mysten/walrus`) | Encrypted dataset/model blobs; owner pays + owns the `Blob` object; gasless public reads via the aggregator; renewable + deletable for storage GC. |
| **Confidentiality** | **Seal** (`@mysten/seal`) | Threshold IBE encryption. The decryption key is released by the key-server committee **only** when an on-chain `seal_approve` Move call succeeds. |
| **Coordination** | **Sui Move** (`reef::registry`) | One shared `ArtifactRegistry` object per artifact: tier, owner, license holders, compute allowlist, group, revenue vault, derivative lineage — and the `seal_approve` gate itself. |
| **Confidential compute** | **AWS Nitro Enclave + Nautilus** (`nautilus/`) | Compute-tier data is decrypted and processed **inside a hardware enclave**; the enclave signs the result and `reef::registry::register_derivative_attested` verifies the AWS attestation + signature **on-chain** before accepting the derivative. See [Confidential compute](#confidential-compute-nautilus-tee). |
| **Access (RPC + data)** | **Tatum** | Three Tatum capabilities: Sui JSON-RPC gateway (`x-api-key`, 429 backoff, public-fullnode fallback), Notification webhooks → push indexer, and a live network/gas status surface. See [Tatum integration](#tatum-integration). |

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

## Tatum integration

Reef uses **three distinct Tatum capabilities**, not just RPC. Each degrades to an
honest disabled state when `TATUM_API_KEY` is absent — never a fabricated value.

| # | Tatum capability | Where | What it does |
|---|------------------|-------|--------------|
| 1 | **Sui RPC gateway** | `lib/clients.ts` | Every Sui JSON-RPC call is routed through the Tatum Sui gateway with the `x-api-key` header and a 429/5xx exponential backoff. The public fullnode is the automatic fallback when no key is set. |
| 2 | **Notification webhooks → push indexer** | `lib/tatum.ts`, `app/api/tatum/webhook`, `indexer/listen.ts` | On startup the indexer registers a Tatum **v4 address subscription** (`/v4/subscription`, `ADDRESS_EVENT`) for the Reef publisher, so on-chain activity is **PUSHED** to `/api/tatum/webhook`. The webhook validates the payload (and an optional `x-reef-webhook-secret`), then triggers an incremental on-chain drain — the chain stays the source of truth; the push is just a low-latency trigger. The existing `queryEvents` **poll loop stays on as the reliable fallback** (belt-and-suspenders). If push is not configured the indexer logs "polling only". |
| 3 | **Network / gas status** | `lib/tatum.ts`, `app/api/tatum/status`, `components/TatumStatus.tsx` | A header indicator shows the live Sui reference gas price + latest checkpoint/epoch, read server-side through the Tatum gateway (`suix_getReferenceGasPrice`, `sui_getLatestCheckpointSequenceNumber`, `suix_getLatestSuiSystemState`) and labeled "via Tatum". The key never reaches the browser; unavailable status renders "—". |

**Env vars:** `TATUM_API_KEY` (RPC + notifications + status), `REEF_WEBHOOK_URL`
(public HTTPS callback URL — set it to enable push; empty = poll only),
`TATUM_WEBHOOK_SECRET` (optional shared secret for the webhook). The key and
secret are server-only and are never logged.

**Honest disabled behaviour:** no `TATUM_API_KEY` → RPC falls back to the public
fullnode, the notification client throws a clear "TATUM_API_KEY is not set" error
(no silent fallback), and the status indicator shows "—". The subscription type
defaults to the documented `ADDRESS_EVENT` shape and is overridable
(`OV_TATUM_SUB_TYPE` / `OV_TATUM_SUB_CHAIN`) if Tatum names the Sui-specific type
differently.

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

## Confidential compute (Nautilus TEE)

The compute tier's promise — *"computable, not downloadable"* — is only as strong as the box the
worker runs on. Reef closes that gap with **Nautilus**, Sui's verifiable-offchain-compute framework,
backed by a real **AWS Nitro Enclave**. This is the part that turns "trust the operator" into
**"Sui Move verified the enclave."**

**End-to-end flow of one confidential job:**

```
consumer ─▶ /api/compute ─▶ Nitro Enclave (Nautilus app, nautilus/)
                                  │  in-enclave TS worker (worker/enclave-server.ts, 127.0.0.1:7070)
                                  │   1. Seal-gated decrypt (compute_workers allowlist)
                                  │   2. run the allowlisted algorithm (worker/algos/*)
                                  │   3. wipe plaintext → metrics only
                                  │  enclave ephemeral key signs
                                  │   IntentMessage{intent:0, ts, ComputeResultPayload{dataset_id, algo_hash, metrics}}
                                  ▼
        server ─▶ reef::registry::register_derivative_attested(payload, signature, &Enclave<REEF>)
                                  ▼
                  Move verifies: AWS-rooted attestation (PCRs + ephemeral pubkey via the vendored
                  `reef::enclave` module) AND the ed25519 signature over the result.
                  Aborts (EBadEnclaveSig) on mismatch — the derivative is only created if the
                  enclave is real and the result is genuinely what it signed.
```

**What this buys you:** the compute derivative on-chain is provably the output of an **allowlisted
algorithm running inside an attested enclave** over the gated data — not something an operator could
fabricate. The enclave returns `metrics_b64` (base64 of the exact signed bytes) so the server forwards
them **verbatim** on-chain; the signed bytes and the verified bytes are identical by construction.

**Honest fallback, no silent downgrade.** Setting `WORKER_ISOLATION_MODE=enclave-sim` runs a
TEE *simulator* for CI/dev — clearly disclosed as **not hardware-attested**. If
`WORKER_ISOLATION_MODE=enclave-nautilus` is set but the enclave is unreachable, the compute path
**fails closed** rather than quietly running on a plain server.

**Verified live on Sui testnet (2026-06-06):**

| On-chain artifact | Value |
|---|---|
| Reef package | `0x3203061e549b9df36a842a53fe3ef40e2a2e923e05a9aeed26ed9715ee63db7d` |
| `Enclave<REEF>` object | `0x2bf98f2a6ea8e78835463e8dcece3d321eae948b527e699c69bca91a70c5b21e` |
| `register_enclave` (AWS-root attestation verified) | `3m78crZ2ysQ83DKbQuimFh9aVVhVPkPF8NxX4NQyBbnS` |
| `register_derivative_attested` (enclave sig verified) | `926wJkXLbJoWNpoa5YBjSnVcxahztAu9svjWnww1mMco` |

To reproduce the enclave from scratch (build EIF, register PCRs, register the live attestation), see
**[`nautilus/RUNBOOK.md`](nautilus/RUNBOOK.md)**.

---

## Honesty (please read)

Seal provides **threshold encryption + on-chain-gated key delivery** — nothing more. It does **not**
run user algorithms on plaintext. "Private but computable" is **Reef's own** compute worker, which
uses Seal only to decrypt. So the compute-privacy guarantee comes from **the worker's isolation + the
algorithm allowlist**, not from Seal.

The confidential-compute worker now runs inside an **AWS Nitro Enclave wrapped by Nautilus** — Sui's
verifiable-offchain-compute framework. The worker decrypts (Seal-gated key delivery) and runs the
allowlisted algorithm **inside the enclave**. The enclave's ephemeral key signs the result;
`reef::registry::register_derivative_attested` **verifies that signature on-chain** against the
registered enclave object (PCRs + public key) before a compute derivative is accepted. The guarantee
is **"Sui Move verified the enclave"**, not "trust the operator."

**Verified live on Sui testnet (2026-06-06):** a real AWS Nitro enclave was built, its NSM
attestation document verified on-chain against the **AWS root of trust** (bundled in the Sui
framework), and a confidential-compute result passed `register_derivative_attested`'s on-chain
ed25519 verification:

| On-chain artifact | Value |
|---|---|
| Reef package | `0x3203061e549b9df36a842a53fe3ef40e2a2e923e05a9aeed26ed9715ee63db7d` |
| `Enclave<REEF>` object | `0x2bf98f2a6ea8e78835463e8dcece3d321eae948b527e699c69bca91a70c5b21e` |
| `register_enclave` (AWS-root attestation verified) | `3m78crZ2ysQ83DKbQuimFh9aVVhVPkPF8NxX4NQyBbnS` |
| `register_derivative_attested` (enclave sig verified) | `926wJkXLbJoWNpoa5YBjSnVcxahztAu9svjWnww1mMco` |
| compute-tier dataset (Seal-encrypted CSV on Walrus) | `0xdcb43aeb3b2d6c14be413061826e1c6cd885c58e70b2f841ba15b9057d32f1fa` |
| verified result (computed inside the enclave) | `{ columnMeans_0: 4, columnMeans_1: 5, columnMeans_2: 6, n: 3 }` |
| `EnclaveConfig<REEF>` (registered PCRs) | `0x9f2447…d95d` |

That last row is the proof it's **real, not a stub**: the enclave Seal-decrypted a private dataset on
Walrus, computed `mean-aggregate` over it **inside the TEE**, and the resulting column means were
accepted on-chain only because the enclave's signature verified.

The Nautilus enclave app (`nautilus/`) runs the in-enclave TS worker (`worker/enclave-server.ts`,
on `127.0.0.1:7070`), signs `IntentMessage{intent:0,…}` over `ComputeResultPayload{dataset_id,
algo_hash, metrics}`, and returns `metrics_b64` = base64 of the **exact signed bytes** so the server
forwards them verbatim on-chain (byte-exact; no `EBadEnclaveSig`).

The **TEE simulator (`enclave-sim`) remains as an honestly-disclosed CI/dev fallback.** There is
**no silent fallback** — if `WORKER_ISOLATION_MODE=enclave-nautilus` is set but the enclave is
unconfigured or unreachable, the compute path **fails closed** with a clear error. The worker refuses
any algorithm not on the dataset's allowlist **before decrypting a single byte** (`decryptCalled:
false`), and on a Seal `NoAccessError` it reports denial rather than faking a result.

**Scope and known limits (testnet):** this targets Sui testnet; metadata (object ids, blob ids)
remains public by design. Seal still does only threshold key-delivery; the enclave is the compute
isolation boundary. Do not assume mainnet-grade confidentiality.

**One known gap, disclosed:** the **browser** write-signer (signing Sui transactions through the
Privy-embedded wallet) is stubbed with an honest throw — server-side flows (scripts, worker, the
`real` family) sign with an Ed25519 keypair and work end-to-end today. Wiring the Privy→Sui browser
signer is the next step; the UI surfaces a real "wallet not connected" error rather than a fake
signature.

**Two further disclosed limits of the attested path:**
1. **Contract-level scope.** `reef::registry::mint_enclave_cap` is open, and
   `register_derivative_attested` accepts any registered `Enclave<REEF>` without pinning PCRs on-chain.
   The server pins the canonical enclave object id (`REEF_ENCLAVE_OBJECT_ID`), so the **app** is safe,
   but the **contract-level** guarantee is "signed by *a* registered REEF enclave," not "*the* canonical
   one." Production would gate cap minting (one-time / deployer-only) and assert expected PCRs in Move.
2. **Tatum RPC coverage.** The Tatum Sui gateway does not serve `suix_getLatestSuiSystemState`, so the
   live status surface **omits the epoch field and lists it under `unavailable`** (honest partial) while
   the reference gas price and latest checkpoint **do** route through Tatum. The `/api/tatum/status`
   route degrades to `200` with whatever the gateway served — it never fails the whole surface (`502`)
   over one unsupported method.

---

## Getting started

**Prerequisites:** **Node 20+**, **pnpm**, and (for publishing/Move work) the **Sui CLI** — use a
build matching Sui **testnet** (`sui --version` should report `1.73.x`). The web app uses experimental
HTTPS in dev, so it serves on `https://localhost:3000`.

```bash
git clone https://github.com/freedanjeremiah/Tatum-x-Build-on-Sui-Hackathon.git
cd Tatum-x-Build-on-Sui-Hackathon
pnpm install
cp .env.local.example .env.local
```

`.env.local` is gitignored — secrets never enter the repo. Fill it according to the path you want:

### Path A — Browse against the already-deployed testnet package (fastest)

You don't have to publish anything. Point the app at the live Reef package and the public Mysten
testnet Seal key servers (these are the built-in defaults, shown here explicitly):

```bash
# in .env.local
REEF_PACKAGE_ID=0x3203061e549b9df36a842a53fe3ef40e2a2e923e05a9aeed26ed9715ee63db7d
NEXT_PUBLIC_OV_REEF_PACKAGE_ID=0x3203061e549b9df36a842a53fe3ef40e2a2e923e05a9aeed26ed9715ee63db7d
SEAL_KEY_SERVER_IDS=0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75,0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>     # browser wallet (free at dashboard.privy.io)
```

```bash
pnpm dev          # https://localhost:3000 — browse artifacts indexed from Sui testnet
```

### Path B — Run real on-chain flows with your own wallet

To register artifacts, buy licenses, pay royalties, etc., you need a funded testnet signer:

```bash
# create a wallet (or import an existing suiprivkey)
sui client new-address ed25519
sui client faucet                         # fund it on testnet

# in .env.local — the server signer (bech32 suiprivkey…, NOT hex on Sui ≥1.7):
MASTER_SUI_PRIVKEY=suiprivkey1...
MASTER_SUI_ADDRESS=0x...
WALLET_PRIVATE_KEY=suiprivkey1...         # same value; read by the worker + /api/compute
TATUM_API_KEY=<your-tatum-key>            # optional — routes RPC via Tatum; omit → public fullnode
```

Sanity-check connectivity, then run a flow:

```bash
pnpm probe:real                           # gas price (via Tatum), wallet balance, package reachable
pnpm real scripts/01-upload-gated.ts      # register → Seal-encrypt → Walrus-store, end-to-end
```

To deploy **your own** copy of the contracts instead of using the shared package:

```bash
cd move && sui move build && sui client publish --gas-budget 200000000
# put the new package id in REEF_PACKAGE_ID (+ NEXT_PUBLIC_OV_REEF_PACKAGE_ID)
```

### Path C — Confidential compute

**Simulator (zero infra, honest):** exercises the full code path with a disclosed *non-attested*
simulator. Good for local dev and CI.

```bash
WORKER_ISOLATION_MODE=enclave-sim pnpm exec tsx scripts/06-enclave-sim-demo.ts
```

**Real Nitro enclave:** point at a running enclave (see [`nautilus/RUNBOOK.md`](nautilus/RUNBOOK.md)
to build one on a Nitro-enabled EC2 box). If the enclave runs on a remote host, tunnel its vsock
bridge to localhost first (`ssh -L 3000:127.0.0.1:3000 ec2-user@<host>`), then:

```bash
WORKER_ISOLATION_MODE=enclave-nautilus \
ENCLAVE_PROCESS_URL=http://127.0.0.1:3000 \
REEF_ENCLAVE_OBJECT_ID=0x2bf98f2a6ea8e78835463e8dcece3d321eae948b527e699c69bca91a70c5b21e \
pnpm exec tsx scripts/07-nautilus-attested-demo.ts
```

This decrypts inside the real enclave, runs the allowlisted algorithm, and lands a
`register_derivative_attested` transaction whose enclave signature is **verified on-chain**.

### Environment variables

`.env.local.example` is the full annotated list. The essentials by purpose:

| Purpose | Vars |
|---|---|
| Move package | `REEF_PACKAGE_ID`, `NEXT_PUBLIC_OV_REEF_PACKAGE_ID` |
| Server signer | `MASTER_SUI_PRIVKEY` / `MASTER_SUI_ADDRESS`, `WALLET_PRIVATE_KEY` (bech32 `suiprivkey…`) |
| Browser wallet | `NEXT_PUBLIC_PRIVY_APP_ID` |
| Seal | `SEAL_KEY_SERVER_IDS` (defaults to the Mysten testnet pair), `SEAL_THRESHOLD` |
| Tatum | `TATUM_API_KEY`, `REEF_WEBHOOK_URL`, `TATUM_WEBHOOK_SECRET` |
| Confidential compute | `WORKER_ISOLATION_MODE` (`enclave-nautilus` \| `enclave-sim` \| unset), `ENCLAVE_PROCESS_URL`, `REEF_ENCLAVE_OBJECT_ID` |
| Model Run tab (optional) | `INFERENCE_*` (omit → honest 503) |

Walrus / Sui / Tatum endpoints default to testnet; override with the `NEXT_PUBLIC_OV_*` / `OV_*` vars.

---

## Scripts, worker, indexer

```bash
pnpm probe:real                              # Sui connectivity check via Tatum (gas price, balance, package)
pnpm real scripts/01-upload-gated.ts         # run any flow script against Sui testnet
pnpm worker:real                             # confidential-compute worker (Seal-gated decrypt, long-running)
pnpm indexer:real                            # SQLite read-model indexer over Sui Move events (long-running)
pnpm exec tsx scripts/06-enclave-sim-demo.ts # TEE simulator demo (honest, non-attested)
pnpm exec tsx scripts/07-nautilus-attested-demo.ts  # real enclave → on-chain attested verify (needs ENCLAVE_PROCESS_URL)
pnpm test                                    # unit tests — no creds, no gas
RUN_INTEGRATION=1 pnpm test                  # also runs live on-chain integration tests
cd move && sui move test                     # Move contract tests (24 tests: full access matrix + attested registration)
```

The `real` family preloads `.env.local` via `node --env-file`.

---

## Project layout

```
.
├─ app/            Next.js App Router — pages + API routes (/api/run, /api/compute, /api/index, …)
├─ components/     React UI (browse, upload wizard, artifact tabs, compute panel, Run tab, wallet)
├─ lib/            core: clients (Sui+Tatum), registry (Move calls + register_derivative_attested),
│                  crypto (Seal), storage (Walrus), enclaveClient (→ Nautilus enclave), artifacts,
│                  licensing, royalty, group, dispute, compute, attestation, tee-sim
├─ move/           Sui Move package: reef.move (`reef::registry` + register_derivative_attested) +
│                  enclave.move (vendored Nautilus `reef::enclave` attestation verifier) + tests
├─ worker/         confidential-compute worker, algorithm allowlist (worker/algos/), and
│                  enclave-server.ts (the in-enclave localhost listener the Nautilus app calls)
├─ nautilus/       AWS Nitro Enclave app (Rust) + build/registration scripts + RUNBOOK.md
├─ indexer/        SQLite read-model over Sui Move events (cache only — never keys or plaintext)
├─ scripts/        flow scripts (00..09), enclave-sim + nautilus demos, diagnostics, seed corpus
├─ e2e/            Playwright verification harness (own package.json)
└─ docs/           design specs (docs/superpowers/specs + plans), pitch, demo script
```

### How the layers fit

- `lib/clients.ts` — Sui client routed through the Tatum gateway; server signer = Ed25519 keypair,
  browser signer = Privy (write path in progress).
- `lib/registry.ts` — the `RegistryClient`: `register` (→ get object id → **then** encrypt+store),
  `buyLicense`, `payRoyalty`/`claimRevenue`, `createGroup`, `raiseDispute`, and `buildSealApproveTx`.
- `lib/crypto.ts` (Seal) + `lib/storage.ts` (Walrus) — encrypt-before-publish always; a ciphertext
  guard refuses to publish anything that looks like plaintext.
- `worker/` — allowlist gate → Seal decrypt-in-worker → run the one approved algorithm → register a
  derivative → wipe plaintext → return metrics only. Inside the enclave, `worker/enclave-server.ts`
  exposes this over localhost so the Nautilus Rust app (`nautilus/`) can drive it and sign the result.
- `lib/enclaveClient.ts` + `lib/registry.ts#registerDerivativeAttested` — the server calls the enclave's
  `process_data`, then submits the enclave-signed result to `register_derivative_attested`, which the
  vendored `reef::enclave` Move module verifies on-chain (AWS attestation + ed25519) before the
  derivative is created. Fails closed if the enclave is unreachable.

---

## Invariants the code enforces

- The backend never holds keys, plaintext, or gating power — Seal crypto runs against the key-server
  committee and the Move policy decides access.
- Register before upload; the Seal identity is bound to the real on-chain object id.
- Encrypt-before-publish; Walrus writes are refused if the payload looks like plaintext.
- Compute-tier artifacts have **no download path** at all; the worker returns aggregate metrics only.
- Fail closed on Seal `NoAccessError` — never retried, never faked.
- Attested compute: the enclave signs the exact result bytes it returns, and the server forwards them
  **verbatim** on-chain; `register_derivative_attested` aborts (`EBadEnclaveSig`) on any mismatch, so a
  compute derivative cannot exist without a genuine enclave signature over that exact result.
- No silent isolation downgrade: `enclave-nautilus` fails closed if the enclave is unreachable; the
  `enclave-sim` simulator is always disclosed as non-attested.
- `/api/index` stores only **public** descriptors — never keys or plaintext.

---

## Out of scope (testnet prototype)

Mainnet-grade confidentiality · hiding metadata (object ids and blob ids are public by design) ·
decryption revocation beyond forward-only (rotate by re-encrypting) · a production event indexer for
full per-wallet license enumeration · the Privy→Sui browser write-signer (server signing works today).

Reef is built natively on Sui, Walrus, Seal, and Tatum — every layer chosen for the job it
alone can do.
