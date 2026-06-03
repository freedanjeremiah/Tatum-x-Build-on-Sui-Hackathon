# Tessera

> A *tessera* was a small token in the ancient world — a tile that proved your right to enter, claim a
> ration, or be counted. Tesserae also tiled together into mosaics. Both meanings are the product: here
> the **license token is the access credential**, and datasets tile into models tile into derivatives —
> a mosaic of provenance with royalties flowing back along every edge.

**Tessera is a decentralized Kaggle + Hugging Face.** Datasets and ML models are registered as Story
Protocol **IP Assets**; their heavy files are **threshold-encrypted on IPFS**; and who may decrypt them
is enforced **on-chain** — there is no auth server and no platform operator who can hand out access.
It runs on the Story **Aeneid** testnet.

> **The thesis:** access control is a property of the *data*, not the *platform*. The license token you
> mint on-chain *is* the key that decrypts the file. Lose the platform and the rule still holds.

---

## Built on CDR (Confidential Data Rails)

Tessera is a flagship **CDR** application: it turns a private dataset into exactly what CDR promises —
*a programmable, composable on-chain object* — and then ships a real product on top of it. Private data
without giving up composability.

**The composability lives in custom read-condition contracts.** A CDR validator `staticcall`s a vault's
read condition to decide who may decrypt. Tessera writes **five**, against the live Aeneid interface it
reverse-engineered (`IReadCondition`):

- **`AnyOfReadCondition`** — composable **OR** over conditions. One vault gate becomes
  *"license **OR** token-balance **OR** merkle-allowlist"* just by listing sub-conditions and their
  data. Dynamic permissioning expressed as data, with no redeploys.
- **`ComputeWorkerReadCondition`** — *computable, not downloadable*, enforced **at the CDR layer**: only
  an allowlisted compute worker can decrypt, so a consumer's read simply reverts. This is a confidential
  **query marketplace** — run an approved algorithm over data you are never allowed to see.
- **`GroupLicenseReadCondition`** — subscribe to a lab, unlock its whole family of vaults. It *composes*
  the already-deployed `LicenseReadCondition` rather than re-implementing license validation.
- **`OwnerReadCondition`** — fills a real gap: Story's deployed owner condition is write-only, so
  private-tier reads reverted at the precompile. This is the missing read-side counterpart.

**Composability beyond the gate:** every artifact is a Story **IP Asset**, so a model trained on a
private dataset is registered as that dataset's **derivative**, and a compute result is a derivative of
the data it ran on — with **royalties flowing upstream along every edge**. Private data you cannot even
download still earns its owner money, automatically. That is the CDR mission, shipped end-to-end:
upload → encrypt → gate → license → compute → derive → pay.

---

## Why this is different

On a normal ML hub, a company server holds the files and decides — in its own code, behind its own
login — who gets to download. You trust the platform. On Tessera the file is encrypted before it ever
leaves the browser, the decryption key is delivered by the **CDR** (Confidential Data Rails) network
only when an **on-chain condition** says you qualify, and that condition is a smart contract anyone can
read. The registry that lists artifacts is just a cache — delete it and the access rules are unchanged,
because they live in the encryption + the chain.

This unlocks two things a download-only hub can't do:
- **Private but provable** — you can publish a private dataset, prove it exists and who owns it, and
  license it, without ever exposing the bytes.
- **Private but computable** — a consumer can run an approved algorithm *over* your private data and
  take home only the result, never the rows. See **Compute** below.

---

## Access tiers

Every artifact picks one tier at upload. The tier decides how its CDR vault is sealed:

| Tier | Who can decrypt | Sealed with |
|------|-----------------|-------------|
| **Public** | anyone | not encrypted; registered for provenance + attribution-only license |
| **Private** | only the owner wallet | `OwnerReadCondition` (EOA check) |
| **Gated** | anyone holding a license token | `LicenseReadCondition(LICENSE_TOKEN, ipId)` — pay/mint to decrypt |
| **Group** | one license unlocks a family of artifacts | group read condition (per-IP fallback today) |
| **Compute** | *nobody downloads* — an allowlisted algorithm runs on it | `ComputeWorkerReadCondition` |

