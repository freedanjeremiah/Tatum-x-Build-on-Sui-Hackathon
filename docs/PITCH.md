# Tessera — Hackathon Pitch Deck

**3-minute pitch, 7 slides, built for the Tatum x Walrus hackathon (Technical Implementation track).**

Tagline: *Access control as a property of the data, not the platform.*

---

## Slide 1 — Title + Hook (0:00–0:15)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│            ▣ TESSERA                                     │
│            ──────────────────                            │
│            Confidential Data Registry                    │
│                                                          │
│   Hugging Face + Kaggle, but the license IS the          │
│   decryption credential. No auth server. No platform     │
│   that can revoke your access.                           │
│                                                          │
│                                                          │
│   Built on Sui + Walrus + Seal + Tatum                   │
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

**WHY NOW?** **Seal** brings threshold IBE encryption whose key release is gated by an on-chain Move policy, and **Walrus** brings owner-controlled blob storage — both on **Sui**. The on-chain `seal_approve` check means the license you hold can literally be the decryption credential.

---

## Slide 3 — Solution (0:45–1:00)

**ONE-LINER:**

> **Tessera is a decentralized Hugging Face where every dataset and model is a Sui Move object, the bytes are threshold-encrypted with Seal and stored on Walrus, and the access tier is enforced by a Move policy — not a server.**

**ARCHITECTURE (4 boxes):**

```
┌────────────────┐    ┌────────────────┐    ┌──────────────────┐
│  Sui Move      │───▶│  Seal threshold│───▶│  Walrus blob     │
│  ArtifactReg-  │    │  encryption    │    │  (ciphertext,    │
│  istry object  │    │                │    │  owner-paid)     │
└────────────────┘    └───────┬────────┘    └──────────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │  seal_approve(id, reg) │
                  │  one Move gate, five   │
                  │  access tiers          │
                  └────────────────────────┘
```

**KEY INSIGHT:** *We didn't build an access-control server. We wrote one on-chain `seal_approve` Move function that turns license/owner/compute-allowlist checks into pure on-chain logic. Seal dry-runs it before releasing any key share — if the Move call aborts, the read is denied.*

The single gate covers five tiers in one function:

1. **public** — open branch (always allows)
2. **private-owner** — `sender == owner`
3. **gated-license** — `sender == owner || license_holders.contains(sender)`
4. **compute** — `compute_workers.contains(sender)` only → *"computable, not downloadable"*
5. **group** — group membership unlocks a family of artifacts

The identity is bound to the artifact's own object id (`sealId = artifactObjectId ++ blake2b256(tier)`), so each artifact's policy is isolated and forgery is impossible. RPC is routed through the **Tatum** Sui gateway.

---

## Slide 4 — LIVE DEMO (1:00–2:15) — MOST IMPORTANT

**Switch to browser at `localhost:3000`.**

### Demo Script (75s — see `DEMO_SCRIPT.md` for full timing)

1. **(0–10s) Browse.** Land on `/`. 5-tier filter strip (Public / Private / Gated / Compute / Group). Real artifacts indexed from Sui. Tier rails make tiers instantly readable. Click "Compute".

2. **(10–25s) Gated buy-to-unlock.** Navigate to `SentimentLLM-7B`. Click "Buy to unlock". The Privy embedded wallet signs. A real `buy_license` transaction lands on Sui and adds the buyer to `license_holders`. Seal releases the key shares and the bytes decrypt client-side. *No server saw the plaintext.*

3. **(25–50s) Confidential compute (the WOW moment).** Navigate to `Confidential Numeric Rows (live)`. Click "Run confidential job". Watch the progress trail: allowlist check → decrypt + run. The worker decrypts inside its process, runs `mean-aggregate`, and returns `{columnMeans_0: 3, n: 5}` PLUS a real **derivative** registered on-chain (`resultIpId`). Royalties route upstream automatically.

   Then point at the **TEE-SIM disclosure strip**:
   > "Isolation: simulated enclave (TEE-SIM, sim-signature verified — NOT hardware-attested). The simulator exercises the same verification code path real attestation would take, but the signature is HMAC over a server-side secret — not chained to Intel's quoting enclave. Do not trust for production data."
   >
   > *That's the honesty layer. We never claim a TEE we don't have.*

