# Reef — Live Demo Script

**Total time: 75 seconds (slide 4 of the pitch).**

This script drives the **production** build (`pnpm build && pnpm start`) with `WORKER_ISOLATION_MODE=enclave-sim` so the TEE-SIM honest disclosure is visible on camera. The Playwright recording in `scripts/demo/record-demo.py` follows this same beat list.

---

## Before you go on stage

1. **Production server running.**
   ```bash
   rm -rf .next
   WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret pnpm build
   WORKER_ISOLATION_MODE=enclave-sim WORKER_SIM_KEY=demo-secret pnpm start &
   ```
   Wait until `http://localhost:3000/api/runtime` returns `{"workerIsolation":"enclave-sim", ...}`.

2. **Privy login session warm.** Use a real browser (`prep-login.py`) to complete the OTP login first. The persistent profile keeps you connected.

3. **Privy wallet funded.**
   ```bash
   pnpm real scripts/demo/fund-privy-wallet.ts 0xYOUR_PRIVY_ADDRESS 4
   ```

4. **Backup video ready.** The recorded walkthrough is your fallback. If anything dies on stage, switch to the MP4.

5. **Browser tabs already open:**
   - Tab 1: `http://localhost:3000/` (Browse — Compute filter pre-selected)
   - Tab 2: `https://suiscan.xyz/testnet/` (Sui explorer, ready for TxLink clicks)

6. **Network OK.** Test the on-chain tx flow once 5 minutes before stage. The Sui testnet has occasional RPC lag; the Tatum gateway smooths most of it.

---

## Beat sheet (75 seconds)

### Beat 1 — Browse + tier filter (0:00–0:10)

**Click:** Compute filter chip.

**Say (10 sec):**
> "Every artifact here is a Sui Move object. The 5 tiers — Public, Private, Gated, Group, Compute — are enforced by **one on-chain `seal_approve` Move policy**. The compute filter shows datasets that are computable but never downloadable. Watch why that matters."

**What the audience sees:**
- The cream paper background, halftone grid
- 5 tier chips (with tier glyph + label, not just color)
- Real artifacts indexed from Sui
- Each card has a 3px tier rail on the left edge

### Beat 2 — Click into gated artifact (0:10–0:15)

**Click:** "SentimentLLM-7B" title.

**Say (5 sec):**
> "Gated tier. Hugging Face's basic version of paywalled models — but here the paywall **is the encryption**."

### Beat 3 — Buy to unlock (0:15–0:35)

**Click:** "Buy to unlock" button.

**Wait ~22 seconds for the on-chain license purchase + Seal decrypt to complete.** Talk through it:

**Say while waiting (20 sec):**
> "The Privy embedded wallet just signed a `buy_license` transaction. The price in SUI went straight to the owner, and my address was added to the artifact's `license_holders` set on-chain. Now Seal dry-runs `seal_approve`, sees I'm a holder, releases the key shares, and threshold-decryption happens *in the browser*.
>
> The server never touched the plaintext. The Hugging Face model card flow we all know — but the license literally **is** the access key."

**What the audience sees:**
- Wallet pill shows `0x4d29…6A` in the header
- DecryptProgress component pulses
- After ~22s: browser auto-downloads the decrypted bytes as `sentimentllm-7b.bin`

### Beat 4 — Compute the WOW moment (0:35–1:05)

**Navigate to:** `http://localhost:3000/compute/0x934A141E7A529AA0a543B7b06950DE3e3520C5aA`

**Point at the Isolation strip BEFORE clicking anything (5 sec):**
> "Look at this disclosure. The UI tells you, before you do anything, that this worker is running in a **simulated** enclave. Not a real one. If we ran it in real attested hardware, the strip would say so. We refuse to lie about a TEE we don't have."

**Click:** Mean aggregate radio → "Run confidential job".

**Wait ~25 seconds. Narrate the progress trail.**

