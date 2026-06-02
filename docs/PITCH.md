# OpenVault — Hackathon Pitch Deck

**3-minute pitch, 7 slides, optimized for the CDR Hackathon Technical Implementation track.**

Tagline: *Access control as a property of the data, not the platform.*

---

## Slide 1 — Title + Hook (0:00–0:15)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│            ▣ OPENVAULT                                   │
│            ──────────────────                            │
│            Confidential Data Registry                    │
│                                                          │
│   Hugging Face + Kaggle, but the license token IS the    │
│   decryption credential. No auth server. No platform     │
│   that can revoke your access.                           │
│                                                          │
│                                                          │
│   Built on Story Protocol (Aeneid) + CDR + IPFS          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**HOOK (read aloud, 15s):**

> "Hugging Face hosts 1.4 million ML models. Every single one of them depends on Hugging Face staying alive, staying neutral, and not changing their terms tomorrow. Your access lives in their database — not in the data itself.
>
> What if access control was a property of the data?"

---

## Slide 2 — Problem (0:15–0:45)

**WHO:** ML researchers, dataset owners, AI startups who need to monetize or share confidential data.

**HOW BAD:**

| Pain | Today | Cost |
|---|---|---|
| Dataset re-distribution | Once downloaded, it's anyone's | Owners lose all leverage |
| License enforcement | "Sue them" | Unenforceable at scale |
| Confidential training | Send raw data to provider | Data sovereignty gone |
| Platform risk | HF can deplatform, change terms, get hacked | Single point of failure for ALL of AI |

**WHY NOT SOLVED?** Existing crypto-data tools either (a) gate the metadata, not the bytes, or (b) make you trust a single oracle/relayer.

**WHY NOW?** **CDR** (Confidential Data Registry) just shipped: threshold-encrypted storage where decryption is gated by an arbitrary on-chain condition. Combined with **Story Protocol's IP Asset + License Token primitives** (Aeneid testnet), the license token can literally be the decryption credential.

---

## Slide 3 — Solution (0:45–1:00)

**ONE-LINER:**

> **OpenVault is a decentralized Hugging Face where every dataset and model is a Story Protocol IP Asset, the bytes are threshold-encrypted on IPFS via CDR, and the access tier is enforced by a contract — not a server.**

**ARCHITECTURE (4 boxes):**

```
┌────────────────┐    ┌────────────────┐    ┌──────────────────┐
│   Story IP     │───▶│   CDR Vault    │───▶│   IPFS (Pinata)  │
│   Asset +      │    │   (threshold-  │    │   ciphertext     │
│   License NFT  │    │   encrypted)   │    │                  │
└────────────────┘    └───────┬────────┘    └──────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │  Custom Read Condition │
                  │  contracts (4 deployed │
                  │  on Aeneid)            │
                  └────────────────────────┘
```

**KEY INSIGHT:** *We didn't build an access-control server. We deployed **4 read-condition contracts** that turn license/owner/compute-allowlist checks into pure on-chain logic. The CDR precompile staticcalls them on every decrypt.*

The four conditions:

1. **`LicenseReadCondition`** (Story-deployed) — gates by license token id
2. **`OwnerReadCondition`** *(new — we shipped this)* — gates by EOA address
3. **`ComputeWorkerReadCondition`** *(new — we shipped this)* — gates by allowlisted compute-worker EOA → enables *"computable, not downloadable"*
4. **`GroupLicenseReadCondition`** *(new — we shipped this)* — composes per-member LicenseReadCondition → one license unlocks any group member

All four are deployed on Aeneid and verifiable on-chain.

---

## Slide 4 — LIVE DEMO (1:00–2:15) — MOST IMPORTANT

**Switch to browser at `localhost:3000`.**

### Demo Script (75s — see `DEMO_SCRIPT.md` for full timing)

1. **(0–10s) Browse.** Land on `/`. 5-tier filter strip (Public / Private / Gated / Compute / Group). 38 real artifacts indexed from Aeneid. Tier rails make tiers instantly readable. Click "Compute".

2. **(10–25s) Gated mint-to-unlock.** Navigate to `SentimentLLM-7B`. Click "Mint to unlock". The Privy embedded wallet auto-signs. A real license token mints on-chain. The CDR vault unlocks and the bytes decrypt client-side. *No server saw the plaintext.*

3. **(25–50s) Confidential compute (the WOW moment).** Navigate to `Confidential Numeric Rows (live)`. Click "Run confidential job". Watch the progress trail: allowlist check → decrypt + run. The worker decrypts inside its process, runs `mean-aggregate`, and returns `{columnMeans_0: 3, n: 5}` PLUS a real **derivative IP asset** registered on-chain (`resultIpId`). Royalties route upstream automatically.

   Then point at the **TEE-SIM disclosure strip**:
   > "Isolation: simulated enclave (TEE-SIM, sim-signature verified — NOT hardware-attested). The simulator exercises the same verification code path real attestation would take, but the signature is HMAC over a server-side secret — not chained to Intel's quoting enclave. Do not trust for production data."
   >
   > *That's the honesty layer. We never claim a TEE we don't have.*

