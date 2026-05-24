# IDEA.md — OpenVault

## The problem
Kaggle and Hugging Face are where the world's datasets and models live, but "private" and "gated" are enforced by **a company's permission table**. That means:
- The platform can see, leak, or be compelled to hand over your private data/weights.
- "Access" is an account flag, not a property of the data — revoke the account and you're locked out; breach the platform and everything leaks.
- Creators of datasets get **no automatic downstream revenue** when someone fine-tunes on their data and profits.
- Provenance ("who made this, what was it trained on, what's the license") is metadata a platform can edit or lose.
- There's no native, neutral way to **dispute** a stolen dataset or a license violation.

## The solution
**OpenVault** makes access control a property of the *data*, not the *platform*:
- Every dataset/model is a Story **IP Asset** — an on-chain identity with a tradable ownership NFT, a license, and provenance no platform can alter.
- Heavy files are **AES-encrypted client-side, stored on IPFS as ciphertext**, and the decryption key is held in a **CDR vault** secured by a validator threshold inside TEEs. No single party — including us — can decrypt.
- The vault's **read condition is a Story license token**. Want the private weights? Mint the license (pay the creator) → pass the on-chain check → validators return partial decryptions → you reconstruct the key locally. The **license IS the access credential**; there is no auth server.
- **Royalties flow automatically**: a fine-tune is registered as a *derivative*, and revenue routes upstream to the dataset/base-model creator per their license terms.
- **Disputes** are first-class: report a stolen dataset or license violation on-chain; UMA arbitration resolves it.
- **Groups** let a lab bundle a model family behind one subscription.

### Why it wins the hackathon
It's the framing where **all seven Story modules are load-bearing**, not bolted on: IP Asset, Metadata, Licensing, Royalty, Dispute, Grouping — plus CDR as the cryptographic "private" guarantee. The unlock flow is a genuinely new primitive: *pay-to-decrypt enforced by a decentralized validator set*.

## Access tiers (the product surface)
- **Public** — open, free; IP Asset registered for provenance + attribution-only license. (Think: open datasets, open-weight models.)
- **Private** — owner-only; vault gated to the owner's wallet. (Think: work-in-progress weights, internal data.)
- **Gated** — pay/license to decrypt; CDR + license-token read condition. (Think: commercial models, premium datasets.)
- **Group-gated** — one license unlocks a whole family. (Think: "subscribe to this lab.")

---

## User flows (these double as the test matrix — cover every case)

### Persona A — Creator (publishes a model/dataset)
**A1. Publish a gated commercial model**
1. Connect (social login → embedded wallet). 2. Upload weights, fill model card, pick **Gated**, set fee + revshare. 3. App registers IP Asset → encrypts → IPFS → vault gated to license token. 4. Card goes live with a "mint to unlock" CTA.
- ✅ Expect: register tx + upload txs + uuid + cid; card shows tier=Gated, fee, terms; weights never readable on IPFS.
- 🧪 Edge: refresh mid-upload; ensure no half-registered artifact (register first, persist only after vault write succeeds).

**A2. Publish a public dataset**
- Pick **Public**; file pinned in clear; attribution-only license; IP Asset still registered.
- ✅ Anyone fetches + reads with no token. 🧪 Verify no vault is created.

**A3. Publish a private artifact**
- Pick **Private**; vault gated to own wallet (EOA condition, `skipConditionValidation`).
- ✅ Creator decrypts. 🧪 A second wallet's read **reverts**.

**A4. Publish a new version (derivative of own prior version)**
- Register as derivative of the previous `ipId`.
- ✅ Lineage graph shows v1→v2. 🧪 Confirm parent terms carried.

**A5. Bundle a model family (group)**
- Create group, add member IPs, attach group license.
- ✅ Group page lists members. 🧪 OPEN: confirm one group license unlocks members' vaults (SPEC §8.7 open item) — else fall back to per-IP gating and note it.

**A6. Claim royalties**
- After someone licenses a derivative of the creator's asset, creator claims.
- ✅ `claimableRevenue` > 0 pre-claim; balance arrives post-claim. 🧪 Claim twice → second is zero/no-op.