**Say while waiting (25 sec):**
> "Watch the progress trail. The worker generates a structurally-valid SGX quote, verifies it against the configured expected measurements, then — and only then — runs the Seal-gated decrypt. The `compute` branch of `seal_approve` checks the caller is on the artifact's `compute_workers` allowlist. A *consumer's* wallet would abort here. The worker's wallet passes. The bytes decrypt inside the worker process, the mean-aggregate algorithm runs, and a real derivative gets registered on-chain.
>
> Notice what we just returned: `{columnMeans_0: 3, n: 5}`. Aggregates only. No raw rows. The data physically never left the worker."

**Point at the result panel:**
> "Real `resultIpId`. Real `resultTx`. Click the TxLink and you'll see the derivative on the Sui explorer with the correct parent pointer for royalty routing."

### Beat 5 — Provenance + Royalty (1:05–1:15)

**Navigate back to the gated artifact detail page.**

**Point at the Provenance sidebar:**
> "Every artifact view surfaces — without hiding behind a tooltip — the registry object id, the register transaction, the license reference, the Walrus blob id. The chain saw everything. We never hide it."

**Click the registry-object TxLink → opens the Sui explorer.**

> "There. That's the chain's truth. The UI is honest about it."

### Beat 6 — Dispute → Counter (1:15–1:25)

**Switch back to the artifact tab. Click "Report".**

**Type evidence quickly:** `Infringes my upstream work.`

**Click "Raise dispute". Wait 22 sec.**

**Say (5 sec while waiting):**
> "A real dispute flag is set on-chain and a `Disputed` event is emitted. The arbitration reviewer gets 30 days. The target — me — can counter."

**Click "Done", then "Counter dispute". Fill counter-evidence:** `Provenance clean.`

**Click "Submit counter-evidence". Show the badge updating:**
> "Two on-chain transactions in 10 seconds. The chain is the arbiter. Not a moderator."

### Beat 7 — Land the close (1:25–1:30)

**Don't navigate.** Leave the artifact detail page on screen with the In dispute · countered badge.

**Say (5 sec, full eye contact with judges):**
> "The license IS the access key. Compute happens in attested-or-honestly-not-attested isolation. Every transaction is on Sui. The Hugging Face flow, but the chain enforces what the platform used to."

---

## Anticipated questions

| Q | A |
|---|---|
| "Why Seal vs Lit Protocol / client-side encryption / Filecoin?" | Seal's threshold IBE + an arbitrary on-chain `seal_approve` policy is the *exact* shape we needed. The condition is a Move function — we wrote one that covers all five tiers. |
| "Is the worker really trusted?" | No, and we say so on every compute screen. Production needs attested SGX/TDX. The TEE-SIM mode proves the verification code path works; it does NOT claim hardware attestation. |
| "What about decryption revocation?" | Seal cannot revoke a granted credential. Rotate by re-encrypting. We disclose this in the footer on every page. |
| "How does the group tier work?" | The `group` branch of `seal_approve` admits the owner or any address in the artifact's `license_holders`. Today each member is gated per-artifact; a single-identity group unlock is future work. |
| "Token economics?" | License fees + royalty cascade + compute fees. All on-chain in SUI. Reef takes nothing. |
| "Is it production-ready?" | Backend: integration tests pass on real Sui testnet. UI: PRD-compliant per audit. TEE: simulated. The browser write-signer is the one disclosed gap; server signing works today. |

---

## Failure protocols

| If this dies on stage | Do this |
|---|---|
| Dev server not responding | Switch to the backup MP4 |
| Privy login expired | Switch to backup video |
| Compute job aborts | Already prepared — say *"sometimes the testnet RPC is slow — here's what success looks like"* + switch to backup |
| TxLink broken | Show the per-step screenshot from the recording |
| All of the above | Talk through Slide 3 (architecture). The honest-disclosure philosophy lands even without the demo. |

---

## Post-demo CTA (after Q&A)

> "Code is on GitHub. The `seal_approve` Move policy is verifiable on Sui right now — `cd move && sui move test` runs the full access matrix. Full integration suite at `scripts/diag/full-suite.ts` — `pnpm real` it yourself. Every flow runs end-to-end on the live testnet."