4. **(50–65s) Provenance + on-chain royalty.** Navigate to the artifact detail. Show the Provenance sidebar: IP asset, register tx, license terms id, vault uuid, CID. Click any TxLink → opens Aeneid block explorer. The chain saw everything; the UI never lies about it.

5. **(65–75s) Dispute → counter.** Click Report → fill evidence → "Raise dispute" → real on-chain `disputeId` returns. Header shows `In dispute #N` with a pulsing dot. Click "Counter dispute" → fill counter-evidence → "Submit". The pulse stops; badge gains "· countered". Two real on-chain transactions in 10 seconds of demo.

**WOW MOMENT:** The compute job. *Same dataset that just refused to be downloaded by the consumer, ran an algorithm inside the worker and returned aggregates — with a verifiable derivative IP on-chain.* That's "computable, not downloadable" as a property of the data.

---

## Slide 5 — Impact + Scale (2:15–2:30)

**AT TODAY'S SCALE:**

- **12 of 13** backend flows verified on real Aeneid by `scripts/diag/full-suite.ts`
- **4 custom read-condition contracts** deployed and verifiable on-chain
- **Real CDR decrypts** measured at <2 seconds end-to-end on testnet
- **Three SDK bugs found + fixed** in core-sdk 1.4.4 during integration (we wrote 3 fixes back into the lib that anyone using Story + CDR will benefit from)

**AT HUGGING FACE SCALE (1.4M models):**

- Every model becomes its own IP Asset → on-chain provenance for the entire AI supply chain
- Every download is a license mint → instant, programmable royalties to dataset owners
- "Computable, not downloadable" → enables fine-tuning on copyrighted data WITHOUT transferring rights
- Disputes resolve at protocol speed, not platform speed

**TECHNICAL REASON THIS SCALES:**

CDR's threshold encryption + our read-condition pattern is O(1) per read — no per-user provisioning, no per-file ACL. Adding a new tier is one Solidity contract that implements `checkReadCondition`. The platform never grows in complexity.

---

## Slide 6 — Business Model (2:30–2:40)

Three on-chain revenue streams, all atomic with the access action:

1. **Mint fee** — every license mint pays a fee in WIP routed to the dataset owner (with auto-wrap of native IP).
2. **Royalty cascade** — derivatives pay royalties upstream via Story's RoyaltyModule; we verified this end-to-end with `payRoyalty + claimAllRevenue`.
3. **Compute fee** — compute jobs mint one compute-license per run; the worker charges the consumer's wallet, owner claims.

OpenVault itself takes nothing. The protocol monetizes the data owners; we provide the tooling. Optional future: a fee on the indexer/discovery layer.

---

## Slide 7 — The Ask (2:40–3:00)

We need **two specific things** to take this to production:

1. **A pilot dataset partner** — a real AI/ML team with confidential data they want to monetize. We deploy them on OpenVault in a week; they keep the on-chain royalties.

2. **A TEE infrastructure partner** — Gramine, Phala, AzureCC, or similar — so we can run the compute worker in a **real** attested enclave. The honest-disclosure architecture is already wired; flipping `WORKER_ISOLATION_MODE=enclave` is a one-line change once the runtime exists.

We are NOT asking for funding. We are asking for **distribution + verification**.

**Final line:**

> "Hugging Face is centralized infrastructure pretending to be a community. We built the community without the infrastructure. The license token is the access. The chain is the source of truth. The honest disclosure is non-negotiable. Thank you — and the demo's still running if you want to mint a license yourself."

---

## Speaker Notes

| Beat | Voice | Body |
|---|---|---|
| Hook | Calm, confident | One step toward judges. Direct eye contact. |
| Problem | Slightly faster | Use hands to count the four pains. |
| Solution | Slow down on "didn't build an access-control server" | Point at architecture diagram. |
| Demo | Drop voice into "look at this" mode | Stay at the laptop. Click slowly. Narrate every TxLink. |
| Scale | Back up | "1.4 million models" lands harder if you pause after. |
| Business | Quick | Don't dwell. |
| Ask | Look up. Direct. | End on "the demo's still running." |

---

## Drive Submission Checklist

- [x] `docs/PITCH.md` — this file
- [x] `docs/DEMO_SCRIPT.md` — see companion file
- [x] `HANDOFF.md` — current state, all flows verified, KNOWN ISSUES disclosed
- [x] `README.md` — setup instructions
- [x] Source code — github.com/freedanjeremiah/CDR-hackathon
- [x] Demo MP4 — `/tmp/openvault_demo.mp4` (84s, H.264, ready to upload)
- [x] Walkthrough GIF — `openvault-prd-e2e-final.gif` (42 frames)
- [x] Architecture diagram — embedded in this deck (Slide 3)
- [ ] Team photo — *to add*

## Common Mistakes — Avoid

- ❌ Don't start with "Hi we're team X" — start with the hook
- ❌ Don't read the slides — talk to the judges, the slides are visual aids
- ❌ Don't show 5 features quickly — show the compute flow beautifully
- ❌ Don't end with "thank you" — end with the ASK
- ✅ Have a backup video (`/tmp/openvault_demo.mp4`) in case the demo dies
- ✅ End with the chain explorer still on screen — let them see real tx hashes