4. **(50–65s) Provenance + on-chain royalty.** Navigate to the artifact detail. Show the Provenance sidebar: registry object id, register tx, license reference, blob id. Click any TxLink → opens the Sui explorer. The chain saw everything; the UI never lies about it.

5. **(65–75s) Dispute → counter.** Click Report → fill evidence → "Raise dispute" → a real on-chain dispute flag is set. Header shows `In dispute #N` with a pulsing dot. Click "Counter dispute" → fill counter-evidence → "Submit". The pulse stops; badge gains "· countered". Two real on-chain transactions in 10 seconds of demo.

**WOW MOMENT:** The compute job. *Same dataset that just refused to be downloaded by the consumer, ran an algorithm inside the worker and returned aggregates — with a verifiable derivative on-chain.* That's "computable, not downloadable" as a property of the data.

---

## Slide 5 — Impact + Scale (2:15–2:30)

**AT TODAY'S SCALE:**

- Every backend flow verified on real Sui testnet by `scripts/diag/full-suite.ts`
- One `seal_approve` Move gate covering all five tiers, with 21 Move tests for the full access matrix
- **Real Seal decrypts** measured at <2 seconds end-to-end on testnet
- RPC hardened through the Tatum gateway (`x-api-key`, 429 backoff) with a public fullnode fallback

**AT HUGGING FACE SCALE (1.4M models):**

- Every model becomes its own Move object → on-chain provenance for the entire AI supply chain
- Every purchase is a license grant → instant, programmable royalties to dataset owners
- "Computable, not downloadable" → enables fine-tuning on copyrighted data WITHOUT transferring rights
- Disputes resolve at protocol speed, not platform speed

**TECHNICAL REASON THIS SCALES:**

Seal's threshold encryption + our single-gate policy is O(1) per read — no per-user provisioning, no per-file ACL. Adding a new tier is one branch in the Move function. The platform never grows in complexity.

---

## Slide 6 — Business Model (2:30–2:40)

Three on-chain revenue streams, all atomic with the access action:

1. **License fee** — every `buy_license` pays the artifact's `price` in SUI straight to the owner.
2. **Royalty cascade** — derivatives pay royalties upstream into each artifact's on-chain `Balance<SUI>` vault; we verified this end-to-end with `pay_royalty + claim_revenue`.
3. **Compute fee** — compute jobs charge a fee per run; the owner claims the accrued revenue.

Tessera itself takes nothing. The protocol monetizes the data owners; we provide the tooling. Optional future: a fee on the indexer/discovery layer.

---

## Slide 7 — The Ask (2:40–3:00)

We need **two specific things** to take this to production:

1. **A pilot dataset partner** — a real AI/ML team with confidential data they want to monetize. We deploy them on Tessera in a week; they keep the on-chain royalties.

2. **A TEE infrastructure partner** — Gramine, Phala, AzureCC, or similar — so we can run the compute worker in a **real** attested enclave. The honest-disclosure architecture is already wired; flipping `WORKER_ISOLATION_MODE=enclave` is a one-line change once the runtime exists.

We are NOT asking for funding. We are asking for **distribution + verification**.

**Final line:**

> "Hugging Face is centralized infrastructure pretending to be a community. We built the community without the infrastructure. The license is the access. The chain is the source of truth. The honest disclosure is non-negotiable. Thank you — and the demo's still running if you want to buy a license yourself."

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

## Submission Checklist

- [x] `docs/PITCH.md` — this file
- [x] `docs/DEMO_SCRIPT.md` — see companion file
- [x] `README.md` — setup instructions
- [x] Source code
- [x] Demo MP4 — recorded walkthrough, ready to upload
- [x] Architecture diagram — embedded in this deck (Slide 3)
- [ ] Team photo — *to add*

## Common Mistakes — Avoid

- ❌ Don't start with "Hi we're team X" — start with the hook
- ❌ Don't read the slides — talk to the judges, the slides are visual aids
- ❌ Don't show 5 features quickly — show the compute flow beautifully
- ❌ Don't end with "thank you" — end with the ASK
- ✅ Have a backup video in case the demo dies
- ✅ End with the chain explorer still on screen — let them see real tx hashes