For **Compute**, the data is never returned. A consumer chooses an algorithm from the dataset's
**hash-pinned allowlist**; a worker decrypts the data in memory, runs only that algorithm, registers
the **result as a derivative IP** of the dataset, wipes the plaintext, and returns **aggregate metrics
only**. Royalties on the derivative flow upstream to the data owner.

---

## Honesty (please read)

CDR provides **threshold encryption + on-chain-gated key delivery** — nothing more. It does **not** run
user algorithms on plaintext. "Private but computable" is **Tessera's own** compute worker, which uses
CDR only to decrypt. So the compute-privacy guarantee comes from **the worker's isolation + the
algorithm allowlist**, not from CDR.

The demo worker runs on an ordinary server (operator-trusted) — a production deployment would run it
inside an attested **SGX/TDX enclave**. We don't hide this: the UI discloses the exact isolation
posture everywhere a compute job runs, and the worker refuses any algorithm not on the dataset's
allowlist **before decrypting a single byte** (`decryptCalled: false`). No silent fallbacks — if
something can't be done honestly, the API says so instead of faking it.

---

## Run models (inference)

Model artifacts get a **Run** tab: type a prompt, watch the output stream back live. Inference runs on
an external GPU backend (any **OpenAI-compatible** endpoint — Ollama, vLLM, OpenAI itself) reached
through the `/api/run` route. That route injects a **server-only** bearer token, so the secret never
reaches the browser; visitors only ever talk to `/api/run`. Public-safe guards are built in: per-IP
rate limit, prompt-size and `max_tokens` caps, and an upstream timeout. If no backend is configured the
route returns an honest **503** rather than a fabricated reply. Datasets are not runnable.

Wire it by setting the three `INFERENCE_*` vars (below) to your endpoint.

---

## Quick start (Story Aeneid testnet)

Requires **Node 22+** and **pnpm**. The app is at the repo root.

```bash
pnpm install
cp .env.local.example .env.local   # fill the three core vars below
pnpm dev                           # https://localhost:3000  (dev uses experimental HTTPS)
```

### Environment variables

RPC URL and contract addresses are hardcoded in `lib/constants.ts`, so only these matter:

**Core** — needed to upload, index, and run the app:

| Var | Scope | Missing → |
|-----|-------|-----------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | public (browser) | wallet auth unavailable |
| `WALLET_PRIVATE_KEY` | server secret | scripts / worker throw |
| `PINATA_JWT` | server secret | IPFS pinning throws |

**Inference** — optional; powers the model **Run** tab (omit → Run tab returns 503):

| Var | Default | Notes |
|-----|---------|-------|
| `INFERENCE_BASE_URL` | — | OpenAI-compatible base, e.g. `https://<host>/v1` |
| `INFERENCE_TOKEN` | — | bearer token; injected server-side, never sent to the browser |
| `INFERENCE_MODEL` | `llama3.1:8b` | model id the backend serves |

**Optional tuning** (`WORKER_ISOLATION_MODE`, `CDR_ATTEST*`, `WORKER_SIM_*`) is documented inline in
`lib/attestation.ts` / `lib/tee-sim.ts`; the defaults are fine for the demo.

> Storage is **Pinata** (not an in-process IPFS node) so uploaded bytes survive across processes — the
> worker and other consumers can retrieve them later.

---

## Scripts, worker, indexer

```bash
pnpm probe:real                        # connectivity check (no gas spent)
pnpm real scripts/01-upload-gated.ts   # run any flow script (00..09, diag/, _*) against Aeneid
pnpm worker:real                       # confidential-compute worker (long-running)
pnpm indexer:real                      # SQLite read-model indexer (long-running)
pnpm test                              # unit tests — no creds, no gas
RUN_INTEGRATION=1 pnpm test            # also runs the live on-chain integration tests
```

