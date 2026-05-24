# CLAUDE.md — OpenVault

Navigation + working rules for Claude Code on this repo. Read this first, every session.

## What this project is
OpenVault: a decentralized Kaggle + Hugging Face. Datasets/models are Story **IP Assets**; heavy files are **threshold-encrypted on IPFS** via CDR; access tiers (public / private / gated / group-gated) are enforced **on-chain**. Testnet (Story Aeneid) prototype.

## Where to look
| Need | File |
|---|---|
| What to build, exact flows, structure, acceptance criteria | `SPEC.md` |
| How the SDKs work — doc links + agent skill | `STORY.md` |
| Problem, solution, user flows + test cases | `IDEA.md` |
| This navigation + rules | `CLAUDE.md` |

## Golden rules (violating these breaks the thesis)
1. **Backend is index-only** — never holds keys, never sees plaintext, never gates access. All gating is on-chain.
2. **All CDR crypto is client-side.** `initWasm()` runs before any CDR call.
3. **Register IP Asset → get `ipId` → THEN `uploadFile`** (vault read condition needs `ipId`).
4. **Never hardcode `licenseTermsId`** — thread the real value from registration.
5. **Surface every tx hash + Storyscan link.** Provenance is the product.
6. **No localStorage/sessionStorage** in client components — React state only.
7. **Node 22+** for Helia (the file storage path).
8. **CDR route handlers** need `export const runtime = "nodejs"` (Edge unsupported).

## Build order (de-risks the project)
1. `lib/clients.ts`, `lib/constants.ts`, types.
2. **`scripts/01..05` first** — headless end-to-end proofs per flow. Do NOT start UI until each prints real tx hashes + decrypted output.
3. Then wire UI actions to the proven `lib/*` functions.
4. Indexer + browse last.

## When unsure about an SDK call
- Check `STORY.md` for the exact reference page, fetch it, use the verified signature.
- Use the installed `cdr` agent skill (`npx skills add jacob-tucker/cdr-skill --skill cdr`) for CDR specifics and the 4 example scripts.
- The 4 open items in `SPEC.md §12` are NOT verified — confirm in code before relying on them.

## Definitions / glossary
- **IP Asset / `ipId`** — the on-chain identity of an artifact (a smart-contract account address).
- **CDR vault** — threshold-encrypted store; holds the encrypted AES key + IPFS CID for gated/private files.
- **Read/Write condition** — on-chain access rule on a vault. Gated = `LicenseReadCondition(LICENSE_TOKEN, ipId)`.
- **License token** — ERC-721; minting it (paying in WIP) is how a reader unlocks a gated artifact.
- **Derivative** — a fine-tune/version registered as a child IP; royalties flow upstream automatically.
- **WIP** — Wrapped IP (ERC-20); license/royalty fees are paid in WIP.

## Commands (fill in as scaffolded)
- `pnpm dev` — Next.js
- `pnpm tsx scripts/01-upload-gated.ts` — flow smoke tests
- `pnpm tsx indexer/listen.ts` — start event indexer

## Tone for commits / PRs
Small, verifiable steps. Each flow lands with its script passing first. Note any of the §12 open items you touch.

---

## v2 additions — read before building lineage or compute
9. **OSS lineage is first-class.** Every fine-tune links to a parent `ipId`. If the parent is off-platform OSS, FIRST register it as a *public provenance* IP Asset (true upstream license in metadata, no false ownership claim), THEN register the fine-tune as a derivative. See SPEC Addendum §A.
10. **CDR does NOT compute on encrypted data.** It does threshold encryption + on-chain-gated key delivery only. "Private but computable" = a SEPARATE OpenVault confidential-compute worker that uses CDR for gated decryption. The compute-privacy guarantee comes from the worker's enclave + algorithm allowlist, not CDR. NEVER write code or copy implying CDR runs user algorithms in its validator TEEs. See SPEC Addendum §C1 (honesty box).
11. **Compute-only tier returns results, never raw rows.** No download path for compute-only datasets. Worker refuses any algorithm whose hash isn't on that dataset's allowlist. Result is registered as a derivative of the dataset → royalties upstream.
12. **Disclose worker isolation mode.** If the compute worker is not in an attested enclave, the operator can see plaintext — say so plainly; it's not trustless in that mode.

## v2 open items (verify in code — see SPEC §C9 + §12)
- CDR delegated decryption (worker decrypting for a token-holding consumer) vs worker-holds-token.
- Encoding "compute-license held" vs "download-license held" via distinct `licenseTermsId` / custom `ICDRReadCondition`.
- No documented Story-kernel attestation for user workloads — assume you bring your own enclave.
- Temporal royalty semantics when an OSS parent sets revshare AFTER derivatives exist.
