# OpenVault — Claude Code Build Specification

> Authoritative, exhaustive build spec. Claude Code: treat this as the source of truth for *what* to build. For *how the SDK works*, defer to `STORY.md` links and the installed `cdr` agent skill. For *why*, see `IDEA.md`. For navigation, see `CLAUDE.md`.
>
> Target: **Story Aeneid testnet**. `@piplabs/cdr-sdk@0.2.1` + `@story-protocol/core-sdk`. **This is a testnet confidentiality prototype, not production.**

---

## 0. One-line definition

A decentralized Kaggle + Hugging Face where datasets and ML models are Story **IP Assets**, heavy files are **threshold-encrypted on IPFS** (CDR), and access tiers (public / private / gated / group-gated) are enforced **cryptographically on-chain** — no auth server, no platform that can hand out access.

---

## 1. Non-negotiable invariants (DO NOT violate)

1. **The backend is index-only.** It must NEVER hold decryption keys, NEVER see plaintext artifact bytes, NEVER gate access. All access control is on-chain. If a feature seems to need the server to decrypt or authorize, the design is wrong — redo it client-side + on-chain.
2. **All CDR encryption/decryption happens client-side** (browser or user's Node). `initWasm()` must run before any CDR crypto call.
3. **Register the IP Asset BEFORE uploading the encrypted file.** The vault read condition needs the `ipId`. Order: register IP → get `ipId` → `uploadFile` gated to it → persist `uuid`.
4. **Never hardcode `licenseTermsId`.** Always thread the real value returned at registration through to mint/derivative calls. Docs examples (`2054`, `5`) are placeholders.
5. **Every evidence CID for disputes is single-use protocol-wide.** Generate a fresh one each time.
6. **Surface every tx hash + Storyscan link in the UI.** Provenance is the product.
7. **State CDR's limits honestly in the UI** (testnet, public metadata, no revocation, read latency).

---

## 2. Tech stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js (App Router) | `"use client"` for wallet + WASM; `runtime = "nodejs"` for CDR route handlers (Edge unsupported) |
| Language | TypeScript, `moduleResolution: "Bundler"` | |
| Wallet | Privy (social login) → viem `walletClient` | RainbowKit acceptable fallback |
| Chain SDK | `@story-protocol/core-sdk` | ipAsset, license, royalty, dispute, groupClient, nftClient, wipClient |
| Encryption | `@piplabs/cdr-sdk@0.2.1` | uploadFile/downloadFile/uploadCDR/accessCDR |
| Heavy-file storage | Helia (`helia`, `@helia/unixfs`, `multiformats`) | **Node 22+**; only backend fully tested on Aeneid |
| Public metadata pinning | `pinata-web3` | for model-card JSON |
| Chain lib | `viem` v2.21+ | required CDR peer dep |
| Indexer | lightweight event listener + SQLite/Postgres | read-only mirror; can be a simple Node service |
| Styling | Tailwind | |

---

## 3. Environment variables

```
# .env.local
NEXT_PUBLIC_RPC_URL=https://aeneid.storyrpc.io
NEXT_PUBLIC_STORY_API_URL=http://172.192.41.96:1317
NEXT_PUBLIC_PRIVY_APP_ID=
PINATA_JWT=
# server-side scripts only (never ship to client):
WALLET_PRIVATE_KEY=
```

---

## 4. On-chain constants (Aeneid — verified)

```typescript
// lib/constants.ts
export const RPC_URL = "https://aeneid.storyrpc.io";
export const CDR_API_URL = "http://172.192.41.96:1317";

export const OWNER_WRITE_CONDITION  = "0x4C9bFC96d7092b590D497A191826C3dA2277c34B";
export const LICENSE_READ_CONDITION = "0xC0640AD4CF2CaA9914C8e5C44234359a9102f7a3";
export const LICENSE_TOKEN          = "0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC";
export const ROYALTY_MODULE         = "0xD2f60c40fEbccf6311f8B47c4f2Ec6b040400086";
export const ROYALTY_POLICY_LAP     = "0xBe54FB168b3c982b7AaE60dB6CF75Bd8447b390E";
export const EVEN_SPLIT_GROUP_POOL  = "0xf96f2c30b41Cb6e0290de43C8528ae83d4f33F89";
export const PUBLIC_SPG_COLLECTION  = "0xc32A8a0FF3beDDDa58393d022aF433e78739FAbc"; // testing only — create your own
// WIP_TOKEN_ADDRESS: import from "@story-protocol/core-sdk"
// Vault on-chain ciphertext cap: 1024 bytes (on-chain secrets only; files go off-chain)
```

---

## 5. Project structure (build to this exactly)

```
openvault/
├─ app/
│  ├─ layout.tsx                 # wraps in <Providers> (Privy + WASM init)
│  ├─ page.tsx                   # landing / browse grid
│  ├─ upload/page.tsx            # upload wizard (tier picker → encrypt → register)
│  ├─ artifact/[ipId]/page.tsx   # model/dataset card + download + report + lineage
│  ├─ group/[groupId]/page.tsx   # bundle page
│  ├─ leaderboard/page.tsx       # Kaggle-style scores
│  └─ api/
│     ├─ index/route.ts          # READ-ONLY: query indexer (search/browse)
│     └─ pin/route.ts            # pin PUBLIC metadata JSON to Pinata (no secrets)
├─ components/
│  ├─ Providers.tsx              # PrivyProvider + WasmGate
│  ├─ WasmGate.tsx               # blocks children until initWasm() resolves
│  ├─ UploadWizard.tsx
│  ├─ TierPicker.tsx             # public | private | gated | group-gated
│  ├─ ModelCard.tsx
│  ├─ DownloadButton.tsx         # mint license (if needed) → downloadFile → decrypt
│  ├─ DecryptProgress.tsx        # validator-partial progress UI
│  ├─ LineageGraph.tsx           # parent→child derivative tree + revenue waterfall
│  ├─ ReportDialog.tsx           # raiseDispute
│  └─ TxLink.tsx                 # Storyscan link for any hash
├─ lib/
│  ├─ constants.ts               # §4
│  ├─ clients.ts                 # makeCdrClient / makeStoryClient (§6)
│  ├─ metadata.ts                # build + hash + pin IPA/NFT metadata
│  ├─ artifacts.ts               # high-level: uploadGated/uploadPublic/uploadPrivate/download
│  ├─ licensing.ts               # PIL flavor builders, mint helpers
│  ├─ royalty.ts                 # pay/claim wrappers
│  ├─ dispute.ts                 # raise/counter wrappers
│  ├─ group.ts                   # group create/add/distribute wrappers
│  └─ storage.ts                 # Helia provider factory + Pinata JSON pin
├─ indexer/
│  └─ listen.ts                  # standalone: mirror registry/license/royalty events → DB
├─ types/
│  └─ artifact.ts                # Artifact, Vault, Tier types (§7)
└─ scripts/                      # CLI smoke tests for each flow (run before UI)
   ├─ 01-upload-gated.ts
   ├─ 02-download-gated.ts
   ├─ 03-derivative-royalty.ts
   ├─ 04-dispute.ts
   └─ 05-group.ts
```

**Build the `scripts/*` first.** Each is a headless end-to-end proof of one flow
using a private key. Only wire the UI once a script prints real tx hashes +
decrypted output. This de-risks the whole project.

---

## 6. `lib/clients.ts` (exact)

```typescript
import { CDRClient, initWasm } from "@piplabs/cdr-sdk";
import { StoryClient } from "@story-protocol/core-sdk";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { RPC_URL, CDR_API_URL } from "./constants";

// --- Script / server context (private key) ---
export async function makeClientsFromKey(pk: `0x${string}`) {
  await initWasm();
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account, transport: http(RPC_URL) });
  const cdr = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: CDR_API_URL });
  const story = StoryClient.newClient({ transport: http(RPC_URL), account, chainId: "aeneid" });
  return { cdr, story, account, publicClient, walletClient };
}

// --- Browser context (wallet connector via EIP-1193 provider) ---
export async function makeClientsFromProvider(provider: any, address: `0x${string}`) {
  await initWasm();
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  const walletClient = createWalletClient({ account: address, transport: custom(provider) });
  const cdr = new CDRClient({ network: "testnet", publicClient, walletClient, apiUrl: CDR_API_URL });
  const story = StoryClient.newClient({ transport: custom(provider), account: address, chainId: "aeneid" });
  return { cdr, story, address, publicClient, walletClient };
}

// Read-only CDR (browse without wallet)
export function makeReadOnlyCdr() {
  const publicClient = createPublicClient({ transport: http(RPC_URL) });
  return new CDRClient({ network: "testnet", publicClient, apiUrl: CDR_API_URL });
}
```

---

## 7. Core types

```typescript
// types/artifact.ts
export type Tier = "public" | "private" | "gated" | "group";
export type Modality = "dataset" | "model";

export interface Artifact {
  ipId: `0x${string}`;
  tier: Tier;
  modality: Modality;
  title: string;
  description: string;
  tags: string[];
  ipMetadataURI: string;          // model/dataset card (public, on IPFS)
  vaultUuid?: number;             // CDR vault (gated/private)
  cid?: string;                   // IPFS CID of ciphertext
  licenseTermsId?: string;        // gated tier
  parentIpId?: `0x${string}`;     // derivative/version
  groupId?: `0x${string}`;        // group-gated
  ownerNftTokenId?: bigint;
  createdTx: `0x${string}`;
}
```

---

## 8. Flow specifications (build each as a script, then a UI action)

### 8.1 Upload — GATED  (`scripts/01-upload-gated.ts`, `lib/artifacts.uploadGated`)
**Preconditions:** wallet funded with testnet IP; Helia (Node 22+); metadata pinned.
**Steps:**
1. Build IPA + NFT metadata JSON; pin both to IPFS (Pinata); compute sha256 hashes.
2. `story.ipAsset.registerIpAsset({ nft:{type:"mint",spgNftContract}, licenseTermsData:[{terms: PILFlavor.commercialRemix({commercialRevShare:5, defaultMintingFee: parseEther("1"), currency: WIP_TOKEN_ADDRESS})}], ipMetadata:{...4 fields} })`
3. Capture `ipId` and the returned **licenseTermsId**.
4. Build Helia `HeliaProvider` (pass `CID: (s)=>CID.parse(s)`).
5. `cdr.uploader.uploadFile({ content, storageProvider, globalPubKey: await cdr.observer.getGlobalPubKey(), updatable:false, writeConditionAddr: OWNER_WRITE_CONDITION, readConditionAddr: LICENSE_READ_CONDITION, writeConditionData: encodeAbiParameters([{type:"address"}],[owner]), readConditionData: encodeAbiParameters([{type:"address"},{type:"address"}],[LICENSE_TOKEN, ipId]), accessAuxData:"0x" })`
6. Persist `{ipId, vaultUuid:uuid, cid, licenseTermsId, tier:"gated"}` to indexer + IPA metadata.
**Acceptance:** script logs register tx, upload txs, uuid, cid; artifact shows up in browse.

### 8.2 Upload — PUBLIC
Same as gated but: file pinned to IPFS **in clear** (or CDR `open` condition), license terms = attribution-only PIL, no vault gating. IP Asset still registered (provenance).
**Acceptance:** anyone can fetch + read the file with no token.

### 8.3 Upload — PRIVATE
Register IP Asset (record only). Vault via low-level `cdr.uploader.allocate({updatable:false, writeConditionAddr: owner, readConditionAddr: owner, writeConditionData:"0x", readConditionData:"0x", skipConditionValidation:true})` then encrypt + `write` (small) or `uploadFile` with EOA conditions (large; replicate low-level since high-level helper requires deployed contracts).
**Acceptance:** owner can decrypt; a second wallet's read reverts.

### 8.4 Download — GATED  (`scripts/02-download-gated.ts`, `components/DownloadButton`)
**Steps:**
1. If reader lacks a license token: `story.wipClient.deposit({amount: parseEther("1")})` → `story.wipClient.approve({spender: ROYALTY_MODULE, amount: parseEther("1")})` → `story.license.mintLicenseTokens({licensorIpId: ipId, licenseTermsId: BigInt(licenseTermsId), amount:1})` → take `licenseTokenIds[0]`.
2. `accessAuxData = encodeAbiParameters([{type:"uint256[]"}],[[BigInt(licenseTokenId)]])`.
3. `cdr.consumer.downloadFile({ uuid, accessAuxData, storageProvider, timeoutMs:120_000 })`.
4. Write/serve `content` to the user. Catch `PartialCollectionTimeoutError` → offer retry.
**Acceptance:** holder decrypts; non-holder read reverts on-chain.

### 8.5 Derivative + royalty  (`scripts/03-derivative-royalty.ts`)
1. `story.ipAsset.registerDerivativeIpAsset({ nft:{type:"mint",spgNftContract}, derivData:{ parentIpIds:[PARENT], licenseTermsIds:[PARENT_TERMS] }, ipMetadata:{...} })`.
2. External pay: `story.royalty.payRoyaltyOnBehalf({ receiverIpId: child, payerIpId: zeroAddress, token: WIP_TOKEN_ADDRESS, amount: parseEther("2") })`.
3. Parent claim: `story.royalty.claimAllRevenue({ ancestorIpId: PARENT, claimer: PARENT, childIpIds:[child], royaltyPolicies:[ROYALTY_POLICY_LAP], currencyTokens:[WIP_TOKEN_ADDRESS] })`.
4. View-only: `story.royalty.claimableRevenue({ ipId: PARENT, claimer: PARENT, token: WIP_TOKEN_ADDRESS })`.
**Acceptance:** lineage graph renders parent→child; parent's claimable balance > 0 after pay.

### 8.6 Dispute  (`scripts/04-dispute.ts`, `components/ReportDialog`)
1. Pin evidence to IPFS → fresh `cid`.
2. `story.dispute.raiseDispute({ targetIpId, cid, targetTag: DisputeTargetTag.IMPROPER_REGISTRATION, bond: parseEther("0.1"), liveness: 2592000 })`.
3. Counter (owner): `assertionId = await story.dispute.disputeIdToAssertionId(Number(disputeId))` → `story.dispute.disputeAssertion({ ipId, assertionId, counterEvidenceCID })`.
**Acceptance:** dispute id returned; target card shows "in dispute".

### 8.7 Group bundle  (`scripts/05-group.ts`, `app/group/[groupId]`)
1. `story.groupClient.registerGroupAndAttachLicenseAndAddIps({ groupPool: EVEN_SPLIT_GROUP_POOL, maxAllowedRewardShare:5, ipIds:[A,B], licenseData:{ licenseTermsId: GROUP_TERMS } })`.
2. `story.groupClient.addIpsToGroup({ groupIpId, ipIds:[C] })`.
3. `story.groupClient.collectAndDistributeGroupRoyalties({ groupIpId, currencyTokens:[WIP_TOKEN_ADDRESS], memberIpIds:[A,B] })`.
**Acceptance:** group page lists members; distribute tx routes revenue to member vaults.
**OPEN ITEM:** the read-condition encoding to make one group license unlock member vaults is NOT confirmed in docs (docs show single-IP LicenseRead only). Verify against grouping-module concept + CDR before relying on it; fall back to per-IP gating if unconfirmed.

---

## 9. UI requirements

- **WasmGate**: nothing using CDR renders until `initWasm()` resolves; show a spinner.
- **TierPicker**: 4 cards explaining each tier in one line; selection drives the upload path.
- **DecryptProgress**: poll/await `downloadFile`; show a determinate-ish "collecting validator partials… (this can take up to ~2 min)" state; on timeout, a Retry button. Treat latency as a feature, not an error.
- **ModelCard**: render from IPA metadata; show tier badge, license terms, tags, eval metrics, creators, lineage link, Report button, and (if gated) the mint-to-unlock CTA with the fee shown.
- **TxLink**: every action links to `https://aeneid.explorer.story.foundation/ipa/<ipId>` or the tx on `https://aeneid.storyscan.io`.
- **No browser storage** (localStorage/sessionStorage) in any client component — keep state in React.

---

## 10. Error handling (CDR typed errors — catch by class)
`WalletClientRequiredError`, `InvalidParamsError`, `InvalidConditionContractError`, `LabelMismatchError`, `ContentSizeExceededError`, `EmptyVaultError`, `PartialCollectionTimeoutError`, `CidIntegrityError`. On-chain reverts (failed condition checks) surface as raw viem errors. The big UX one: `PartialCollectionTimeoutError` → "Not enough validators responded; retry."

---

## 11. Definition of done (hackathon)
- [ ] All 5 scripts print real tx hashes + decrypted output on Aeneid
- [ ] Gated upload + download works in the browser with social login
- [ ] Public + private tiers work
- [ ] Derivative + royalty demo with visible upstream claim
- [ ] Report/dispute button raises a real dispute
- [ ] Group bundle page (per-IP gating acceptable if group read-condition unconfirmed)
- [ ] Browse/search via indexer
- [ ] Every tx links to Storyscan; CDR limits disclosed in UI
- [ ] Demo posted publicly (Best Application track weights traction)

---

## 12. Things to verify in code (don't trust this spec blindly)
1. Exact field name `registerIpAsset` returns for the license terms id → `/sdk-reference/ipasset`.
2. Whether `mintLicenseTokens` returns `licenseTokenIds` exactly → `/sdk-reference/license`.
3. Group-license CDR read-condition encoding → `/concepts/grouping-module` + CDR docs.
4. Current minimum dispute bond → `OptimisticOracleV3.getMinimumBond()` on Aeneid.

---

# ADDENDUM v2 — Model lineage for OSS + Confidential Compute on private datasets

> Two capabilities added after review. **Read the honesty box in §C1 before building the compute layer — it is the single most important caveat in this whole spec.**

## A. First-class lineage: a fine-tune of an OSS model MUST link to its parent

### A1. The fix (point 1)
Today's gated/derivative flow already supports parent→child royalties. The gap: when the **parent is open-source / free / public**, people skip registering it, breaking lineage. OpenVault makes parent-linking mandatory and frictionless for the OSS case.

**Rule:** every model upload asks "is this trained on / fine-tuned from an existing artifact?" If yes, it is registered as a **derivative** of that parent `ipId` — even when the parent is a public, zero-fee artifact.

### A2. Two sub-cases

**Case 1 — parent already exists on OpenVault (has an `ipId`):**
Use the derivative flow directly.
```typescript
const child = await story.ipAsset.registerDerivativeIpAsset({
  nft: { type: "mint", spgNftContract: MY_SPG_COLLECTION },
  derivData: { parentIpIds: [PARENT_IP_ID], licenseTermsIds: [PARENT_LICENSE_TERMS_ID] },
  ipMetadata: { ipMetadataURI, ipMetadataHash, nftMetadataURI, nftMetadataHash },
});
```
Even if the parent's terms are zero-fee, the link is recorded; if the parent later sets `commercialRevShare`, downstream revenue still routes (per the terms in force at derivative registration — verify temporal semantics in code).

**Case 2 — parent is OSS from off-platform (e.g. a Hugging Face open model, no `ipId` yet):**
The uploader can't be a derivative of something unregistered. Flow:
1. **Register the OSS parent first** as a public IP Asset on behalf of provenance: register with attribution/non-commercial PIL, metadata pointing at the original source (HF repo URL, license, original authors) in the IPA metadata. Mark `tier: "public"`, `external_source: <hf url>`.
   - ⚠️ Registering someone else's OSS model as an IP Asset is a **provenance/attribution record, not a claim of ownership**. The metadata MUST state the true origin + upstream license (Apache-2.0, Llama license, etc.) and MUST NOT assert commercial terms the uploader has no right to grant. Mis-registration here is exactly what the Dispute module exists to correct (`IMPROPER_REGISTRATION`).
2. Then register the fine-tune as a derivative of that newly-created parent `ipId` (Case 1).

### A3. Royalty semantics for OSS lineage
- OSS parent with attribution-only / 0% revshare → child owes nothing automatically; lineage is recorded for provenance + optional voluntary tips via `payRoyaltyOnBehalf`.
- OSS parent whose registrant set a revshare they were entitled to grant → standard upstream routing via `claimAllRevenue`.
- Multi-level chains (A → B → C): royalties cascade per each edge's terms. Use `batchClaimAllRevenue` for an ancestor claiming across multiple children.

### A4. UI
- Upload wizard: a "Derived from" search box (find an on-platform parent) OR "Import OSS parent" (paste HF/GitHub URL → registers a public provenance IP Asset → then derivative).
- Model card: a **lineage graph** (`LineageGraph.tsx`) showing the full ancestor chain with each edge's license terms + revenue flow. This is a strong demo visual.

### A5. Acceptance
- [ ] Fine-tune of an on-platform model registers as derivative; lineage graph shows the edge.
- [ ] Fine-tune of an off-platform OSS model first creates a public provenance parent (with correct upstream license in metadata), then links.
- [ ] Provenance metadata never falsely asserts ownership/commercial rights over OSS.
- [ ] Upstream claim works where terms grant a share; is a no-op where they don't.

---

## B & C. "Private but computable" datasets (point 2)

### C1. HONESTY BOX — what CDR does and does NOT do  ⚠️ READ FIRST
- **Verified:** CDR stores data threshold-encrypted; the validator DKG + **partial decryption run inside SGX TEEs**; access is gated on-chain; the SDK's documented outputs are `accessCDR` (returns the secret/dataKey to the holder) and `downloadFile` (returns plaintext to the holder). I.e. CDR decrypts **to the authorized client**.
- **NOT verified / NOT a documented CDR feature:** running an arbitrary user algorithm *inside* CDR's validator TEEs over the plaintext and returning only results. A non-SDK news article loosely says CDR lets apps "compute over information without exposing the raw payload," but **the SDK docs do not expose a confidential-compute API.** Do **not** build as if `cdr` can run your training job on plaintext it never releases.
- **Therefore:** "private but computable" is built as a **separate confidential-compute (CC) worker that OpenVault operates**, using CDR purely as the gated key-delivery mechanism. The privacy guarantee for *compute* comes from the CC worker's TEE + an allowlist of vetted algorithms — NOT from CDR. State this distinction in the demo. If you can run the CC worker itself inside an SGX/TDX enclave, you get a real "data-in-use" guarantee comparable to the confidential-computing pattern (analysis app runs inside a TEE; raw data only decrypted in-enclave).

### C2. The model: "bring the algorithm to the data"
The dataset owner never ships plaintext to the consumer. Instead the consumer submits an **approved algorithm** that runs against the decrypted data **inside a controlled compute environment**, and only the *output* (a trained model, metrics, aggregates) leaves.

```
Consumer picks an allowlisted algo + params
        │
        ▼
On-chain: consumer mints a COMPUTE license token for the dataset ipId
        │ (different license terms than a "download" license)
        ▼
OpenVault Compute Worker (ideally inside SGX/TDX enclave):
  1. Verifies the compute-license token on-chain (same LicenseReadCondition check)
  2. Uses CDR consumer flow to decrypt the dataset INSIDE the worker only
  3. Loads ONLY an allowlisted algorithm (hash-pinned) — no arbitrary code
  4. Runs algo over plaintext in-enclave
  5. Emits ONLY the result artifact (model weights / metrics)
  6. Wipes plaintext; never returns raw rows to the consumer
        │
        ▼
Result is registered as a DERIVATIVE IP Asset of the dataset
  → royalties route to the dataset owner automatically (ties to Part A)
```

### C3. Algorithm allowlist (the "only certain algos" requirement)
- An on-chain (or indexer-backed) registry of approved algorithms, each pinned by a content hash (e.g. a Docker image digest or a WASM module hash).
- Dataset owner chooses, per dataset, which algorithm classes are permitted (e.g. "logistic regression, XGBoost, DP-SGD fine-tune" but NOT "raw row export" or "k-NN that can memorize rows").
- The compute worker refuses to run anything whose hash is not on that dataset's allowlist.
- Strongly recommend **differential-privacy / aggregate-only** algorithms for tabular data so outputs can't reconstruct individual rows. Block algorithms that trivially exfiltrate (identity map, full dump, nearest-neighbor lookups).

### C4. New license tier: COMPUTE
Add a 5th access mode alongside public/private/gated/group:
- **compute-only** — consumer may *run approved algorithms* on the data and take the *result*, but can NEVER download the plaintext. Enforced by issuing a **compute license** (distinct `licenseTermsId`) and by the worker never returning raw data. The "download" path is simply not offered for this tier.

### C5. Data model additions
```typescript
// extend types/artifact.ts
export interface Artifact {
  // ...existing...
  computeEnabled?: boolean;
  allowedAlgoHashes?: string[];     // hashes of permitted algorithms for THIS dataset
  computeLicenseTermsId?: string;   // separate terms for compute-only access
  externalSource?: string;          // for OSS provenance parents (HF/GitHub URL)
}

export interface ComputeJob {
  id: string;
  datasetIpId: `0x${string}`;
  consumer: `0x${string}`;
  algoHash: string;                 // must be in dataset.allowedAlgoHashes
  computeLicenseTokenId: bigint;
  status: "pending" | "verifying" | "running" | "done" | "rejected" | "failed";
  resultIpId?: `0x${string}`;       // derivative IP registered from the output
  metricsURI?: string;              // public metrics (IPFS)
}
```

### C6. Compute job flow (script + worker)
1. **Consumer** mints a compute license for `datasetIpId` (wrap IP → approve → `mintLicenseTokens` with `computeLicenseTermsId`).
2. **Consumer** submits a `ComputeJob` referencing an `algoHash` from the dataset's allowlist.
3. **Worker** (server, ideally in-enclave):
   a. On-chain verify the compute-license token (reuse the gated read-condition check).
   b. Reject if `algoHash ∉ dataset.allowedAlgoHashes`.
   c. CDR-decrypt the dataset **inside the worker** (`downloadFile` with the worker holding/permitted the token, or a delegated read — verify delegation semantics; simplest is the worker is the licensed party acting for the job).
   d. Run the hash-pinned algorithm container/WASM over the plaintext.
   e. Produce result (weights/metrics). Pin public metrics to IPFS.
   f. Register the result as a **derivative IP Asset** of `datasetIpId` (Part A flow) → royalties to the dataset owner.
   g. Destroy plaintext + scratch; return only `resultIpId` + metrics to the consumer.
4. Consumer receives a model/metrics they own (as a derivative), the dataset owner gets provenance + royalties, and the **raw dataset was never exposed to the consumer.**

### C7. Honest limits of the compute layer (put in UI + demo)
- The privacy guarantee is **only as strong as the worker's isolation.** If the worker runs on an ordinary server, OpenVault (the operator) technically sees plaintext in memory — that's NOT trustless. To make it a real guarantee, run the worker inside an SGX/TDX enclave with remote attestation, and publish the attestation. Say plainly which mode the demo uses.
- The algorithm allowlist is the privacy boundary for *outputs*. A poorly chosen "approved" algorithm can still leak rows (memorization, overfitting, reconstruction). Prefer DP/aggregate algorithms; document this.
- This is **not** FHE or MPC — it's TEE-based confidential compute. Cheaper and faster, but a different (hardware) trust model.
- CDR is doing key-delivery + access gating only. Don't claim CDR "computes on encrypted data."

### C8. Acceptance
- [ ] Compute tier datasets expose NO download path for consumers.
- [ ] Worker refuses an `algoHash` not on the dataset's allowlist (tested with a rejected job).
- [ ] A successful job returns ONLY result + metrics; consumer cannot retrieve raw rows (tested: attempt and confirm denial).
- [ ] Result registered as derivative of the dataset; owner's `claimableRevenue` increases.
- [ ] Demo clearly states the worker's isolation mode (enclave vs plain server) and the resulting trust assumption.

### C9. Open items to verify before building compute
1. Whether CDR supports **delegated decryption** (a worker decrypting on behalf of a token-holding consumer) or whether the worker itself must hold the license token. Check CDR consumer reference + ip-asset-vaults docs.
2. Whether a custom **ICDRReadCondition** contract can encode "compute-license held" distinctly from "download-license held" (likely yes via different licenseTermsId; confirm).
3. Story-kernel / Aeneid attestation availability if you want to run the worker inside the same TEE substrate (not documented for user workloads — assume NO and bring your own enclave).