The `real` family preloads `.env.local` via `node --env-file` so `tsx`-hoisted modules see env at
module-init time. To re-seed the demo corpus, see `scripts/sample/` (Python generators + manifest).

---

## Project layout

```
.
├─ app/            Next.js App Router — pages + API routes (/api/run, /api/compute, /api/index, …)
├─ components/     React UI (browse, upload wizard, artifact tabs, compute panel, Run tab, wallet)
├─ lib/            core logic: clients, artifacts, licensing, royalty, dispute, group, compute,
│                  storage (Pinata), metadata, attestation, tee-sim, constants
├─ worker/         confidential-compute worker + the algorithm allowlist registry (worker/algos/)
├─ indexer/        index-only SQLite mirror of public artifact records + its API
├─ contracts/      Solidity CDR read-condition contracts (Owner / License / Group / Compute)
├─ scripts/        flow scripts (00..09), diagnostics (diag/), and the seed corpus (sample/)
├─ e2e/            Playwright verification harness (own package.json)
└─ docs/           design specs, handoffs, pitch, run logs
```

### How the layers fit

- `lib/clients.ts` — Story + CDR clients backed by a wallet (server) or an EIP-1193 provider (browser).
- `lib/artifacts.ts` — the high-level `upload*` / `download` / derivative API. Enforces the invariant
  **register → get ipId → then upload** so encryption is always bound to a real on-chain identity.
- `indexer/` — a cache only. `app/api/index` accepts **public** Artifact descriptors (never keys or
  plaintext) via POST self-index, and serves them via GET. `app/api/pin` exposes public JSON.
- `worker/` — allowlist gate → decrypt-in-worker → run the one approved algorithm → register a
  derivative → wipe plaintext → return metrics only.
- `app/` + `components/` — UI wrapped in `WasmGate` so no CDR call fires before `initWasm()`.

---

## Invariants the code enforces

- The backend never holds keys, plaintext, or gating power — CDR crypto runs client-side.
- Register before upload; `licenseTermsId` is always threaded through, never hardcoded.
- A fresh dispute CID is minted on every report.
- Every transaction and ipId is surfaced in the UI via `TxLink`.
- No `localStorage`. Compute-tier artifacts have **no download path** at all.
- `/api/index` POST accepts only public descriptors — it will not store keys or plaintext.

---

## What works today (live on Aeneid)

A complete product, not slideware — every flow below executes against the live testnet:

- **Upload wizard** — pick a tier, encrypt, register the IP, pin to IPFS, and self-index in one flow.
- **Five access tiers** — public · private · gated · group · compute — each with its own CDR read
  condition.
- **Browse / search / tags / profiles / leaderboard** — a full Hugging-Face-style catalog.
- **Gated download** — mint a license token → decrypt → retrieve plaintext, gated entirely on-chain.
- **Confidential compute** — run an allowlisted algorithm over a compute-tier dataset; receive aggregate
  metrics + a derivative IP; raw rows never leave the worker.
- **Model inference** — a **Run** tab streams live output from a GPU backend (OpenAI-compatible).
- **Royalties** — pay and claim revenue along the derivative graph.
- **Disputes** — raise a report against an IP and counter it with on-chain evidence.
- **Groups** — bundle artifacts so one license unlocks the whole family.

**Both prize tracks:** the custom read-condition contracts target the **Technical Implementation**
track (composable vaults, dynamic permissioning); this polished end-to-end surface targets the
**Best CDR Application** track.

---

## Out of scope (testnet prototype)

Mainnet-grade confidentiality · hiding metadata (CIDs and vault ids are public by design) · decryption
revocation (rotate by re-encrypting). The compute worker's production hardening (attested enclave) is
designed for but not deployed here.
```