### Persona B — Consumer (downloads / uses)
**B1. Download a gated model (no license yet)**
1. Open card → "Mint to unlock" (fee shown). 2. App: wrap IP→WIP → approve → mint license token. 3. `downloadFile` → decrypt locally → weights delivered.
- ✅ Decrypted bytes match original hash. 🧪 Cancel at the wallet prompt → no token minted, no charge, clean error.

**B2. Download a gated model (already holds license)**
- Skip minting; go straight to decrypt.
- ✅ Works without paying again. 🧪 Hold an expired/wrong-IP token → read reverts; show clear message.

**B3. Attempt to access gated weights WITHOUT a license (attack case)**
- Try `downloadFile` with empty/forged `accessAuxData`.
- ✅ On-chain read **reverts**; validators produce no partials; no plaintext leaks. (This is the core security claim — test it explicitly.)

**B4. Download a public artifact**
- One click, no wallet needed (read-only client).
- ✅ Fetches from IPFS directly.

**B5. Slow-validator path (latency UX)**
- Trigger a decrypt that approaches `timeoutMs`.
- ✅ DecryptProgress shows "collecting partials…"; on `PartialCollectionTimeoutError`, Retry succeeds. 🧪 Don't show a scary error — frame as expected.

**B6. Fine-tune a licensed dataset, then publish (creator+consumer)**
- License a dataset (B1) → train → publish result as a **derivative** of the dataset (A4 flow).
- ✅ Revenue from the new model routes a share upstream to the dataset creator. (The headline demo.)

### Persona C — Community / governance
**C1. Report a stolen dataset**
- "Report" on a card → upload evidence → `raiseDispute(IMPROPER_REGISTRATION)`.
- ✅ Dispute id returned; card flags "in dispute". 🧪 Reuse a CID → protocol rejects (CIDs are single-use); surface that.

**C2. Owner counters a dispute**
- `disputeIdToAssertionId` → `disputeAssertion` with counter-evidence.
- ✅ Counter tx lands. 🧪 Non-owner tries to counter → rejected.

**C3. Browse/search the hub**
- Filter by modality, tier, tag, license, popularity (indexer).
- ✅ Results match on-chain reality; gated items show locked state without leaking content. 🧪 Indexer down → UI degrades gracefully to direct-chain reads.

### Cross-cutting test cases
- **Wallet not connected** on a gated action → prompt connect, don't crash.
- **WASM not initialized** → WasmGate blocks; never call CDR before `initWasm()`.
- **Insufficient testnet IP** for fee/bond → clear "fund your wallet" + faucet link.
- **Wrong network** → prompt switch to Aeneid.
- **Large file** (multi-GB weights) → chunked upload; show progress; confirm `uploadFile` handles it or chunk at app layer.
- **Re-upload identical file** → new IP Asset + new vault (no dedupe collision).
- **Provenance integrity** → `CidIntegrityError` if downloaded ciphertext ≠ vault CID; surface as "corrupted/tampered download".

## Out of scope for the hackathon (state it)
- Mainnet / production confidentiality (Aeneid is testnet).
- Hiding metadata (CIDs, vault ids, artifact existence are public by design).
- Decryption revocation (once decrypted, can't claw back; rotate by re-encrypting).

---

# ADDENDUM v2 — OSS lineage + compute-on-private-data

## New problem framing
1. **OSS lineage gap.** Most models are fine-tunes of open-source bases (Llama, Mistral, etc.). Today that lineage is just a sentence in a README — uncredited, unenforceable, unrewarded. OpenVault records it on-chain so credit + (optional) royalties flow upstream even from free OSS parents.
2. **The data-sharing deadlock.** The most valuable datasets (medical, financial, proprietary) can't be shared because sharing = losing control. So they sit unused. "Download to train" is the wrong primitive. The right one: **bring the algorithm to the data** — the data never leaves, only the trained result does.

## New solution pieces
- **Mandatory, frictionless parent-linking** for fine-tunes, including auto-registering an off-platform OSS parent as a public *provenance* IP Asset (with its true upstream license) before linking the derivative.
- **Compute-only tier**: a consumer mints a *compute license*, submits an *allowlisted* algorithm, and a confidential-compute worker runs it against the decrypted data **in isolation**, returning only the result (registered as a derivative → royalties to the data owner). Raw rows never reach the consumer.

## ⚠️ Honesty note (carry into the pitch)
CDR provides threshold encryption + on-chain-gated key delivery; its TEEs protect *key custody*, not arbitrary user computation. "Private but computable" is OpenVault's **own confidential-compute worker** using CDR for gated decryption — the compute-privacy guarantee comes from the worker's enclave + algorithm allowlist, NOT from CDR. Don't claim CDR "computes on encrypted data." Strongest version: run the worker inside an SGX/TDX enclave with published attestation.

---

## New user flows (extend the test matrix)

### Persona A — Creator (additions)
**A7. Import an OSS base model for provenance, then publish a fine-tune**
1. Upload wizard → "Import OSS parent" → paste HF/GitHub URL. 2. App registers a **public** provenance IP Asset with the true upstream license + original authors in metadata. 3. Publish the fine-tune as a **derivative** of it.
- ✅ Lineage graph shows OSS-parent → fine-tune; parent metadata names the real source + license.
- 🧪 Edge: try to set commercial terms on an OSS parent the user can't license that way → UI warns; metadata must not assert false ownership. (If abused, it's a `IMPROPER_REGISTRATION` dispute target.)

**A8. Publish a compute-only private dataset**
1. Upload dataset → pick **Compute-only** tier. 2. Choose allowed algorithm classes (hash-pinned) for this dataset. 3. Set compute-license terms (fee/revshare).
- ✅ Dataset is encrypted + gated; card shows "Computable, not downloadable"; lists permitted algorithms.
- 🧪 Confirm NO download path is offered for this tier, even to the owner-as-consumer.

**A9. Earn royalties from a compute job**
- After a consumer runs an approved algo on the dataset (B7), owner claims.
- ✅ `claimableRevenue` for the dataset increases; result is a registered derivative of the dataset.

### Persona B — Consumer (additions)
**B7. Train on a private dataset without ever seeing it (headline demo)**
1. Open a compute-only dataset → "Run a job". 2. Pick an allowlisted algorithm + params. 3. Mint compute license (pay). 4. Worker verifies token → decrypts in-isolation → runs algo → returns trained model + metrics. 5. Consumer receives a model they own (derivative of the dataset).
- ✅ Consumer gets result + metrics; dataset owner gets royalty; raw rows never delivered.
- 🧪 **Privacy test:** attempt to retrieve raw data via the compute path → denied; only result returned.

**B8. Submit a disallowed algorithm (attack case)**
- Submit an `algoHash` not on the dataset's allowlist (or a "dump all rows" algo).
- ✅ Worker **rejects** before running; job status `rejected`; no decryption occurs.

**B9. Compute license ≠ download license**
- Hold only a compute license, try the (nonexistent) download path / a download-gated read.
- ✅ Cannot download plaintext; compute license authorizes compute only.

### Persona C — Community (additions)
**C4. Dispute a falsely-registered OSS parent**
- Someone registered an OSS model claiming commercial ownership they lack → `raiseDispute(IMPROPER_REGISTRATION)` with evidence (the real upstream license).
- ✅ Target flagged; resolves via UMA.

**C5. Audit the algorithm allowlist**
- Browse the approved-algorithm registry; verify each is hash-pinned and a dataset's permitted set is visible on its card.
- ✅ Allowlist is transparent and per-dataset.

### Cross-cutting (additions)
- **Worker isolation mode is disclosed** — UI states whether compute ran in a real enclave (attested) or a plain server (operator-trusted) for the demo.
- **Plaintext lifecycle** — confirm worker wipes decrypted data + scratch after each job (`CidIntegrityError` on tamper still applies).
- **Multi-level lineage royalties** — dataset → model → fine-tune-of-model: confirm each edge's share routes correctly (`batchClaimAllRevenue`).
- **DP/aggregate guardrail** — for tabular data, default to algorithms whose outputs can't reconstruct individual rows; document the residual leakage risk.
